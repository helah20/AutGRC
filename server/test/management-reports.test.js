/**
 * The internal audit plan and the management review inputs, read from the
 * seeded data set. The properties that matter: every priority states its
 * reasons, every 9.3.2 input is present even when the platform holds nothing
 * for it, and a risk nobody has reassessed is read at its inherent rating.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autgrc-mgmt-reports-'));
process.env.AUTGRC_DATA_DIR = tmpDir;
process.env.AUTGRC_DB_FILE = path.join(tmpDir, 'test.db');
process.env.JWT_SECRET = 'test-secret-for-the-management-reports-suite-only';

const { q } = await import('../src/db/index.js');
const { runSeed } = await import('../src/db/seed.js');
const { internalAuditPlan, managementReviewInputs } = await import('../src/services/management-reports.js');

const log = console.log;
console.log = () => {};
await runSeed();
console.log = log;

test('the audit plan ranks the audit universe and says why', () => {
  const plan = internalAuditPlan();
  const col = (name) => plan.headers.indexOf(name);
  assert.ok(plan.rows.length > 0);
  const order = { High: 0, Medium: 1, Low: 2 };
  const priorities = plan.rows.map((r) => order[r[col('Priority')]]);
  assert.deepEqual(priorities, [...priorities].sort((a, b) => a - b), 'highest priority first');
  for (const row of plan.rows) {
    assert.ok(row[col('Basis')].length > 10, `${row[0]} states its basis`);
  }
  const iam = plan.rows.find((r) => r[0] === 'Identity & Access Management');
  assert.match(iam[col('Audit criteria (ECC)')], /2-2-3-2/, 'the criteria are the references the domain cites');
});

test('an unassessed risk is read at its inherent rating', () => {
  const risk = q.get("SELECT * FROM risks WHERE domain_key = 'iam' LIMIT 1");
  const count = (plan) =>
    plan.rows.find((r) => r[0] === 'Identity & Access Management')[plan.headers.indexOf('High/critical risks')];

  // Critical inherent, low residual that nobody has assessed: still critical.
  q.run('UPDATE risks SET inherent_likelihood = 5, inherent_impact = 5, residual_likelihood = 1, residual_impact = 1, residual_assessed = 0 WHERE id = ?', risk.id);
  const unassessed = count(internalAuditPlan());
  q.run('UPDATE risks SET residual_assessed = 1 WHERE id = ?', risk.id);
  assert.equal(count(internalAuditPlan()), unassessed - 1, 'only an assessed residual lowers the count');
});

test('the management review carries every 9.3.2 input', () => {
  const review = managementReviewInputs();
  const refs = review.rows.map((r) => r[1]).join(' ');
  for (const clause of ['9.3.2 a', '9.3.2 b', '9.3.2 c', '9.3.2 d 1', '9.3.2 d 2', '9.3.2 d 3', '9.3.2 d 4', '9.3.2 e', '9.3.2 f', '9.3.2 g']) {
    assert.ok(refs.includes(clause), `input ${clause} present`);
  }
  const feedback = review.rows.find((r) => r[1].startsWith('ISO 9.3.2 e'));
  assert.match(feedback[2], /Not held in the platform/, 'an input the platform cannot measure says so');

  q.run("UPDATE corrective_actions SET due_date = '2000-01-01', status = 'open'");
  const actions = managementReviewInputs().rows.find((r) => r[1] === 'ISO 9.3.2 a');
  assert.equal(actions[4], 'Decision needed');
  assert.match(actions[2], /overdue/);
});
