/**
 * Every domain, generated fresh in each language, must be internally
 * consistent. A false contradiction here means the platform's own wording
 * trips its own checker: a sentence that names one parameter's subject while
 * stating another's value. That is invisible to the per-domain planted tests,
 * which only look at the parameter they plant.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autgrc-generated-consistency-'));
process.env.AUTGRC_DATA_DIR = tmpDir;
process.env.AUTGRC_DB_FILE = path.join(tmpDir, 'test.db');
process.env.JWT_SECRET = 'test-secret-for-the-generated-consistency-suite-only';

const { q } = await import('../src/db/index.js');
const { runSeed } = await import('../src/db/seed.js');
const { generatePackage } = await import('../src/services/generator.js');
const { reviewDomain } = await import('../src/services/review.js');
const { getOrgProfile } = await import('../src/routes/_shared.js');
const { DOMAIN_META } = await import('../src/knowledge/index.js');

const log = console.log;
console.log = () => {};
await runSeed();
console.log = log;

test('a freshly generated package reports no contradiction, in any domain or language', () => {
  const user = q.get("SELECT id FROM users WHERE role = 'grc_manager'");
  const contradictions = [];
  for (const { key } of DOMAIN_META) {
    for (const language of ['en', 'ar']) {
      q.run('DELETE FROM documents WHERE domain_key = ?', key);
      generatePackage({
        domainKey: key,
        docTypes: ['policy', 'standard', 'procedure', 'roles', 'raci', 'control_matrix'],
        frameworkCodes: ['NCA-ECC', 'ISO-27001'],
        org: getOrgProfile(), userId: user.id, ownerId: user.id, language
      });
      for (const f of reviewDomain(key).findings.filter((x) => x.category === 'consistency')) {
        contradictions.push(`${key} (${language}) ${f.evidence?.parameter}: "${f.evidence?.conflicting?.statement}"`);
      }
    }
  }
  assert.deepEqual(contradictions, []);
});
