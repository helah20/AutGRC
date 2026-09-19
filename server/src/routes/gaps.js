/** Gap assessment module. */

import express from 'express';
import { z } from 'zod';
import { db, q, nowIso } from '../db/index.js';
import { id } from '../utils/ids.js';
import { authenticate, requirePermission, audit } from '../middleware/auth.js';
import { asyncHandler, validate, notFound } from '../middleware/errors.js';
import { indexGapItem, removeFromIndex } from '../services/search.js';
import { domainName } from '../knowledge/index.js';

const router = express.Router();
router.use(authenticate);

const STATUSES = ['compliant', 'partially_compliant', 'non_compliant', 'not_applicable'];

function summarise(assessmentId) {
  const rows = q.all('SELECT status, risk_rating FROM gap_items WHERE assessment_id = ?', assessmentId);
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length]));
  const assessable = rows.length - byStatus.not_applicable;
  return {
    total: rows.length,
    byStatus,
    byRisk: ['critical', 'high', 'medium', 'low'].reduce((acc, r) => ({ ...acc, [r]: rows.filter((x) => x.risk_rating === r).length }), {}),
    complianceRate: assessable
      ? Math.round(((byStatus.compliant + byStatus.partially_compliant * 0.5) / assessable) * 100)
      : 0
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const rows = q.all(
    `SELECT a.*, f.code AS framework_code, f.name AS framework_name, u.name AS owner_name
       FROM assessments a
       LEFT JOIN frameworks f ON f.id = a.framework_id
       LEFT JOIN users u ON u.id = a.owner_id
      ORDER BY a.created_at DESC`
  );
  res.json(rows.map((a) => ({ ...a, summary: summarise(a.id) })));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const assessment = q.get(
    `SELECT a.*, f.code AS framework_code, f.name AS framework_name, u.name AS owner_name
       FROM assessments a LEFT JOIN frameworks f ON f.id = a.framework_id LEFT JOIN users u ON u.id = a.owner_id
      WHERE a.id = ?`, req.params.id
  );
  if (!assessment) throw notFound('Assessment');
  const items = q.all(
    `SELECT g.*, fr.domain_key, d.reference AS document_ref, d.title AS document_title, c.control_id AS control_ref
       FROM gap_items g
       LEFT JOIN framework_requirements fr ON fr.id = g.requirement_id
       LEFT JOIN documents d ON d.id = g.document_id
       LEFT JOIN controls c ON c.id = g.control_id
      WHERE g.assessment_id = ? ORDER BY g.requirement_ref`, req.params.id
  );
  res.json({
    assessment,
    summary: summarise(assessment.id),
    items: items.map((i) => ({ ...i, domain_label: i.domain_key ? domainName(i.domain_key) : null }))
  });
}));

/**
 * Create an assessment. When `seedFromFramework` is set, every requirement in
 * the framework is pre-populated with its current mapped state, so the
 * assessment starts from the platform's real coverage position rather than
 * from a blank sheet.
 */
router.post('/', requirePermission('gap:write'), validate(z.object({
  name: z.string().min(3).max(200),
  framework_id: z.string().nullable().optional(),
  scope: z.string().max(1000).optional(),
  due_at: z.string().nullable().optional(),
  seedFromFramework: z.boolean().default(true),
  domainKeys: z.array(z.string()).optional()
})), asyncHandler(async (req, res) => {
  const assessmentId = id('asm');
  const at = nowIso();

  db.transaction(() => {
    q.run(
      `INSERT INTO assessments (id, name, framework_id, scope, status, owner_id, started_at, due_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      assessmentId, req.body.name, req.body.framework_id || null, req.body.scope || null,
      'in_progress', req.user.id, at, req.body.due_at || null, at, at
    );

    if (req.body.seedFromFramework && req.body.framework_id) {
      const domainFilter = req.body.domainKeys?.length
        ? ` AND domain_key IN (${req.body.domainKeys.map(() => '?').join(',')})`
        : '';
      const reqs = q.all(
        `SELECT * FROM framework_requirements WHERE framework_id = ? AND level >= 2${domainFilter}`,
        req.body.framework_id, ...(req.body.domainKeys || [])
      );
      for (const r of reqs) {
        const mapped = q.all(
          `SELECT cm.coverage, c.id AS control_pk, c.control_id, c.name, c.policy_id, c.responsible_role
             FROM control_mappings cm JOIN controls c ON c.id = cm.control_id
            WHERE cm.requirement_id = ?`, r.id
        );
        const covered = mapped.some((m) => m.coverage === 'covered');
        const partial = mapped.some((m) => m.coverage === 'partial');
        const status = covered ? 'compliant' : partial ? 'partially_compliant' : 'non_compliant';
        const evidence = mapped.length
          ? q.all('SELECT name FROM evidence WHERE control_id = ?', mapped[0].control_pk).map((e) => e.name).join('; ')
          : '';

        q.run(
          `INSERT INTO gap_items (id, assessment_id, requirement_id, requirement_ref, requirement_txt,
             current_state, target_state, gap, risk, risk_rating, recommendation, owner, status,
             evidence_ref, document_id, control_id, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          id('gap'), assessmentId, r.id, r.ref, r.title,
          mapped.length
            ? `Addressed by ${mapped.map((m) => m.control_id).join(', ')}.`
            : 'No organisational control is currently mapped to this requirement.',
          'A documented, operating control with retained evidence demonstrating compliance.',
          covered ? 'No gap identified; verify control operating effectiveness.'
            : partial ? 'Partial coverage. The mapped control addresses part of the requirement only.'
            : 'No control identified. The requirement is not addressed.',
          covered ? 'Residual risk of control failure.' : 'The organisation cannot demonstrate compliance with this requirement.',
          covered ? 'low' : partial ? 'medium' : 'high',
          covered ? 'Test control operating effectiveness in the next assurance cycle.'
            : partial ? 'Extend the mapped control or add a complementary control to cover the remainder.'
            : 'Define and implement a control, then map it to this requirement.',
          mapped[0]?.responsible_role || '',
          status, evidence, mapped[0]?.policy_id || null, mapped[0]?.control_pk || null, at, at
        );
      }
    }
  })();

  for (const item of q.all('SELECT * FROM gap_items WHERE assessment_id = ?', assessmentId)) indexGapItem(item);
  audit(req, { action: 'assessment:create', entityType: 'assessment', entityId: assessmentId, summary: `Created gap assessment "${req.body.name}"` });

  const created = q.get('SELECT * FROM assessments WHERE id = ?', assessmentId);
  res.status(201).json({ assessment: created, summary: summarise(assessmentId) });
}));

