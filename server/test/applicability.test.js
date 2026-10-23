/**
 * Per-control applicability: how NCA DCC, OTCC and CCC scope individual
 * controls, and how that scope is read against the organisation profile.
 *
 * The property that matters most is the third answer. A profile that does not
 * say enough must produce "unknown", not a guess, because a wrong "does not
 * apply" invites an exclusion nobody would have made with the facts.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autgrc-applicability-'));
process.env.AUTGRC_DATA_DIR = tmpDir;
process.env.AUTGRC_DB_FILE = path.join(tmpDir, 'test.db');
process.env.JWT_SECRET = 'test-secret-for-the-applicability-suite-only';

const { q } = await import('../src/db/index.js');
const { seedFrameworks } = await import('../src/db/seed.js');
const { analyseCatalogue, applyCatalogue } = await import('../src/services/import-framework.js');
const { parseApplicability, evaluateApplicability } = await import('../src/services/applicability.js');

const IMPORTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../knowledge-base/frameworks/import');

test('applicability cells are read', () => {
  assert.equal(parseApplicability(''), null, 'an empty cell scopes nothing');
  assert.deepEqual(parseApplicability('Secret; Top Secret'),
    { basis: 'data_classification', levels: { Secret: true, 'Top Secret': true } });
  assert.deepEqual(parseApplicability('Public: At least annually; Secret: At least every 6 months'),
    { basis: 'data_classification', levels: { Public: 'At least annually', Secret: 'At least every 6 months' } });
  assert.deepEqual(parseApplicability('l1; L2'), { basis: 'facility_level', levels: { L1: true, L2: true } });
  assert.deepEqual(parseApplicability('CSP'), { basis: 'cloud_role', levels: { CSP: true } });
  assert.match(parseApplicability('Internal').error, /not a level/);
  assert.match(parseApplicability('L1; Secret').error, /mixes/);
});

test('a scoped control is evaluated against the profile', () => {
  const dcc = { basis: 'data_classification', levels: { Secret: true, 'Top Secret': true } };
  const bank = { data_classifications: ['Public', 'Internal', 'Confidential', 'Secret'] };

  const yes = evaluateApplicability(dcc, bank);
  assert.equal(yes.applies, true);
  assert.deepEqual(yes.matched, ['Secret']);

  const no = evaluateApplicability(dcc, { data_classifications: ['Public', 'Confidential'] });
  assert.equal(no.applies, false);
  assert.match(no.reason, /Secret, Top Secret/);

  // The organisation's own scheme shares no name with the publication's, so
  // nothing can be said either way.
  const unknown = evaluateApplicability(dcc, { data_classifications: ['Internal', 'Restricted'] });
  assert.equal(unknown.applies, null);
  assert.match(unknown.reason, /cannot be evaluated/);

  assert.equal(evaluateApplicability(null, bank), null, 'an unscoped control applies wherever its framework does');
  assert.equal(evaluateApplicability('{"basis":"facility_level","levels":{"L1":true}}', { ot_facility_level: 'L2' }).applies, false,
    'a stored JSON string is read the same way');
  assert.equal(evaluateApplicability({ basis: 'facility_level', levels: { L1: true } }, {}).applies, null);
  assert.equal(evaluateApplicability({ basis: 'cloud_role', levels: { CST: true } }, { cloud_roles: ['CSP', 'CST'] }).applies, true);
});

test('frequencies follow the levels the organisation holds', () => {
  const app = { basis: 'data_classification',
    levels: { Public: 'At least every month', Confidential: 'At least every month', Secret: 'Immediately', 'Top Secret': 'Immediately' } };
  assert.equal(evaluateApplicability(app, { data_classifications: ['Public', 'Confidential'] }).frequency, 'At least every month');
  assert.equal(evaluateApplicability(app, { data_classifications: ['Confidential', 'Secret'] }).frequency,
    'Confidential: At least every month; Secret: Immediately',
    'different frequencies are each stated, not reduced to one');
});

test('the knowledge-base catalogues import with their applicability', async () => {
  seedFrameworks();
  const cases = [
    ['NCA-DCC', 'NCA-DCC_DCC-1_2022.csv', '2-2-1-1', 'data_classification'],
    ['NCA-OTCC', 'NCA-OTCC_OTCC-1_2022.csv', '1-2-1-2', 'facility_level'],
    ['NCA-CCC', 'NCA-CCC_CCC-2_2024.csv', '1-1-T-1', 'cloud_role']
  ];
  for (const [code, file, ref, basis] of cases) {
    const framework = q.get('SELECT * FROM frameworks WHERE code = ?', code);
    const existing = q.all('SELECT id, ref, title FROM framework_requirements WHERE framework_id = ?', framework.id);
    const a = await analyseCatalogue({ filePath: path.join(IMPORTS, file), originalName: file, existing });
    assert.deepEqual(a.rejected, [], `${file} imports without rejections`);
    applyCatalogue({ framework, accepted: a.accepted });
    const row = q.get('SELECT * FROM framework_requirements WHERE framework_id = ? AND ref = ?', framework.id, ref);
    assert.equal(JSON.parse(row.applicability).basis, basis, `${code} ${ref} carries its ${basis}`);
  }

  // DCC 2-2-1-1: patches monthly for Public and Confidential data, immediately
  // for Secret and Top Secret — the case the profile has to select between.
  const dcc = q.get(`SELECT fr.applicability FROM framework_requirements fr JOIN frameworks f ON f.id = fr.framework_id
                      WHERE f.code = 'NCA-DCC' AND fr.ref = '2-2-1-1'`);
  const result = evaluateApplicability(dcc.applicability, { data_classifications: ['Secret'] });
  assert.equal(result.applies, true);
  assert.equal(result.frequency, 'Immediately');

  // A subdomain heading carries no applicability of its own.
  const heading = q.get(`SELECT fr.applicability FROM framework_requirements fr JOIN frameworks f ON f.id = fr.framework_id
                          WHERE f.code = 'NCA-OTCC' AND fr.ref = '2-2'`);
  assert.equal(heading.applicability, null);
});
