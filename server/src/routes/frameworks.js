/** Authoritative source catalogue and cross-framework mapping engine. */

import express from 'express';
import { z } from 'zod';
import { db, q, nowIso } from '../db/index.js';
import { id } from '../utils/ids.js';
import { authenticate, requirePermission, audit } from '../middleware/auth.js';
import { asyncHandler, validate, notFound, HttpError } from '../middleware/errors.js';
import { domainName, SOURCE_NOTE, DOMAIN_META } from '../knowledge/index.js';
import { suggestMappings } from '../services/ai.js';
import { listParam } from './_shared.js';

const router = express.Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const rows = q.all('SELECT * FROM frameworks ORDER BY kind DESC, code');
  const counts = Object.fromEntries(
    q.all('SELECT framework_id, COUNT(*) AS n FROM framework_requirements GROUP BY framework_id').map((r) => [r.framework_id, r.n])
  );
  const mapped = Object.fromEntries(
    q.all(`SELECT fr.framework_id, COUNT(DISTINCT fr.id) AS n
             FROM framework_requirements fr
             JOIN control_mappings cm ON cm.requirement_id = fr.id
            WHERE cm.coverage IN ('covered','partial')
            GROUP BY fr.framework_id`).map((r) => [r.framework_id, r.n])
  );
  const byId = Object.fromEntries(rows.map((f) => [f.id, f]));
  res.json({
    sourceNote: SOURCE_NOTE,
    items: rows.map((f) => ({
      ...f,
      requirement_count: counts[f.id] || 0,
      mapped_count: mapped[f.id] || 0,
      coverage: counts[f.id] ? Math.round(((mapped[f.id] || 0) / counts[f.id]) * 100) : 0,
      // The edition this one replaced, and the one that replaced it.
      supersedes: f.supersedes_id ? { id: f.supersedes_id, code: byId[f.supersedes_id]?.code || null } : null,
      superseded_by: rows
        .filter((other) => other.supersedes_id === f.id)
        .map((other) => ({ id: other.id, code: other.code, version: other.version }))
    }))
  });
}));

// --------------------------------------------------------- editions -------

/**
 * Register a new edition of a framework already in the catalogue.
 *
 * A published standard does not change in place. When the NCA or ISO issues a
 * new edition, an organisation stays assessed against the one it was certified
 * under until it migrates, so both have to exist at once: the previous edition
 * is marked superseded rather than overwritten, and its requirements and their
 * mappings are left exactly as they were.
 */
router.post('/editions', requirePermission('settings:write'), validate(z.object({
  supersedesCode: z.string().min(2).max(60),
  code: z.string().min(2).max(60),
  name: z.string().min(3).max(300),
  version: z.string().min(1).max(60),
  publishedOn: z.string().max(40).nullable().optional(),
  retiresOn: z.string().max(40).nullable().optional(),
  copyRequirements: z.boolean().default(true)
})), asyncHandler(async (req, res) => {
  const previous = q.get('SELECT * FROM frameworks WHERE code = ?', req.body.supersedesCode);
  if (!previous) throw notFound(`Framework "${req.body.supersedesCode}"`);
  if (q.get('SELECT id FROM frameworks WHERE code = ?', req.body.code)) {
    throw new HttpError(409, `A framework with the code "${req.body.code}" already exists.`);
  }

  const at = nowIso();
  const editionId = id('fwk');

  db.transaction(() => {
    q.run(
      `INSERT INTO frameworks (id, code, name, publisher, version, kind, jurisdiction, description,
         source_note, is_mandatory, edition_status, supersedes_id, published_on, retires_on, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      editionId, req.body.code, req.body.name, previous.publisher, req.body.version,
      previous.kind, previous.jurisdiction, previous.description, previous.source_note,
      previous.is_mandatory, 'current', previous.id,
      req.body.publishedOn || null, req.body.retiresOn || null, at
    );
    q.run("UPDATE frameworks SET edition_status = 'superseded', retires_on = ? WHERE id = ?",
      req.body.retiresOn || previous.retires_on || null, previous.id);

    if (req.body.copyRequirements) {
      // Copied, not moved. The old edition keeps its requirements and their
      // control mappings, so an assessment against it stays readable.
      const requirements = q.all('SELECT * FROM framework_requirements WHERE framework_id = ? ORDER BY ref', previous.id);
      const idMap = new Map();
      for (const r of requirements) {
        const newId = id('req');
        idMap.set(r.id, newId);
        q.run(
          `INSERT INTO framework_requirements
             (id, framework_id, ref, parent_ref, title, statement, domain_key, level,
              provenance, source_status, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          newId, editionId, r.ref, r.parent_ref, r.title, r.statement, r.domain_key, r.level,
          r.provenance, r.source_status, at
        );
      }
      // Each requirement in the new edition is equivalent to its predecessor
      // until somebody assesses the change, which is what a crosswalk says.
      for (const r of requirements) {
        q.run(
          `INSERT INTO crosswalks (id, source_id, target_id, relation, note, created_at)
           VALUES (?,?,?,?,?,?)`,
          id('xwk'), r.id, idMap.get(r.id), 'equivalent',
          `${`Carried forward from ${previous.code} ${previous.version || ''}`.trim()}. Not yet reassessed against the new edition.`,
          at
        );
      }
    }
  })();

  audit(req, {
    action: 'framework:new_edition', entityType: 'framework', entityId: editionId,
    summary: `Registered ${req.body.code} ${req.body.version} superseding ${previous.code}`,
    detail: { copyRequirements: req.body.copyRequirements }
  });

  const created = q.get('SELECT * FROM frameworks WHERE id = ?', editionId);
  res.status(201).json({
    framework: created,
    superseded: q.get('SELECT * FROM frameworks WHERE id = ?', previous.id),
    requirementsCopied: q.get('SELECT COUNT(*) AS n FROM framework_requirements WHERE framework_id = ?', editionId).n,
    note: 'Requirements were carried forward as equivalent crosswalks. Reassess each one against the new edition before relying on the mapping.'
  });
}));

