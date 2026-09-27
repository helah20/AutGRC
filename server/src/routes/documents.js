/** Document library: CRUD, sections, lifecycle, versions, comments, links. */

import express from 'express';
import { z } from 'zod';
import { db, q, nowIso, toJson, fromJson } from '../db/index.js';
import { id } from '../utils/ids.js';
import { authenticate, requirePermission, audit, can } from '../middleware/auth.js';
import { asyncHandler, validate, HttpError, notFound } from '../middleware/errors.js';
import { sanitiseHtml, htmlToText } from '../services/html.js';
import { indexDocument, removeFromIndex } from '../services/search.js';
import { notifyTransition, notifyComment } from '../services/notify.js';
import { enrichDocument, enrichDocuments, listParam, paginate, STATUS_LABEL } from './_shared.js';
import { DOC_TYPE_LABEL, DOC_TYPE_PREFIX } from '../services/generator.js';
import { domainName, domainShort } from '../knowledge/index.js';
import { padNumber } from '../utils/ids.js';

const router = express.Router();
router.use(authenticate);

/** Permitted lifecycle transitions and the permission each one needs. */
const TRANSITIONS = {
  draft: { under_review: 'document:submit', retired: 'document:retire' },
  under_review: { approved: 'document:approve', draft: 'document:review', retired: 'document:retire' },
  approved: { published: 'document:publish', under_review: 'document:review', retired: 'document:retire' },
  published: { under_revision: 'document:update', retired: 'document:retire' },
  under_revision: { under_review: 'document:submit', published: 'document:publish', retired: 'document:retire' },
  retired: { draft: 'document:update' }
};

const TRANSITION_ACTION = {
  under_review: 'submitted', approved: 'approved', published: 'published',
  under_revision: 'reopened', retired: 'retired', draft: 'returned'
};

function loadSections(documentId, { includeInternal = false } = {}) {
  const rows = q.all('SELECT * FROM document_sections WHERE document_id = ? ORDER BY position', documentId);
  return rows
    .filter((s) => includeInternal || !s.section_key.startsWith('_'))
    .map((s) => ({ ...s, source_refs: fromJson(s.source_refs, []) }));
}

function snapshot(documentId) {
  const doc = q.get('SELECT * FROM documents WHERE id = ?', documentId);
  return { document: doc, sections: loadSections(documentId, { includeInternal: true }) };
}

/** Bump 0.x during drafting, whole numbers on publication. */
function nextVersion(current, major) {
  const [maj, min] = String(current || '0.1').split('.').map(Number);
  return major ? `${(maj || 0) + 1}.0` : `${maj || 0}.${(min || 0) + 1}`;
}

