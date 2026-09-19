/** Interactive RACI / RASCI matrix builder with validation. */

import express from 'express';
import { z } from 'zod';
import { db, q, nowIso } from '../db/index.js';
import { id } from '../utils/ids.js';
import { authenticate, requirePermission, audit } from '../middleware/auth.js';
import { asyncHandler, validate, notFound, HttpError } from '../middleware/errors.js';
import { validateMatrix } from '../services/review.js';
import { indexRaciActivity, removeFromIndex } from '../services/search.js';
import { DOMAIN_MODELS, ROLE_INDEX, domainName, roleName } from '../knowledge/index.js';

const router = express.Router();
router.use(authenticate);

function hydrate(matrixId) {
  const matrix = q.get('SELECT * FROM raci_matrices WHERE id = ?', matrixId);
  if (!matrix) return null;
  const columns = q.all(
    `SELECT rr.*, r.name AS role_name, r.category
       FROM raci_roles rr LEFT JOIN roles r ON r.id = rr.role_id
      WHERE rr.matrix_id = ? ORDER BY rr.position`, matrixId
  );
  const activities = q.all('SELECT * FROM raci_activities WHERE matrix_id = ? ORDER BY position', matrixId);
  const assignments = q.all('SELECT * FROM raci_assignments WHERE matrix_id = ?', matrixId);
  const grid = {};
  for (const a of assignments) {
    grid[a.activity_id] = grid[a.activity_id] || {};
    grid[a.activity_id][a.role_col_id] = a.value;
  }
  return {
    matrix: { ...matrix, domain_label: matrix.domain_key ? domainName(matrix.domain_key) : null },
    columns, activities, grid,
    validation: validateMatrix(matrixId)
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const rows = q.all('SELECT * FROM raci_matrices ORDER BY updated_at DESC');
  res.json(rows.map((m) => ({
    ...m,
    domain_label: m.domain_key ? domainName(m.domain_key) : null,
    activities: q.get('SELECT COUNT(*) AS n FROM raci_activities WHERE matrix_id = ?', m.id).n,
    roles: q.get('SELECT COUNT(*) AS n FROM raci_roles WHERE matrix_id = ?', m.id).n,
    issues: validateMatrix(m.id).length
  })));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const data = hydrate(req.params.id);
  if (!data) throw notFound('Matrix');
  res.json(data);
}));

router.post('/', requirePermission('raci:write'), validate(z.object({
  name: z.string().min(3).max(200),
  domain_key: z.string().nullable().optional(),
  mode: z.enum(['raci', 'rasci']).default('raci'),
  description: z.string().max(1000).optional(),
  seedFromDomain: z.boolean().optional()
})), asyncHandler(async (req, res) => {
  const matrixId = id('mtx');
  const at = nowIso();
  const model = req.body.seedFromDomain && req.body.domain_key ? DOMAIN_MODELS[req.body.domain_key] : null;

  db.transaction(() => {
    q.run(
      'INSERT INTO raci_matrices (id, name, domain_key, mode, description, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
      matrixId, req.body.name, req.body.domain_key || null, req.body.mode, req.body.description || null, at, at
    );
    if (model) {
      const colIds = {};
      model.roles.forEach((code, i) => {
        const colId = id('rcl');
        const roleRow = q.get('SELECT id FROM roles WHERE code = ?', code);
        q.run('INSERT INTO raci_roles (id, matrix_id, role_id, label, position) VALUES (?,?,?,?,?)',
          colId, matrixId, roleRow?.id || null, ROLE_INDEX[code]?.shortName || code, i);
        colIds[code] = colId;
      });
      model.raciActivities.forEach((a, i) => {
        const actId = id('rac');
        q.run('INSERT INTO raci_activities (id, matrix_id, activity, phase, position) VALUES (?,?,?,?,?)',
          actId, matrixId, a.activity, a.phase || null, i);
        for (const [code, value] of Object.entries(a.assign)) {
          if (!colIds[code]) continue;
          q.run('INSERT INTO raci_assignments (id, matrix_id, activity_id, role_col_id, value) VALUES (?,?,?,?,?)',
            id('ras'), matrixId, actId, colIds[code], value);
        }
      });
    }
  })();

  audit(req, { action: 'raci:create', entityType: 'raci', entityId: matrixId, summary: `Created RACI matrix "${req.body.name}"` });
  res.status(201).json(hydrate(matrixId));
}));

