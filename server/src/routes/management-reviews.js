/**
 * Management reviews: the minutes of the meeting at which top management
 * reviews the ISMS (ISO/IEC 27001 9.3) and the cybersecurity supervisory
 * committee receives review and audit results (NCA ECC 1-2-3, 1-8-3).
 *
 * The inputs are captured when the review is recorded, so the minutes show
 * what the committee was told. A decision that needs work raises a corrective
 * action, which carries it to completion and verification like any other.
 * Closed minutes are a record and are not edited.
 */

import express from 'express';
import { z } from 'zod';
import { db, q, nowIso } from '../db/index.js';
import { id, padNumber } from '../utils/ids.js';
import { authenticate, requirePermission, audit } from '../middleware/auth.js';
import { asyncHandler, validate, notFound, HttpError } from '../middleware/errors.js';
import { managementReviewInputs } from '../services/management-reports.js';
import { reviewDecisions, reviewMinutesPayload, DECISION_CATEGORY } from '../services/assurance-records.js';
import { buildDocx } from '../services/export-docx.js';
import { buildPdf } from '../services/export-pdf.js';
import { getOrgProfile } from './_shared.js';

const router = express.Router();
router.use(authenticate);

function load(ref) {
  return q.get('SELECT * FROM management_reviews WHERE id = ? OR review_id = ?', ref, ref);
}

function detail(row) {
  let inputs = null;
  try { inputs = JSON.parse(row.inputs_snapshot); } catch { /* shown as absent */ }
  return { review: { ...row, inputs_snapshot: undefined }, inputs, decisions: reviewDecisions(row.id) };
}

function assertOpen(row) {
  if (row.status === 'closed') throw new HttpError(409, 'These minutes are closed. A closed record is not edited; record a further review instead.');
}

router.get('/', asyncHandler(async (req, res) => {
  const rows = q.all(
    `SELECT r.id, r.review_id, r.held_on, r.forum, r.chair, r.status, r.closed_at,
            (SELECT COUNT(*) FROM management_review_decisions d WHERE d.review_id = r.id) AS decisions
       FROM management_reviews r ORDER BY r.held_on DESC, r.created_at DESC`);
  res.json({ items: rows, categories: DECISION_CATEGORY });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const row = load(req.params.id);
  if (!row) throw notFound('Management review');
  res.json(detail(row));
}));

router.post('/', requirePermission('review:write'), validate(z.object({
  held_on: z.string().min(8).max(40),
  forum: z.string().max(200).nullable().optional(),
  chair: z.string().max(200).nullable().optional(),
  attendees: z.string().max(2000).nullable().optional(),
  summary: z.string().max(8000).nullable().optional()
})), asyncHandler(async (req, res) => {
  const b = req.body;
  const at = nowIso();
  const rowId = id('mrv');
  const reference = `MR-${padNumber(q.get('SELECT COUNT(*) AS n FROM management_reviews').n + 1, 4)}`;
  const inputs = { ...managementReviewInputs(), capturedAt: at };
  q.run(
    `INSERT INTO management_reviews (id, review_id, held_on, forum, chair, attendees, summary, inputs_snapshot,
       status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    rowId, reference, b.held_on, b.forum || null, b.chair || null, b.attendees || null, b.summary || null,
    JSON.stringify(inputs), 'draft', req.user.id, at, at
  );
  audit(req, { action: 'review:create', entityType: 'management_review', entityId: rowId, summary: `Recorded management review ${reference} held ${b.held_on}` });
  res.status(201).json(detail(load(rowId)));
}));

router.patch('/:id', requirePermission('review:write'), validate(z.object({
  held_on: z.string().min(8).max(40),
  forum: z.string().max(200).nullable(),
  chair: z.string().max(200).nullable(),
  attendees: z.string().max(2000).nullable(),
  summary: z.string().max(8000).nullable()
}).partial()), asyncHandler(async (req, res) => {
  const row = load(req.params.id);
  if (!row) throw notFound('Management review');
  assertOpen(row);
  const entries = Object.entries(req.body).filter(([, v]) => v !== undefined);
  if (entries.length) {
    q.run(`UPDATE management_reviews SET ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
      ...entries.map(([, v]) => v), nowIso(), row.id);
  }
  audit(req, { action: 'review:update', entityType: 'management_review', entityId: row.id, summary: `Updated ${row.review_id}` });
  res.json(detail(load(row.id)));
}));

