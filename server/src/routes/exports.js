/** Export engine: Word, PDF and Excel. */

import express from 'express';
import { q, fromJson } from '../db/index.js';
import { authenticate, requirePermission, audit } from '../middleware/auth.js';
import { asyncHandler, notFound, HttpError } from '../middleware/errors.js';
import { buildDocx } from '../services/export-docx.js';
import { buildPdf } from '../services/export-pdf.js';
import { buildSwimlanePptx } from '../services/export-pptx.js';
import { previewPackage } from '../services/generator.js';
import { exportLanguage, sheetText, cellText, attachment } from '../services/export-i18n.js';
import {
  buildControlWorkbook, buildRaciWorkbook, buildMappingWorkbook,
  buildGapWorkbook, buildRegisterWorkbook, buildSoaWorkbook, buildRiskTreatmentWorkbook
} from '../services/export-xlsx.js';
import { evaluateApplicability } from '../services/applicability.js';
import { auditReportPayload } from '../services/assurance-records.js';
import { enrichRisk } from '../services/risk.js';
import { validateMatrix } from '../services/review.js';
import { domainName } from '../knowledge/index.js';
import { getOrgProfile, listParam, enrichDocuments } from './_shared.js';

const router = express.Router();
router.use(authenticate);
router.use(requirePermission('export:run'));

function send(res, buffer, filename, mime) {
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', attachment(filename));
  res.setHeader('Content-Length', Buffer.byteLength(buffer));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
}

const MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};

function approvalSource(doc) {
  if (!doc.translation_of) return doc.id;
  const own = q.get('SELECT COUNT(*) AS n FROM document_approvals WHERE document_id = ?', doc.id).n;
  return own ? doc.id : doc.translation_of;
}

/**
 * The version history as a reader of the issued document needs it: the
 * platform's own record of the generated draft becomes the first draft under
 * its owner's name, and a published document shows the version it was issued
 * as, which the record only gains when someone edits it afterwards.
 */
function exportVersions(doc) {
  const rows = q.all(
    `SELECT v.version, v.change_note, v.change_type, COALESCE(u.name, v.author_name) AS author_name, v.created_at
       FROM document_versions v LEFT JOIN users u ON u.id = v.author_id
      WHERE v.document_id = ? ORDER BY v.created_at`, doc.id);
  if (doc.status === 'published' && !rows.some((v) => v.version === doc.version)) {
    const published = q.get(
      "SELECT actor_name, created_at FROM document_approvals WHERE document_id = ? AND action = 'published' ORDER BY created_at DESC LIMIT 1",
      approvalSource(doc));
    rows.push({
      version: doc.version, change_type: 'published', change_note: null,
      author_name: published?.actor_name || null,
      created_at: published?.created_at || doc.effective_date || doc.updated_at
    });
  }
  return rows;
}

/**
 * The document in the language the file is asked for.
 *
 * A file follows the reader's language, not the language the document was
 * written in. The same document in that language is used when it exists —
 * the version made from it, or the original it was made from. Otherwise it
 * is rebuilt from the same domain model and values in that language, the way
 * the Arabic version of a package is generated; a section a person wrote
 * stays as they wrote it, since there is no model text to rebuild it from.
 */
