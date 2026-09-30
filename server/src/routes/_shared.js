/** Helpers shared across route modules. */

import { q, fromJson } from '../db/index.js';
import { can, mfaRequiredRoles } from '../middleware/auth.js';
import { domainName, DOMAIN_META } from '../knowledge/index.js';
import { DOC_TYPE_LABEL } from '../services/generator.js';

export const STATUS_LABEL = {
  draft: 'Draft', under_review: 'Under Review', approved: 'Approved',
  published: 'Published', under_revision: 'Under Revision', retired: 'Retired'
};

export const PROVENANCE_LABEL = {
  regulatory_requirement: 'Regulatory requirement',
  framework_guidance: 'Framework guidance',
  organizational_policy: 'Organisational policy',
  organizational_standard: 'Organisational standard',
  procedure: 'Procedure',
  implementation_guidance: 'Implementation guidance',
  ai_recommendation: 'AI-generated recommendation',
  user_input: 'User input',
  uploaded_source: 'Uploaded source'
};

const userCache = () => {
  const rows = q.all('SELECT id, name, email, role, job_title FROM users');
  return Object.fromEntries(rows.map((u) => [u.id, u]));
};

/** Decorate a document row with labels and related names for the client. */
export function enrichDocument(doc, users = userCache()) {
  if (!doc) return null;
  return {
    ...doc,
    domain_label: domainName(doc.domain_key),
    doc_type_label: DOC_TYPE_LABEL[doc.doc_type] || doc.doc_type,
    status_label: STATUS_LABEL[doc.status] || doc.status,
    owner_name: users[doc.owner_id]?.name || null,
    owner_title: users[doc.owner_id]?.job_title || null,
    approver_name: users[doc.approver_id]?.name || null,
    reviewer_name: users[doc.reviewer_id]?.name || null,
    generation_meta: fromJson(doc.generation_meta, null),
    provenance_label: PROVENANCE_LABEL[doc.provenance] || doc.provenance
  };
}

export function enrichDocuments(rows) {
  const users = userCache();
  return rows.map((d) => enrichDocument(d, users));
}

export function enrichControl(row) {
  if (!row) return null;
  const mappings = q.all(
    `SELECT cm.*, fr.ref, fr.title AS requirement_title, f.code AS framework_code, f.name AS framework_name
       FROM control_mappings cm
       JOIN framework_requirements fr ON fr.id = cm.requirement_id
       JOIN frameworks f ON f.id = fr.framework_id
      WHERE cm.control_id = ?
      ORDER BY f.code, fr.ref`,
    row.id
  );
  const evidence = q.all('SELECT * FROM evidence WHERE control_id = ? ORDER BY evidence_id', row.id);
  return { ...row, domain_label: domainName(row.domain_key), mappings, evidence };
}

export function getOrgProfile() {
  const row = q.get('SELECT * FROM org_profile WHERE id = 1');
  if (!row) return { org_name: 'Your Organisation', applicable_frameworks: null };
  return {
    ...row,
    regulators: fromJson(row.regulators, []),
    technology_env: fromJson(row.technology_env, []),
    data_classifications: fromJson(row.data_classifications, []),
    // Null and empty mean different things here. Null is "nobody has said which
    // frameworks apply", which is what sends a new installation through setup;
    // an empty list is a decision that none do, and generates documents with no
    // framework traceability rather than stopping to ask again.
    applicable_frameworks: row.applicable_frameworks === null || row.applicable_frameworks === undefined
      ? null
      : fromJson(row.applicable_frameworks, []),
    mfa_required_roles: mfaRequiredRoles()
  };
}

/**
 * The framework codes a generated package cites.
 *
 * Taken from the organisation profile rather than from the request: which
 * authoritative sources an organisation is subject to is a fact about the
 * organisation, not a choice to be made again on every document. Made per
 * package it drifted — two policies in the same library could cite different
 * source sets with nothing recording why.
 */
export function applicableFrameworkCodes() {
  const codes = getOrgProfile().applicable_frameworks;
  if (!Array.isArray(codes) || !codes.length) return [];
  const known = new Set(q.all('SELECT code FROM frameworks').map((f) => f.code));
  return codes.filter((code) => known.has(code));
}

export function domainOptions() {
  return DOMAIN_META.map((d) => ({ ...d, documents: q.get('SELECT COUNT(*) AS n FROM documents WHERE domain_key = ?', d.key).n }));
}

/** Parse comma-separated query parameters into a clean array. */
export function listParam(value) {
  if (!value) return [];
  return String(value).split(',').map((x) => x.trim()).filter(Boolean);
}

export function paginate(req, defaultLimit = 50, maxLimit = 500) {
  const limit = Math.min(Math.max(Number(req.query.limit) || defaultLimit, 1), maxLimit);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  return { limit, offset };
}

/**
 * The My Work queue: everything outstanding for one person, derived from live
 * state rather than from the notification table, so resolving the work clears
 * the queue whether or not the notification was ever read. The dashboard reads
 * the same function for its sidebar count, so the two cannot disagree.
 */
