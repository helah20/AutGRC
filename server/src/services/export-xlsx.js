/**
 * Excel export.
 *
 * Produces multi-sheet workbooks for the registers that GRC teams actually
 * work in: control matrix, RACI, compliance mapping, gap assessment,
 * evidence register and the document register.
 */

import ExcelJS from 'exceljs';

const BRAND = 'FF1F3A5F';
const LIGHT = 'FFF2F5F9';
const BORDER = 'FFC9D4E0';

const RISK_FILL = {
  critical: 'FFF6D5D5', high: 'FFFBE3D5', medium: 'FFFDF3D3', low: 'FFE0F0DC'
};
const STATUS_FILL = {
  compliant: 'FFE0F0DC', partially_compliant: 'FFFDF3D3',
  non_compliant: 'FFF6D5D5', not_applicable: 'FFECEFF3',
  covered: 'FFE0F0DC', partial: 'FFFDF3D3', not_covered: 'FFF6D5D5',
  // Statement of Applicability implementation states.
  implemented: 'FFE0F0DC', planned: 'FFE7F0F9', not_implemented: 'FFF6D5D5', excluded: 'FFECEFF3'
};

function styleSheet(sheet, headers, widths) {
  sheet.columns = headers.map((hdr, i) => ({
    header: hdr,
    key: `c${i}`,
    width: widths?.[i] || Math.min(Math.max(hdr.length + 6, 14), 60)
  }));
  const head = sheet.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
  head.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  head.height = 26;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
}

function finishSheet(sheet, headerCount) {
  sheet.eachRow({ includeEmpty: false }, (row, n) => {
    row.alignment = { vertical: 'top', wrapText: true };
    if (n > 1 && n % 2 === 0) {
      for (let c = 1; c <= headerCount; c += 1) {
        const cell = row.getCell(c);
        if (!cell.fill || cell.fill.type !== 'pattern') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
        }
      }
    }
    for (let c = 1; c <= headerCount; c += 1) {
      row.getCell(c).border = {
        top: { style: 'thin', color: { argb: BORDER } },
        bottom: { style: 'thin', color: { argb: BORDER } },
        left: { style: 'thin', color: { argb: BORDER } },
        right: { style: 'thin', color: { argb: BORDER } }
      };
    }
  });
}

function tint(sheet, rowIdx, colIdx, argb) {
  if (!argb) return;
  sheet.getRow(rowIdx).getCell(colIdx).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function newWorkbook(orgName) {
  const wb = new ExcelJS.Workbook();
  wb.creator = orgName || 'AutGRC';
  wb.created = new Date();
  return wb;
}

function coverSheet(wb, { orgName, title, subtitle, note }) {
  const sheet = wb.addWorksheet('Cover');
  sheet.columns = [{ width: 24 }, { width: 90 }];
  sheet.getCell('A1').value = (orgName || 'Organisation').toUpperCase();
  sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: BRAND } };
  sheet.getCell('A3').value = title;
  sheet.getCell('A3').font = { bold: true, size: 18, color: { argb: BRAND } };
  sheet.getCell('A4').value = subtitle || '';
  sheet.getCell('A4').font = { size: 11, color: { argb: 'FF6B7C8F' } };
  sheet.getCell('A6').value = 'Generated';
  sheet.getCell('B6').value = new Date().toISOString().slice(0, 19).replace('T', ' ');
  sheet.getCell('A7').value = 'Produced by';
  sheet.getCell('B7').value = 'AutGRC — Cybersecurity Governance Platform';
  if (note) {
    sheet.getCell('A9').value = 'Note';
    sheet.getCell('B9').value = note;
    sheet.getCell('B9').alignment = { wrapText: true, vertical: 'top' };
    sheet.getRow(9).height = 60;
  }
  for (const r of [6, 7, 9]) sheet.getCell(`A${r}`).font = { bold: true, color: { argb: BRAND } };
  return sheet;
}

const SOURCE_NOTE =
  'Framework identifiers and titles in this workbook are reference metadata compiled for mapping purposes. ' +
  'Verify against the official publication before relying on them for regulatory attestation. ' +
  'Organisational controls, policies and procedures are the organisation\'s own content and are not regulatory requirements.';

