/**
 * Corrective actions.
 *
 * A finding used to be raised and then nothing held it. This is what somebody
 * is actually going to do about a finding, a gap or a risk, by when, and who
 * checked that they did. Verification is a separate act by a separate person,
 * the same rule the platform applies to document approval and evidence.
 */

import express from 'express';
import { z } from 'zod';
import { q, nowIso } from '../db/index.js';
import { id, padNumber } from '../utils/ids.js';
import { authenticate, requirePermission, audit } from '../middleware/auth.js';
import { asyncHandler, validate, notFound, HttpError } from '../middleware/errors.js';
import { notify } from '../services/notify.js';
import { domainName } from '../knowledge/index.js';
import { listParam, paginate } from './_shared.js';

const router = express.Router();
router.use(authenticate);

const SOURCE_TABLE = {
  finding: { table: 'findings', label: 'Finding' },
  gap_item: { table: 'gap_items', label: 'Gap item' },
  risk: { table: 'risks', label: 'Risk' },
  assessment: { table: 'assessments', label: 'Assessment' }
};

function enrich(row) {
  if (!row) return null;
  const today = new Date().toISOString().slice(0, 10);
  const open = ['open', 'in_progress', 'blocked'].includes(row.status);
  return {
    ...row,
    domain_label: row.domain_key ? domainName(row.domain_key) : null,
    overdue: Boolean(open && row.due_date && row.due_date < today),
    verified: Boolean(row.verified_at)
  };
}

function loadAction(ref) {
  return q.get(
    `SELECT a.*, u.name AS owner_name, u.email AS owner_email, v.name AS verified_by_name,
            c.name AS created_by_name
       FROM corrective_actions a
       LEFT JOIN users u ON u.id = a.owner_id
       LEFT JOIN users v ON v.id = a.verified_by
       LEFT JOIN users c ON c.id = a.created_by
      WHERE a.id = ? OR a.action_id = ?`,
    ref, ref
  );
}

/** Resolve what an action is about, so the list can show it without a join per row. */
function describeSource(sourceType, sourceId) {
  if (sourceType === 'manual' || !sourceId) return null;
  const spec = SOURCE_TABLE[sourceType];
  if (!spec) return null;
  if (sourceType === 'finding') {
    const row = q.get('SELECT id, title, severity, status FROM findings WHERE id = ?', sourceId);
    return row ? { type: 'finding', label: 'Finding', id: row.id, title: row.title, badge: row.severity, status: row.status } : null;
  }
  if (sourceType === 'risk') {
    const row = q.get('SELECT id, risk_id, title, status FROM risks WHERE id = ?', sourceId);
    return row ? { type: 'risk', label: 'Risk', id: row.id, ref: row.risk_id, title: row.title, status: row.status } : null;
  }
  if (sourceType === 'gap_item') {
    const row = q.get('SELECT id, requirement_ref, gap, status FROM gap_items WHERE id = ?', sourceId);
    return row ? { type: 'gap_item', label: 'Gap', id: row.id, ref: row.requirement_ref, title: row.gap, status: row.status } : null;
  }
  const row = q.get('SELECT id, title, status FROM assessments WHERE id = ?', sourceId);
  return row ? { type: 'assessment', label: 'Assessment', id: row.id, title: row.title, status: row.status } : null;
}

// ----------------------------------------------------------------- list ---

