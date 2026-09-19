/** Control library. */

import express from 'express';
import { z } from 'zod';
import { db, q, nowIso } from '../db/index.js';
import { id, padNumber } from '../utils/ids.js';
import { authenticate, requirePermission, audit } from '../middleware/auth.js';
import { asyncHandler, validate, notFound, HttpError } from '../middleware/errors.js';
import { indexControl, removeFromIndex, indexEvidence } from '../services/search.js';
import { domainName, domainShort, DOMAIN_META } from '../knowledge/index.js';
import { enrichControl, listParam, paginate } from './_shared.js';

const router = express.Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset } = paginate(req, 200, 2000);
  const filters = [];
  const args = [];
  for (const [column, values] of [
    ['domain_key', listParam(req.query.domain)],
    ['control_type', listParam(req.query.type)],
    ['risk_rating', listParam(req.query.risk)],
    ['status', listParam(req.query.status)],
    ['control_nature', listParam(req.query.nature)]
  ]) {
    if (values.length) { filters.push(`${column} IN (${values.map(() => '?').join(',')})`); args.push(...values); }
  }
  if (req.query.search) {
    filters.push('(name LIKE ? OR control_id LIKE ? OR description LIKE ? OR requirement LIKE ?)');
    const like = `%${req.query.search}%`;
    args.push(like, like, like, like);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const total = q.get(`SELECT COUNT(*) AS n FROM controls ${where}`, ...args).n;
  const rows = q.all(`SELECT * FROM controls ${where} ORDER BY control_id LIMIT ? OFFSET ?`, ...args, limit, offset);

  // Attach mapping and evidence counts without N+1 queries.
  const mapCounts = Object.fromEntries(q.all('SELECT control_id, COUNT(*) AS n FROM control_mappings GROUP BY control_id').map((r) => [r.control_id, r.n]));
  const evCounts = Object.fromEntries(q.all('SELECT control_id, COUNT(*) AS n FROM evidence GROUP BY control_id').map((r) => [r.control_id, r.n]));

  res.json({
    total, limit, offset,
    items: rows.map((c) => ({
      ...c, domain_label: domainName(c.domain_key),
      mapping_count: mapCounts[c.id] || 0, evidence_count: evCounts[c.id] || 0
    })),
    facets: {
      domains: q.all('SELECT domain_key, COUNT(*) AS n FROM controls GROUP BY domain_key').map((r) => ({ ...r, label: domainName(r.domain_key) })),
      types: q.all('SELECT control_type, COUNT(*) AS n FROM controls GROUP BY control_type'),
      risks: q.all('SELECT risk_rating, COUNT(*) AS n FROM controls GROUP BY risk_rating'),
      statuses: q.all('SELECT status, COUNT(*) AS n FROM controls GROUP BY status')
    }
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const row = q.get('SELECT * FROM controls WHERE id = ? OR control_id = ?', req.params.id, req.params.id);
  if (!row) throw notFound('Control');
  const enriched = enrichControl(row);
  const docs = q.all(
    'SELECT id, reference, title, doc_type, status FROM documents WHERE id IN (?,?,?)',
    row.policy_id, row.standard_id, row.procedure_id
  );
  res.json({ control: enriched, documents: docs });
}));

const controlSchema = z.object({
  name: z.string().min(3).max(250),
  domain_key: z.string().min(2),
  description: z.string().max(4000).optional(),
  requirement: z.string().max(4000).optional(),
  control_type: z.enum(['preventive', 'detective', 'corrective', 'deterrent', 'compensating', 'directive']),
  control_nature: z.enum(['technical', 'administrative', 'physical', 'hybrid']).optional(),
  implementation: z.string().max(4000).optional(),
  responsible_role: z.string().max(160).optional(),
  accountable_role: z.string().max(160).optional(),
  frequency: z.string().max(160).optional(),
  kpi: z.string().max(500).optional(),
  risk: z.string().max(2000).optional(),
  risk_rating: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  testing_method: z.string().max(1000).optional(),
  status: z.enum(['proposed', 'approved', 'implemented', 'retired']).optional(),
  policy_id: z.string().nullable().optional(),
  standard_id: z.string().nullable().optional(),
  procedure_id: z.string().nullable().optional(),
  evidence: z.array(z.string().max(400)).optional()
});