function documentInLanguage(doc, lang) {
  const stored = (id) => q.all('SELECT * FROM document_sections WHERE document_id = ? ORDER BY position', id);
  const own = (d) => {
    const all = stored(d.id);
    const flowRow = all.find((x) => x.section_key === '_flow');
    return { doc: d, sections: all.filter((x) => !x.section_key.startsWith('_')), flow: flowRow ? fromJson(flowRow.body, null) : null };
  };
  if ((doc.language || 'en') === lang) return own(doc);

  const sibling = q.get(
    `SELECT * FROM documents
      WHERE id != ? AND language = ? AND doc_type = ? AND status != 'retired'
        AND (translation_of = ? OR id = ? OR (translation_of IS NOT NULL AND translation_of = ?))
      ORDER BY updated_at DESC LIMIT 1`,
    doc.id, lang, doc.doc_type, doc.id, doc.translation_of || '', doc.translation_of || '');
  if (sibling) {
    const found = own(sibling);
    // The reader exported this document; its own status and dates are the record.
    return { ...found, doc: { ...sibling, status: doc.status, version: doc.version, effective_date: doc.effective_date, review_date: doc.review_date } };
  }

  const meta = fromJson(doc.generation_meta, {});
  if (!meta.domain && !doc.domain_key) return own(doc);
  let built = null;
  try {
    const preview = previewPackage({
      domainKey: doc.domain_key, docTypes: [doc.doc_type], frameworkCodes: meta.frameworks || [],
      org: getOrgProfile(), parameterOverrides: meta.parameterOverrides || {}, language: lang
    });
    if (preview.language === lang) built = preview.documents[0];
  } catch { built = null; }
  if (!built) return own(doc);

  const original = own(doc);
  const written = new Map(original.sections.filter((x) => x.provenance === 'user_input').map((x) => [x.section_key, x]));
  return {
    doc: { ...doc, title: built.title, language: lang },
    sections: built.sections.map((x, i) => written.get(x.key)
      || { section_key: x.key, heading: x.heading, body: x.body, provenance: x.provenance, position: i }),
    flow: built.flow || original.flow
  };
}

function documentPayload(documentId, lang = 'en') {
  const source = q.get('SELECT * FROM documents WHERE id = ?', documentId);
  if (!source) throw notFound('Document');
  const { doc, sections, flow } = documentInLanguage(source, lang);
  const meta = fromJson(doc.generation_meta, {});
  const codes = meta.frameworks || [];
  const frameworks = codes.length
    ? q.all(`SELECT * FROM frameworks WHERE code IN (${codes.map(() => '?').join(',')})`, ...codes)
    : [];
  return {
    document: doc,
    sections,
    flow,
    lang,
    org: getOrgProfile(),
    owner: doc.owner_id ? q.get('SELECT name, job_title FROM users WHERE id = ?', doc.owner_id) : null,
    approver: doc.approver_id ? q.get('SELECT name, job_title FROM users WHERE id = ?', doc.approver_id) : null,
    versions: exportVersions(doc),
    // A version in another language is the same approved document, so it
    // carries its original's approval record rather than an empty one. The
    // role is the person's job title; the stored value is a platform role code.
    approvals: q.all(
      `SELECT a.action, a.actor_name, COALESCE(u.job_title, a.actor_role) AS actor_role, a.created_at
         FROM document_approvals a LEFT JOIN users u ON u.id = a.actor_id
        WHERE a.document_id = ? ORDER BY a.created_at`, approvalSource(doc)),
    frameworks,
    domainName: domainName(doc.domain_key)
  };
}

router.get('/documents/:id.docx', asyncHandler(async (req, res) => {
  const lang = exportLanguage(req);
  const payload = documentPayload(req.params.id, lang);
  const buffer = await buildDocx(payload);
  audit(req, {
    action: 'export:docx', entityType: 'document', entityId: req.params.id,
    summary: `Exported ${payload.document.reference} to Word${lang === 'ar' ? ' (Arabic)' : ''}`
  });
  send(res, buffer, `${payload.document.reference} ${payload.document.title}.docx`, MIME.docx);
}));

// A procedure's process flow as an editable PowerPoint swimlane chart. Only a
// document with a flow has one to export.
router.get('/documents/:id.pptx', asyncHandler(async (req, res) => {
  const lang = exportLanguage(req);
  const payload = documentPayload(req.params.id, lang);
  const doc = payload.document;
  if (!payload.flow?.steps?.length) throw new HttpError(400, 'This document has no process flow to export.');
  const params = fromJson(doc.generation_meta, {}).parameters || {};
  const buffer = await buildSwimlanePptx({
    flow: payload.flow, params, lang, title: doc.title,
    subtitle: `${doc.reference} · ${lang === 'ar' ? 'الإصدار' : 'Version'} ${doc.version}`
  });
  audit(req, {
    action: 'export:pptx', entityType: 'document', entityId: req.params.id,
    summary: `Exported the ${doc.reference} process flow to PowerPoint${lang === 'ar' ? ' (Arabic)' : ''}`
  });
  send(res, buffer, `${doc.reference} ${lang === 'ar' ? 'مخطط سير العملية' : 'swimlane'}.pptx`, MIME.pptx);
}));