function recordVersion(documentId, { version, note, type, user }) {
  q.run(
    `INSERT INTO document_versions (id, document_id, version, snapshot, change_note, change_type, author_id, author_name, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    id('ver'), documentId, version, toJson(snapshot(documentId)), note, type,
    user?.id || null, user?.name || 'System', nowIso()
  );
}

// ------------------------------------------------------------------ list ---

router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset } = paginate(req, 100, 1000);
  const filters = [];
  const args = [];

  for (const [column, value] of [
    ['doc_type', listParam(req.query.type)],
    ['domain_key', listParam(req.query.domain)],
    ['status', listParam(req.query.status)],
    ['classification', listParam(req.query.classification)]
  ]) {
    if (value.length) {
      filters.push(`${column} IN (${value.map(() => '?').join(',')})`);
      args.push(...value);
    }
  }
  if (req.query.owner) { filters.push('owner_id = ?'); args.push(req.query.owner); }
  if (req.query.package) { filters.push('package_id = ?'); args.push(req.query.package); }
  if (req.query.search) {
    filters.push('(title LIKE ? OR reference LIKE ? OR summary LIKE ?)');
    const like = `%${req.query.search}%`;
    args.push(like, like, like);
  }
  if (req.query.reviewDue === 'true') {
    filters.push("review_date IS NOT NULL AND review_date <= date('now','+60 day') AND status != 'retired'");
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const sortable = { updated_at: 'updated_at', created_at: 'created_at', title: 'title', reference: 'reference', review_date: 'review_date', status: 'status' };
  const sort = sortable[req.query.sort] || 'updated_at';
  const dir = req.query.dir === 'asc' ? 'ASC' : 'DESC';

  const total = q.get(`SELECT COUNT(*) AS n FROM documents ${where}`, ...args).n;
  const rows = q.all(`SELECT * FROM documents ${where} ORDER BY ${sort} ${dir} LIMIT ? OFFSET ?`, ...args, limit, offset);
  res.json({ total, limit, offset, items: enrichDocuments(rows) });
}));

router.get('/meta/options', asyncHandler(async (req, res) => {
  res.json({
    types: Object.entries(DOC_TYPE_LABEL).map(([value, label]) => ({ value, label })),
    statuses: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
    classifications: ['public', 'internal', 'confidential', 'secret', 'top_secret'].map((v) => ({ value: v, label: v.replace('_', ' ') })),
    counts: {
      byType: q.all('SELECT doc_type, COUNT(*) AS n FROM documents GROUP BY doc_type'),
      byStatus: q.all('SELECT status, COUNT(*) AS n FROM documents GROUP BY status'),
      byDomain: q.all('SELECT domain_key, COUNT(*) AS n FROM documents GROUP BY domain_key')
    }
  });
}));

// --------------------------------------------------------------- detail ---

router.get('/:id', asyncHandler(async (req, res) => {
  const doc = q.get('SELECT * FROM documents WHERE id = ?', req.params.id);
  if (!doc) throw notFound('Document');

  const internal = q.all("SELECT * FROM document_sections WHERE document_id = ? AND section_key = '_flow'", doc.id);
  const flow = internal.length ? fromJson(internal[0].body, null) : null;

  const links = q.all(
    `SELECT dl.*, d.reference, d.title, d.doc_type, d.status
       FROM document_links dl JOIN documents d ON d.id = dl.to_id
      WHERE dl.from_id = ?`, doc.id
  );
  const backlinks = q.all(
    `SELECT dl.*, d.reference, d.title, d.doc_type, d.status
       FROM document_links dl JOIN documents d ON d.id = dl.from_id
      WHERE dl.to_id = ?`, doc.id
  );

  res.json({
    document: enrichDocument(doc),
    sections: loadSections(doc.id),
    flow,
    links,
    backlinks,
    versions: q.all('SELECT id, version, change_note, change_type, author_name, created_at FROM document_versions WHERE document_id = ? ORDER BY created_at DESC', doc.id),
    approvals: q.all('SELECT * FROM document_approvals WHERE document_id = ? ORDER BY created_at DESC', doc.id),
    comments: q.all('SELECT * FROM comments WHERE document_id = ? ORDER BY created_at DESC', doc.id),
    controls: q.all('SELECT id, control_id, name, control_type, risk_rating FROM controls WHERE policy_id = ? OR standard_id = ? OR procedure_id = ?', doc.id, doc.id, doc.id),
    findings: q.all("SELECT * FROM findings WHERE scope_type = 'document' AND scope_id = ? AND status = 'open' ORDER BY created_at DESC", doc.id)
  });
}));

// --------------------------------------------------------------- create ---

const createSchema = z.object({
  title: z.string().min(3).max(250),
  doc_type: z.enum(['policy', 'standard', 'procedure', 'guideline', 'framework', 'roles', 'raci', 'control_matrix', 'work_instruction']),
  domain_key: z.string().min(2),
  classification: z.enum(['public', 'internal', 'confidential', 'secret', 'top_secret']).default('internal'),
  summary: z.string().max(2000).optional(),
  owner_id: z.string().nullable().optional(),
  approver_id: z.string().nullable().optional(),
  parent_id: z.string().nullable().optional(),
  sections: z.array(z.object({
    section_key: z.string().min(1).max(60),
    heading: z.string().min(1).max(200),
    body: z.string().max(200000).default('')
  })).optional()
});

router.post('/', requirePermission('document:create'), validate(createSchema), asyncHandler(async (req, res) => {
  const body = req.body;
  const at = nowIso();
  const prefix = `${DOC_TYPE_PREFIX[body.doc_type] || 'DOC'}-${domainShort(body.domain_key)}-`;
  const existing = q.all('SELECT reference FROM documents WHERE reference LIKE ?', `${prefix}%`);
  const next = existing.reduce((max, r) => Math.max(max, Number(String(r.reference).slice(prefix.length)) || 0), 0) + 1;
  const reference = `${prefix}${padNumber(next)}`;
  const docId = id('doc');

  db.transaction(() => {
    q.run(
      `INSERT INTO documents (id, reference, title, doc_type, domain_key, status, classification, version,
         owner_id, approver_id, parent_id, summary, review_date, provenance, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      docId, reference, body.title, body.doc_type, body.domain_key, 'draft', body.classification, '0.1',
      body.owner_id || req.user.id, body.approver_id || null, body.parent_id || null, body.summary || null,
      new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      'organizational_policy', req.user.id, at, at
    );
    (body.sections || [{ section_key: 'purpose', heading: 'Purpose', body: '' }]).forEach((s, i) => {
      q.run(
        `INSERT INTO document_sections (id, document_id, section_key, heading, body, position, provenance, source_refs, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        id('sec'), docId, s.section_key, s.heading, sanitiseHtml(s.body), i, 'user_input', toJson([]), at, at
      );
    });
    recordVersion(docId, { version: '0.1', note: 'Document created', type: 'created', user: req.user });
  })();

  const doc = q.get('SELECT * FROM documents WHERE id = ?', docId);
  indexDocument(doc, loadSections(docId));
  audit(req, { action: 'document:create', entityType: 'document', entityId: docId, summary: `Created ${reference} — ${body.title}` });
  res.status(201).json({ document: enrichDocument(doc), sections: loadSections(docId) });
}));

// --------------------------------------------------------------- update ---

const updateSchema = z.object({
  title: z.string().min(3).max(250).optional(),
  summary: z.string().max(2000).nullable().optional(),
  classification: z.enum(['public', 'internal', 'confidential', 'secret', 'top_secret']).optional(),
  owner_id: z.string().nullable().optional(),
  approver_id: z.string().nullable().optional(),
  reviewer_id: z.string().nullable().optional(),
  effective_date: z.string().nullable().optional(),
  review_date: z.string().nullable().optional()
});

router.patch('/:id', requirePermission('document:update'), validate(updateSchema), asyncHandler(async (req, res) => {
  const doc = q.get('SELECT * FROM documents WHERE id = ?', req.params.id);
  if (!doc) throw notFound('Document');
  if (doc.status === 'published' && !can(req.user.role, 'document:publish')) {
    throw new HttpError(409, 'This document is published. Move it to Under Revision before editing.');
  }

  const fields = Object.entries(req.body).filter(([, v]) => v !== undefined);
  if (!fields.length) return res.json({ document: enrichDocument(doc) });

  q.run(
    `UPDATE documents SET ${fields.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
    ...fields.map(([, v]) => v), nowIso(), doc.id
  );
  const updated = q.get('SELECT * FROM documents WHERE id = ?', doc.id);
  indexDocument(updated, loadSections(doc.id));
  audit(req, {
    action: 'document:update', entityType: 'document', entityId: doc.id,
    summary: `Updated ${doc.reference}`, detail: Object.fromEntries(fields)
  });
  res.json({ document: enrichDocument(updated) });
}));

router.delete('/:id', requirePermission('document:delete'), asyncHandler(async (req, res) => {
  const doc = q.get('SELECT * FROM documents WHERE id = ?', req.params.id);
  if (!doc) throw notFound('Document');
  if (doc.status === 'published') {
    throw new HttpError(409, 'Published documents cannot be deleted. Retire the document instead so the record is preserved.');
  }
  q.run('DELETE FROM documents WHERE id = ?', doc.id);
  removeFromIndex('document', doc.id);
  audit(req, { action: 'document:delete', entityType: 'document', entityId: doc.id, summary: `Deleted ${doc.reference} — ${doc.title}` });
  res.json({ ok: true });
}));

// ------------------------------------------------------------- sections ---

const sectionSchema = z.object({
  heading: z.string().min(1).max(200).optional(),
  body: z.string().max(400000).optional(),
  provenance: z.string().max(60).optional()
});

router.put('/:id/sections/:sectionId', requirePermission('document:update'), validate(sectionSchema), asyncHandler(async (req, res) => {
  const doc = q.get('SELECT * FROM documents WHERE id = ?', req.params.id);
  if (!doc) throw notFound('Document');
  const section = q.get('SELECT * FROM document_sections WHERE id = ? AND document_id = ?', req.params.sectionId, doc.id);
  if (!section) throw notFound('Section');
  if (section.locked) throw new HttpError(409, 'This section is locked and cannot be edited.');
  if (doc.status === 'published') throw new HttpError(409, 'Move the document to Under Revision before editing its content.');

  const heading = req.body.heading ?? section.heading;
  const body = req.body.body !== undefined ? sanitiseHtml(req.body.body) : section.body;
  // A human edit changes the provenance: it is no longer purely generated.
  const provenance = req.body.provenance
    ?? (req.body.body !== undefined && section.provenance === 'ai_recommendation' ? 'user_input' : section.provenance);

  q.run(
    'UPDATE document_sections SET heading = ?, body = ?, provenance = ?, updated_at = ? WHERE id = ?',
    heading, body, provenance, nowIso(), section.id
  );
  q.run('UPDATE documents SET updated_at = ? WHERE id = ?', nowIso(), doc.id);
  indexDocument(doc, loadSections(doc.id));
  audit(req, { action: 'section:update', entityType: 'document', entityId: doc.id, summary: `Edited "${heading}" in ${doc.reference}` });

  res.json({ section: { ...q.get('SELECT * FROM document_sections WHERE id = ?', section.id), source_refs: fromJson(section.source_refs, []) } });
}));

router.post('/:id/sections', requirePermission('document:update'), validate(z.object({
  section_key: z.string().min(1).max(60),
  heading: z.string().min(1).max(200),
  body: z.string().max(400000).default(''),
  position: z.number().int().optional()
})), asyncHandler(async (req, res) => {
  const doc = q.get('SELECT * FROM documents WHERE id = ?', req.params.id);
  if (!doc) throw notFound('Document');
  const max = q.get('SELECT COALESCE(MAX(position), -1) AS p FROM document_sections WHERE document_id = ? AND position < 900', doc.id).p;
  const at = nowIso();
  const sectionId = id('sec');
  q.run(
    `INSERT INTO document_sections (id, document_id, section_key, heading, body, position, provenance, source_refs, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    sectionId, doc.id, req.body.section_key, req.body.heading, sanitiseHtml(req.body.body),
    req.body.position ?? max + 1, 'user_input', toJson([]), at, at
  );
  q.run('UPDATE documents SET updated_at = ? WHERE id = ?', at, doc.id);
  indexDocument(doc, loadSections(doc.id));
  audit(req, { action: 'section:create', entityType: 'document', entityId: doc.id, summary: `Added section "${req.body.heading}" to ${doc.reference}` });
  res.status(201).json({ section: q.get('SELECT * FROM document_sections WHERE id = ?', sectionId) });
}));

router.delete('/:id/sections/:sectionId', requirePermission('document:update'), asyncHandler(async (req, res) => {
  const section = q.get('SELECT * FROM document_sections WHERE id = ? AND document_id = ?', req.params.sectionId, req.params.id);
  if (!section) throw notFound('Section');
  if (section.locked) throw new HttpError(409, 'This section is locked and cannot be removed.');
  q.run('DELETE FROM document_sections WHERE id = ?', section.id);
  const doc = q.get('SELECT * FROM documents WHERE id = ?', req.params.id);
  indexDocument(doc, loadSections(doc.id));
  audit(req, { action: 'section:delete', entityType: 'document', entityId: doc.id, summary: `Removed section "${section.heading}" from ${doc.reference}` });
  res.json({ ok: true });
}));

router.post('/:id/sections/reorder', requirePermission('document:update'), validate(z.object({ order: z.array(z.string()) })), asyncHandler(async (req, res) => {
  const doc = q.get('SELECT * FROM documents WHERE id = ?', req.params.id);
  if (!doc) throw notFound('Document');
  db.transaction(() => {
    req.body.order.forEach((sectionId, i) => {
      q.run('UPDATE document_sections SET position = ? WHERE id = ? AND document_id = ?', i, sectionId, doc.id);
    });
  })();
  audit(req, { action: 'section:reorder', entityType: 'document', entityId: doc.id, summary: `Reordered sections in ${doc.reference}` });
  res.json({ sections: loadSections(doc.id) });
}));

// ------------------------------------------------------------ lifecycle ---

router.post('/:id/transition', requirePermission('document:read'), validate(z.object({
  to: z.enum(['draft', 'under_review', 'approved', 'published', 'under_revision', 'retired']),
  comment: z.string().max(2000).optional(),
  effective_date: z.string().nullable().optional()
})), asyncHandler(async (req, res) => {
  const doc = q.get('SELECT * FROM documents WHERE id = ?', req.params.id);
  if (!doc) throw notFound('Document');

  const allowed = TRANSITIONS[doc.status] || {};
  const permission = allowed[req.body.to];
  if (!permission) {
    throw new HttpError(409, `A document at status "${STATUS_LABEL[doc.status]}" cannot move to "${STATUS_LABEL[req.body.to]}".`, { allowed: Object.keys(allowed) });
  }
  if (!can(req.user.role, permission)) {
    audit(req, { action: `denied:${permission}`, entityType: 'document', entityId: doc.id, summary: `Transition denied for ${req.user.email}`, outcome: 'denied' });
    throw new HttpError(403, `Your role cannot perform this transition. It requires the "${permission}" permission.`);
  }
  // Segregation of duties: the author may not be the approver of their own work.
  if (req.body.to === 'approved' && doc.owner_id === req.user.id && req.user.role !== 'admin') {
    throw new HttpError(409, 'Segregation of duties: a document cannot be approved by its own owner.');
  }
  if (req.body.to === 'approved' && !doc.approver_id) {
    q.run('UPDATE documents SET approver_id = ? WHERE id = ?', req.user.id, doc.id);
  }

  const at = nowIso();
  const major = req.body.to === 'published';
  const version = major ? nextVersion(doc.version, true) : doc.version;
  const effective = req.body.to === 'published'
    ? (req.body.effective_date || at.slice(0, 10))
    : doc.effective_date;
  const reviewDate = req.body.to === 'published'
    ? new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)
    : doc.review_date;

  db.transaction(() => {
    q.run(
      'UPDATE documents SET status = ?, version = ?, effective_date = ?, review_date = ?, retired_date = ?, updated_at = ? WHERE id = ?',
      req.body.to, version, effective, reviewDate,
      req.body.to === 'retired' ? at.slice(0, 10) : null, at, doc.id
    );
    q.run(
      `INSERT INTO document_approvals (id, document_id, action, from_status, to_status, actor_id, actor_name, actor_role, comment, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      id('apr'), doc.id, TRANSITION_ACTION[req.body.to] || req.body.to, doc.status, req.body.to,
      req.user.id, req.user.name, req.user.role, req.body.comment || null, at
    );
    if (major) {
      recordVersion(doc.id, { version, note: req.body.comment || `Published as version ${version}`, type: 'published', user: req.user });
    }
  })();

  const updated = q.get('SELECT * FROM documents WHERE id = ?', doc.id);
  indexDocument(updated, loadSections(doc.id));
  audit(req, {
    action: `document:${TRANSITION_ACTION[req.body.to]}`, entityType: 'document', entityId: doc.id,
    summary: `${doc.reference} moved from ${STATUS_LABEL[doc.status]} to ${STATUS_LABEL[req.body.to]}`,
    detail: { comment: req.body.comment }
  });
  // Tell whoever the transition now waits on. The document row is re-read
  // above, so approver_id assigned during this transition is included.
  notifyTransition({ document: updated, from: doc.status, to: req.body.to, actor: req.user });
  res.json({
    document: enrichDocument(updated),
    approvals: q.all('SELECT * FROM document_approvals WHERE document_id = ? ORDER BY created_at DESC', doc.id)
  });
}));

router.get('/:id/transitions', asyncHandler(async (req, res) => {
  const doc = q.get('SELECT * FROM documents WHERE id = ?', req.params.id);
  if (!doc) throw notFound('Document');
  const allowed = TRANSITIONS[doc.status] || {};
  res.json(Object.entries(allowed).map(([to, permission]) => ({
    to, label: STATUS_LABEL[to], permission, allowed: can(req.user.role, permission)
  })));
}));

// -------------------------------------------------------------- versions --

router.post('/:id/versions', requirePermission('document:update'), validate(z.object({
  note: z.string().max(1000).optional(), major: z.boolean().optional()
})), asyncHandler(async (req, res) => {
  const doc = q.get('SELECT * FROM documents WHERE id = ?', req.params.id);
  if (!doc) throw notFound('Document');
  const version = nextVersion(doc.version, req.body.major);
  q.run('UPDATE documents SET version = ?, updated_at = ? WHERE id = ?', version, nowIso(), doc.id);
  recordVersion(doc.id, { version, note: req.body.note || 'Manual version snapshot', type: 'revision', user: req.user });
  audit(req, { action: 'document:version', entityType: 'document', entityId: doc.id, summary: `${doc.reference} versioned to ${version}` });
  res.status(201).json({ version, versions: q.all('SELECT id, version, change_note, change_type, author_name, created_at FROM document_versions WHERE document_id = ? ORDER BY created_at DESC', doc.id) });
}));

router.get('/:id/versions/:versionId', asyncHandler(async (req, res) => {
  const row = q.get('SELECT * FROM document_versions WHERE id = ? AND document_id = ?', req.params.versionId, req.params.id);
  if (!row) throw notFound('Version');
  res.json({ ...row, snapshot: fromJson(row.snapshot, null) });
}));

/** Section-level textual diff between two versions (or a version and now). */
router.get('/:id/compare', asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const fromRow = q.get('SELECT * FROM document_versions WHERE id = ? AND document_id = ?', from, req.params.id);
  if (!fromRow) throw notFound('Base version');
  const toSnapshot = to
    ? fromJson(q.get('SELECT snapshot FROM document_versions WHERE id = ? AND document_id = ?', to, req.params.id)?.snapshot, null)
    : snapshot(req.params.id);
  if (!toSnapshot) throw notFound('Comparison version');

  const a = fromJson(fromRow.snapshot, { sections: [] });
  const bySectionKey = (snap) => Object.fromEntries((snap.sections || []).map((s) => [s.section_key, s]));
  const left = bySectionKey(a);
  const right = bySectionKey(toSnapshot);
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].filter((k) => !k.startsWith('_'));

  const sections = keys.map((key) => {
    const l = left[key];
    const r = right[key];
    const lt = htmlToText(l?.body || '');
    const rt = htmlToText(r?.body || '');
    return {
      section_key: key,
      heading: r?.heading || l?.heading || key,
      status: !l ? 'added' : !r ? 'removed' : lt === rt ? 'unchanged' : 'modified',
      diff: lt === rt ? null : lineDiff(lt, rt)
    };
  });

  res.json({
    from: { id: fromRow.id, version: fromRow.version, created_at: fromRow.created_at, author: fromRow.author_name },
    to: to ? { id: to } : { version: toSnapshot.document?.version, label: 'Current' },
    sections
  });
}));