router.patch('/:code/edition', requirePermission('settings:write'), validate(z.object({
  edition_status: z.enum(['current', 'superseded', 'draft']).optional(),
  published_on: z.string().max(40).nullable().optional(),
  retires_on: z.string().max(40).nullable().optional()
})), asyncHandler(async (req, res) => {
  const fw = q.get('SELECT * FROM frameworks WHERE code = ? OR id = ?', req.params.code, req.params.code);
  if (!fw) throw notFound('Framework');
  const entries = Object.entries(req.body).filter(([, v]) => v !== undefined);
  if (entries.length) {
    q.run(`UPDATE frameworks SET ${entries.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`,
      ...entries.map(([, v]) => v), fw.id);
  }
  audit(req, {
    action: 'framework:edition', entityType: 'framework', entityId: fw.id,
    summary: `Updated the edition record for ${fw.code}`, detail: Object.fromEntries(entries)
  });
  res.json({ framework: q.get('SELECT * FROM frameworks WHERE id = ?', fw.id) });
}));

router.get('/:code/requirements', asyncHandler(async (req, res) => {
  const fw = q.get('SELECT * FROM frameworks WHERE code = ? OR id = ?', req.params.code, req.params.code);
  if (!fw) throw notFound('Framework');

  const filters = ['fr.framework_id = ?'];
  const args = [fw.id];
  const domains = listParam(req.query.domain);
  if (domains.length) { filters.push(`fr.domain_key IN (${domains.map(() => '?').join(',')})`); args.push(...domains); }
  if (req.query.search) {
    filters.push('(fr.title LIKE ? OR fr.ref LIKE ? OR fr.statement LIKE ?)');
    const like = `%${req.query.search}%`;
    args.push(like, like, like);
  }

  const rows = q.all(
    `SELECT fr.* FROM framework_requirements fr WHERE ${filters.join(' AND ')} ORDER BY fr.level, fr.id`, ...args
  );

  const mappings = q.all(
    `SELECT cm.requirement_id, cm.coverage, cm.confidence, c.id AS control_pk, c.control_id, c.name AS control_name,
            c.policy_ref, c.procedure_ref, c.domain_key
       FROM control_mappings cm JOIN controls c ON c.id = cm.control_id
      WHERE cm.requirement_id IN (SELECT id FROM framework_requirements WHERE framework_id = ?)`,
    fw.id
  );
  const byReq = {};
  for (const m of mappings) {
    byReq[m.requirement_id] = byReq[m.requirement_id] || [];
    byReq[m.requirement_id].push(m);
  }

  res.json({
    framework: fw,
    sourceNote: SOURCE_NOTE,
    requirements: rows.map((r) => ({
      ...r,
      domain_label: r.domain_key ? domainName(r.domain_key) : null,
      controls: byReq[r.id] || [],
      coverage: coverageOf(byReq[r.id] || [])
    })),
    domains: DOMAIN_META.filter((d) => rows.some((r) => r.domain_key === d.key))
  });
}));

function coverageOf(list) {
  if (!list.length) return 'not_covered';
  if (list.some((m) => m.coverage === 'covered')) return 'covered';
  if (list.some((m) => m.coverage === 'partial')) return 'partial';
  if (list.every((m) => m.coverage === 'not_applicable')) return 'not_applicable';
  return 'not_covered';
}

