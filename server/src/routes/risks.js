/**
 * Risk register, treatment and the corrective actions that carry it out.
 *
 * The register is a projection of the canonical requirement model, the same
 * one the policies come from: each requirement states the risk it exists to
 * address, so a risk and the controls that treat it share an origin instead of
 * being kept as two separate truths that drift.
 */

import express from 'express';
import { z } from 'zod';
import { db, q, nowIso } from '../db/index.js';
import { id, padNumber } from '../utils/ids.js';
import { authenticate, requirePermission, audit } from '../middleware/auth.js';
import { asyncHandler, validate, notFound, HttpError } from '../middleware/errors.js';
import { domainName, domainShort, DOMAIN_META } from '../knowledge/index.js';
import {
  enrichRisk, buildMatrix, describe, LIKELIHOOD_SCALE, IMPACT_SCALE, TREATMENTS
} from '../services/risk.js';
import { listParam, paginate } from './_shared.js';

const router = express.Router();
router.use(authenticate);

function loadRisk(ref) {
  return q.get('SELECT * FROM risks WHERE id = ? OR risk_id = ?', ref, ref);
}

function controlsFor(riskRowId) {
  return q.all(
    `SELECT rc.id AS link_id, rc.effect, rc.note, rc.provenance,
            c.id, c.control_id, c.name, c.status, c.control_type, c.maturity, c.domain_key
       FROM risk_controls rc
       JOIN controls c ON c.id = rc.control_id
      WHERE rc.risk_id = ?
      ORDER BY c.control_id`,
    riskRowId
  );
}

function actionsFor(sourceType, sourceId) {
  return q.all(
    `SELECT a.*, u.name AS owner_name, v.name AS verified_by_name
       FROM corrective_actions a
       LEFT JOIN users u ON u.id = a.owner_id
       LEFT JOIN users v ON v.id = a.verified_by
      WHERE a.source_type = ? AND a.source_id = ?
      ORDER BY CASE a.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'blocked' THEN 2 ELSE 3 END,
               a.due_date`,
    sourceType, sourceId
  );
}

// ------------------------------------------------------------- register ---

router.get('/', requirePermission('risk:read'), asyncHandler(async (req, res) => {
  const { limit, offset } = paginate(req, 200, 1000);
  const filters = [];
  const args = [];
  for (const [column, values] of [
    ['domain_key', listParam(req.query.domain)],
    ['status', listParam(req.query.status)],
    ['treatment', listParam(req.query.treatment)],
    ['category', listParam(req.query.category)]
  ]) {
    if (values.length) { filters.push(`${column} IN (${values.map(() => '?').join(',')})`); args.push(...values); }
  }
  if (req.query.search) {
    filters.push('(title LIKE ? OR risk_id LIKE ? OR description LIKE ?)');
    const like = `%${req.query.search}%`;
    args.push(like, like, like);
  }
  if (req.query.unassessed === 'true') filters.push('residual_assessed = 0');
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const rows = q.all(`SELECT * FROM risks ${where} ORDER BY risk_id LIMIT ? OFFSET ?`, ...args, limit, offset);
  const enriched = rows.map(enrichRisk);

  // The matrix is drawn from every risk, not the filtered page, or the picture
  // changes as somebody types in the search box.
  const all = q.all('SELECT * FROM risks').map(enrichRisk);

  res.json({
    total: q.get(`SELECT COUNT(*) AS n FROM risks ${where}`, ...args).n,
    limit,
    offset,
    items: enriched.map((r) => ({
      ...r,
      domain_label: domainName(r.domain_key),
      control_count: q.get('SELECT COUNT(*) AS n FROM risk_controls WHERE risk_id = ?', r.id).n,
      open_actions: q.get(
        "SELECT COUNT(*) AS n FROM corrective_actions WHERE source_type = 'risk' AND source_id = ? AND status IN ('open','in_progress','blocked')",
        r.id
      ).n
    })),
    matrix: {
      residual: buildMatrix(all, { position: 'residual' }),
      inherent: buildMatrix(all, { position: 'inherent' })
    },
    summary: {
      total: all.length,
      // Counted rather than computed from the matrix, so an unassessed residual
      // is visible as exactly that instead of hiding inside a band.
      residualAssessed: all.filter((r) => r.residual_assessed).length,
      unassessed: all.filter((r) => !r.residual_assessed).length,
      accepted: all.filter((r) => r.accepted).length,
      acceptancesExpired: all.filter((r) => r.acceptanceExpired).length,
      byResidualRating: ['critical', 'high', 'medium', 'low'].map((band) => ({
        rating: band,
        n: all.filter((r) => r.residual.rating === band).length
      })),
      byInherentRating: ['critical', 'high', 'medium', 'low'].map((band) => ({
        rating: band,
        n: all.filter((r) => r.inherent.rating === band).length
      }))
    },
    facets: {
      domains: q.all('SELECT domain_key, COUNT(*) AS n FROM risks GROUP BY domain_key')
        .map((r) => ({ ...r, label: domainName(r.domain_key) })),
      statuses: q.all('SELECT status, COUNT(*) AS n FROM risks GROUP BY status'),
      treatments: q.all('SELECT treatment, COUNT(*) AS n FROM risks GROUP BY treatment'),
      categories: q.all('SELECT category, COUNT(*) AS n FROM risks GROUP BY category')
    },
    scales: { likelihood: LIKELIHOOD_SCALE, impact: IMPACT_SCALE, treatments: TREATMENTS }
  });
}));

