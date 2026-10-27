/**
 * Every exported file follows the reader's language: an Arabic reader gets
 * Arabic headings, labels, sheet names and values, laid out right to left,
 * and an English reader gets the file as before.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autgrc-export-language-'));
process.env.AUTGRC_DATA_DIR = tmpDir;
process.env.AUTGRC_DB_FILE = path.join(tmpDir, 'test.db');
process.env.JWT_SECRET = 'test-secret-for-the-export-language-suite-only';

const { q } = await import('../src/db/index.js');
const { runSeed } = await import('../src/db/seed.js');
const { exportLanguage, cellText, sheetText, attachment } = await import('../src/services/export-i18n.js');
const { buildGenericWorkbook, buildRegisterWorkbook } = await import('../src/services/export-xlsx.js');
const { buildPdf, rtlUnits } = await import('../src/services/export-pdf.js');
const { auditReportPayload } = await import('../src/services/assurance-records.js');
const { managementReviewInputs, internalAuditPlan } = await import('../src/services/management-reports.js');

const log = console.log;
console.log = () => {};
await runSeed();
console.log = log;

const ARABIC = /[؀-ۿ]/;

test('the file language comes from the interface, and ?lang overrides it', () => {
  assert.equal(exportLanguage({ query: {}, headers: { 'x-language': 'ar' } }), 'ar');
  assert.equal(exportLanguage({ query: {}, headers: {} }), 'en');
  assert.equal(exportLanguage({ query: { lang: 'en' }, headers: { 'x-language': 'ar' } }), 'en');
});

test('fixed wording and stored values are translated; English is left alone', () => {
  assert.equal(sheetText('Control Matrix', 'ar'), 'مصفوفة الضوابط');
  assert.equal(cellText('implemented', 'ar'), 'مُطبَّق');
  assert.equal(cellText('high', 'ar'), 'مرتفع');
  assert.equal(cellText('implemented', 'en'), 'implemented');
  assert.equal(cellText('2-2-3-1', 'ar'), '2-2-3-1', 'identifiers are never translated');
});

test('an Arabic file name survives the download header', () => {
  const header = attachment('مصفوفة الضوابط.xlsx');
  assert.match(header, /filename="export\.xlsx"/);
  assert.equal(decodeURIComponent(header.match(/filename\*=UTF-8''(.+)$/)[1]), 'مصفوفة الضوابط.xlsx');
  assert.match(attachment('Control Matrix.xlsx'), /filename="Control Matrix\.xlsx"/);
});

test('an Arabic workbook has Arabic sheets and headers and opens right to left', async () => {
  const documents = q.all('SELECT * FROM documents ORDER BY reference LIMIT 5');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await buildRegisterWorkbook({ documents, orgName: 'Test', lang: 'ar' }));
  const sheet = wb.worksheets[1];
  assert.equal(sheet.name, 'الوثائق');
  assert.equal(sheet.views[0].rightToLeft, true);
  assert.equal(sheet.getRow(1).getCell(1).value, 'المرجع');
  assert.ok(ARABIC.test(String(sheet.getRow(2).getCell(5).value)), 'the status is shown in Arabic');

  const en = new ExcelJS.Workbook();
  await en.xlsx.load(await buildGenericWorkbook({ title: 'Report', headers: ['Status'], rows: [['implemented']], orgName: 'Test', lang: 'en' }));
  assert.equal(en.worksheets[1].getRow(2).getCell(1).value, 'implemented');
  assert.ok(!en.worksheets[1].views[0].rightToLeft);
});

test('the management review inputs and audit plan read the same figures in both languages', () => {
  const en = managementReviewInputs();
  const ar = managementReviewInputs('ar');
  assert.equal(ar.rows.length, en.rows.length);
  assert.deepEqual(ar.rows.map((r) => r[1]), en.rows.map((r) => r[1]), 'the same clauses, in the same order');
  for (const row of ar.rows) assert.ok(ARABIC.test(row[0]) && ARABIC.test(row[2]));

  const planEn = internalAuditPlan();
  const planAr = internalAuditPlan('ar');
  assert.equal(planAr.rows.length, planEn.rows.length);
  assert.ok(planAr.rows.every((r) => ARABIC.test(r[0]) && ARABIC.test(r[1])));
});

test('the internal audit report is produced in Arabic, as a PDF in an Arabic face', async () => {
  const assessment = q.get('SELECT id FROM assessments LIMIT 1');
  const payload = auditReportPayload(assessment.id, 'ar');
  assert.equal(payload.lang, 'ar');
  assert.ok(payload.sections.every((s) => ARABIC.test(s.heading)));
  assert.ok(ARABIC.test(payload.document.title));
  const pdf = Buffer.from(await buildPdf({ ...payload, org: { org_name: 'Test' } }));
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  assert.match(pdf.toString('latin1'), /IBMPlexSansArabic/);

  const english = auditReportPayload(assessment.id, 'en');
  assert.equal(english.sections[0].heading, 'Audit Objective and Scope');
});

test('Arabic lines keep Latin and number runs together and each Arabic word apart', () => {
  assert.deepEqual(rtlUnits(['يشترط', 'ISO/IEC', '27001', 'البند']), ['يشترط', 'ISO/IEC 27001', 'البند']);
});