router.get('/documents/:id.pdf', asyncHandler(async (req, res) => {
  const lang = exportLanguage(req);
  const payload = documentPayload(req.params.id, lang);
  const buffer = await buildPdf(payload);
  audit(req, {
    action: 'export:pdf', entityType: 'document', entityId: req.params.id,
    summary: `Exported ${payload.document.reference} to PDF${lang === 'ar' ? ' (Arabic)' : ''}`
  });
  send(res, buffer, `${payload.document.reference} ${payload.document.title}.pdf`, MIME.pdf);
}));

router.get('/controls.xlsx', asyncHandler(async (req, res) => {
  const lang = exportLanguage(req);
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
  const buffer = await buildControlWorkbook({ lang,
    controls, evidence, mappings,
    orgName: getOrgProfile().org_name,
    domainLabel: domains.length === 1 ? domainName(domains[0]) : null
  });
  audit(req, { action: 'export:xlsx', entityType: 'control', summary: `Exported ${controls.length} controls to Excel` });
  send(res, buffer, `${sheetText('Control Matrix', lang)}.xlsx`, MIME.xlsx);
}));

router.get('/raci/:id.xlsx', asyncHandler(async (req, res) => {
  const lang = exportLanguage(req);
  const matrix = q.get('SELECT * FROM raci_matrices WHERE id = ?', req.params.id);
  if (!matrix) throw notFound('Matrix');
  const buffer = await buildRaciWorkbook({ lang,
    matrix,
    columns: q.all('SELECT * FROM raci_roles WHERE matrix_id = ? ORDER BY position', matrix.id),
    activities: q.all('SELECT * FROM raci_activities WHERE matrix_id = ? ORDER BY position', matrix.id),
    assignments: q.all('SELECT * FROM raci_assignments WHERE matrix_id = ?', matrix.id),
    issues: validateMatrix(matrix.id),
    orgName: getOrgProfile().org_name
  });
  audit(req, { action: 'export:xlsx', entityType: 'raci', entityId: matrix.id, summary: `Exported RACI matrix "${matrix.name}"` });
  send(res, buffer, `${cellText(matrix.name, lang)}.xlsx`, MIME.xlsx);
}));

