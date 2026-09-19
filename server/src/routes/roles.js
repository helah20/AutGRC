/** Cybersecurity roles and responsibilities. */

import express from 'express';
import { z } from 'zod';
import { db, q, nowIso, toJson, fromJson } from '../db/index.js';
import { id, slug } from '../utils/ids.js';
import { authenticate, requirePermission, audit } from '../middleware/auth.js';
import { asyncHandler, validate, notFound, HttpError } from '../middleware/errors.js';
import { indexRole, removeFromIndex } from '../services/search.js';
import { ROLE_LIBRARY, ROLE_INDEX, DOMAIN_MODELS, domainName, resolveText, buildParameterSet } from '../knowledge/index.js';
import { getOrgProfile } from './_shared.js';

const router = express.Router();
router.use(authenticate);

const ITEM_KINDS = ['responsibility', 'accountability', 'activity', 'approval', 'escalation'];

function hydrate(row) {
  if (!row) return null;
  const items = q.all('SELECT * FROM role_items WHERE role_id = ? ORDER BY kind, position', row.id);
  const grouped = Object.fromEntries(ITEM_KINDS.map((k) => [k, items.filter((i) => i.kind === k)]));

  // RACI assignments for this role across every matrix it appears in.
  const assignments = q.all(
    `SELECT m.id AS matrix_id, m.name AS matrix_name, m.domain_key, a.activity, a.phase, ra.value
       FROM raci_assignments ra
       JOIN raci_roles rr ON rr.id = ra.role_col_id
       JOIN raci_activities a ON a.id = ra.activity_id
       JOIN raci_matrices m ON m.id = ra.matrix_id
      WHERE rr.role_id = ? AND ra.value != ''
      ORDER BY m.name, a.position`,
    row.id
  );

  return {
    ...row,
    domain_label: row.domain_key ? domainName(row.domain_key) : null,
    competencies: fromJson(row.competencies, []),
    interfaces: fromJson(row.interfaces, []),
    items: grouped,
    raci: assignments
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const rows = q.all('SELECT * FROM roles ORDER BY category, name');
  const counts = Object.fromEntries(
    q.all('SELECT role_id, COUNT(*) AS n FROM role_items GROUP BY role_id').map((r) => [r.role_id, r.n])
  );
  res.json({
    items: rows.map((r) => ({
      ...r,
      domain_label: r.domain_key ? domainName(r.domain_key) : null,
      competencies: fromJson(r.competencies, []),
      item_count: counts[r.id] || 0
    })),
    library: ROLE_LIBRARY.map((r) => ({
      code: r.code, name: r.name, shortName: r.shortName, category: r.category,
      exists: rows.some((x) => x.code === r.code)
    }))
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const row = q.get('SELECT * FROM roles WHERE id = ? OR code = ?', req.params.id, req.params.id);
  if (!row) throw notFound('Role');
  res.json({ role: hydrate(row) });
}));

/** Create a role from the curated library, fully populated. */
router.post('/from-library', requirePermission('role:write'), validate(z.object({
  code: z.string().min(2),
  domainKey: z.string().optional()
})), asyncHandler(async (req, res) => {
  const template = ROLE_INDEX[req.body.code];
  if (!template) throw new HttpError(404, 'That role is not in the library');
  if (q.get('SELECT id FROM roles WHERE code = ?', template.code)) {
    throw new HttpError(409, `The role "${template.name}" already exists.`);
  }
  const params = buildParameterSet(req.body.domainKey || 'governance', getOrgProfile());
  const rowId = id('rol');
  const at = nowIso();

  db.transaction(() => {
    q.run(
      `INSERT INTO roles (id, code, name, short_name, category, purpose, reporting_line, authority, domain_key,
         competencies, interfaces, provenance, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      rowId, template.code, template.name, template.shortName, template.category,
      resolveText(template.purpose, params), resolveText(template.reportingLine, params), resolveText(template.authority, params),
      req.body.domainKey || null, toJson(template.competencies), toJson(template.interfaces),
      'organizational_policy', at, at
    );
    for (const [kind, list] of [
      ['responsibility', template.responsibilities], ['accountability', template.accountabilities],
      ['activity', template.activities], ['approval', template.approvals], ['escalation', template.escalations]
    ]) {
      list.forEach((text, i) => q.run(
        'INSERT INTO role_items (id, role_id, kind, text, position, provenance, created_at) VALUES (?,?,?,?,?,?,?)',
        id('rit'), rowId, kind, resolveText(text, params), i, 'ai_recommendation', at
      ));
    }
  })();

  const row = q.get('SELECT * FROM roles WHERE id = ?', rowId);
  indexRole(row, q.all('SELECT * FROM role_items WHERE role_id = ?', rowId));
  audit(req, { action: 'role:create', entityType: 'role', entityId: rowId, summary: `Created role ${template.name} from the library` });
  res.status(201).json({ role: hydrate(row) });
}));

const roleSchema = z.object({
  name: z.string().min(3).max(200),
  short_name: z.string().max(60).optional(),
  category: z.string().max(60).optional(),
  purpose: z.string().max(4000).optional(),
  reporting_line: z.string().max(2000).optional(),
  authority: z.string().max(4000).optional(),
  domain_key: z.string().nullable().optional(),
  competencies: z.array(z.string().max(300)).optional(),
  interfaces: z.array(z.object({ role: z.string().max(200), nature: z.string().max(600) })).optional()
});

router.post('/', requirePermission('role:write'), validate(roleSchema), asyncHandler(async (req, res) => {
  const code = slug(req.body.name) || `role-${Date.now()}`;
  if (q.get('SELECT id FROM roles WHERE code = ?', code)) throw new HttpError(409, 'A role with that name already exists.');
  const rowId = id('rol');
  const at = nowIso();
  q.run(
    `INSERT INTO roles (id, code, name, short_name, category, purpose, reporting_line, authority, domain_key,
       competencies, interfaces, provenance, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    rowId, code, req.body.name, req.body.short_name || req.body.name.slice(0, 24), req.body.category || 'Custom',
    req.body.purpose || null, req.body.reporting_line || null, req.body.authority || null, req.body.domain_key || null,
    toJson(req.body.competencies || []), toJson(req.body.interfaces || []), 'user_input', at, at
  );
  const row = q.get('SELECT * FROM roles WHERE id = ?', rowId);
  indexRole(row, []);
  audit(req, { action: 'role:create', entityType: 'role', entityId: rowId, summary: `Created role ${req.body.name}` });
  res.status(201).json({ role: hydrate(row) });
}));

router.patch('/:id', requirePermission('role:write'), validate(roleSchema.partial()), asyncHandler(async (req, res) => {
  const row = q.get('SELECT * FROM roles WHERE id = ? OR code = ?', req.params.id, req.params.id);
  if (!row) throw notFound('Role');
  const body = { ...req.body };
  if (body.competencies) body.competencies = toJson(body.competencies);
  if (body.interfaces) body.interfaces = toJson(body.interfaces);
  const entries = Object.entries(body).filter(([, v]) => v !== undefined);
  if (entries.length) {
    q.run(`UPDATE roles SET ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
      ...entries.map(([, v]) => v), nowIso(), row.id);
  }
  const updated = q.get('SELECT * FROM roles WHERE id = ?', row.id);
  indexRole(updated, q.all('SELECT * FROM role_items WHERE role_id = ?', row.id));
  audit(req, { action: 'role:update', entityType: 'role', entityId: row.id, summary: `Updated role ${row.name}` });
  res.json({ role: hydrate(updated) });
}));

router.delete('/:id', requirePermission('role:write'), asyncHandler(async (req, res) => {
  const row = q.get('SELECT * FROM roles WHERE id = ? OR code = ?', req.params.id, req.params.id);
  if (!row) throw notFound('Role');
  q.run('DELETE FROM roles WHERE id = ?', row.id);
  removeFromIndex('role', row.id);
  audit(req, { action: 'role:delete', entityType: 'role', entityId: row.id, summary: `Deleted role ${row.name}` });
  res.json({ ok: true });
}));

// ---------------------------------------------------------- role items ----

router.post('/:id/items', requirePermission('role:write'), validate(z.object({
  kind: z.enum(ITEM_KINDS),
  text: z.string().min(3).max(1200),
  domain_key: z.string().nullable().optional()
})), asyncHandler(async (req, res) => {
  const row = q.get('SELECT * FROM roles WHERE id = ? OR code = ?', req.params.id, req.params.id);
  if (!row) throw notFound('Role');
  const max = q.get('SELECT COALESCE(MAX(position), -1) AS p FROM role_items WHERE role_id = ? AND kind = ?', row.id, req.body.kind).p;
  const itemId = id('rit');
  q.run(
    'INSERT INTO role_items (id, role_id, kind, text, position, domain_key, provenance, created_at) VALUES (?,?,?,?,?,?,?,?)',
    itemId, row.id, req.body.kind, req.body.text, max + 1, req.body.domain_key || row.domain_key, 'user_input', nowIso()
  );
  indexRole(row, q.all('SELECT * FROM role_items WHERE role_id = ?', row.id));
  audit(req, { action: 'role:item_create', entityType: 'role', entityId: row.id, summary: `Added ${req.body.kind} to ${row.name}` });
  res.status(201).json({ item: q.get('SELECT * FROM role_items WHERE id = ?', itemId) });
}));

router.put('/:id/items/:itemId', requirePermission('role:write'), validate(z.object({ text: z.string().min(3).max(1200) })), asyncHandler(async (req, res) => {
  const item = q.get('SELECT * FROM role_items WHERE id = ? AND role_id = ?', req.params.itemId, req.params.id);
  if (!item) throw notFound('Responsibility');
  q.run("UPDATE role_items SET text = ?, provenance = 'user_input' WHERE id = ?", req.body.text, item.id);
  const row = q.get('SELECT * FROM roles WHERE id = ?', item.role_id);
  indexRole(row, q.all('SELECT * FROM role_items WHERE role_id = ?', row.id));
  audit(req, { action: 'role:item_update', entityType: 'role', entityId: row.id, summary: `Edited ${item.kind} on ${row.name}` });
  res.json({ item: q.get('SELECT * FROM role_items WHERE id = ?', item.id) });
}));

router.delete('/:id/items/:itemId', requirePermission('role:write'), asyncHandler(async (req, res) => {
  const item = q.get('SELECT * FROM role_items WHERE id = ? AND role_id = ?', req.params.itemId, req.params.id);
  if (!item) throw notFound('Responsibility');
  q.run('DELETE FROM role_items WHERE id = ?', item.id);
  res.json({ ok: true });
}));

/** Coverage view: which domains a role participates in and how heavily. */
router.get('/:id/coverage', asyncHandler(async (req, res) => {
  const row = q.get('SELECT * FROM roles WHERE id = ? OR code = ?', req.params.id, req.params.id);
  if (!row) throw notFound('Role');
  const coverage = Object.entries(DOMAIN_MODELS).map(([key, model]) => {
    const acts = model.raciActivities.filter((a) => a.assign[row.code]);
    return {
      domain: key,
      label: model.name,
      accountable: acts.filter((a) => a.assign[row.code] === 'A').length,
      responsible: acts.filter((a) => a.assign[row.code] === 'R').length,
      consulted: acts.filter((a) => ['C', 'S'].includes(a.assign[row.code])).length,
      informed: acts.filter((a) => a.assign[row.code] === 'I').length
    };
  }).filter((c) => c.accountable + c.responsible + c.consulted > 0);
  res.json({ role: { id: row.id, code: row.code, name: row.name }, coverage });
}));

export default router;