// -------------------------------------------------------- control matrix ---

export async function buildControlWorkbook({ controls, evidence, mappings, orgName, domainLabel }) {
  const wb = newWorkbook(orgName);
  coverSheet(wb, {
    orgName,
    title: 'Control Matrix',
    subtitle: domainLabel ? `Domain: ${domainLabel}` : 'All domains',
    note: SOURCE_NOTE
  });

  const headers = ['Control ID', 'Control Name', 'Domain', 'Description', 'Requirement', 'Type', 'Nature',
    'Implementation Guidance', 'Responsible Role', 'Accountable Role', 'Frequency', 'KPI', 'Risk',
    'Risk Rating', 'Status', 'Related Policy', 'Related Standard', 'Related Procedure', 'Framework Mapping'];
  const sheet = wb.addWorksheet('Controls');
  styleSheet(sheet, headers, [14, 34, 20, 50, 50, 14, 14, 46, 22, 22, 20, 38, 46, 12, 14, 20, 20, 20, 34]);

  controls.forEach((c) => {
    const map = (mappings || []).filter((m) => m.control_id === c.id)
      .map((m) => `${m.framework_code} ${m.ref} (${m.coverage})`).join('; ');
    const row = sheet.addRow([
      c.control_id, c.name, c.domain_label || c.domain_key, c.description, c.requirement,
      c.control_type, c.control_nature, c.implementation, c.responsible_role, c.accountable_role,
      c.frequency, c.kpi, c.risk, c.risk_rating, c.status,
      c.policy_ref || '', c.standard_ref || '', c.procedure_ref || '', map
    ]);
    tint(sheet, row.number, 14, RISK_FILL[c.risk_rating]);
  });
  finishSheet(sheet, headers.length);

  const evHeaders = ['Evidence ID', 'Control ID', 'Evidence Required', 'Type', 'Frequency', 'Owner Role', 'Status', 'Last Collected'];
  const evSheet = wb.addWorksheet('Evidence');
  styleSheet(evSheet, evHeaders, [16, 14, 56, 16, 22, 24, 14, 16]);
  (evidence || []).forEach((e) => {
    evSheet.addRow([e.evidence_id, e.control_ref || '', e.name, e.evidence_type, e.frequency, e.owner_role, e.status, e.last_collected || '']);
  });
  finishSheet(evSheet, evHeaders.length);

  return wb.xlsx.writeBuffer();
}

// ------------------------------------------------------------------ RACI ---

export async function buildRaciWorkbook({ matrix, columns, activities, assignments, orgName, issues }) {
  const wb = newWorkbook(orgName);
  coverSheet(wb, {
    orgName,
    title: matrix.name,
    subtitle: `${matrix.mode.toUpperCase()} responsibility assignment matrix`,
    note: 'R = Responsible · A = Accountable (exactly one per activity) · S = Support · C = Consulted · I = Informed'
  });

  const headers = ['Activity', 'Phase', ...columns.map((c) => c.label)];
  const sheet = wb.addWorksheet('Matrix');
  styleSheet(sheet, headers, [58, 16, ...columns.map(() => 12)]);

  const byActivity = new Map();
  for (const a of assignments) {
    if (!byActivity.has(a.activity_id)) byActivity.set(a.activity_id, {});
    byActivity.get(a.activity_id)[a.role_col_id] = a.value;
  }

  const VALUE_FILL = { A: 'FFD6E4F2', R: 'FFDDEEDB', S: 'FFF3E8D6', C: 'FFF0EEDA', I: 'FFECEFF3' };

  activities.forEach((act) => {
    const assign = byActivity.get(act.id) || {};
    const row = sheet.addRow([act.activity, act.phase || '', ...columns.map((c) => assign[c.id] || '')]);
    columns.forEach((c, i) => {
      const cell = row.getCell(3 + i);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.font = { bold: true, size: 11 };
      if (assign[c.id]) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VALUE_FILL[assign[c.id]] } };
    });
  });
  finishSheet(sheet, headers.length);

  const legend = wb.addWorksheet('Legend');
  styleSheet(legend, ['Code', 'Meaning', 'Definition'], [10, 18, 80]);
  [['R', 'Responsible', 'Performs the activity.'],
   ['A', 'Accountable', 'Answerable for the outcome. Exactly one per activity.'],
   ['S', 'Support', 'Provides resources or assistance to the responsible role.'],
   ['C', 'Consulted', 'Provides input before the activity completes. Two-way communication.'],
   ['I', 'Informed', 'Told of the outcome. One-way communication.']].forEach((r) => legend.addRow(r));
  finishSheet(legend, 3);

  if (issues?.length) {
    const val = wb.addWorksheet('Validation');
    styleSheet(val, ['Severity', 'Issue', 'Activity', 'Recommendation'], [12, 46, 40, 60]);
    issues.forEach((i) => val.addRow([i.severity, i.title, i.location, i.recommendation]));
    finishSheet(val, 4);
  }

  return wb.xlsx.writeBuffer();
}