export function buildMyWork(user) {
  const me = user.id;
  const today = new Date().toISOString().slice(0, 10);
  const groups = [];

  // 1. Lifecycle actions available to this person right now.
  if (can(user.role, 'document:approve')) {
    // Segregation of duties excludes documents this person owns, so the queue
    // never offers an action the transition route would refuse.
    const rows = q.all(
      `SELECT * FROM documents
        WHERE status = 'under_review' AND (owner_id IS NULL OR owner_id != ?)
        ORDER BY updated_at DESC LIMIT 50`,
      me
    );
    groups.push({
      key: 'awaiting_approval',
      label: 'Awaiting your approval',
      help: 'Submitted for approval. A document you own yourself is not listed: it has to be approved by someone else.',
      action: 'Approve',
      documents: enrichDocuments(rows)
    });
  }

  if (can(user.role, 'document:publish')) {
    const rows = q.all("SELECT * FROM documents WHERE status = 'approved' ORDER BY updated_at DESC LIMIT 50");
    groups.push({
      key: 'ready_to_publish',
      label: 'Approved and ready to publish',
      help: 'Approved but not yet effective.',
      action: 'Publish',
      documents: enrichDocuments(rows)
    });
  }

  if (can(user.role, 'document:review')) {
    const rows = q.all(
      "SELECT * FROM documents WHERE status = 'under_review' AND reviewer_id = ? ORDER BY updated_at DESC LIMIT 50",
      me
    );
    if (rows.length) {
      groups.push({
        key: 'named_reviewer',
        label: 'You are the named reviewer',
        help: 'These name you specifically, rather than your role.',
        action: 'Review',
        documents: enrichDocuments(rows)
      });
    }
  }

  // 2. Documents this person owns that have fallen due.
  const reviewDue = q.all(
    `SELECT * FROM documents
      WHERE owner_id = ? AND review_date IS NOT NULL AND status NOT IN ('retired','draft')
        AND review_date <= date('now','+30 day')
      ORDER BY review_date LIMIT 50`,
    me
  );
  groups.push({
    key: 'review_due',
    label: 'Your documents due for review',
    help: 'A published document past its review date is a finding in most audits.',
    action: 'Open',
    documents: enrichDocuments(reviewDue).map((d) => ({ ...d, overdue: d.review_date < today }))
  });

  // 3. Drafts this person owns and has not submitted.
  if (can(user.role, 'document:submit')) {
    const drafts = q.all(
      "SELECT * FROM documents WHERE owner_id = ? AND status IN ('draft','under_revision') ORDER BY updated_at DESC LIMIT 50",
      me
    );
    groups.push({
      key: 'your_drafts',
      label: 'Your drafts',
      help: 'Not yet submitted for approval.',
      action: 'Open',
      documents: enrichDocuments(drafts)
    });
  }

  // 4. Evidence this person may verify, minus anything they collected.
  const evidence = can(user.role, 'evidence:verify')
    ? q.all(
      `SELECT f.id AS file_id, f.filename, f.collected_at, f.period,
              e.id AS evidence_row, e.evidence_id, e.name, u.name AS collected_by
         FROM evidence_files f
         JOIN evidence e ON e.id = f.evidence_id
         LEFT JOIN users u ON u.id = f.uploaded_by
        WHERE f.verified_at IS NULL AND (f.uploaded_by IS NULL OR f.uploaded_by != ?)
        ORDER BY f.collected_at LIMIT 50`,
      me
    )
    : [];

  // 5. Open findings on documents this person owns.
  const findings = q.all(
    `SELECT f.id, f.title, f.severity, f.category, f.status, f.created_at,
            d.id AS document_id, d.reference, d.title AS document_title
       FROM findings f
       JOIN documents d ON d.id = f.scope_id
      WHERE f.scope_type = 'document' AND d.owner_id = ? AND f.status IN ('open','acknowledged')
      ORDER BY CASE f.severity
                 WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2
                 WHEN 'low' THEN 3 ELSE 4 END, f.created_at DESC
      LIMIT 50`,
    me
  );

  // 6. Comments by other people on documents this person is accountable for.
  const comments = q.all(
    `SELECT c.id, c.body, c.created_at, c.author_name,
            d.id AS document_id, d.reference, d.title AS document_title
       FROM comments c
       JOIN documents d ON d.id = c.document_id
      WHERE c.resolved = 0
        AND c.author_id != ?
        AND (d.owner_id = ? OR d.approver_id = ? OR d.reviewer_id = ?)
      ORDER BY c.created_at DESC LIMIT 50`,
    me, me, me, me
  );

  const documentCount = groups.reduce((total, g) => total + g.documents.length, 0);
  return {
    groups: groups.filter((g) => g.documents.length),
    evidence,
    findings,
    comments,
    total: documentCount + evidence.length + findings.length + comments.length,
    emptyBecauseNothingAssigned: documentCount + evidence.length + findings.length + comments.length === 0
  };
}