router.post('/', requirePermission('control:write'), validate(controlSchema), asyncHandler(async (req, res) => {
  const body = req.body;
  const prefix = `${domainShort(body.domain_key)}-`;
  const existing = q.all('SELECT control_id FROM controls WHERE control_id LIKE ?', `${prefix}%`);
  const next = existing.reduce((m, r) => Math.max(m, Number(String(r.control_id).slice(prefix.length)) || 0), 0) + 1;
  const controlId = `${prefix}${padNumber(next)}`;
  const rowId = id('ctl');
  const at = nowIso();

  db.transaction(() => {
    q.run(
      `INSERT INTO controls (id, control_id, name, domain_key, description, requirement, control_type, control_nature,
         implementation, responsible_role, accountable_role, frequency, kpi, risk, risk_rating, testing_method,
         policy_id, standard_id, procedure_id, status, provenance, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      rowId, controlId, body.name, body.domain_key, body.description || null, body.requirement || null,
      body.control_type, body.control_nature || 'administrative', body.implementation || null,
      body.responsible_role || null, body.accountable_role || null, body.frequency || null,
      body.kpi || null, body.risk || null, body.risk_rating || 'medium', body.testing_method || null,
      body.policy_id || null, body.standard_id || null, body.procedure_id || null,
      body.status || 'proposed', 'organizational_standard', at, at
    );
    const evPrefix = `EV-${domainShort(body.domain_key)}-`;
    let evNext = q.all('SELECT evidence_id FROM evidence WHERE evidence_id LIKE ?', `${evPrefix}%`)
      .reduce((m, r) => Math.max(m, Number(String(r.evidence_id).slice(evPrefix.length)) || 0), 0);
    for (const item of body.evidence || []) {
      evNext += 1;
      q.run(
        `INSERT INTO evidence (id, evidence_id, name, description, evidence_type, domain_key, control_id, frequency, owner_role, status, provenance, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id('evd'), `${evPrefix}${padNumber(evNext)}`, item,
        `Evidence demonstrating operation of control ${controlId}.`, 'record', body.domain_key, rowId,
        body.frequency || null, body.responsible_role || null, 'required', 'organizational_standard', at, at
      );
    }
  })();

  const row = q.get('SELECT * FROM controls WHERE id = ?', rowId);
  indexControl(row, body.evidence || []);
  audit(req, { action: 'control:create', entityType: 'control', entityId: rowId, summary: `Created control ${controlId} — ${body.name}` });
  res.status(201).json({ control: enrichControl(row) });
}));

router.patch('/:id', requirePermission('control:write'), validate(controlSchema.partial()), asyncHandler(async (req, res) => {
  const row = q.get('SELECT * FROM controls WHERE id = ? OR control_id = ?', req.params.id, req.params.id);
  if (!row) throw notFound('Control');
  const { evidence, ...fields } = req.body;
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (entries.length) {
    q.run(
      `UPDATE controls SET ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
      ...entries.map(([, v]) => v), nowIso(), row.id
    );
  }
  const updated = q.get('SELECT * FROM controls WHERE id = ?', row.id);
  indexControl(updated, q.all('SELECT name FROM evidence WHERE control_id = ?', row.id).map((e) => e.name));
  audit(req, { action: 'control:update', entityType: 'control', entityId: row.id, summary: `Updated control ${row.control_id}`, detail: Object.fromEntries(entries) });
  res.json({ control: enrichControl(updated) });
}));

router.delete('/:id', requirePermission('control:write'), asyncHandler(async (req, res) => {
  const row = q.get('SELECT * FROM controls WHERE id = ? OR control_id = ?', req.params.id, req.params.id);
  if (!row) throw notFound('Control');
  q.run('DELETE FROM controls WHERE id = ?', row.id);
  removeFromIndex('control', row.id);
  audit(req, { action: 'control:delete', entityType: 'control', entityId: row.id, summary: `Deleted control ${row.control_id}` });
  res.json({ ok: true });
}));

/** Evidence attached to a control. */
router.post('/:id/evidence', requirePermission('evidence:write'), validate(z.object({
  name: z.string().min(3).max(400),
  description: z.string().max(2000).optional(),
  evidence_type: z.string().max(60).optional(),
  frequency: z.string().max(160).optional(),
  owner_role: z.string().max(160).optional(),
  source_system: z.string().max(160).optional(),
  retention: z.string().max(160).optional()
})), asyncHandler(async (req, res) => {
  const control = q.get('SELECT * FROM controls WHERE id = ? OR control_id = ?', req.params.id, req.params.id);
  if (!control) throw notFound('Control');
  const prefix = `EV-${domainShort(control.domain_key)}-`;
  const next = q.all('SELECT evidence_id FROM evidence WHERE evidence_id LIKE ?', `${prefix}%`)
    .reduce((m, r) => Math.max(m, Number(String(r.evidence_id).slice(prefix.length)) || 0), 0) + 1;
  const evId = id('evd');
  const at = nowIso();
  q.run(
    `INSERT INTO evidence (id, evidence_id, name, description, evidence_type, domain_key, control_id, frequency, owner_role, source_system, retention, status, provenance, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    evId, `${prefix}${padNumber(next)}`, req.body.name, req.body.description || null,
    req.body.evidence_type || 'record', control.domain_key, control.id, req.body.frequency || control.frequency,
    req.body.owner_role || control.responsible_role, req.body.source_system || null, req.body.retention || null,
    'required', 'organizational_standard', at, at
  );
  indexEvidence(q.get('SELECT * FROM evidence WHERE id = ?', evId));
  audit(req, { action: 'evidence:create', entityType: 'control', entityId: control.id, summary: `Added evidence requirement to ${control.control_id}` });
  res.status(201).json({ evidence: q.get('SELECT * FROM evidence WHERE id = ?', evId) });
}));

export default router;