/** Full traceability chain for one requirement: source → control → documents → evidence. */
router.get('/requirements/:id/trace', asyncHandler(async (req, res) => {
  const requirement = q.get(
    `SELECT fr.*, f.code AS framework_code, f.name AS framework_name, f.kind
       FROM framework_requirements fr JOIN frameworks f ON f.id = fr.framework_id
      WHERE fr.id = ?`, req.params.id
  );
  if (!requirement) throw notFound('Requirement');

  const controls = q.all(
    `SELECT c.*, cm.coverage, cm.rationale, cm.confidence, cm.provenance AS mapping_provenance
       FROM control_mappings cm JOIN controls c ON c.id = cm.control_id
      WHERE cm.requirement_id = ?`, requirement.id
  );

  const chain = controls.map((c) => ({
    control: {
      id: c.id, control_id: c.control_id, name: c.name, domain_key: c.domain_key,
      domain_label: domainName(c.domain_key), coverage: c.coverage, rationale: c.rationale,
      confidence: c.confidence, responsible_role: c.responsible_role, frequency: c.frequency
    },
    policy: c.policy_id ? q.get('SELECT id, reference, title, status FROM documents WHERE id = ?', c.policy_id) : null,
    policy_ref: c.policy_ref,
    standard: c.standard_id ? q.get('SELECT id, reference, title, status FROM documents WHERE id = ?', c.standard_id) : null,
    standard_ref: c.standard_ref,
    procedure: c.procedure_id ? q.get('SELECT id, reference, title, status FROM documents WHERE id = ?', c.procedure_id) : null,
    procedure_ref: c.procedure_ref,
    evidence: q.all('SELECT id, evidence_id, name, evidence_type, frequency, status FROM evidence WHERE control_id = ?', c.id)
  }));

  const crosswalks = q.all(
    `SELECT cw.relation, fr.ref, fr.title, f.code AS framework_code, f.name AS framework_name, fr.id
       FROM crosswalks cw JOIN framework_requirements fr ON fr.id = cw.target_id JOIN frameworks f ON f.id = fr.framework_id
      WHERE cw.source_id = ?
      UNION
     SELECT cw.relation, fr.ref, fr.title, f.code AS framework_code, f.name AS framework_name, fr.id
       FROM crosswalks cw JOIN framework_requirements fr ON fr.id = cw.source_id JOIN frameworks f ON f.id = fr.framework_id
      WHERE cw.target_id = ?`,
    requirement.id, requirement.id
  );

  res.json({
    requirement: { ...requirement, domain_label: requirement.domain_key ? domainName(requirement.domain_key) : null },
    sourceNote: SOURCE_NOTE,
    coverage: coverageOf(controls),
    chain,
    crosswalks
  });
}));

/** Cross-framework equivalences for the mapping visualisation. */
router.get('/crosswalks', asyncHandler(async (req, res) => {
  const rows = q.all(
    `SELECT cw.id, cw.relation, cw.note,
            sf.code AS source_framework, sr.ref AS source_ref, sr.title AS source_title, sr.id AS source_id, sr.domain_key,
            tf.code AS target_framework, tr.ref AS target_ref, tr.title AS target_title, tr.id AS target_id
       FROM crosswalks cw
       JOIN framework_requirements sr ON sr.id = cw.source_id
       JOIN framework_requirements tr ON tr.id = cw.target_id
       JOIN frameworks sf ON sf.id = sr.framework_id
       JOIN frameworks tf ON tf.id = tr.framework_id
      ${req.query.domain ? 'WHERE sr.domain_key = ?' : ''}
      ORDER BY sf.code, sr.ref`,
    ...(req.query.domain ? [req.query.domain] : [])
  );
  res.json({ items: rows.map((r) => ({ ...r, domain_label: r.domain_key ? domainName(r.domain_key) : null })) });
}));

router.post('/crosswalks', requirePermission('mapping:write'), validate(z.object({
  source_id: z.string().min(1),
  target_id: z.string().min(1),
  relation: z.enum(['equivalent', 'broader', 'narrower', 'related']).default('equivalent'),
  note: z.string().max(1000).optional()
})), asyncHandler(async (req, res) => {
  if (req.body.source_id === req.body.target_id) throw new HttpError(400, 'A requirement cannot be mapped to itself.');
  for (const key of ['source_id', 'target_id']) {
    if (!q.get('SELECT id FROM framework_requirements WHERE id = ?', req.body[key])) throw notFound('Requirement');
  }
  q.run(
    'INSERT OR IGNORE INTO crosswalks (id, source_id, target_id, relation, note, created_at) VALUES (?,?,?,?,?,?)',
    id('cwk'), req.body.source_id, req.body.target_id, req.body.relation, req.body.note || null, nowIso()
  );
  audit(req, { action: 'crosswalk:create', entityType: 'crosswalk', summary: 'Created a cross-framework equivalence' });
  res.status(201).json({ ok: true });
}));

router.delete('/crosswalks/:id', requirePermission('mapping:write'), asyncHandler(async (req, res) => {
  q.run('DELETE FROM crosswalks WHERE id = ?', req.params.id);
  res.json({ ok: true });
}));

