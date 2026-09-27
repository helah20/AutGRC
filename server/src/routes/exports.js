/** Export engine: Word, PDF and Excel. */

import express from 'express';
import { q, fromJson } from '../db/index.js';
import { authenticate, requirePermission, audit } from '../middleware/auth.js';
import { asyncHandler, notFound, HttpError } from '../middleware/errors.js';
import { buildDocx } from '../services/export-docx.js';
import { buildPdf } from '../services/export-pdf.js';
import {
  buildControlWorkbook, buildRaciWorkbook, buildMappingWorkbook,
  buildGapWorkbook, buildRegisterWorkbook, buildSoaWorkbook, buildRiskTreatmentWorkbook
} from '../services/export-xlsx.js';
import { enrichRisk } from '../services/risk.js';
import { validateMatrix } from '../services/review.js';
import { domainName } from '../knowledge/index.js';
import { getOrgProfile, listParam, enrichDocuments } from './_shared.js';

const router = express.Router();
router.use(authenticate);
router.use(requirePermission('export:run'));

function send(res, buffer, filename, mime) {
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/[^\w.\- ]/g, '')}"`);
  res.setHeader('Content-Length', Buffer.byteLength(buffer));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
}

const MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

function documentPayload(documentId) {
  const doc = q.get('SELECT * FROM documents WHERE id = ?', documentId);
  if (!doc) throw notFound('Document');
  const sections = q.all('SELECT * FROM document_sections WHERE document_id = ? ORDER BY position', doc.id)
    .filter((s) => !s.section_key.startsWith('_'));
  const meta = fromJson(doc.generation_meta, {});
  const codes = meta.frameworks || [];
  const frameworks = codes.length
    ? q.all(`SELECT * FROM frameworks WHERE code IN (${codes.map(() => '?').join(',')})`, ...codes)
    : [];
  return {
    document: doc,
    sections,
    org: getOrgProfile(),
    owner: doc.owner_id ? q.get('SELECT name, job_title FROM users WHERE id = ?', doc.owner_id) : null,
    approver: doc.approver_id ? q.get('SELECT name, job_title FROM users WHERE id = ?', doc.approver_id) : null,
    versions: q.all('SELECT version, change_note, author_name, created_at FROM document_versions WHERE document_id = ? ORDER BY created_at', doc.id),
    approvals: q.all('SELECT action, actor_name, actor_role, created_at FROM document_approvals WHERE document_id = ? ORDER BY created_at', doc.id),
    frameworks,
    domainName: domainName(doc.domain_key)
  };
}

router.get('/documents/:id.docx', asyncHandler(async (req, res) => {
  const payload = documentPayload(req.params.id);
  const buffer = await buildDocx(payload);
  audit(req, { action: 'export:docx', entityType: 'document', entityId: req.params.id, summary: `Exported ${payload.document.reference} to Word` });
  send(res, buffer, `${payload.document.reference} ${payload.document.title}.docx`, MIME.docx);
}));

router.get('/documents/:id.pdf', asyncHandler(async (req, res) => {
  const payload = documentPayload(req.params.id);
  const buffer = await buildPdf(payload);
  audit(req, { action: 'export:pdf', entityType: 'document', entityId: req.params.id, summary: `Exported ${payload.document.reference} to PDF` });
  send(res, buffer, `${payload.document.reference} ${payload.document.title}.pdf`, MIME.pdf);
}));

router.get('/controls.xlsx', asyncHandler(async (req, res) => {
  const domains = listParam(req.query.domain);
  const where = domains.length ? `WHERE domain_key IN (${domains.map(() => '?').join(',')})` : '';
  const controls = q.all(`SELECT * FROM controls ${where} ORDER BY control_id`, ...domains)
    .map((c) => ({ ...c, domain_label: domainName(c.domain_key) }));
  const ids = controls.map((c) => c.id);
  const evidence = ids.length
    ? q.all(`SELECT e.*, c.control_id AS control_ref FROM evidence e JOIN controls c ON c.id = e.control_id WHERE e.control_id IN (${ids.map(() => '?').join(',')})`, ...ids)
    : [];
  const mappings = ids.length
    ? q.all(
        `SELECT cm.control_id, cm.coverage, fr.ref, f.code AS framework_code
           FROM control_mappings cm JOIN framework_requirements fr ON fr.id = cm.requirement_id
           JOIN frameworks f ON f.id = fr.framework_id
          WHERE cm.control_id IN (${ids.map(() => '?').join(',')})`, ...ids)
    : [];
  const buffer = await buildControlWorkbook({
    controls, evidence, mappings,
    orgName: getOrgProfile().org_name,
    domainLabel: domains.length === 1 ? domainName(domains[0]) : null
  });
  audit(req, { action: 'export:xlsx', entityType: 'control', summary: `Exported ${controls.length} controls to Excel` });
  send(res, buffer, 'Control Matrix.xlsx', MIME.xlsx);
}));

