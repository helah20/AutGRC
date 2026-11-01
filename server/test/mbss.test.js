/**
 * Minimum baseline security standards: the catalogue is complete in both
 * languages and cites only references the framework catalogue holds; a
 * generated baseline is a reviewable Standard with a verification workbook.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autgrc-mbss-'));
process.env.AUTGRC_DATA_DIR = tmpDir;
process.env.AUTGRC_DB_FILE = path.join(tmpDir, 'test.db');
process.env.JWT_SECRET = 'test-secret-for-the-mbss-suite-only';

const { q } = await import('../src/db/index.js');
const { seedFrameworks } = await import('../src/db/seed.js');
const { MBSS_TECHNOLOGIES, itemRefs, matchTechnologies, customTechnology, criticality } = await import('../src/knowledge/mbss/index.js');
const { REQUIREMENTS } = await import('../src/knowledge/frameworks.js');
const { buildMbss, generateMbss, mbssChecklist, mbssParameters } = await import('../src/services/mbss.js');
const { buildMbssWorkbook } = await import('../src/services/export-xlsx.js');
const { checkCompleteness } = await import('../src/services/review.js');

seedFrameworks();
const ARABIC = /[؀-ۿ]/;

test('every item is numbered once, written in both languages, and has a check', () => {
  const ids = new Set();
  for (const tech of MBSS_TECHNOLOGIES) {
    assert.ok(tech.items.length >= 7, `${tech.key} has a baseline`);
    assert.match(tech.benchmark, /CIS/, `${tech.key} names its CIS source`);
    for (const item of tech.items) {
      assert.ok(!ids.has(item.id), `${item.id} is unique`);
      ids.add(item.id);
      assert.ok(item.en && item.checkEn, `${item.id} has English`);
      assert.ok(ARABIC.test(item.ar), `${item.id} has Arabic`);
      assert.ok([1, 2].includes(item.level) && ['cis', 'org'].includes(item.source));
    }
  }
});

test('every reference an item cites exists in the framework catalogue', () => {
  const known = Object.fromEntries(Object.entries(REQUIREMENTS).map(([code, rows]) => [code, new Set(rows.map((r) => r[0]))]));
  for (const tech of MBSS_TECHNOLOGIES) {
    for (const item of tech.items) {
      for (const [code, refs] of Object.entries(itemRefs(item))) {
        for (const ref of refs) assert.ok(known[code]?.has(ref), `${item.id} cites ${code} ${ref}`);
      }
    }
  }
});

test('the agreed values resolve in both languages, so no placeholder reaches a document', () => {
  for (const language of ['en', 'ar']) {
    for (const tech of MBSS_TECHNOLOGIES) {
      const doc = buildMbss({ tech, language, org: { org_name: 'Test Org' } });
      const text = doc.sections.map((s) => s.body).join(' ');
      assert.doesNotMatch(text, /\{\{\w+\}\}/, `${tech.key} (${language}) resolves its values`);
    }
  }
  assert.equal(mbssParameters({}, 'en').passwordMinLength, '14 characters', 'a baseline states the IAM Standard\'s value');
});

test('the organisation\'s environment suggests the matching baselines', () => {
  const keys = matchTechnologies(['Microsoft 365', 'Oracle Database', 'Palo Alto firewalls', 'Core banking platform']);
  assert.deepEqual(keys.sort(), ['m365', 'oracle_db', 'palo_alto']);
});

test('authentication and logging items rank high; a level 2 item ranks lower', () => {
  assert.equal(criticality({ area: 'accounts', level: 1 }), 'high');
  assert.equal(criticality({ area: 'accounts', level: 2 }), 'medium');
  assert.equal(criticality({ area: 'services', level: 1 }), 'medium');
});

test('a generated baseline is a draft Standard that passes the completeness check, with a workbook', async () => {
  const [doc] = generateMbss({ technologies: ['windows_server'], language: 'ar', org: { org_name: 'Test Org' }, benchmarkVersions: { windows_server: 'v3.0.0' } });
  const row = q.get('SELECT * FROM documents WHERE id = ?', doc.id);
  assert.equal(row.doc_type, 'standard');
  assert.equal(row.status, 'draft');
  assert.match(row.reference, /^MBS-WSR-\d{3}$/);
  assert.ok(ARABIC.test(row.title));
  const sections = q.all('SELECT * FROM document_sections WHERE document_id = ?', doc.id);
  assert.deepEqual(checkCompleteness({ doc: row, sections }).filter((f) => f.category === 'completeness'), [],
    'a baseline is not held to the shape of a domain Standard');

  const checklist = mbssChecklist(row);
  assert.equal(checklist.rows.length, MBSS_TECHNOLOGIES.find((t) => t.key === 'windows_server').items.length);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await buildMbssWorkbook({ document: row, checklist, orgName: 'Test Org', lang: 'ar' }));
  const sheet = wb.worksheets[1];
  assert.equal(sheet.views[0].rightToLeft, true);
  assert.equal(sheet.getRow(2).getCell(1).value, 'WSR-001');
  assert.equal(sheet.getRow(2).getCell(12).dataValidation.type, 'list', 'status is chosen from a list');
  assert.match(String(wb.worksheets[2].getRow(3).getCell(2).value.formula), /COUNTIF/);
  assert.match(String(wb.worksheets[0].getCell('B8').value || wb.worksheets[0].getCell('B10').value), /CC BY-NC-SA/);

  const [second] = generateMbss({ technologies: ['windows_server'], language: 'en', org: {} });
  assert.match(second.reference, /^MBS-WSR-002$/, 'a second baseline takes the next number');
});

test('a technology outside the catalogue gets the general baseline', () => {
  const tech = customTechnology({ name: 'F5 BIG-IP', category: 'network' });
  assert.equal(tech.prefix, 'F5B');
  assert.ok(tech.items.length >= 10);
  const [doc] = generateMbss({ custom: { name: 'F5 BIG-IP', category: 'network' }, language: 'en', org: {} });
  assert.equal(q.get('SELECT domain_key FROM documents WHERE id = ?', doc.id).domain_key, 'network_security');
});
