/** Reporting module: compliance, coverage, audit readiness and exports. */

import express from 'express';
import { q } from '../db/index.js';
import { authenticate, requirePermission, audit } from '../middleware/auth.js';
import { asyncHandler, notFound } from '../middleware/errors.js';
import { buildGenericWorkbook } from '../services/export-xlsx.js';
import { buildPdf } from '../services/export-pdf.js';
import { domainName, DOMAIN_META, ROLE_LIBRARY } from '../knowledge/index.js';
import { getOrgProfile, enrichDocuments, STATUS_LABEL } from './_shared.js';
import { h, joinBlocks } from '../services/html.js';
import { DOC_TYPE_LABEL } from '../services/generator.js';

const router = express.Router();
router.use(authenticate);

const REPORTS = {
  compliance_coverage: { name: 'Compliance Coverage', description: 'Requirement coverage across every adopted framework.' },
  policy_coverage: { name: 'Policy Coverage', description: 'Which domains hold a complete Policy, Standard and Procedure chain.' },
  control_coverage: { name: 'Control Coverage', description: 'Controls by domain with evidence and mapping counts.' },
  framework_mapping: { name: 'Framework Mapping', description: 'Every requirement with its mapped control and traceability chain.' },
  gap_assessment: { name: 'Gap Assessment', description: 'Gap assessment results by status and risk.' },
  roles_responsibilities: { name: 'Roles and Responsibilities', description: 'Defined roles with their accountabilities and approvals.' },
  raci: { name: 'RACI Assignment', description: 'Responsibility assignment across every matrix, with validation issues.' },
  document_status: { name: 'Document Status', description: 'The document register with lifecycle state and ownership.' },
  review_status: { name: 'Review Status', description: 'Documents by review date, highlighting those overdue.' },
  audit_readiness: { name: 'Audit Readiness', description: 'A consolidated readiness position across documents, controls, evidence and findings.' }
};

router.get('/', asyncHandler(async (req, res) => {
  res.json(Object.entries(REPORTS).map(([key, meta]) => ({ key, ...meta })));
}));