// ------------------------------------------------------ compliance mapping --

export async function buildMappingWorkbook({ rows, frameworks, orgName, summary }) {
  const wb = newWorkbook(orgName);
  coverSheet(wb, {
    orgName, title: 'Framework Compliance Mapping',
    subtitle: frameworks.map((f) => f.code).join(', '),
    note: SOURCE_NOTE
  });

  if (summary?.length) {
    const s = wb.addWorksheet('Summary');
    styleSheet(s, ['Framework', 'Requirements', 'Covered', 'Partial', 'Not covered', 'Not applicable', 'Coverage %'], [40, 16, 12, 12, 14, 16, 12]);
    summary.forEach((r) => {
      const row = s.addRow([r.name, r.total, r.covered, r.partial, r.notCovered, r.notApplicable, `${r.coverage}%`]);
      tint(s, row.number, 7, r.coverage >= 80 ? STATUS_FILL.covered : r.coverage >= 50 ? STATUS_FILL.partial : STATUS_FILL.not_covered);
    });
    finishSheet(s, 7);
  }

  const headers = ['Framework', 'Requirement Ref', 'Requirement Title', 'Domain', 'Coverage',
    'Control ID', 'Control Name', 'Policy Reference', 'Procedure Reference', 'Evidence', 'Confidence', 'Rationale'];
  const sheet = wb.addWorksheet('Mapping');
  styleSheet(sheet, headers, [16, 16, 56, 22, 16, 14, 34, 22, 22, 44, 12, 50]);
  rows.forEach((r) => {
    const row = sheet.addRow([
      r.framework_code, r.ref, r.title, r.domain_label || r.domain_key, r.coverage,
      r.control_ref || '', r.control_name || '', r.policy_ref || '', r.procedure_ref || '',
      r.evidence || '', r.confidence || '', r.rationale || ''
    ]);
    tint(sheet, row.number, 5, STATUS_FILL[r.coverage]);
  });
  finishSheet(sheet, headers.length);

  return wb.xlsx.writeBuffer();
}

// --------------------------------------------------------- gap assessment --

export async function buildGapWorkbook({ assessment, items, orgName }) {
  const wb = newWorkbook(orgName);
  coverSheet(wb, {
    orgName, title: assessment.name, subtitle: 'Gap assessment',
    note: SOURCE_NOTE
  });

  const headers = ['Requirement', 'Requirement Text', 'Current State', 'Target State', 'Gap', 'Risk',
    'Risk Rating', 'Recommendation', 'Owner', 'Due Date', 'Status', 'Evidence', 'Related Document'];
  const sheet = wb.addWorksheet('Gap Assessment');
  styleSheet(sheet, headers, [16, 56, 40, 40, 40, 40, 12, 50, 22, 14, 20, 32, 24]);
  items.forEach((i) => {
    const row = sheet.addRow([
      i.requirement_ref, i.requirement_txt, i.current_state, i.target_state, i.gap, i.risk,
      i.risk_rating, i.recommendation, i.owner, i.due_date, i.status, i.evidence_ref, i.document_ref || ''
    ]);
    tint(sheet, row.number, 11, STATUS_FILL[i.status]);
    tint(sheet, row.number, 7, RISK_FILL[i.risk_rating]);
  });
  finishSheet(sheet, headers.length);

  const counts = items.reduce((acc, i) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc; }, {});
  const s = wb.addWorksheet('Summary');
  styleSheet(s, ['Status', 'Count', 'Share'], [26, 12, 12]);
  const total = items.length || 1;
  for (const [status, count] of Object.entries(counts)) {
    const row = s.addRow([status.replace(/_/g, ' '), count, `${Math.round((count / total) * 100)}%`]);
    tint(s, row.number, 1, STATUS_FILL[status]);
  }
  finishSheet(s, 3);

  return wb.xlsx.writeBuffer();
}

