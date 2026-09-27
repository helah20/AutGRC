/**
 * Statement of Applicability.
 *
 * ISO/IEC 27001 requires a reasoned decision for every Annex A control,
 * including the ones excluded, with the justification recorded either way.
 *
 * Only the decision and its justification are stored. Whether a control is
 * actually implemented is read from the existing mappings and control records,
 * so the SoA cannot claim an implementation the control library does not show.
 */

import express from 'express';
import { z } from 'zod';
import { db, q, nowIso } from '../db/index.js';
import { id } from '../utils/ids.js';
import { authenticate, requirePermission, audit } from '../middleware/auth.js';
import { asyncHandler, validate, notFound, HttpError } from '../middleware/errors.js';
import { domainName, SOURCE_NOTE } from '../knowledge/index.js';

const router = express.Router();
router.use(authenticate);

/**
 * Implementation status is derived, never stored: a requirement is implemented
 * when every control mapped to it is implemented, partial when some are, and
 * not implemented when none is.
 */
function implementationOf(controls) {
  if (!controls.length) return 'not_implemented';
  const implemented = controls.filter((c) => c.status === 'implemented').length;
  if (implemented === controls.length) return 'implemented';
  if (implemented > 0 || controls.some((c) => c.status === 'approved')) return 'partial';
  return 'planned';
}

router.get('/:code', asyncHandler(async (req, res) => {
  const framework = q.get('SELECT * FROM frameworks WHERE code = ? OR id = ?', req.params.code, req.params.code);
  if (!framework) throw notFound('Framework');

  const requirements = q.all(
    'SELECT * FROM framework_requirements WHERE framework_id = ? ORDER BY ref',
    framework.id
  );
  const decisions = Object.fromEntries(
    q.all('SELECT * FROM soa_decisions WHERE framework_id = ?', framework.id).map((d) => [d.requirement_id, d])
  );

  const rows = requirements.map((requirement) => {
    const controls = q.all(
      `SELECT c.id, c.control_id, c.name, c.status, c.domain_key, cm.coverage
         FROM control_mappings cm
         JOIN controls c ON c.id = cm.control_id
        WHERE cm.requirement_id = ?
        ORDER BY c.control_id`,
      requirement.id
    );
    const decision = decisions[requirement.id];
    // Absent a recorded decision, a requirement is applicable: excluding one
    // is the act that has to be deliberate and justified, not including it.
    const applicable = decision ? Boolean(decision.applicable) : true;

    return {
      requirement_id: requirement.id,
      ref: requirement.ref,
      title: requirement.title,
      statement: requirement.statement,
      domain_key: requirement.domain_key,
      domain_label: requirement.domain_key ? domainName(requirement.domain_key) : null,
      level: requirement.level,
      applicable,
      justification: decision?.justification || null,
      decided_by_name: decision?.decided_by_name || null,
      decided_at: decision?.decided_at || null,
      decision_recorded: Boolean(decision),
      controls,
      implementation: applicable ? implementationOf(controls) : 'excluded'
    };
  });

  const applicable = rows.filter((r) => r.applicable);
  res.json({
    framework: {
      id: framework.id, code: framework.code, name: framework.name,
      version: framework.version, publisher: framework.publisher,
      edition_status: framework.edition_status
    },
    sourceNote: SOURCE_NOTE,
    rows,
    summary: {
      total: rows.length,
      applicable: applicable.length,
      excluded: rows.length - applicable.length,
      implemented: applicable.filter((r) => r.implementation === 'implemented').length,
      partial: applicable.filter((r) => r.implementation === 'partial').length,
      planned: applicable.filter((r) => r.implementation === 'planned').length,
      notImplemented: applicable.filter((r) => r.implementation === 'not_implemented').length,
      // An exclusion with no justification is the finding an auditor writes up
      // first, so it is counted separately rather than buried in "excluded".
      exclusionsWithoutJustification: rows.filter((r) => !r.applicable && !r.justification).length,
      decisionsRecorded: rows.filter((r) => r.decision_recorded).length
    }
  });
}));

/** Record or change the applicability decision for one requirement. */
router.put('/:code/decisions/:requirementId', requirePermission('soa:write'), validate(z.object({
  applicable: z.boolean(),
  justification: z.string().max(4000).nullable().optional()
})), asyncHandler(async (req, res) => {
  const framework = q.get('SELECT * FROM frameworks WHERE code = ? OR id = ?', req.params.code, req.params.code);
  if (!framework) throw notFound('Framework');
  const requirement = q.get(
    'SELECT * FROM framework_requirements WHERE id = ? AND framework_id = ?',
    req.params.requirementId, framework.id
  );
  if (!requirement) throw notFound('Requirement');

  // Excluding a control is the decision an auditor will ask about, so it does
  // not get to be silent.
  if (!req.body.applicable && !(req.body.justification || '').trim()) {
    throw new HttpError(400,
      'An excluded control needs a justification. ISO/IEC 27001 requires the reason for every exclusion to be stated.');
  }

  const at = nowIso();
  q.run(
    `INSERT INTO soa_decisions (id, requirement_id, framework_id, applicable, justification,
       decided_by, decided_by_name, decided_at, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT (requirement_id) DO UPDATE SET
       applicable = excluded.applicable, justification = excluded.justification,
       decided_by = excluded.decided_by, decided_by_name = excluded.decided_by_name,
       decided_at = excluded.decided_at`,
    id('soa'), requirement.id, framework.id, req.body.applicable ? 1 : 0,
    req.body.justification || null, req.user.id, req.user.name, at, at
  );

  audit(req, {
    action: 'soa:decision', entityType: 'framework_requirement', entityId: requirement.id,
    summary: `${req.body.applicable ? 'Included' : 'Excluded'} ${framework.code} ${requirement.ref} in the Statement of Applicability`,
    detail: { justification: req.body.justification }
  });
  res.json({ decision: q.get('SELECT * FROM soa_decisions WHERE requirement_id = ?', requirement.id) });
}));

router.delete('/:code/decisions/:requirementId', requirePermission('soa:write'), asyncHandler(async (req, res) => {
  const result = q.run('DELETE FROM soa_decisions WHERE requirement_id = ?', req.params.requirementId);
  if (!result.changes) throw notFound('Decision');
  audit(req, {
    action: 'soa:decision_cleared', entityType: 'framework_requirement', entityId: req.params.requirementId,
    summary: 'Cleared a Statement of Applicability decision'
  });
  res.json({ ok: true });
}));

export default router;
