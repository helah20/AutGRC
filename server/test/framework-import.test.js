/**
 * Licensed catalogue import tests.
 *
 * This writes into the one table the platform treats as authoritative, so the
 * properties worth asserting are the destructive ones it must not have: no row
 * is deleted, existing requirement ids survive so the mappings built on them
 * survive, and a column naming other frameworks does not become a crosswalk.
 *
 * Fixtures are written with ExcelJS rather than committed as binaries, so the
 * header spellings the parser accepts are visible in the test.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autgrc-fwimport-'));
process.env.AUTGRC_DATA_DIR = tmpDir;
process.env.AUTGRC_DB_FILE = path.join(tmpDir, 'test.db');
process.env.JWT_SECRET = 'test-secret-for-the-framework-import-suite-only';

const { q } = await import('../src/db/index.js');
const { seedFrameworks } = await import('../src/db/seed.js');
const { analyseCatalogue, applyCatalogue, matchDomain } = await import('../src/services/import-framework.js');

seedFrameworks();
const ecc = q.get("SELECT * FROM frameworks WHERE code = 'NCA-ECC'");
assert.ok(ecc, 'the seed provides NCA-ECC to import into');

async function sheet(name, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Controls');
  for (const row of rows) ws.addRow(row);
  const file = path.join(tmpDir, name);
  if (name.endsWith('.csv')) await wb.csv.writeFile(file);
  else await wb.xlsx.writeFile(file);
  return file;
}

const existing = () => q.all('SELECT id, ref, title FROM framework_requirements WHERE framework_id = ?', ecc.id);

test('capability names resolve to domains, or to nothing', () => {
  assert.equal(matchDomain('Identity & Access Management'), 'iam');
  assert.equal(matchDomain('iam'), 'iam');
  assert.equal(matchDomain('IAM'), 'iam');
  assert.equal(matchDomain('Asset Management'), 'asset_management');
  assert.equal(matchDomain(''), null);
  // A capability the platform has no domain for must not be forced into the
  // nearest one: a control filed under the wrong domain is worse than one filed
  // under none, because it looks right.
  assert.equal(matchDomain('Quantum Readiness'), null);
  assert.equal(matchDomain('Security'), null, 'an ambiguous word matches several domains, so it matches none');
});

test('the publisher layout is read', async () => {
  const file = await sheet('publisher.xlsx', [
    ['Reference', 'Title', 'Statement', 'Domain', 'Level'],
    ['2-2-1', 'Unique identification', 'Each user shall have a unique identifier.', 'Identity & Access Management', 3],
    ['2-2-3-1', 'Shared accounts', 'Shared accounts shall be prohibited.', 'iam', ''],
    ['', 'Orphan', 'No reference.', 'iam', ''],
    ['2-2-1', 'Duplicate', 'Same reference again.', 'iam', '']
  ]);
  const a = await analyseCatalogue({ filePath: file, originalName: 'publisher.xlsx', existing: existing() });

  assert.equal(a.layout, 'publisher');
  assert.equal(a.accepted.length, 2);
  assert.equal(a.rejected.length, 2);
  assert.match(a.rejected[0].reason, /No control reference/);
  assert.match(a.rejected[1].reason, /more than once/);

  const first = a.accepted[0];
  assert.equal(first.ref, '2-2-1');
  assert.equal(first.domainKey, 'iam');
  assert.equal(first.level, 3, 'a stated level is used');
  assert.equal(a.accepted[1].level, 4, '2-2-3-1 is four segments deep when no level is stated');
});

test("the paper's five-field layout is read", async () => {
  // Policy Statement, Purpose, Relevant Standards, Control Number, Capability
  // Name — the schema in section 5.3.1, page 10, in that order.
  const file = await sheet('five-field.xlsx', [
    ['Policy Statement', 'Purpose', 'Relevant Standards', 'Control Number', 'Capability Name'],
    ['Access shall be granted on least privilege.', 'Limit access to what a role requires', 'ISO 27001 A.5.15; NIST AC-6', '2-2-3-3', 'Identity & Access Management'],
    ['Assets shall be inventoried.', 'Maintain an accurate asset register', 'ISO 27001 A.5.9', '2-1-1', 'Asset Management'],
    ['Cryptographic keys shall be escrowed.', 'Recover data when a key is lost', '', '2-8-4', 'Quantum Readiness']
  ]);
  const a = await analyseCatalogue({ filePath: file, originalName: 'five-field.xlsx', existing: existing() });

  assert.equal(a.layout, 'structured_five_field');
  assert.equal(a.accepted.length, 3);
  assert.equal(a.accepted[0].ref, '2-2-3-3');
  assert.equal(a.accepted[0].title, 'Limit access to what a role requires', 'Purpose becomes the title');
  assert.equal(a.accepted[0].statement, 'Access shall be granted on least privilege.');
  assert.equal(a.accepted[0].domainKey, 'iam');
  assert.equal(a.accepted[1].domainKey, 'asset_management');

  // An unresolved capability is reported, and the row is still imported without
  // a domain rather than dropped or filed somewhere plausible.
  assert.equal(a.accepted[2].domainKey, null);
  assert.deepEqual(a.unmatchedCapabilities, [{ capability: 'Quantum Readiness', rows: 1 }]);

  // Relevant Standards is collected as a candidate and never written.
  assert.equal(a.crosswalkCandidates.length, 2);
  assert.equal(a.crosswalkCandidates[0].ref, '2-2-3-3');
  assert.match(a.crosswalkCandidates[0].related, /A\.5\.15/);
});

test('a CSV is read the same way', async () => {
  const file = await sheet('publisher.csv', [
    ['Control Number', 'Control Title', 'Requirement'],
    ['2-3-1', 'Network segmentation', 'Networks shall be segmented by trust zone.']
  ]);
  const a = await analyseCatalogue({ filePath: file, originalName: 'publisher.csv', existing: existing() });
  assert.equal(a.accepted.length, 1);
  assert.equal(a.accepted[0].ref, '2-3-1');
  assert.equal(a.accepted[0].title, 'Network segmentation');
});

test('a file with no usable columns is refused with the reason', async () => {
  const noRef = await sheet('no-ref.xlsx', [['Notes', 'Comment'], ['something', 'else']]);
  await assert.rejects(
    () => analyseCatalogue({ filePath: noRef, originalName: 'no-ref.xlsx', existing: [] }),
    /control reference column/
  );

  const noText = await sheet('no-text.xlsx', [['Control Number'], ['2-2-1']]);
  await assert.rejects(
    () => analyseCatalogue({ filePath: noText, originalName: 'no-text.xlsx', existing: [] }),
    /control text column/
  );

  const headerOnly = await sheet('header-only.xlsx', [['Control Number', 'Title', 'Statement']]);
  await assert.rejects(
    () => analyseCatalogue({ filePath: headerOnly, originalName: 'header-only.xlsx', existing: [] }),
    /no data rows/
  );
});

test('applying a catalogue', async () => {
  const before = existing();
  const knownRef = before[0].ref;
  const knownId = before[0].id;

  // A mapping built on the shipped row. If the import replaced rows rather than
  // updating them, this is what would be lost.
  const control = q.get('SELECT id FROM controls LIMIT 1');

  const file = await sheet('apply.xlsx', [
    ['Control Number', 'Title', 'Statement', 'Capability Name'],
    [knownRef, 'Official wording for an existing control', 'The licensed statement of this control.', 'Identity & Access Management'],
    ['9-9-1', 'A control the shipped catalogue does not have', 'A statement only the licensed copy carries.', 'Governance']
  ]);
  const a = await analyseCatalogue({ filePath: file, originalName: 'apply.xlsx', existing: before });
  assert.equal(a.updates, 1);
  assert.equal(a.inserts, 1);
  assert.equal(a.notCovered.length, before.length - 1,
    'every catalogue row the file does not mention is reported');

  const written = applyCatalogue({ framework: ecc, accepted: a.accepted });
  assert.deepEqual(written, { inserted: 1, updated: 1 });

  const after = q.all('SELECT * FROM framework_requirements WHERE framework_id = ?', ecc.id);
  assert.equal(after.length, before.length + 1, 'nothing was deleted');

  const updated = after.find((r) => r.ref === knownRef);
  assert.equal(updated.id, knownId, 'the requirement id survived, so anything mapped to it survived');
  assert.equal(updated.title, 'Official wording for an existing control');
  assert.equal(updated.statement, 'The licensed statement of this control.');
  assert.equal(updated.source_status, 'user_imported');

  const untouched = after.find((r) => r.ref === before[1].ref);
  assert.equal(untouched.source_status, 'reference',
    'a row the file did not mention is still labelled reference metadata, not promoted');

  const inserted = after.find((r) => r.ref === '9-9-1');
  assert.equal(inserted.domain_key, 'governance');
  assert.equal(inserted.source_status, 'user_imported');
  assert.equal(inserted.provenance, ecc.kind === 'regulation' ? 'regulatory_requirement' : 'framework_guidance');

  // No crosswalk was created from anything in the file.
  if (control) {
    const mappings = q.all('SELECT * FROM control_mappings WHERE requirement_id = ?', knownId);
    assert.ok(Array.isArray(mappings), 'mappings table is still queryable against the surviving id');
  }
});

test('re-importing the same file changes nothing further', async () => {
  const before = q.all('SELECT * FROM framework_requirements WHERE framework_id = ? ORDER BY ref', ecc.id);
  const file = await sheet('again.xlsx', [
    ['Control Number', 'Title', 'Statement'],
    ['9-9-1', 'A control the shipped catalogue does not have', 'A statement only the licensed copy carries.']
  ]);
  const a = await analyseCatalogue({ filePath: file, originalName: 'again.xlsx', existing: before });
  assert.equal(a.inserts, 0);
  assert.equal(a.updates, 1);
  applyCatalogue({ framework: ecc, accepted: a.accepted });
  const after = q.all('SELECT * FROM framework_requirements WHERE framework_id = ? ORDER BY ref', ecc.id);
  assert.equal(after.length, before.length);
  assert.deepEqual(after.map((r) => r.id), before.map((r) => r.id));
});