// -------------------------------------------------------- document register --

export async function buildRegisterWorkbook({ documents, orgName }) {
  const wb = newWorkbook(orgName);
  coverSheet(wb, { orgName, title: 'Governance Document Register', subtitle: 'All governance documents and their lifecycle state' });
  const headers = ['Reference', 'Title', 'Type', 'Domain', 'Status', 'Version', 'Classification',
    'Owner', 'Approver', 'Effective Date', 'Review Date', 'Last Updated'];
  const sheet = wb.addWorksheet('Documents');
  styleSheet(sheet, headers, [16, 46, 18, 24, 16, 10, 16, 22, 22, 14, 14, 20]);
  documents.forEach((d) => {
    sheet.addRow([
      d.reference, d.title, d.doc_type, d.domain_label || d.domain_key, d.status, d.version,
      d.classification, d.owner_name || '', d.approver_name || '',
      d.effective_date || '', d.review_date || '', (d.updated_at || '').slice(0, 10)
    ]);
  });
  finishSheet(sheet, headers.length);
  return wb.xlsx.writeBuffer();
}

/** Generic single-sheet export used by the reporting module. */
export async function buildGenericWorkbook({ title, subtitle, headers, rows, orgName, widths }) {
  const wb = newWorkbook(orgName);
  coverSheet(wb, { orgName, title, subtitle });
  const sheet = wb.addWorksheet(title.slice(0, 28) || 'Report');
  styleSheet(sheet, headers, widths);
  rows.forEach((r) => sheet.addRow(r));
  finishSheet(sheet, headers.length);
  return wb.xlsx.writeBuffer();
}

/**
 * Statement of Applicability.
 *
 * Applicability comes from the recorded decision; implementation comes from
 * the control library. The workbook keeps them in separate columns for the
 * same reason the API does — one is a judgement, the other is a fact about
 * what has been built.
 */
export async function buildSoaWorkbook({ framework, rows, summary, orgName }) {
  const wb = newWorkbook(orgName);
  coverSheet(wb, {
    orgName,
    title: `Statement of Applicability — ${framework.code}`,
    subtitle: `${framework.name}${framework.version ? ` (${framework.version})` : ''}`,
    note: SOURCE_NOTE
  });

  const headers = ['Reference', 'Control', 'Applicable', 'Justification', 'Implementation',
    'Mapped Controls', 'Decision Recorded By', 'Decision Date'];
  const sheet = wb.addWorksheet('Statement of Applicability');
  styleSheet(sheet, headers, [14, 52, 12, 52, 18, 26, 24, 14]);
  rows.forEach((r) => {
    const row = sheet.addRow([
      r.ref,
      r.title,
      r.applicable ? 'Yes' : 'No',
      r.justification || (r.applicable ? '' : 'NOT JUSTIFIED'),
      r.implementation.replace(/_/g, ' '),
      r.controls.map((c) => c.control_id).join(', '),
      r.decided_by_name || '',
      r.decided_at ? String(r.decided_at).slice(0, 10) : ''
    ]);
    tint(sheet, row.number, 5, STATUS_FILL[r.implementation] || null);
    // An unjustified exclusion is the first thing an auditor looks for.
    if (!r.applicable && !r.justification) tint(sheet, row.number, 4, RISK_FILL.critical);
  });
  finishSheet(sheet, headers.length);

  const s = wb.addWorksheet('Summary');
  styleSheet(s, ['Measure', 'Count'], [42, 12]);
  for (const [label, value] of [
    ['Controls in the framework', summary.total],
    ['Applicable', summary.applicable],
    ['Excluded', summary.excluded],
    ['Exclusions without a justification', summary.exclusionsWithoutJustification],
    ['Implemented', summary.implemented],
    ['Partially implemented', summary.partial],
    ['Planned', summary.planned],
    ['Applicable but not implemented', summary.notImplemented],
    ['Explicit decisions recorded', summary.decisionsRecorded]
  ]) {
    const row = s.addRow([label, value]);
    if (label.includes('without a justification') && value > 0) tint(s, row.number, 2, RISK_FILL.critical);
  }
  finishSheet(s, 2);

  return wb.xlsx.writeBuffer();
}

