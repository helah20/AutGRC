/**
 * A generated package answers for every requirement the catalogue assigns to
 * its domain, so reviewing it raises no "requirement with no mapped control"
 * finding. The controls are in the package from the start rather than
 * recommended afterwards.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autgrc-coverage-'));
process.env.AUTGRC_DATA_DIR = tmpDir;
process.env.AUTGRC_DB_FILE = path.join(tmpDir, 'test.db');
process.env.JWT_SECRET = 'test-secret-for-the-coverage-suite-only';

const { q } = await import('../src/db/index.js');
const { runSeed } = await import('../src/db/seed.js');
const { reviewDomain } = await import('../src/services/review.js');
const { DOMAIN_MODELS } = await import('../src/knowledge/index.js');

const log = console.log;
console.log = () => {};
await runSeed();
console.log = log;

test('reviewing a generated package finds no requirement without a control', () => {
  const missing = [];
  for (const key of Object.keys(DOMAIN_MODELS)) {
    for (const f of reviewDomain(key).findings.filter((x) => x.category === 'compliance')) {
      missing.push(`${key}: ${f.evidence?.framework} ${(f.evidence?.refs || []).join(', ')}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('every requirement of an applicable framework is mapped to a control', () => {
  const org = q.get('SELECT applicable_frameworks FROM org_profile WHERE id = 1');
  const codes = JSON.parse(org.applicable_frameworks);
  const unmapped = q.all(
    `SELECT f.code, fr.ref FROM framework_requirements fr JOIN frameworks f ON f.id = fr.framework_id
      WHERE f.code IN (${codes.map(() => '?').join(',')})
        AND NOT EXISTS (SELECT 1 FROM framework_requirements c WHERE c.framework_id = fr.framework_id AND c.parent_ref = fr.ref)
        AND fr.id NOT IN (SELECT requirement_id FROM control_mappings)`, ...codes);
  assert.deepEqual(unmapped, []);
});