router.patch('/:id', requirePermission('raci:write'), validate(z.object({
  name: z.string().min(3).max(200).optional(),
  mode: z.enum(['raci', 'rasci']).optional(),
  description: z.string().max(1000).nullable().optional()
})), asyncHandler(async (req, res) => {
  const matrix = q.get('SELECT * FROM raci_matrices WHERE id = ?', req.params.id);
  if (!matrix) throw notFound('Matrix');
  const entries = Object.entries(req.body).filter(([, v]) => v !== undefined);
  if (entries.length) {
    q.run(`UPDATE raci_matrices SET ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
      ...entries.map(([, v]) => v), nowIso(), matrix.id);
  }
  res.json(hydrate(matrix.id));
}));

router.delete('/:id', requirePermission('raci:write'), asyncHandler(async (req, res) => {
  const matrix = q.get('SELECT * FROM raci_matrices WHERE id = ?', req.params.id);
  if (!matrix) throw notFound('Matrix');
  for (const a of q.all('SELECT id FROM raci_activities WHERE matrix_id = ?', matrix.id)) removeFromIndex('raci_activity', a.id);
  q.run('DELETE FROM raci_matrices WHERE id = ?', matrix.id);
  audit(req, { action: 'raci:delete', entityType: 'raci', entityId: matrix.id, summary: `Deleted RACI matrix "${matrix.name}"` });
  res.json({ ok: true });
}));

// ------------------------------------------------------------- columns ----

router.post('/:id/roles', requirePermission('raci:write'), validate(z.object({
  label: z.string().min(1).max(60),
  role_id: z.string().nullable().optional()
})), asyncHandler(async (req, res) => {
  const matrix = q.get('SELECT * FROM raci_matrices WHERE id = ?', req.params.id);
  if (!matrix) throw notFound('Matrix');
  const max = q.get('SELECT COALESCE(MAX(position), -1) AS p FROM raci_roles WHERE matrix_id = ?', matrix.id).p;
  q.run('INSERT INTO raci_roles (id, matrix_id, role_id, label, position) VALUES (?,?,?,?,?)',
    id('rcl'), matrix.id, req.body.role_id || null, req.body.label, max + 1);
  q.run('UPDATE raci_matrices SET updated_at = ? WHERE id = ?', nowIso(), matrix.id);
  audit(req, { action: 'raci:add_role', entityType: 'raci', entityId: matrix.id, summary: `Added role column "${req.body.label}"` });
  res.status(201).json(hydrate(matrix.id));
}));

router.delete('/:id/roles/:colId', requirePermission('raci:write'), asyncHandler(async (req, res) => {
  const col = q.get('SELECT * FROM raci_roles WHERE id = ? AND matrix_id = ?', req.params.colId, req.params.id);
  if (!col) throw notFound('Role column');
  q.run('DELETE FROM raci_roles WHERE id = ?', col.id);
  q.run('UPDATE raci_matrices SET updated_at = ? WHERE id = ?', nowIso(), req.params.id);
  audit(req, { action: 'raci:remove_role', entityType: 'raci', entityId: req.params.id, summary: `Removed role column "${col.label}"` });
  res.json(hydrate(req.params.id));
}));

// ---------------------------------------------------------- activities ----

router.post('/:id/activities', requirePermission('raci:write'), validate(z.object({
  activity: z.string().min(3).max(400),
  phase: z.string().max(60).nullable().optional(),
  control_id: z.string().nullable().optional()
})), asyncHandler(async (req, res) => {
  const matrix = q.get('SELECT * FROM raci_matrices WHERE id = ?', req.params.id);
  if (!matrix) throw notFound('Matrix');
  const max = q.get('SELECT COALESCE(MAX(position), -1) AS p FROM raci_activities WHERE matrix_id = ?', matrix.id).p;
  const actId = id('rac');
  q.run('INSERT INTO raci_activities (id, matrix_id, activity, phase, control_id, position) VALUES (?,?,?,?,?,?)',
    actId, matrix.id, req.body.activity, req.body.phase || null, req.body.control_id || null, max + 1);
  q.run('UPDATE raci_matrices SET updated_at = ? WHERE id = ?', nowIso(), matrix.id);
  indexRaciActivity(matrix.id, { id: actId, activity: req.body.activity, phase: req.body.phase }, '', matrix.domain_key);
  audit(req, { action: 'raci:add_activity', entityType: 'raci', entityId: matrix.id, summary: `Added activity "${req.body.activity}"` });
  res.status(201).json(hydrate(matrix.id));
}));

router.patch('/:id/activities/:activityId', requirePermission('raci:write'), validate(z.object({
  activity: z.string().min(3).max(400).optional(),
  phase: z.string().max(60).nullable().optional()
})), asyncHandler(async (req, res) => {
  const act = q.get('SELECT * FROM raci_activities WHERE id = ? AND matrix_id = ?', req.params.activityId, req.params.id);
  if (!act) throw notFound('Activity');
  const entries = Object.entries(req.body).filter(([, v]) => v !== undefined);
  if (entries.length) {
    q.run(`UPDATE raci_activities SET ${entries.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`,
      ...entries.map(([, v]) => v), act.id);
  }
  q.run('UPDATE raci_matrices SET updated_at = ? WHERE id = ?', nowIso(), req.params.id);
  res.json(hydrate(req.params.id));
}));

router.delete('/:id/activities/:activityId', requirePermission('raci:write'), asyncHandler(async (req, res) => {
  const act = q.get('SELECT * FROM raci_activities WHERE id = ? AND matrix_id = ?', req.params.activityId, req.params.id);
  if (!act) throw notFound('Activity');
  q.run('DELETE FROM raci_activities WHERE id = ?', act.id);
  removeFromIndex('raci_activity', act.id);
  q.run('UPDATE raci_matrices SET updated_at = ? WHERE id = ?', nowIso(), req.params.id);
  audit(req, { action: 'raci:remove_activity', entityType: 'raci', entityId: req.params.id, summary: `Removed activity "${act.activity}"` });
  res.json(hydrate(req.params.id));
}));

// --------------------------------------------------------- assignments ----

router.put('/:id/assign', requirePermission('raci:write'), validate(z.object({
  activity_id: z.string().min(1),
  role_col_id: z.string().min(1),
  value: z.enum(['R', 'A', 'S', 'C', 'I', ''])
})), asyncHandler(async (req, res) => {
  const matrix = q.get('SELECT * FROM raci_matrices WHERE id = ?', req.params.id);
  if (!matrix) throw notFound('Matrix');
  if (matrix.mode === 'raci' && req.body.value === 'S') {
    throw new HttpError(400, 'Support (S) is only available in RASCI mode. Switch the matrix mode first.');
  }
  const act = q.get('SELECT * FROM raci_activities WHERE id = ? AND matrix_id = ?', req.body.activity_id, matrix.id);
  const col = q.get('SELECT * FROM raci_roles WHERE id = ? AND matrix_id = ?', req.body.role_col_id, matrix.id);
  if (!act || !col) throw notFound('Matrix cell');

  if (req.body.value === '') {
    q.run('DELETE FROM raci_assignments WHERE activity_id = ? AND role_col_id = ?', act.id, col.id);
  } else {
    q.run(
      `INSERT INTO raci_assignments (id, matrix_id, activity_id, role_col_id, value) VALUES (?,?,?,?,?)
       ON CONFLICT(activity_id, role_col_id) DO UPDATE SET value = excluded.value`,
      id('ras'), matrix.id, act.id, col.id, req.body.value
    );
  }
  q.run('UPDATE raci_matrices SET updated_at = ? WHERE id = ?', nowIso(), matrix.id);

  const assignments = q.all(
    `SELECT ra.value, rr.label FROM raci_assignments ra JOIN raci_roles rr ON rr.id = ra.role_col_id WHERE ra.activity_id = ?`,
    act.id
  );
  indexRaciActivity(matrix.id, act, assignments.map((a) => `${a.value}: ${a.label}`).join('; '), matrix.domain_key);

  res.json(hydrate(matrix.id));
}));

router.get('/:id/validate', asyncHandler(async (req, res) => {
  const matrix = q.get('SELECT * FROM raci_matrices WHERE id = ?', req.params.id);
  if (!matrix) throw notFound('Matrix');
  const issues = validateMatrix(matrix.id);
  res.json({
    matrix: { id: matrix.id, name: matrix.name },
    valid: issues.length === 0,
    issues,
    summary: {
      total: issues.length,
      high: issues.filter((i) => i.severity === 'high').length,
      medium: issues.filter((i) => i.severity === 'medium').length,
      low: issues.filter((i) => i.severity === 'low').length
    }
  });
}));

export default router;