router.get('/:id', requirePermission('risk:read'), asyncHandler(async (req, res) => {
  const row = loadRisk(req.params.id);
  if (!row) throw notFound('Risk');
  const risk = enrichRisk(row);
  res.json({
    risk: { ...risk, domain_label: domainName(risk.domain_key) },
    controls: controlsFor(row.id),
    actions: actionsFor('risk', row.id),
    owner: row.owner_id ? q.get('SELECT id, name, email, job_title FROM users WHERE id = ?', row.owner_id) : null,
    scales: { likelihood: LIKELIHOOD_SCALE, impact: IMPACT_SCALE, treatments: TREATMENTS }
  });
}));

const riskBody = {
  title: z.string().min(5).max(300),
  description: z.string().max(4000).nullable().optional(),
  domain_key: z.string().min(2).max(60),
  category: z.enum(['confidentiality', 'integrity', 'availability', 'compliance',
    'operational', 'third_party', 'financial', 'reputational']).default('operational'),
  threat: z.string().max(1000).nullable().optional(),
  vulnerability: z.string().max(1000).nullable().optional(),
  affected_asset: z.string().max(500).nullable().optional(),
  inherent_likelihood: z.number().int().min(1).max(5),
  inherent_impact: z.number().int().min(1).max(5),
  treatment: z.enum(['mitigate', 'accept', 'transfer', 'avoid']).default('mitigate'),
  treatment_summary: z.string().max(2000).nullable().optional(),
  owner_id: z.string().nullable().optional(),
  owner_role: z.string().max(160).nullable().optional(),
  review_date: z.string().max(40).nullable().optional()
};