router.patch('/:id', requirePermission('gap:write'), validate(z.object({
  name: z.string().min(3).max(200).optional(),
  scope: z.string().max(1000).nullable().optional(),
  status: z.enum(['planned', 'in_progress', 'completed', 'archived']).optional(),
  due_at: z.string().nullable().optional()
})), asyncHandler(async (req, res) => {
  const row = q.get('SELECT * FROM assessments WHERE id = ?', req.params.id);
  if (!row) throw notFound('Assessment');
  const entries = Object.entries(req.body).filter(([, v]) => v !== undefined);
  if (entries.length) {
    q.run(`UPDATE assessments SET ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
      ...entries.map(([, v]) => v), nowIso(), row.id);
  }
  audit(req, { action: 'assessment:update', entityType: 'assessment', entityId: row.id, summary: `Updated assessment "${row.name}"` });
  res.json({ assessment: q.get('SELECT * FROM assessments WHERE id = ?', row.id) });
}));

router.delete('/:id', requirePermission('gap:write'), asyncHandler(async (req, res) => {
  const row = q.get('SELECT * FROM assessments WHERE id = ?', req.params.id);
  if (!row) throw notFound('Assessment');
  for (const item of q.all('SELECT id FROM gap_items WHERE assessment_id = ?', row.id)) removeFromIndex('gap_item', item.id);
  q.run('DELETE FROM assessments WHERE id = ?', row.id);
  audit(req, { action: 'assessment:delete', entityType: 'assessment', entityId: row.id, summary: `Deleted assessment "${row.name}"` });
  res.json({ ok: true });
}));

const itemSchema = z.object({
  requirement_ref: z.string().max(60).optional(),
  requirement_txt: z.string().max(2000).optional(),
  current_state: z.string().max(4000).nullable().optional(),
  target_state: z.string().max(4000).nullable().optional(),
  gap: z.string().max(4000).nullable().optional(),
  risk: z.string().max(4000).nullable().optional(),
  risk_rating: z.enum(['low', 'medium', 'high', 'critical']).nullable().optional(),
  recommendation: z.string().max(4000).nullable().optional(),
  owner: z.string().max(200).nullable().optional(),
  due_date: z.string().nullable().optional(),
  status: z.enum(STATUSES).optional(),
  evidence_ref: z.string().max(2000).nullable().optional(),
  document_id: z.string().nullable().optional(),
  control_id: z.string().nullable().optional()
});

router.post('/:id/items', requirePermission('gap:write'), validate(itemSchema), asyncHandler(async (req, res) => {
  const assessment = q.get('SELECT * FROM assessments WHERE id = ?', req.params.id);
  if (!assessment) throw notFound('Assessment');
  const itemId = id('gap');
  const at = nowIso();
  const cols = Object.keys(req.body);
  q.run(
    `INSERT INTO gap_items (id, assessment_id, ${cols.join(', ')}, created_at, updated_at)
     VALUES (?,?,${cols.map(() => '?').join(',')},?,?)`,
    itemId, assessment.id, ...cols.map((c) => req.body[c]), at, at
  );
  indexGapItem(q.get('SELECT * FROM gap_items WHERE id = ?', itemId));
  audit(req, { action: 'gap:create', entityType: 'assessment', entityId: assessment.id, summary: 'Added a gap assessment row' });
  res.status(201).json({ item: q.get('SELECT * FROM gap_items WHERE id = ?', itemId), summary: summarise(assessment.id) });
}));

router.patch('/:id/items/:itemId', requirePermission('gap:write'), validate(itemSchema), asyncHandler(async (req, res) => {
  const item = q.get('SELECT * FROM gap_items WHERE id = ? AND assessment_id = ?', req.params.itemId, req.params.id);
  if (!item) throw notFound('Gap item');
  const entries = Object.entries(req.body).filter(([, v]) => v !== undefined);
  if (entries.length) {
    q.run(`UPDATE gap_items SET ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
      ...entries.map(([, v]) => v), nowIso(), item.id);
  }
  const updated = q.get('SELECT * FROM gap_items WHERE id = ?', item.id);
  indexGapItem(updated);
  res.json({ item: updated, summary: summarise(req.params.id) });
}));

router.delete('/:id/items/:itemId', requirePermission('gap:write'), asyncHandler(async (req, res) => {
  q.run('DELETE FROM gap_items WHERE id = ? AND assessment_id = ?', req.params.itemId, req.params.id);
  removeFromIndex('gap_item', req.params.itemId);
  res.json({ ok: true, summary: summarise(req.params.id) });
}));

export default router;