/** Minimal line-level diff: enough to drive a side-by-side review panel. */
function lineDiff(a, b) {
  const left = a.split('\n');
  const right = b.split('\n');
  const rightSet = new Map();
  right.forEach((line, i) => {
    if (!rightSet.has(line)) rightSet.set(line, []);
    rightSet.get(line).push(i);
  });
  const out = [];
  const usedRight = new Set();
  for (const line of left) {
    const matches = rightSet.get(line);
    const idx = matches?.find((i) => !usedRight.has(i));
    if (idx === undefined) out.push({ type: 'removed', text: line });
    else { usedRight.add(idx); out.push({ type: 'same', text: line }); }
  }
  right.forEach((line, i) => {
    if (!usedRight.has(i)) out.push({ type: 'added', text: line });
  });
  return out.filter((d) => d.text.trim());
}

// -------------------------------------------------------------- comments --

router.post('/:id/comments', requirePermission('comment:write'), validate(z.object({
  body: z.string().min(1).max(4000),
  section_id: z.string().nullable().optional(),
  quote: z.string().max(1000).nullable().optional()
})), asyncHandler(async (req, res) => {
  const doc = q.get('SELECT * FROM documents WHERE id = ?', req.params.id);
  if (!doc) throw notFound('Document');
  const commentId = id('cmt');
  q.run(
    'INSERT INTO comments (id, document_id, section_id, author_id, author_name, body, quote, created_at) VALUES (?,?,?,?,?,?,?,?)',
    commentId, doc.id, req.body.section_id || null, req.user.id, req.user.name,
    req.body.body, req.body.quote || null, nowIso()
  );
  const comment = q.get('SELECT * FROM comments WHERE id = ?', commentId);
  notifyComment({ document: doc, comment, actor: req.user });
  audit(req, { action: 'comment:create', entityType: 'document', entityId: doc.id, summary: `Commented on ${doc.reference}` });
  res.status(201).json({ comment });
}));