router.post('/', requirePermission('risk:write'), validate(z.object(riskBody)),
  asyncHandler(async (req, res) => {
    const b = req.body;
    if (!DOMAIN_META.some((d) => d.key === b.domain_key)) {
      throw new HttpError(400, `"${b.domain_key}" is not a known domain.`);
    }
    const at = nowIso();
    const rowId = id('rsk');
    const existing = q.get(
      "SELECT COUNT(*) AS n FROM risks WHERE domain_key = ?", b.domain_key
    ).n;
    const reference = `RSK-${domainShort(b.domain_key)}-${padNumber(existing + 1, 3)}`;

    q.run(
      `INSERT INTO risks (id, risk_id, title, description, domain_key, category, threat, vulnerability,
         affected_asset, inherent_likelihood, inherent_impact, residual_likelihood, residual_impact,
         residual_assessed, treatment, treatment_summary, owner_id, owner_role, status, review_date,
         provenance, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      rowId, reference, b.title, b.description || null, b.domain_key, b.category,
      b.threat || null, b.vulnerability || null, b.affected_asset || null,
      b.inherent_likelihood, b.inherent_impact,
      // A new risk has no assessed residual position until somebody works one
      // out, so it starts at the inherent figures and says it is unassessed.
      b.inherent_likelihood, b.inherent_impact, 0,
      b.treatment, b.treatment_summary || null, b.owner_id || null, b.owner_role || null,
      'identified', b.review_date || null, 'user_input', at, at
    );

    audit(req, {
      action: 'risk:create', entityType: 'risk', entityId: rowId,
      summary: `Added risk ${reference}: ${b.title}`
    });
    res.status(201).json({ risk: enrichRisk(q.get('SELECT * FROM risks WHERE id = ?', rowId)) });
  })
);

router.patch('/:id', requirePermission('risk:write'), validate(z.object({
  ...Object.fromEntries(Object.entries(riskBody).map(([k, v]) => [k, v.optional()])),
  residual_likelihood: z.number().int().min(1).max(5).optional(),
  residual_impact: z.number().int().min(1).max(5).optional(),
  status: z.enum(['identified', 'assessed', 'treated', 'accepted', 'closed']).optional()
}).partial()), asyncHandler(async (req, res) => {
  const row = loadRisk(req.params.id);
  if (!row) throw notFound('Risk');
  if (row.accepted_at && ['inherent_likelihood', 'inherent_impact', 'treatment'].some((k) => k in req.body)) {
    throw new HttpError(409,
      'This risk has been formally accepted. Withdraw the acceptance before changing its rating or treatment.');
  }

  const entries = Object.entries(req.body).filter(([, v]) => v !== undefined);
  // Touching either residual figure means somebody has now assessed it.
  const assessedResidual = entries.some(([k]) => k === 'residual_likelihood' || k === 'residual_impact');
  if (assessedResidual) entries.push(['residual_assessed', 1]);

  if (entries.length) {
    q.run(
      `UPDATE risks SET ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
      ...entries.map(([, v]) => v), nowIso(), row.id
    );
  }

  const updated = q.get('SELECT * FROM risks WHERE id = ?', row.id);
  audit(req, {
    action: 'risk:update', entityType: 'risk', entityId: row.id,
    summary: `Updated risk ${row.risk_id}`,
    detail: Object.fromEntries(entries)
  });
  res.json({ risk: enrichRisk(updated), controls: controlsFor(row.id) });
}));

router.delete('/:id', requirePermission('risk:write'), asyncHandler(async (req, res) => {
  const row = loadRisk(req.params.id);
  if (!row) throw notFound('Risk');
  if (row.accepted_at) {
    throw new HttpError(409, 'A formally accepted risk is part of the record and cannot be deleted. Close it instead.');
  }
  q.run('DELETE FROM risks WHERE id = ?', row.id);
  audit(req, { action: 'risk:delete', entityType: 'risk', entityId: row.id, summary: `Deleted risk ${row.risk_id}` });
  res.json({ ok: true });
}));

// ------------------------------------------------------------ acceptance --

/**
 * Accepting a risk is a decision with a name and an expiry on it, taken by
 * someone who can approve governance. An acceptance with no end date is a
 * decision nobody ever revisits, so one is required.
 */
