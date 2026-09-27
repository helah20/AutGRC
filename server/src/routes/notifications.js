/**
 * Notification inbox and the My Work queue.
 *
 * The queue is computed from live state rather than from stored notifications:
 * a notification records that someone was told, the queue answers what is
 * actually outstanding. Resolving the work empties the queue whether or not
 * the notification was ever read.
 */

import express from 'express';
import { z } from 'zod';
import { q, nowIso } from '../db/index.js';
import { authenticate, requirePermission, audit } from '../middleware/auth.js';
import { asyncHandler, validate, notFound } from '../middleware/errors.js';
import { runSweeps } from '../services/notify.js';
import { buildMyWork, paginate } from './_shared.js';

const router = express.Router();
router.use(authenticate);

// -------------------------------------------------------------- inbox ------

router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset } = paginate(req, 40, 200);
  const unreadOnly = req.query.unread === 'true';
  const where = unreadOnly ? 'WHERE user_id = ? AND read_at IS NULL' : 'WHERE user_id = ?';
  const items = q.all(
    `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    req.user.id, limit, offset
  );
  res.json({
    items,
    total: q.get(`SELECT COUNT(*) AS n FROM notifications ${where}`, req.user.id).n,
    unread: q.get('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', req.user.id).n,
    limit,
    offset
  });
}));

router.get('/unread-count', asyncHandler(async (req, res) => {
  res.json({
    unread: q.get('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', req.user.id).n
  });
}));

router.post('/:id/read', asyncHandler(async (req, res) => {
  const row = q.get('SELECT * FROM notifications WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (!row) throw notFound('Notification');
  if (!row.read_at) q.run('UPDATE notifications SET read_at = ? WHERE id = ?', nowIso(), row.id);
  res.json({ notification: q.get('SELECT * FROM notifications WHERE id = ?', row.id) });
}));

router.post('/read-all', asyncHandler(async (req, res) => {
  const result = q.run(
    'UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL',
    nowIso(), req.user.id
  );
  res.json({ ok: true, marked: result.changes });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const result = q.run('DELETE FROM notifications WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (!result.changes) throw notFound('Notification');
  res.json({ ok: true });
}));

/** Re-run the sweeps on demand rather than waiting for the six-hour interval. */
router.post('/sweep', requirePermission('settings:write'), validate(z.object({}).passthrough()),
  asyncHandler(async (req, res) => {
    const result = runSweeps();
    audit(req, {
      action: 'notification:sweep', entityType: 'notification',
      summary: `Notification sweep raised ${result.review.raised + result.evidence.raised} notification(s)`,
      detail: result
    });
    res.json(result);
  })
);

// ------------------------------------------------------------- my work -----

/**
 * What is outstanding for the signed-in user, grouped by the action it needs.
 * Each group is empty for a role that cannot act on it, so a read-only account
 * sees an honest empty queue rather than work it cannot do.
 */
router.get('/my-work', asyncHandler(async (req, res) => {
  res.json(buildMyWork(req.user));
}));

export default router;