router.get('/raci/:id.xlsx', asyncHandler(async (req, res) => {
  const matrix = q.get('SELECT * FROM raci_matrices WHERE id = ?', req.params.id);
  if (!matrix) throw notFound('Matrix');
  const buffer = await buildRaciWorkbook({
    matrix,
    columns: q.all('SELECT * FROM raci_roles WHERE matrix_id = ? ORDER BY position', matrix.id),
    activities: q.all('SELECT * FROM raci_activities WHERE matrix_id = ? ORDER BY position', matrix.id),
    assignments: q.all('SELECT * FROM raci_assignments WHERE matrix_id = ?', matrix.id),
    issues: validateMatrix(matrix.id),
    orgName: getOrgProfile().org_name
  });
  audit(req, { action: 'export:xlsx', entityType: 'raci', entityId: matrix.id, summary: `Exported RACI matrix "${matrix.name}"` });
  send(res, buffer, `${matrix.name}.xlsx`, MIME.xlsx);
}));

router.get('/mappings.xlsx', asyncHandler(async (req, res) => {
  const codes = listParam(req.query.framework);
  const frameworks = codes.length
    ? q.all(`SELECT * FROM frameworks WHERE code IN (${codes.map(() => '?').join(',')})`, ...codes)
    : q.all('SELECT * FROM frameworks ORDER BY kind DESC, code');

  const rows = [];
  const summary = [];
  for (const f of frameworks) {
    const reqs = q.all('SELECT * FROM framework_requirements WHERE framework_id = ? ORDER BY level, id', f.id);
    let covered = 0, partial = 0, notApplicable = 0;
    for (const r of reqs) {
      const maps = q.all(
        `SELECT cm.*, c.control_id, c.name, c.policy_ref, c.procedure_ref, c.id AS control_pk
           FROM control_mappings cm JOIN controls c ON c.id = cm.control_id WHERE cm.requirement_id = ?`, r.id
      );
      if (!maps.length) {
        rows.push({ framework_code: f.code, ref: r.ref, title: r.title, domain_key: r.domain_key, domain_label: r.domain_key ? domainName(r.domain_key) : '', coverage: 'not_covered' });
        continue;
      }
      for (const m of maps) {
        if (m.coverage === 'covered') covered += 1;
        else if (m.coverage === 'partial') partial += 1;
        else if (m.coverage === 'not_applicable') notApplicable += 1;
        rows.push({
          framework_code: f.code, ref: r.ref, title: r.title,
          domain_key: r.domain_key, domain_label: r.domain_key ? domainName(r.domain_key) : '',
          coverage: m.coverage, control_ref: m.control_id, control_name: m.name,
          policy_ref: m.policy_ref, procedure_ref: m.procedure_ref,
          evidence: q.all('SELECT name FROM evidence WHERE control_id = ?', m.control_pk).map((e) => e.name).join('; '),
          confidence: m.confidence, rationale: m.rationale
        });
      }
    }
    const assessable = Math.max(reqs.length - notApplicable, 0);
    summary.push({
      name: f.name, total: reqs.length, covered, partial,
      notCovered: Math.max(assessable - covered - partial, 0), notApplicable,
      coverage: assessable ? Math.round(((covered + partial * 0.5) / assessable) * 100) : 0
    });
  }

  const buffer = await buildMappingWorkbook({ rows, frameworks, summary, orgName: getOrgProfile().org_name });
  audit(req, { action: 'export:xlsx', entityType: 'mapping', summary: `Exported framework mapping (${frameworks.map((f) => f.code).join(', ')})` });
  send(res, buffer, 'Framework Mapping.xlsx', MIME.xlsx);
}));

router.get('/gap/:id.xlsx', asyncHandler(async (req, res) => {
  const assessment = q.get('SELECT * FROM assessments WHERE id = ?', req.params.id);
  if (!assessment) throw notFound('Assessment');
  const items = q.all(
    `SELECT g.*, d.reference AS document_ref FROM gap_items g LEFT JOIN documents d ON d.id = g.document_id
      WHERE g.assessment_id = ? ORDER BY g.requirement_ref`, assessment.id
  );
  const buffer = await buildGapWorkbook({ assessment, items, orgName: getOrgProfile().org_name });
  audit(req, { action: 'export:xlsx', entityType: 'assessment', entityId: assessment.id, summary: `Exported gap assessment "${assessment.name}"` });
  send(res, buffer, `${assessment.name}.xlsx`, MIME.xlsx);
}));

