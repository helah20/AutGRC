/** Helpers shared across route modules. */

import { q, fromJson } from '../db/index.js';
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
  if (!row) return { org_name: 'Your Organisation' };
  return {
    ...row,
    regulators: fromJson(row.regulators, []),
    technology_env: fromJson(row.technology_env, []),
    data_classifications: fromJson(row.data_classifications, [])
  };
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
