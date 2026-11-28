/**
 * The risk methodology an administrator configures, the current risk it
 * produces, and the reminder schedule that chases every dated obligation.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autgrc-automation-'));
process.env.AUTGRC_DATA_DIR = tmpDir;
process.env.AUTGRC_DB_FILE = path.join(tmpDir, 'test.db');
process.env.JWT_SECRET = 'test-secret-for-the-automation-suite-only';

const { q, nowIso } = await import('../src/db/index.js');
const {
  normaliseMethodology, methodologyProblems, saveMethodology, loadMethodology, DEFAULT_METHODOLOGY, normaliseAutomation
} = await import('../src/services/risk-methodology.js');
const { rating, currentPosition, suggestedEffectiveness, acceptable, nextReviewDate } = await import('../src/services/risk.js');
const { remindDeadline, daysUntil } = await import('../src/services/notify.js');
const { cycleDays } = await import('../src/services/cadence.js');

q.run(`INSERT INTO org_profile (id, org_name, updated_at) VALUES (1, 'Test Org', ?)`, nowIso());
for (const [uid, role] of [['usr_owner', 'cyber_user'], ['usr_grc', 'grc_manager'], ['usr_admin', 'admin']]) {
  q.run(`INSERT INTO users (id, email, name, password_hash, role, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`,
    uid, `${uid}@test`, uid, 'x', role, nowIso(), nowIso());
}

test('the methodology', async (t) => {
  await t.test('the default matrix is consistent and is the one in use', () => {
    assert.deepEqual(methodologyProblems(DEFAULT_METHODOLOGY), []);
    assert.equal(rating(5, 5), 'critical');
    assert.equal(rating(1, 1), 'low');
  });

  await t.test('a saved matrix decides every rating', () => {
    const m = structuredClone(DEFAULT_METHODOLOGY);
    m.matrix[2][2] = 'high'; // impact 3, likelihood 3
    m.matrix[2][3] = 'high';
    m.matrix[2][4] = 'high';
    m.matrix[3][2] = 'high';
    m.matrix[4][2] = 'critical';
    assert.ok(saveMethodology(m).methodology);
    assert.equal(rating(3, 3), 'high');
    saveMethodology(DEFAULT_METHODOLOGY);
    assert.equal(rating(3, 3), 'medium');
  });

  await t.test('a matrix that ranks a worse cell lower is refused', () => {
    const m = structuredClone(DEFAULT_METHODOLOGY);
    m.matrix[4][4] = 'low';
    const result = saveMethodology(m);
    assert.ok(result.problems.length > 0);
    assert.equal(rating(5, 5), 'critical', 'the refused matrix is not put into use');
  });

  await t.test('values out of range fall back to the defaults', () => {
    const m = normaliseMethodology({ matrix: [['huge']], reviewDays: { critical: -4 }, acceptableUpTo: 'everything' });
    assert.equal(m.matrix[0][0], DEFAULT_METHODOLOGY.matrix[0][0]);
    assert.equal(m.reviewDays.critical, 30);
    assert.equal(m.acceptableUpTo, 'high');
  });

  await t.test('appetite and review cycle follow the saved values', () => {
    const m = structuredClone(DEFAULT_METHODOLOGY);
    m.acceptableUpTo = 'medium';
    m.reviewDays.high = 60;
    saveMethodology(m);
    assert.equal(acceptable('medium'), true);
    assert.equal(acceptable('high'), false);
    assert.equal(nextReviewDate('high', new Date('2027-01-01T00:00:00Z')), '2027-03-02');
    saveMethodology(DEFAULT_METHODOLOGY);
    assert.equal(loadMethodology().acceptableUpTo, 'high');
  });
});

test('current risk', async (t) => {
  await t.test('existing controls lower likelihood by the methodology\'s steps, not impact', () => {
    const row = { inherent_likelihood: 4, inherent_impact: 5, control_effectiveness: 'effective' };
    const current = currentPosition(row);
    assert.equal(current.likelihood, 2);
    assert.equal(current.impact, 5);
    assert.equal(currentPosition({ ...row, control_effectiveness: 'ineffective' }).likelihood, 4);
    assert.equal(currentPosition({ ...row, control_effectiveness: 'not_assessed' }), null);
    assert.equal(currentPosition({ ...row, control_effectiveness: 'effective', inherent_likelihood: 1 }).likelihood, 1);
  });

  await t.test('the weakest assessed control decides the suggestion', () => {
    assert.equal(suggestedEffectiveness([{ operating_effectiveness: 'effective' }, { operating_effectiveness: 'partially_effective' }]), 'partially_effective');
    assert.equal(suggestedEffectiveness([{ operating_effectiveness: 'not_assessed' }, { operating_effectiveness: null }]), null);
  });
});

test('cadence', () => {
  assert.equal(cycleDays('quarterly'), 91);
  assert.equal(cycleDays('Continuous, reviewed annually'), 365);
  assert.equal(cycleDays('Continuous'), null, 'how a control operates is not a review cycle');
  assert.equal(cycleDays('weekly discovery, quarterly attestation'), 7);
  assert.equal(cycleDays('Per event'), null);
});

test('deadline reminders', async (t) => {
  const automation = normaliseAutomation({ reminderDays: [30, 15, 5], escalateAfterDays: 3 });
  const today = new Date('2027-01-10T08:00:00Z');
  const base = { ownerIds: ['usr_owner'], escalationPermission: 'action:verify', entityType: 'action', entityId: 'a1', url: '/actions', what: 'corrective action CA-0001 — Patch', automation, today };
  const count = (key) => q.get('SELECT COUNT(*) AS n FROM notifications WHERE dedupe_key LIKE ?', `${key}%`).n;

  await t.test('days are counted in whole calendar days', () => {
    assert.equal(daysUntil('2027-01-13', today), 3);
    assert.equal(daysUntil('2027-01-09', today), -1);
  });

  await t.test('nothing is sent before the first interval', () => {
    assert.equal(remindDeadline({ ...base, key: 'k-far', due: '2027-03-01' }), 0);
  });

  await t.test('a deadline three days out gets one reminder, at the nearest interval', () => {
    assert.equal(remindDeadline({ ...base, key: 'k-near', due: '2027-01-13' }), 1);
    assert.equal(count('k-near:2027-01-13:r5'), 1);
    assert.equal(count('k-near:2027-01-13:r15') + count('k-near:2027-01-13:r30'), 0);
    assert.equal(remindDeadline({ ...base, key: 'k-near', due: '2027-01-13' }), 0, 'a second sweep raises nothing');
  });

  await t.test('overdue is told to the owner, and escalated only after the escalation period', () => {
    assert.equal(remindDeadline({ ...base, key: 'k-late', due: '2027-01-09' }), 1);
    assert.equal(count('k-late:2027-01-09:escalated'), 0);
    const escalated = remindDeadline({ ...base, key: 'k-later', due: '2027-01-05' });
    // The owner, then each holder of action:verify who is not the owner.
    assert.equal(escalated, 3);
    assert.equal(count('k-later:2027-01-05:escalated'), 2);
  });

  await t.test('moving the deadline starts the schedule again', () => {
    assert.equal(remindDeadline({ ...base, key: 'k-near', due: '2027-01-14' }), 1);
  });
});