router.get('/mappings.xlsx', asyncHandler(async (req, res) => {
  const lang = exportLanguage(req);
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
      // The summary counts requirements, each at the best coverage any of its
      // controls gives; the sheet below still lists every mapping.
      const best = ['covered', 'partial', 'not_applicable'].find((c) => maps.some((m) => m.coverage === c));
      if (best === 'covered') covered += 1;
      else if (best === 'partial') partial += 1;
      else if (best === 'not_applicable') notApplicable += 1;
      for (const m of maps) {
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

  const buffer = await buildMappingWorkbook({ lang, rows, frameworks, summary, orgName: getOrgProfile().org_name });
  audit(req, { action: 'export:xlsx', entityType: 'mapping', summary: `Exported framework mapping (${frameworks.map((f) => f.code).join(', ')})` });
  send(res, buffer, `${sheetText('Framework Compliance Mapping', lang)}.xlsx`, MIME.xlsx);
}));

router.get('/gap/:id.xlsx', asyncHandler(async (req, res) => {
  const lang = exportLanguage(req);
  const assessment = q.get('SELECT * FROM assessments WHERE id = ?', req.params.id);
  if (!assessment) throw notFound('Assessment');
  const items = q.all(
    `SELECT g.*, d.reference AS document_ref FROM gap_items g LEFT JOIN documents d ON d.id = g.document_id
      WHERE g.assessment_id = ? ORDER BY g.requirement_ref`, assessment.id
  );
  const buffer = await buildGapWorkbook({ lang, assessment, items, orgName: getOrgProfile().org_name });
  audit(req, { action: 'export:xlsx', entityType: 'assessment', entityId: assessment.id, summary: `Exported gap assessment "${assessment.name}"` });
  send(res, buffer, `${cellText(assessment.name, lang)}.xlsx`, MIME.xlsx);
}));

/**
 * Internal audit report for one assessment (ISO/IEC 27001 9.2.2; NCA ECC
 * 1-8-3): scope and criteria, results, nonconformities, the corrective actions
 * raised against them with their root causes, and the conclusion.
 */
router.get('/audit-report/:id.:format(docx|pdf)', asyncHandler(async (req, res) => {
  const lang = exportLanguage(req);
  const payload = auditReportPayload(req.params.id, lang);
  if (!payload) throw notFound('Assessment');
  const org = getOrgProfile();
  const docx = req.params.format === 'docx';
  const buffer = docx ? await buildDocx({ ...payload, org }) : await buildPdf({ ...payload, org });
  audit(req, { action: `export:${req.params.format}`, entityType: 'assessment', entityId: req.params.id,
    summary: `Exported the internal audit report for ${payload.document.title.split(' — ').slice(1).join(' — ')}${lang === 'ar' ? ' (Arabic)' : ''}` });
  send(res, buffer, `${payload.document.title}.${req.params.format}`, docx ? MIME.docx : MIME.pdf);
}));

router.get('/register.xlsx', asyncHandler(async (req, res) => {
  const lang = exportLanguage(req);
  const documents = enrichDocuments(q.all('SELECT * FROM documents ORDER BY reference'));
  const buffer = await buildRegisterWorkbook({ lang, documents, orgName: getOrgProfile().org_name });
  audit(req, { action: 'export:xlsx', entityType: 'document', summary: `Exported the document register (${documents.length} documents)` });
  send(res, buffer, `${sheetText('Governance Document Register', lang)}.xlsx`, MIME.xlsx);
}));

/**
 * Statement of Applicability. Built from the same derivation the API uses, so
 * the spreadsheet an auditor receives says what the screen says.
 */
router.get('/soa.xlsx', asyncHandler(async (req, res) => {
  const lang = exportLanguage(req);
  const code = req.query.framework || 'ISO-27001';
  const framework = q.get('SELECT * FROM frameworks WHERE code = ? OR id = ?', code, code);
  if (!framework) throw notFound(`Framework "${code}"`);

  const decisions = Object.fromEntries(
    q.all('SELECT * FROM soa_decisions WHERE framework_id = ?', framework.id).map((d) => [d.requirement_id, d])
  );
  const org = getOrgProfile();
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
        publication: evaluateApplicability(requirement.applicability, org),
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
    publicationExcludes: rows.filter((r) => r.applicable && r.publication?.applies === false).length,
    excludedButPublicationApplies: rows.filter((r) => !r.applicable && r.publication?.applies === true).length,
    decisionsRecorded: Object.keys(decisions).length
  };

  const buffer = await buildSoaWorkbook({ lang, framework, rows, summary, orgName: getOrgProfile().org_name });
  audit(req, {
    action: 'export:xlsx', entityType: 'framework', entityId: framework.id,
    summary: `Exported the Statement of Applicability for ${framework.code}`
  });
  send(res, buffer, `${sheetText('Statement of Applicability', lang)} - ${framework.code}.xlsx`, MIME.xlsx);
}));

router.get('/risk-treatment.xlsx', asyncHandler(async (req, res) => {
  const lang = exportLanguage(req);
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

  const buffer = await buildRiskTreatmentWorkbook({ lang, risks, orgName: getOrgProfile().org_name });
  audit(req, {
    action: 'export:xlsx', entityType: 'risk',
    summary: `Exported the risk treatment plan (${risks.length} risks)`
  });
  send(res, buffer, `${sheetText('Risk Treatment Plan', lang)}.xlsx`, MIME.xlsx);
}));

export default router;