router.get('/register.xlsx', asyncHandler(async (req, res) => {
  const documents = enrichDocuments(q.all('SELECT * FROM documents ORDER BY reference'));
  const buffer = await buildRegisterWorkbook({ documents, orgName: getOrgProfile().org_name });
  audit(req, { action: 'export:xlsx', entityType: 'document', summary: `Exported the document register (${documents.length} documents)` });
  send(res, buffer, 'Document Register.xlsx', MIME.xlsx);
}));

/**
 * Statement of Applicability. Built from the same derivation the API uses, so
 * the spreadsheet an auditor receives says what the screen says.
 */
router.get('/soa.xlsx', asyncHandler(async (req, res) => {
  const code = req.query.framework || 'ISO-27001';
  const framework = q.get('SELECT * FROM frameworks WHERE code = ? OR id = ?', code, code);
  if (!framework) throw notFound(`Framework "${code}"`);

  const decisions = Object.fromEntries(
    q.all('SELECT * FROM soa_decisions WHERE framework_id = ?', framework.id).map((d) => [d.requirement_id, d])
  );
  const rows = q.all('SELECT * FROM framework_requirements WHERE framework_id = ? ORDER BY ref', framework.id)
    .map((requirement) => {
      const controls = q.all(
        `SELECT c.id, c.control_id, c.status FROM control_mappings cm
           JOIN controls c ON c.id = cm.control_id
          WHERE cm.requirement_id = ? ORDER BY c.control_id`,
        requirement.id
      );
      const decision = decisions[requirement.id];
      const applicable = decision ? Boolean(decision.applicable) : true;
      const implemented = controls.filter((c) => c.status === 'implemented').length;
      return {
        ref: requirement.ref,
        title: requirement.title,
        applicable,
        justification: decision?.justification || null,
        decided_by_name: decision?.decided_by_name || null,
        decided_at: decision?.decided_at || null,
        controls,
        implementation: !applicable ? 'excluded'
          : !controls.length ? 'not_implemented'
            : implemented === controls.length ? 'implemented'
              : implemented > 0 || controls.some((c) => c.status === 'approved') ? 'partial' : 'planned'
      };
    });

  const applicable = rows.filter((r) => r.applicable);
  const summary = {
    total: rows.length,
    applicable: applicable.length,
    excluded: rows.length - applicable.length,
    implemented: applicable.filter((r) => r.implementation === 'implemented').length,
    partial: applicable.filter((r) => r.implementation === 'partial').length,
    planned: applicable.filter((r) => r.implementation === 'planned').length,
    notImplemented: applicable.filter((r) => r.implementation === 'not_implemented').length,
    exclusionsWithoutJustification: rows.filter((r) => !r.applicable && !r.justification).length,
    decisionsRecorded: Object.keys(decisions).length
  };

  const buffer = await buildSoaWorkbook({ framework, rows, summary, orgName: getOrgProfile().org_name });
  audit(req, {
    action: 'export:xlsx', entityType: 'framework', entityId: framework.id,
    summary: `Exported the Statement of Applicability for ${framework.code}`
  });
  send(res, buffer, `Statement of Applicability - ${framework.code}.xlsx`, MIME.xlsx);
}));

router.get('/risk-treatment.xlsx', asyncHandler(async (req, res) => {
  const risks = q.all('SELECT * FROM risks ORDER BY risk_id').map((row) => {
    const risk = enrichRisk(row);
    return {
      ...risk,
      domain_label: domainName(risk.domain_key),
      owner_name: row.owner_id ? q.get('SELECT name FROM users WHERE id = ?', row.owner_id)?.name : null,
      controls: q.all(
        `SELECT c.control_id FROM risk_controls rc JOIN controls c ON c.id = rc.control_id
          WHERE rc.risk_id = ? ORDER BY c.control_id`, row.id
      ),
      open_actions: q.get(
        "SELECT COUNT(*) AS n FROM corrective_actions WHERE source_type = 'risk' AND source_id = ? AND status IN ('open','in_progress','blocked')",
        row.id
      ).n
    };
  });

  const buffer = await buildRiskTreatmentWorkbook({ risks, orgName: getOrgProfile().org_name });
  audit(req, {
    action: 'export:xlsx', entityType: 'risk',
    summary: `Exported the risk treatment plan (${risks.length} risks)`
  });
  send(res, buffer, 'Risk Treatment Plan.xlsx', MIME.xlsx);
}));

export default router;
