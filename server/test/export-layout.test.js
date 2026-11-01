/**
 * What an exported document carries: the parts around the content are the
 * organisation's or the exporter's choice, and a section hidden from the file
 * stays out of it without leaving the Policy's clause numbers wrong.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autgrc-layout-'));
process.env.AUTGRC_DATA_DIR = tmpDir;
process.env.AUTGRC_DB_FILE = path.join(tmpDir, 'test.db');
process.env.JWT_SECRET = 'test-secret-for-the-export-layout-suite-only';

const { q } = await import('../src/db/index.js');
const { layoutFor, normaliseLayout, sectionsForExport, defaultLayout } = await import('../src/services/export-layout.js');
const { buildDocx } = await import('../src/services/export-docx.js');
const { buildPdf } = await import('../src/services/export-pdf.js');

const doc = { reference: 'POL-T-001', title: 'Test Policy', doc_type: 'policy', status: 'draft', classification: 'internal', version: '0.1', created_at: '2026-11-01', effective_date: '2026-11-01' };
const sections = [
  { heading: 'Purpose', body: '<p>Why.</p>' },
  { heading: 'Internal note', body: '<p>Not for the file.</p>', exported: 0 },
  { heading: 'Policy Statements', body: '<ol class="clause-list"><li><span class="clause-ref">4.1</span> A clause.</li><li class="subclause"><span class="clause-ref">4.1.1</span> A subclause.</li></ol>' }
];

async function docxText(layout, list = sections) {
  const buf = await buildDocx({ document: doc, sections: list, org: { org_name: 'Org' }, layout });
  const zip = await JSZip.loadAsync(buf);
  return (await zip.file('word/document.xml').async('string')).replace(/<[^>]+>/g, '');
}

test('a request names the parts to include; without one the organisation default applies', () => {
  assert.deepEqual(layoutFor({ query: { parts: 'cover,numbering' } }),
    { cover: true, control: false, approvals: false, versions: false, contents: false, numbering: true });
  assert.deepEqual(layoutFor({ query: {} }), defaultLayout());
  assert.ok(Object.values(defaultLayout()).every(Boolean), 'with nothing stored, every part is on');
  assert.equal(normaliseLayout({ cover: false, bogus: true }).cover, false);
  assert.equal(normaliseLayout({ cover: 'no' }).cover, true, 'only a boolean changes a part');
});

test('a hidden section stays out, and clause numbers follow the section to its new place', () => {
  const out = sectionsForExport(sections);
  assert.deepEqual(out.map((s) => s.heading), ['Purpose', 'Policy Statements']);
  assert.match(out[1].body, /clause-ref">2\.1</);
  assert.match(out[1].body, /clause-ref">2\.1\.1</);
});

test('Word leaves out the parts turned off', async () => {
  const full = await docxText(undefined);
  assert.match(full, /Document Control/);
  assert.match(full, /Version History/);
  assert.match(full, /1\. Purpose/);

  const bare = await docxText({ cover: false, control: false, approvals: false, versions: false, contents: false, numbering: false });
  assert.doesNotMatch(bare, /Document Control/);
  assert.doesNotMatch(bare, /Version History/);
  assert.doesNotMatch(bare, /1\. Purpose/);
  assert.match(bare, /Purpose/);
});

test('PDF is shorter with only the content', async () => {
  const pages = async (layout) => {
    const buf = Buffer.from(await buildPdf({ document: doc, sections, org: { org_name: 'Org' }, layout }));
    return (buf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
  };
  const full = await pages(undefined);
  const bare = await pages({ cover: false, control: false, approvals: false, versions: false, contents: false, numbering: true });
  assert.ok(bare < full, `${bare} pages without front matter, ${full} with it`);
  assert.equal(bare, 1);
});

test('the organisation default is read from the profile', () => {
  q.run("INSERT OR IGNORE INTO org_profile (id, org_name, updated_at) VALUES (1, 'Org', '2026-11-01')");
  q.run('UPDATE org_profile SET export_layout = ? WHERE id = 1', JSON.stringify({ cover: false, contents: false }));
  const layout = defaultLayout();
  assert.equal(layout.cover, false);
  assert.equal(layout.contents, false);
  assert.equal(layout.control, true, 'a part not stored stays on');
});
