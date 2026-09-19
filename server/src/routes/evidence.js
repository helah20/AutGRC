/** Evidence register. */

import express from 'express';
import { z } from 'zod';
import { q, nowIso } from '../db/index.js';
import { authenticate, requirePermission, audit } from '../middleware/auth.js';
import { asyncHandler, validate, notFound } from '../middleware/errors.js';
import { indexEvidence, removeFromIndex } from '../services/search.js';
import { domainName } from '../knowledge/index.js';
import { listParam, paginate } from './_shared.js';

const router = express.Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset } = paginate(req, 200, 2000);
  const filters = [];
  const args = [];
  for (const [column, values] of [
    ['e.domain_key', listParam(req.query.domain)],
    ['e.status', listParam(req.query.status)],
    ['e.evidence_type', listParam(req.query.type)]
  ]) {
    if (values.length) { filters.push(`${column} IN (${values.map(() => '?').join(',')})`); args.push(...values); }
  }
  if (req.query.search) {
    filters.push('(e.name LIKE ? OR e.evidence_id LIKE ? OR e.description LIKE ?)');
    const like = `%${req.query.search}%`;
    args.push(like, like, like);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const total = q.get(`SELECT COUNT(*) AS n FROM evidence e ${where}`, ...args).n;
  const rows = q.all(
    `SELECT e.*, c.control_id AS control_ref, c.name AS control_name
       FROM evidence e LEFT JOIN controls c ON c.id = e.control_id
       ${where} ORDER BY e.evidence_id LIMIT ? OFFSET ?`, ...args, limit, offset
  );
  res.json({
    total, limit, offset,
    items: rows.map((e) => ({ ...e, domain_label: e.domain_key ? domainName(e.domain_key) : null })),
    facets: {
      statuses: q.all('SELECT status, COUNT(*) AS n FROM evidence GROUP BY status'),
      types: q.all('SELECT evidence_type, COUNT(*) AS n FROM evidence GROUP BY evidence_type'),
      domains: q.all('SELECT domain_key, COUNT(*) AS n FROM evidence GROUP BY domain_key').map((r) => ({ ...r, label: domainName(r.domain_key) }))
    }
  });
}));

router.patch('/:id', requirePermission('evidence:write'), validate(z.object({
  name: z.string().min(3).max(400).optional(),
  description: z.string().max(2000).nullable().optional(),
  evidence_type: z.string().max(60).optional(),
  frequency: z.string().max(160).nullable().optional(),
  owner_role: z.string().max(160).nullable().optional(),
  source_system: z.string().max(160).nullable().optional(),
  retention: z.string().max(160).nullable().optional(),
  status: z.enum(['required', 'collected', 'verified', 'missing', 'expired']).optional(),
  last_collected: z.string().nullable().optional()
})), asyncHandler(async (req, res) => {
  const row = q.get('SELECT * FROM evidence WHERE id = ? OR evidence_id = ?', req.params.id, req.params.id);
  if (!row) throw notFound('Evidence');
  const entries = Object.entries(req.body).filter(([, v]) => v !== undefined);
  if (entries.length) {
    q.run(`UPDATE evidence SET ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
      ...entries.map(([, v]) => v), nowIso(), row.id);
  }
  const updated = q.get('SELECT * FROM evidence WHERE id = ?', row.id);
  indexEvidence(updated);
  audit(req, { action: 'evidence:update', entityType: 'evidence', entityId: row.id, summary: `Updated evidence ${row.evidence_id}`, detail: Object.fromEntries(entries) });
  res.json({ evidence: updated });
}));

router.delete('/:id', requirePermission('evidence:write'), asyncHandler(async (req, res) => {
  const row = q.get('SELECT * FROM evidence WHERE id = ? OR evidence_id = ?', req.params.id, req.params.id);
  if (!row) throw notFound('Evidence');
  q.run('DELETE FROM evidence WHERE id = ?', row.id);
  removeFromIndex('evidence', row.id);
  audit(req, { action: 'evidence:delete', entityType: 'evidence', entityId: row.id, summary: `Deleted evidence ${row.evidence_id}` });
  res.json({ ok: true });
}));

export default router;