router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset } = paginate(req, 200, 1000);
  const filters = [];
  const args = [];
  for (const [column, values] of [
    ['a.status', listParam(req.query.status)],
    ['a.priority', listParam(req.query.priority)],
    ['a.source_type', listParam(req.query.source)],
    ['a.domain_key', listParam(req.query.domain)]
  ]) {
    if (values.length) { filters.push(`${column} IN (${values.map(() => '?').join(',')})`); args.push(...values); }
  }
  if (req.query.mine === 'true') { filters.push('a.owner_id = ?'); args.push(req.user.id); }
  if (req.query.overdue === 'true') {
    filters.push("a.due_date < date('now') AND a.status IN ('open','in_progress','blocked')");
  }
  if (req.query.search) {
    filters.push('(a.title LIKE ? OR a.action_id LIKE ? OR a.description LIKE ?)');
    const like = `%${req.query.search}%`;
    args.push(like, like, like);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const rows = q.all(
    `SELECT a.*, u.name AS owner_name, v.name AS verified_by_name
       FROM corrective_actions a
       LEFT JOIN users u ON u.id = a.owner_id
       LEFT JOIN users v ON v.id = a.verified_by
       ${where}
      ORDER BY CASE a.status WHEN 'blocked' THEN 0 WHEN 'open' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END,
               a.due_date IS NULL, a.due_date
      LIMIT ? OFFSET ?`,
    ...args, limit, offset
  );

  res.json({
    total: q.get(`SELECT COUNT(*) AS n FROM corrective_actions a ${where}`, ...args).n,
    limit,
    offset,
    items: rows.map((r) => ({ ...enrich(r), source: describeSource(r.source_type, r.source_id) })),
    summary: {
      open: q.get("SELECT COUNT(*) AS n FROM corrective_actions WHERE status IN ('open','in_progress','blocked')").n,
      overdue: q.get("SELECT COUNT(*) AS n FROM corrective_actions WHERE status IN ('open','in_progress','blocked') AND due_date < date('now')").n,
      blocked: q.get("SELECT COUNT(*) AS n FROM corrective_actions WHERE status = 'blocked'").n,
      completedAwaitingVerification: q.get("SELECT COUNT(*) AS n FROM corrective_actions WHERE status = 'completed' AND verified_at IS NULL").n,
      mine: q.get("SELECT COUNT(*) AS n FROM corrective_actions WHERE owner_id = ? AND status IN ('open','in_progress','blocked')", req.user.id).n
    },
    facets: {
      statuses: q.all('SELECT status, COUNT(*) AS n FROM corrective_actions GROUP BY status'),
      priorities: q.all('SELECT priority, COUNT(*) AS n FROM corrective_actions GROUP BY priority'),
      sources: q.all('SELECT source_type, COUNT(*) AS n FROM corrective_actions GROUP BY source_type')
    }
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const row = loadAction(req.params.id);
  if (!row) throw notFound('Corrective action');
  res.json({ action: enrich(row), source: describeSource(row.source_type, row.source_id) });
}));

// --------------------------------------------------------------- create ---

router.post('/', requirePermission('action:write'), validate(z.object({
  title: z.string().min(5).max(300),
  description: z.string().max(4000).nullable().optional(),
  source_type: z.enum(['finding', 'gap_item', 'risk', 'assessment', 'manual']).default('manual'),
  source_id: z.string().nullable().optional(),
  domain_key: z.string().max(60).nullable().optional(),
  owner_id: z.string().min(2),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  due_date: z.string().min(8).max(40)
})), asyncHandler(async (req, res) => {
  const b = req.body;
  if (b.source_type !== 'manual') {
    if (!b.source_id) throw new HttpError(400, `A ${b.source_type.replace('_', ' ')} action needs the record it comes from.`);
    const spec = SOURCE_TABLE[b.source_type];
    if (!q.get(`SELECT id FROM ${spec.table} WHERE id = ?`, b.source_id)) {
      throw notFound(spec.label);
    }
  }
  const owner = q.get("SELECT * FROM users WHERE id = ? AND status = 'active'", b.owner_id);
  if (!owner) throw new HttpError(400, 'The owner must be an active user. An action with nobody accountable is not an action.');

  const at = nowIso();
  const rowId = id('act');
  const reference = `CA-${padNumber(q.get('SELECT COUNT(*) AS n FROM corrective_actions').n + 1, 4)}`;

  q.run(
    `INSERT INTO corrective_actions (id, action_id, title, description, source_type, source_id,
       domain_key, owner_id, priority, due_date, status, progress, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    rowId, reference, b.title, b.description || null, b.source_type, b.source_id || null,
    b.domain_key || null, owner.id, b.priority, b.due_date, 'open', 0, req.user.id, at, at
  );

  if (owner.id !== req.user.id) {
    notify({
      userId: owner.id, kind: 'action_assigned', entityType: 'corrective_action', entityId: rowId,
      url: '/actions', actor: req.user,
      severity: b.priority === 'critical' ? 'danger' : 'warn',
      title: `Action assigned: ${reference}`,
      body: `${b.title} — due ${b.due_date}.`,
      dedupeKey: `action:${rowId}:assigned`
    });
  }

  audit(req, {
    action: 'action:create', entityType: 'corrective_action', entityId: rowId,
    summary: `Raised ${reference} against ${b.source_type}, owned by ${owner.email}, due ${b.due_date}`
  });
  res.status(201).json({ action: enrich(loadAction(rowId)) });
}));

// --------------------------------------------------------------- update ---

router.patch('/:id', requirePermission('action:write'), validate(z.object({
  title: z.string().min(5).max(300).optional(),
  description: z.string().max(4000).nullable().optional(),
  owner_id: z.string().min(2).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  due_date: z.string().min(8).max(40).optional(),
  status: z.enum(['open', 'in_progress', 'blocked', 'completed', 'cancelled']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  blocked_reason: z.string().max(1000).nullable().optional()
}).partial()), asyncHandler(async (req, res) => {
  const row = loadAction(req.params.id);
  if (!row) throw notFound('Corrective action');
  if (row.verified_at) {
    throw new HttpError(409, 'This action has been verified closed. Raise a new action rather than reopening it.');
  }
  if (req.body.status === 'blocked' && !(req.body.blocked_reason || row.blocked_reason)) {
    throw new HttpError(400, 'Say what is blocking it. "Blocked" with no reason tells the next reader nothing.');
  }

  const entries = Object.entries(req.body).filter(([, v]) => v !== undefined);
  // Completing implies finished, whatever the slider last said.
  if (req.body.status === 'completed') {
    entries.push(['progress', 100], ['completed_at', nowIso()]);
  } else if (req.body.status && req.body.status !== 'completed' && row.completed_at) {
    entries.push(['completed_at', null]);
  }

  if (entries.length) {
    q.run(
      `UPDATE corrective_actions SET ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
      ...entries.map(([, v]) => v), nowIso(), row.id
    );
  }

  const updated = loadAction(row.id);
  if (req.body.owner_id && req.body.owner_id !== row.owner_id && req.body.owner_id !== req.user.id) {
    notify({
      userId: req.body.owner_id, kind: 'action_assigned', entityType: 'corrective_action', entityId: row.id,
      url: '/actions', actor: req.user, severity: 'warn',
      title: `Action reassigned to you: ${row.action_id}`,
      body: `${updated.title} — due ${updated.due_date}.`,
      dedupeKey: `action:${row.id}:assigned:${req.body.owner_id}`
    });
  }

  audit(req, {
    action: 'action:update', entityType: 'corrective_action', entityId: row.id,
    summary: `Updated ${row.action_id}`, detail: Object.fromEntries(entries)
  });
  res.json({ action: enrich(updated) });
}));