/**
 * Record a decision. With `raise_action`, the decision becomes a corrective
 * action owned by the named person, so it is tracked to verification rather
 * than left in the minutes.
 */
router.post('/:id/decisions', requirePermission('review:write'), validate(z.object({
  category: z.enum(['improvement', 'change', 'resources', 'risk', 'other']),
  decision: z.string().min(5).max(2000),
  owner_id: z.string().nullable().optional(),
  due_date: z.string().max(40).nullable().optional(),
  raise_action: z.boolean().optional()
})), asyncHandler(async (req, res) => {
  const row = load(req.params.id);
  if (!row) throw notFound('Management review');
  assertOpen(row);
  const b = req.body;
  if (b.raise_action && (!b.owner_id || !b.due_date)) {
    throw new HttpError(400, 'An action needs an owner and a due date. A decision with nobody accountable is not an action.');
  }
  const owner = b.owner_id ? q.get("SELECT * FROM users WHERE id = ? AND status = 'active'", b.owner_id) : null;
  if (b.owner_id && !owner) throw new HttpError(400, 'The owner must be an active user.');

  const at = nowIso();
  const position = q.get('SELECT COUNT(*) AS n FROM management_review_decisions WHERE review_id = ?', row.id).n + 1;
  db.transaction(() => {
    let actionId = null;
    if (b.raise_action) {
      actionId = id('act');
      const reference = `CA-${padNumber(q.get('SELECT COUNT(*) AS n FROM corrective_actions').n + 1, 4)}`;
      q.run(
        `INSERT INTO corrective_actions (id, action_id, title, description, source_type, source_id,
           domain_key, owner_id, priority, due_date, status, progress, created_by, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        actionId, reference, b.decision.slice(0, 300),
        `Decision ${position} of management review ${row.review_id} held ${row.held_on}.`,
        'manual', null, null, owner.id, 'medium', b.due_date, 'open', 0, req.user.id, at, at
      );
    }
    q.run(
      `INSERT INTO management_review_decisions (id, review_id, position, category, decision, owner_id, due_date, action_id, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      id('mrd'), row.id, position, b.category, b.decision, owner?.id || null, b.due_date || null, actionId, at
    );
    q.run('UPDATE management_reviews SET updated_at = ? WHERE id = ?', at, row.id);
  })();
  audit(req, { action: 'review:decision', entityType: 'management_review', entityId: row.id,
    summary: `Recorded decision ${position} in ${row.review_id}${b.raise_action ? ' and raised a corrective action' : ''}` });
  res.status(201).json(detail(load(row.id)));
}));

router.post('/:id/close', requirePermission('review:write'), asyncHandler(async (req, res) => {
  const row = load(req.params.id);
  if (!row) throw notFound('Management review');
  assertOpen(row);
  const at = nowIso();
  q.run("UPDATE management_reviews SET status = 'closed', closed_by = ?, closed_at = ?, updated_at = ? WHERE id = ?",
    req.user.id, at, at, row.id);
  audit(req, { action: 'review:close', entityType: 'management_review', entityId: row.id, summary: `Closed the minutes of ${row.review_id}` });
  res.json(detail(load(row.id)));
}));

router.get('/:id/minutes.:format(docx|pdf)', requirePermission('export:run'), asyncHandler(async (req, res) => {
  const payload = reviewMinutesPayload(req.params.id);
  if (!payload) throw notFound('Management review');
  const org = getOrgProfile();
  const docx = req.params.format === 'docx';
  const buffer = docx ? await buildDocx({ ...payload, org }) : await buildPdf({ ...payload, org });
  audit(req, { action: `export:${req.params.format}`, entityType: 'management_review', entityId: req.params.id,
    summary: `Exported the minutes of ${payload.document.reference}` });
  res.setHeader('Content-Type', docx
    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${payload.document.reference} Minutes.${req.params.format}"`);
  res.send(Buffer.from(buffer));
}));

export default router;