function buildReport(key) {
  switch (key) {
    case 'compliance_coverage': {
      const rows = q.all('SELECT * FROM frameworks ORDER BY kind DESC, code').map((f) => {
        const total = q.get('SELECT COUNT(*) AS n FROM framework_requirements WHERE framework_id = ?', f.id).n;
        const maps = q.all(
          `SELECT DISTINCT cm.requirement_id, cm.coverage FROM control_mappings cm
             JOIN framework_requirements fr ON fr.id = cm.requirement_id WHERE fr.framework_id = ?`, f.id);
        const covered = maps.filter((m) => m.coverage === 'covered').length;
        const partial = maps.filter((m) => m.coverage === 'partial').length;
        const na = maps.filter((m) => m.coverage === 'not_applicable').length;
        const assessable = Math.max(total - na, 0);
        return [f.code, f.name, f.kind === 'regulation' ? 'Regulatory' : 'Framework', total, covered, partial,
          Math.max(assessable - covered - partial, 0), na,
          `${assessable ? Math.round(((covered + partial * 0.5) / assessable) * 100) : 0}%`];
      });
      return { headers: ['Code', 'Source', 'Type', 'Requirements', 'Covered', 'Partial', 'Not covered', 'Not applicable', 'Coverage'], rows,
        widths: [14, 46, 16, 14, 12, 12, 14, 16, 12] };
    }
    case 'policy_coverage': {
      const rows = DOMAIN_META.map((d) => {
        const types = q.all('SELECT DISTINCT doc_type FROM documents WHERE domain_key = ?', d.key).map((r) => r.doc_type);
        const has = (t) => (types.includes(t) ? 'Yes' : 'No');
        const complete = ['policy', 'standard', 'procedure'].every((t) => types.includes(t));
        return [d.name, d.category, has('policy'), has('standard'), has('procedure'), has('roles'), has('raci'),
          q.get('SELECT COUNT(*) AS n FROM controls WHERE domain_key = ?', d.key).n,
          complete ? 'Complete' : types.length ? 'Partial' : 'Not started'];
      });
      return { headers: ['Domain', 'Category', 'Policy', 'Standard', 'Procedure', 'Roles', 'RACI', 'Controls', 'Chain status'], rows,
        widths: [32, 16, 10, 10, 12, 10, 10, 10, 16] };
    }
    case 'control_coverage': {
      const rows = q.all('SELECT * FROM controls ORDER BY control_id').map((c) => [
        c.control_id, c.name, domainName(c.domain_key), c.control_type, c.control_nature, c.risk_rating,
        c.responsible_role || '', c.accountable_role || '', c.frequency || '', c.status,
        q.get('SELECT COUNT(*) AS n FROM evidence WHERE control_id = ?', c.id).n,
        q.get('SELECT COUNT(*) AS n FROM control_mappings WHERE control_id = ?', c.id).n
      ]);
      return { headers: ['Control ID', 'Control', 'Domain', 'Type', 'Nature', 'Risk', 'Responsible', 'Accountable', 'Frequency', 'Status', 'Evidence', 'Mappings'], rows,
        widths: [14, 42, 24, 14, 14, 12, 22, 22, 22, 14, 10, 10] };
    }
    case 'framework_mapping': {
      const rows = q.all(
        `SELECT f.code, fr.ref, fr.title, fr.domain_key, cm.coverage, cm.confidence, c.control_id, c.name AS control_name, c.policy_ref, c.procedure_ref
           FROM framework_requirements fr
           JOIN frameworks f ON f.id = fr.framework_id
           LEFT JOIN control_mappings cm ON cm.requirement_id = fr.id
           LEFT JOIN controls c ON c.id = cm.control_id
          ORDER BY f.code, fr.level, fr.ref`
      ).map((r) => [r.code, r.ref, r.title, r.domain_key ? domainName(r.domain_key) : '',
        r.coverage || 'not_covered', r.control_id || '', r.control_name || '', r.policy_ref || '', r.procedure_ref || '', r.confidence || '']);
      return { headers: ['Framework', 'Ref', 'Requirement', 'Domain', 'Coverage', 'Control ID', 'Control', 'Policy Ref', 'Procedure Ref', 'Confidence'], rows,
        widths: [14, 14, 56, 24, 16, 14, 34, 22, 20, 12] };
    }
    case 'gap_assessment': {
      const rows = q.all(
        `SELECT a.name AS assessment, g.* FROM gap_items g JOIN assessments a ON a.id = g.assessment_id
          ORDER BY a.name, g.requirement_ref`
      ).map((g) => [g.assessment, g.requirement_ref, g.requirement_txt, g.status, g.risk_rating || '',
        g.current_state || '', g.gap || '', g.recommendation || '', g.owner || '', g.due_date || '']);
      return { headers: ['Assessment', 'Requirement', 'Requirement Text', 'Status', 'Risk', 'Current State', 'Gap', 'Recommendation', 'Owner', 'Due'], rows,
        widths: [28, 14, 50, 20, 12, 40, 40, 46, 20, 14] };
    }
    case 'roles_responsibilities': {
      const rows = [];
      for (const r of q.all('SELECT * FROM roles ORDER BY category, name')) {
        const items = q.all('SELECT kind, text FROM role_items WHERE role_id = ? ORDER BY kind, position', r.id);
        if (!items.length) rows.push([r.name, r.category, r.reporting_line || '', '', '']);
        for (const i of items) rows.push([r.name, r.category, r.reporting_line || '', i.kind, i.text]);
      }
      return { headers: ['Role', 'Category', 'Reporting Line', 'Item Type', 'Statement'], rows, widths: [30, 16, 40, 18, 70] };
    }
    case 'raci': {
      const rows = [];
      for (const m of q.all('SELECT * FROM raci_matrices ORDER BY name')) {
        const cols = Object.fromEntries(q.all('SELECT id, label FROM raci_roles WHERE matrix_id = ?', m.id).map((c) => [c.id, c.label]));
        for (const a of q.all('SELECT * FROM raci_activities WHERE matrix_id = ? ORDER BY position', m.id)) {
          const assigns = q.all('SELECT * FROM raci_assignments WHERE activity_id = ?', a.id);
          rows.push([
            m.name, a.activity, a.phase || '',
            assigns.filter((x) => x.value === 'A').map((x) => cols[x.role_col_id]).join(', '),
            assigns.filter((x) => x.value === 'R').map((x) => cols[x.role_col_id]).join(', '),
            assigns.filter((x) => ['C', 'S'].includes(x.value)).map((x) => cols[x.role_col_id]).join(', '),
            assigns.filter((x) => x.value === 'I').map((x) => cols[x.role_col_id]).join(', ')
          ]);
        }
      }
      return { headers: ['Matrix', 'Activity', 'Phase', 'Accountable', 'Responsible', 'Consulted / Support', 'Informed'], rows,
        widths: [30, 52, 14, 24, 28, 30, 30] };
    }
    case 'document_status': {
      const rows = enrichDocuments(q.all('SELECT * FROM documents ORDER BY reference')).map((d) => [
        d.reference, d.title, d.doc_type_label, d.domain_label, d.status_label, d.version, d.classification,
        d.owner_name || '', d.approver_name || '', d.effective_date || '', d.review_date || ''
      ]);
      return { headers: ['Reference', 'Title', 'Type', 'Domain', 'Status', 'Version', 'Classification', 'Owner', 'Approver', 'Effective', 'Review Due'], rows,
        widths: [16, 46, 20, 26, 16, 10, 16, 22, 22, 14, 14] };
    }
    case 'review_status': {
      const today = new Date().toISOString().slice(0, 10);
      const rows = enrichDocuments(q.all("SELECT * FROM documents WHERE status != 'retired' ORDER BY review_date")).map((d) => {
        const days = d.review_date ? Math.ceil((new Date(d.review_date) - new Date()) / 86400000) : null;
        return [d.reference, d.title, d.status_label, d.owner_name || 'Unassigned', d.review_date || 'Not set',
          days === null ? 'No review date' : days < 0 ? `Overdue by ${Math.abs(days)} days` : `${days} days remaining`,
          d.review_date && d.review_date < today ? 'Overdue' : days !== null && days <= 30 ? 'Due soon' : 'On track'];
      });
      return { headers: ['Reference', 'Title', 'Status', 'Owner', 'Review Date', 'Time to Review', 'Flag'], rows,
        widths: [16, 46, 16, 24, 14, 24, 14] };
    }
    case 'audit_readiness': {
      const rows = DOMAIN_META.map((d) => {
        const docs = q.all('SELECT * FROM documents WHERE domain_key = ?', d.key);
        const types = new Set(docs.map((x) => x.doc_type));
        const controls = q.all('SELECT id FROM controls WHERE domain_key = ?', d.key);
        const withEvidence = controls.filter((c) => q.get('SELECT COUNT(*) AS n FROM evidence WHERE control_id = ?', c.id).n > 0).length;
        const mapped = controls.filter((c) => q.get('SELECT COUNT(*) AS n FROM control_mappings WHERE control_id = ?', c.id).n > 0).length;
        const findings = q.get("SELECT COUNT(*) AS n FROM findings WHERE scope_type = 'domain' AND scope_id = ? AND status IN ('open','acknowledged')", d.key).n;
        const publishedDocs = docs.filter((x) => x.status === 'published').length;

        const score = controls.length === 0 && docs.length === 0 ? 0 : Math.round(
          (['policy', 'standard', 'procedure'].filter((t) => types.has(t)).length / 3) * 40 +
          (controls.length ? (withEvidence / controls.length) * 25 : 0) +
          (controls.length ? (mapped / controls.length) * 25 : 0) +
          (docs.length ? (publishedDocs / docs.length) * 10 : 0)
        );
        return [d.name, docs.length, publishedDocs, controls.length, withEvidence, mapped, findings,
          `${score}%`, score >= 80 ? 'Ready' : score >= 50 ? 'Partial' : score > 0 ? 'Not ready' : 'Not started'];
      }).filter((r) => r[1] > 0 || r[3] > 0);
      return { headers: ['Domain', 'Documents', 'Published', 'Controls', 'With Evidence', 'Mapped', 'Open Findings', 'Readiness', 'Assessment'], rows,
        widths: [30, 12, 12, 12, 14, 12, 14, 12, 16] };
    }
    default:
      return null;
  }
}