/**
 * Verify a completed action. The owner cannot verify their own work, and an
 * action that is not complete cannot be verified at all.
 */
router.post('/:id/verify', requirePermission('action:verify'), validate(z.object({
  note: z.string().max(2000).nullable().optional()
}).partial()), asyncHandler(async (req, res) => {
  const row = loadAction(req.params.id);
  if (!row) throw notFound('Corrective action');
  if (row.status !== 'completed') {
    throw new HttpError(409, 'Only a completed action can be verified.');
  }
  if (row.verified_at) throw new HttpError(409, 'This action has already been verified.');
  if (row.owner_id === req.user.id) {
    audit(req, {
      action: 'action:verify', entityType: 'corrective_action', entityId: row.id,
      summary: `Verification refused: ${req.user.email} owns ${row.action_id}`, outcome: 'denied'
    });
    throw new HttpError(403, 'Segregation of duties: an action cannot be verified by the person who carried it out.');
  }

  const at = nowIso();
  q.run('UPDATE corrective_actions SET verified_by = ?, verified_at = ?, updated_at = ? WHERE id = ?',
    req.user.id, at, at, row.id);

  // A finding whose action has been verified closed is resolved.
  if (row.source_type === 'finding' && row.source_id) {
    const outstanding = q.get(
      "SELECT COUNT(*) AS n FROM corrective_actions WHERE source_type = 'finding' AND source_id = ? AND verified_at IS NULL AND status != 'cancelled'",
      row.source_id
    ).n;
    if (outstanding === 0) {
      q.run("UPDATE findings SET status = 'resolved', updated_at = ? WHERE id = ? AND status IN ('open','acknowledged')", at, row.source_id);
    }
  }

  if (row.owner_id && row.owner_id !== req.user.id) {
    notify({
      userId: row.owner_id, kind: 'action_verified', entityType: 'corrective_action', entityId: row.id,
      url: '/actions', actor: req.user,
      title: `Action verified: ${row.action_id}`,
      body: req.body.note || `${req.user.name} confirmed this is done.`,
      dedupeKey: `action:${row.id}:verified`
    });
  }

  audit(req, {
    action: 'action:verify', entityType: 'corrective_action', entityId: row.id,
    summary: `Verified ${row.action_id} as complete`, detail: { note: req.body.note }
  });
  res.json({ action: enrich(loadAction(row.id)) });
}));

router.delete('/:id', requirePermission('action:write'), asyncHandler(async (req, res) => {
  const row = loadAction(req.params.id);
  if (!row) throw notFound('Corrective action');
  if (row.verified_at) throw new HttpError(409, 'A verified action is part of the record. Cancel a live one instead of deleting it.');
  q.run('DELETE FROM corrective_actions WHERE id = ?', row.id);
  audit(req, { action: 'action:delete', entityType: 'corrective_action', entityId: row.id, summary: `Deleted ${row.action_id}` });
  res.json({ ok: true });
}));

export default router;
