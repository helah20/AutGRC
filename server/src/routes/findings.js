/** Governance findings raised by the quality engine, AI provider or a user. */

import express from 'express';
import { z } from 'zod';
import { q, nowIso, toJson, fromJson } from '../db/index.js';
import { id } from '../utils/ids.js';
import { authenticate, requirePermission, audit } from '../middleware/auth.js';
import { asyncHandler, validate, notFound } from '../middleware/errors.js';
import { listParam } from './_shared.js';

const router = express.Router();
router.use(authenticate);

const SEVERITY_ORDER = "CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END";

router.get('/', asyncHandler(async (req, res) => {
  const filters = [];
  const args = [];
  for (const [column, values] of [
    ['category', listParam(req.query.category)],
    ['severity', listParam(req.query.severity)],
    ['status', listParam(req.query.status)],
    ['scope_type', listParam(req.query.scope)],
    ['source', listParam(req.query.source)]
  ]) {
    if (values.length) { filters.push(`${column} IN (${values.map(() => '?').join(',')})`); args.push(...values); }
  }
  if (req.query.scopeId) { filters.push('scope_id = ?'); args.push(req.query.scopeId); }
  if (req.query.open === 'true') filters.push("status IN ('open','acknowledged')");

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const rows = q.all(`SELECT * FROM findings ${where} ORDER BY ${SEVERITY_ORDER}, created_at DESC LIMIT 500`, ...args);

  // Resolve the human-readable label for each finding's scope.
  const docIds = [...new Set(rows.filter((r) => r.scope_type === 'document').map((r) => r.scope_id))];
  const docs = docIds.length
    ? Object.fromEntries(q.all(`SELECT id, reference, title FROM documents WHERE id IN (${docIds.map(() => '?').join(',')})`, ...docIds).map((d) => [d.id, d]))
    : {};

  res.json({
    items: rows.map((f) => ({
      ...f,
      evidence: fromJson(f.evidence, null),
      scope_label: f.scope_type === 'document' ? (docs[f.scope_id]?.reference || f.scope_id) : f.scope_id
    })),
    facets: {
      bySeverity: q.all("SELECT severity, COUNT(*) AS n FROM findings WHERE status IN ('open','acknowledged') GROUP BY severity"),
      byCategory: q.all("SELECT category, COUNT(*) AS n FROM findings WHERE status IN ('open','acknowledged') GROUP BY category"),
      byStatus: q.all('SELECT status, COUNT(*) AS n FROM findings GROUP BY status')
    }
  });
}));

router.post('/', requirePermission('finding:write'), validate(z.object({
  scope_type: z.string().min(2).max(40),
  scope_id: z.string().max(60).nullable().optional(),
  category: z.enum(['completeness', 'consistency', 'accountability', 'auditability', 'compliance', 'ambiguity', 'duplication', 'currency', 'ownership']),
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical']),
  title: z.string().min(3).max(300),
  detail: z.string().max(4000).optional(),
  location: z.string().max(300).optional(),
  recommendation: z.string().max(2000).optional()
})), asyncHandler(async (req, res) => {
  const at = nowIso();
  const rowId = id('fnd');
  q.run(
    `INSERT INTO findings (id, scope_type, scope_id, category, severity, title, detail, location, recommendation, evidence, status, source, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    rowId, req.body.scope_type, req.body.scope_id || null, req.body.category, req.body.severity,
    req.body.title, req.body.detail || null, req.body.location || null, req.body.recommendation || null,
    toJson(null), 'open', 'user', at, at
  );
  audit(req, { action: 'finding:create', entityType: 'finding', entityId: rowId, summary: `Raised finding "${req.body.title}"` });
  res.status(201).json({ finding: q.get('SELECT * FROM findings WHERE id = ?', rowId) });
}));

router.patch('/:id', requirePermission('finding:write'), validate(z.object({
  status: z.enum(['open', 'acknowledged', 'resolved', 'accepted_risk', 'false_positive']).optional(),
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical']).optional(),
  recommendation: z.string().max(2000).nullable().optional()
})), asyncHandler(async (req, res) => {
  const row = q.get('SELECT * FROM findings WHERE id = ?', req.params.id);
  if (!row) throw notFound('Finding');
  const entries = Object.entries(req.body).filter(([, v]) => v !== undefined);
  if (entries.length) {
    q.run(`UPDATE findings SET ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
      ...entries.map(([, v]) => v), nowIso(), row.id);
  }
  audit(req, {
    action: 'finding:update', entityType: 'finding', entityId: row.id,
    summary: `Finding "${row.title}" ${req.body.status ? `marked ${req.body.status.replace('_', ' ')}` : 'updated'}`
  });
  res.json({ finding: q.get('SELECT * FROM findings WHERE id = ?', row.id) });
}));

export default router;