router.get('/:key', asyncHandler(async (req, res) => {
  const meta = REPORTS[req.params.key];
  if (!meta) throw notFound('Report');
  const report = buildReport(req.params.key);
  res.json({ key: req.params.key, ...meta, ...report, generatedAt: new Date().toISOString() });
}));

router.get('/:key/export.xlsx', requirePermission('export:run'), asyncHandler(async (req, res) => {
  const meta = REPORTS[req.params.key];
  if (!meta) throw notFound('Report');
  const report = buildReport(req.params.key);
  const buffer = await buildGenericWorkbook({
    title: meta.name, subtitle: meta.description,
    headers: report.headers, rows: report.rows, widths: report.widths,
    orgName: getOrgProfile().org_name
  });
  audit(req, { action: 'export:report', entityType: 'report', entityId: req.params.key, summary: `Exported the ${meta.name} report to Excel` });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${meta.name}.xlsx"`);
  res.send(Buffer.from(buffer));
}));

router.get('/:key/export.pdf', requirePermission('export:run'), asyncHandler(async (req, res) => {
  const meta = REPORTS[req.params.key];
  if (!meta) throw notFound('Report');
  const report = buildReport(req.params.key);
  const org = getOrgProfile();

  // Very wide reports are truncated in PDF; Excel keeps every column.
  const maxCols = 7;
  const headers = report.headers.slice(0, maxCols);
  const rows = report.rows.map((r) => r.slice(0, maxCols).map((c) => String(c ?? '')));

  const buffer = await buildPdf({
    document: {
      reference: `RPT-${req.params.key.toUpperCase().replace(/_/g, '-')}`,
      title: meta.name, doc_type: 'report', domain_key: '', status: 'published',
      classification: 'internal', version: '1.0',
      created_at: new Date().toISOString(), review_date: null, effective_date: new Date().toISOString().slice(0, 10)
    },
    sections: [
      { heading: 'Purpose', body: joinBlocks(h.p(meta.description), h.p(`Generated on ${new Date().toISOString().slice(0, 10)} from the live AutGRC data set.`)) },
      { heading: meta.name, body: h.table(headers, rows) },
      ...(report.headers.length > maxCols
        ? [{ heading: 'Note', body: h.callout('note', 'Columns omitted', `This report has ${report.headers.length} columns; the PDF shows the first ${maxCols}. Export to Excel for the complete data set.`) }]
        : [])
    ],
    org, owner: null, approver: null, versions: [], approvals: [], frameworks: [],
    domainName: 'All domains'
  });
  audit(req, { action: 'export:report', entityType: 'report', entityId: req.params.key, summary: `Exported the ${meta.name} report to PDF` });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${meta.name}.pdf"`);
  res.send(buffer);
}));

export default router;