router.patch('/:id/comments/:commentId', requirePermission('comment:write'), asyncHandler(async (req, res) => {
  const comment = q.get('SELECT * FROM comments WHERE id = ? AND document_id = ?', req.params.commentId, req.params.id);
  if (!comment) throw notFound('Comment');
  const resolved = req.body.resolved ? 1 : 0;
  q.run('UPDATE comments SET resolved = ?, resolved_by = ? WHERE id = ?', resolved, resolved ? req.user.name : null, comment.id);
  res.json({ comment: q.get('SELECT * FROM comments WHERE id = ?', comment.id) });
}));

router.delete('/:id/comments/:commentId', requirePermission('comment:write'), asyncHandler(async (req, res) => {
  const comment = q.get('SELECT * FROM comments WHERE id = ? AND document_id = ?', req.params.commentId, req.params.id);
  if (!comment) throw notFound('Comment');
  if (comment.author_id !== req.user.id && req.user.role !== 'admin') {
    throw new HttpError(403, 'You can only delete your own comments.');
  }
  q.run('DELETE FROM comments WHERE id = ?', comment.id);
  res.json({ ok: true });
}));

// ----------------------------------------------------------------- links --

router.post('/:id/links', requirePermission('document:update'), validate(z.object({
  to_id: z.string().min(1),
  link_type: z.enum(['implements', 'supports', 'supersedes', 'references', 'derived_from']),
  note: z.string().max(500).optional()
})), asyncHandler(async (req, res) => {
  const doc = q.get('SELECT * FROM documents WHERE id = ?', req.params.id);
  const target = q.get('SELECT * FROM documents WHERE id = ?', req.body.to_id);
  if (!doc || !target) throw notFound('Document');
  if (doc.id === target.id) throw new HttpError(400, 'A document cannot be linked to itself.');
  q.run(
    'INSERT OR IGNORE INTO document_links (id, from_id, to_id, link_type, note, created_at) VALUES (?,?,?,?,?,?)',
    id('lnk'), doc.id, target.id, req.body.link_type, req.body.note || null, nowIso()
  );
  audit(req, { action: 'document:link', entityType: 'document', entityId: doc.id, summary: `Linked ${doc.reference} → ${target.reference} (${req.body.link_type})` });
  res.status(201).json({ ok: true });
}));

router.delete('/:id/links/:linkId', requirePermission('document:update'), asyncHandler(async (req, res) => {
  q.run('DELETE FROM document_links WHERE id = ? AND from_id = ?', req.params.linkId, req.params.id);
  res.json({ ok: true });
}));

export default router;