// ---------------------------------------------------- control mappings ----

router.post('/mappings', requirePermission('mapping:write'), validate(z.object({
  control_id: z.string().min(1),
  requirement_id: z.string().min(1),
  coverage: z.enum(['covered', 'partial', 'not_covered', 'not_applicable']).default('covered'),
  rationale: z.string().max(2000).optional(),
  confidence: z.enum(['low', 'medium', 'high']).default('medium')
})), asyncHandler(async (req, res) => {
  const control = q.get('SELECT * FROM controls WHERE id = ? OR control_id = ?', req.body.control_id, req.body.control_id);
  const requirement = q.get('SELECT * FROM framework_requirements WHERE id = ?', req.body.requirement_id);
  if (!control || !requirement) throw notFound('Control or requirement');
  const at = nowIso();
  q.run(
    `INSERT INTO control_mappings (id, control_id, requirement_id, coverage, rationale, confidence, mapped_by, provenance, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(control_id, requirement_id) DO UPDATE SET
       coverage = excluded.coverage, rationale = excluded.rationale,
       confidence = excluded.confidence, mapped_by = excluded.mapped_by,
       provenance = 'user_input', updated_at = excluded.updated_at`,
    id('map'), control.id, requirement.id, req.body.coverage, req.body.rationale || null,
    req.body.confidence, req.user.name, 'user_input', at, at
  );
  audit(req, {
    action: 'mapping:create', entityType: 'control', entityId: control.id,
    summary: `Mapped ${control.control_id} to ${requirement.ref} (${req.body.coverage})`
  });
  res.status(201).json({ ok: true });
}));

router.delete('/mappings/:id', requirePermission('mapping:write'), asyncHandler(async (req, res) => {
  const row = q.get('SELECT * FROM control_mappings WHERE id = ?', req.params.id);
  if (!row) throw notFound('Mapping');
  q.run('DELETE FROM control_mappings WHERE id = ?', row.id);
  audit(req, { action: 'mapping:delete', entityType: 'control', entityId: row.control_id, summary: 'Removed a control mapping' });
  res.json({ ok: true });
}));

/** Suggest controls for an unmapped requirement. */
router.post('/requirements/:id/suggest', requirePermission('ai:use'), asyncHandler(async (req, res) => {
  const requirement = q.get('SELECT * FROM framework_requirements WHERE id = ?', req.params.id);
  if (!requirement) throw notFound('Requirement');
  const controls = q.all('SELECT * FROM controls');
  const result = await suggestMappings({ requirement, controls, userId: req.user.id });
  res.json(result);
}));

/** Coverage matrix used by the mapping dashboard. */
router.get('/coverage', asyncHandler(async (req, res) => {
  const frameworks = q.all('SELECT * FROM frameworks ORDER BY kind DESC, code');
  const summary = frameworks.map((f) => {
    const reqs = q.all('SELECT id, domain_key FROM framework_requirements WHERE framework_id = ?', f.id);
    const mapped = q.all(
      `SELECT DISTINCT cm.requirement_id, cm.coverage
         FROM control_mappings cm
         JOIN framework_requirements fr ON fr.id = cm.requirement_id
        WHERE fr.framework_id = ?`, f.id
    );
    const byId = Object.fromEntries(mapped.map((m) => [m.requirement_id, m.coverage]));
    const covered = reqs.filter((r) => byId[r.id] === 'covered').length;
    const partial = reqs.filter((r) => byId[r.id] === 'partial').length;
    const notApplicable = reqs.filter((r) => byId[r.id] === 'not_applicable').length;
    const notCovered = reqs.length - covered - partial - notApplicable;
    const assessable = reqs.length - notApplicable;
    return {
      id: f.id, code: f.code, name: f.name, kind: f.kind, is_mandatory: f.is_mandatory,
      total: reqs.length, covered, partial, notCovered, notApplicable,
      coverage: assessable ? Math.round(((covered + partial * 0.5) / assessable) * 100) : 0
    };
  });

  const byDomain = DOMAIN_META.map((d) => {
    const reqs = q.get('SELECT COUNT(*) AS n FROM framework_requirements WHERE domain_key = ?', d.key).n;
    const covered = q.get(
      `SELECT COUNT(DISTINCT fr.id) AS n FROM framework_requirements fr
         JOIN control_mappings cm ON cm.requirement_id = fr.id
        WHERE fr.domain_key = ? AND cm.coverage IN ('covered','partial')`, d.key
    ).n;
    return { key: d.key, name: d.name, category: d.category, requirements: reqs, covered, coverage: reqs ? Math.round((covered / reqs) * 100) : 0 };
  });

  res.json({ sourceNote: SOURCE_NOTE, frameworks: summary, domains: byDomain });
}));

export default router;