/**
 * Risk treatment plan. ISO/IEC 27001 asks for the plan alongside the SoA, and
 * an auditor reads the two together.
 *
 * Risks whose residual position nobody has assessed are marked as such rather
 * than printed with a residual figure equal to the inherent one, which would
 * read as a reduction somebody achieved.
 */
export async function buildRiskTreatmentWorkbook({ risks, orgName }) {
  const wb = newWorkbook(orgName);
  coverSheet(wb, {
    orgName, title: 'Risk Treatment Plan', subtitle: 'Risk register, treatment decisions and corrective actions',
    note: SOURCE_NOTE
  });

  const headers = ['Risk ID', 'Risk', 'Domain', 'Category', 'Inherent L', 'Inherent I', 'Inherent Score',
    'Inherent Rating', 'Treatment', 'Treatment Summary', 'Residual L', 'Residual I', 'Residual Score',
    'Residual Rating', 'Owner', 'Status', 'Controls', 'Open Actions', 'Accepted By', 'Acceptance Expires'];
  const sheet = wb.addWorksheet('Risk Treatment Plan');
  styleSheet(sheet, headers, [14, 46, 22, 16, 11, 11, 13, 14, 13, 46, 11, 11, 13, 14, 22, 14, 24, 12, 22, 18]);

  risks.forEach((r) => {
    const assessed = r.residual_assessed;
    const row = sheet.addRow([
      r.risk_id, r.title, r.domain_label, r.category,
      r.inherent.likelihood, r.inherent.impact, r.inherent.score, r.inherent.rating,
      r.treatment, r.treatment_summary || '',
      assessed ? r.residual.likelihood : 'Not assessed',
      assessed ? r.residual.impact : '',
      assessed ? r.residual.score : '',
      assessed ? r.residual.rating : 'Not assessed',
      r.owner_name || r.owner_role || '', r.status,
      (r.controls || []).map((c) => c.control_id).join(', '),
      r.open_actions ?? 0,
      r.accepted_by_name || '', r.acceptance_expires || ''
    ]);
    tint(sheet, row.number, 8, RISK_FILL[r.inherent.rating]);
    if (assessed) tint(sheet, row.number, 14, RISK_FILL[r.residual.rating]);
  });
  finishSheet(sheet, headers.length);

  const unassessed = risks.filter((r) => !r.residual_assessed).length;
  const s = wb.addWorksheet('Summary');
  styleSheet(s, ['Measure', 'Count'], [46, 12]);
  for (const [label, value] of [
    ['Risks in the register', risks.length],
    ['Residual position assessed', risks.length - unassessed],
    ['Residual position NOT assessed', unassessed],
    ['Formally accepted', risks.filter((r) => r.accepted).length],
    ['Acceptances expired', risks.filter((r) => r.acceptanceExpired).length],
    ...['critical', 'high', 'medium', 'low'].map((band) => [
      `Inherent ${band}`, risks.filter((r) => r.inherent.rating === band).length
    ])
  ]) {
    const row = s.addRow([label, value]);
    if (label.includes('NOT assessed') && value > 0) tint(s, row.number, 2, RISK_FILL.high);
    if (label.includes('Acceptances expired') && value > 0) tint(s, row.number, 2, RISK_FILL.critical);
  }
  finishSheet(s, 2);

  return wb.xlsx.writeBuffer();
}