router.post('/:id/accept', requirePermission('risk:accept'), validate(z.object({
  rationale: z.string().min(20).max(4000),
  expires: z.string().min(8).max(40)
})), asyncHandler(async (req, res) => {
  const row = loadRisk(req.params.id);
  if (!row) throw notFound('Risk');
  if (row.accepted_at) throw new HttpError(409, 'This risk has already been accepted.');
  if (new Date(req.body.expires) <= new Date()) {
    throw new HttpError(400, 'The acceptance must expire in the future.');
  }
  // The person who owns a risk should not be the one who signs off living with
  // it: the same segregation the platform applies to document approval.
  if (row.owner_id === req.user.id) {
    audit(req, {
      action: 'risk:accept', entityType: 'risk', entityId: row.id,
      summary: `Acceptance refused: ${req.user.email} owns ${row.risk_id}`, outcome: 'denied'
    });
    throw new HttpError(403, 'Segregation of duties: a risk cannot be accepted by its own owner.');
  }

  const at = nowIso();
  q.run(
    `UPDATE risks SET status = 'accepted', treatment = 'accept', accepted_by = ?, accepted_by_name = ?,
       accepted_at = ?, acceptance_rationale = ?, acceptance_expires = ?, updated_at = ? WHERE id = ?`,
    req.user.id, req.user.name, at, req.body.rationale, req.body.expires, at, row.id
  );
  audit(req, {
    action: 'risk:accept', entityType: 'risk', entityId: row.id,
    summary: `Accepted risk ${row.risk_id} until ${req.body.expires}`,
    detail: { rationale: req.body.rationale }
  });
  res.json({ risk: enrichRisk(q.get('SELECT * FROM risks WHERE id = ?', row.id)) });
}));

router.post('/:id/withdraw-acceptance', requirePermission('risk:accept'),
  asyncHandler(async (req, res) => {
    const row = loadRisk(req.params.id);
    if (!row) throw notFound('Risk');
    if (!row.accepted_at) throw new HttpError(409, 'This risk has not been accepted.');
    q.run(
      `UPDATE risks SET status = 'assessed', treatment = 'mitigate', accepted_by = NULL,
         accepted_by_name = NULL, accepted_at = NULL, acceptance_rationale = NULL,
         acceptance_expires = NULL, updated_at = ? WHERE id = ?`,
      nowIso(), row.id
    );
    audit(req, {
      action: 'risk:withdraw_acceptance', entityType: 'risk', entityId: row.id,
      summary: `Withdrew the acceptance of risk ${row.risk_id}`
    });
    res.json({ risk: enrichRisk(q.get('SELECT * FROM risks WHERE id = ?', row.id)) });
  })
);

// -------------------------------------------------------------- controls --

router.post('/:id/controls', requirePermission('risk:write'), validate(z.object({
  controlId: z.string().min(2),
  effect: z.enum(['reduces_likelihood', 'reduces_impact', 'both', 'detects']).default('reduces_likelihood'),
  note: z.string().max(1000).nullable().optional()
})), asyncHandler(async (req, res) => {
  const row = loadRisk(req.params.id);
  if (!row) throw notFound('Risk');
  const control = q.get('SELECT * FROM controls WHERE id = ? OR control_id = ?', req.body.controlId, req.body.controlId);
  if (!control) throw notFound('Control');
  if (q.get('SELECT id FROM risk_controls WHERE risk_id = ? AND control_id = ?', row.id, control.id)) {
    throw new HttpError(409, `${control.control_id} already treats this risk.`);
  }

  q.run(
    `INSERT INTO risk_controls (id, risk_id, control_id, effect, note, provenance, created_at)
     VALUES (?,?,?,?,?,?,?)`,
    id('rkc'), row.id, control.id, req.body.effect, req.body.note || null, 'user_input', nowIso()
  );
  audit(req, {
    action: 'risk:link_control', entityType: 'risk', entityId: row.id,
    summary: `Linked control ${control.control_id} to risk ${row.risk_id}`
  });
  res.status(201).json({ controls: controlsFor(row.id) });
}));

router.delete('/:id/controls/:linkId', requirePermission('risk:write'), asyncHandler(async (req, res) => {
  const row = loadRisk(req.params.id);
  if (!row) throw notFound('Risk');
  const result = q.run('DELETE FROM risk_controls WHERE id = ? AND risk_id = ?', req.params.linkId, row.id);
  if (!result.changes) throw notFound('Control link');
  audit(req, { action: 'risk:unlink_control', entityType: 'risk', entityId: row.id, summary: `Unlinked a control from risk ${row.risk_id}` });
  res.json({ controls: controlsFor(row.id) });
}));

export default router;
