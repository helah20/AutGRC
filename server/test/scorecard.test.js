/**
 * Governance quality scorecard tests.
 *
 * The scorecard exists to make the quality engine's output legible per
 * criterion, so the properties worth asserting are the ones a reader would rely
 * on without checking: that no finding category is quietly unaccounted for,
 * that a criterion's band moves when findings land in it and not otherwise, and
 * that reviewer disagreement is reported rather than averaged away.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autgrc-scorecard-'));
process.env.AUTGRC_DATA_DIR = tmpDir;
process.env.AUTGRC_DB_FILE = path.join(tmpDir, 'test.db');
process.env.JWT_SECRET = 'test-secret-for-the-scorecard-suite-only';

const { q, nowIso } = await import('../src/db/index.js');
const { seedFrameworks, seedOrg, seedUsers } = await import('../src/db/seed.js');
const { generatePackage } = await import('../src/services/generator.js');
const { reviewDocument, reviewDomain } = await import('../src/services/review.js');
const { scorecard, assessmentOf, compareBases, CRITERIA, KRI_THRESHOLDS } =
  await import('../src/services/scorecard.js');

seedFrameworks();
const org = seedOrg();
const users = seedUsers('Test#Password123');

const pkg = generatePackage({
  domainKey: 'cryptography',
  docTypes: ['policy', 'standard', 'procedure', 'roles', 'raci', 'control_matrix'],
  frameworkCodes: ['NCA-ECC', 'ISO-27001'],
  org,
  userId: users.grc_manager.id,
  ownerId: users.grc_manager.id
});
const policy = q.get('SELECT * FROM documents WHERE package_id = ? AND doc_type = ?', pkg.packageId, 'policy');

/**
 * Every category any check in the platform can emit. Collected from the two
 * producers rather than from a list, so a new category added to either one
 * fails this suite instead of silently scoring nothing.
 */
const EMITTED_CATEGORIES = (() => {
  const found = new Set();
  for (const file of ['../src/services/review.js', '../src/services/import.js']) {
    const src = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
    for (const m of src.matchAll(/category:\s*'([a-z_]+)'/g)) found.add(m[1]);
  }
  return [...found].sort();
})();

test('the scorecard accounts for every finding category', () => {
  const mapped = new Set(CRITERIA.flatMap((c) => c.categories));
  assert.ok(EMITTED_CATEGORIES.length >= 8, `expected to find the check categories, got ${EMITTED_CATEGORIES}`);
  const missing = EMITTED_CATEGORIES.filter((c) => !mapped.has(c));
  assert.deepEqual(missing, [],
    'a finding category maps to no criterion, so its findings would score nothing');

  // And the reverse: a criterion listing a category nothing emits is either a
  // typo or a check that was deleted.
  const stray = [...mapped].filter((c) => !EMITTED_CATEGORIES.includes(c));
  assert.deepEqual(stray, [], 'a criterion claims a category no check emits');
});

test('an unrecognised category is reported, not dropped', () => {
  const card = scorecard([{ category: 'invented', severity: 'critical' }]);
  assert.equal(card.unmapped.length, 1);
  assert.equal(card.unmapped[0].category, 'invented');
  // It must not have been scored anywhere either.
  assert.equal(card.overall, 5);
});

test('bands', async (t) => {
  await t.test('no findings scores 5 on every criterion', () => {
    const card = scorecard([]);
    assert.deepEqual(card.criteria.map((c) => c.band), [5, 5, 5, 5, 5]);
    assert.equal(card.overall, 5);
    assert.equal(card.weakest, null);
    assert.deepEqual(card.breaches, []);
  });

  await t.test('a finding lands on exactly one criterion', () => {
    const card = scorecard([{ category: 'accountability', severity: 'critical' }]);
    const hit = card.criteria.filter((c) => c.findings > 0);
    assert.equal(hit.length, 1);
    assert.equal(hit[0].key, 'role_clarity');
    assert.equal(hit[0].status, 'breach');
    assert.equal(card.weakest, 'role_clarity');
    assert.deepEqual(card.breaches, ['role_clarity']);
  });

  await t.test('the band normalises by document count', () => {
    const findings = Array.from({ length: 6 }, () => ({ category: 'completeness', severity: 'high' }));
    // 72 penalty points: the worst band for one document, mid-scale spread
    // across twelve. A band that punished the size of a governance chain would
    // report a complete domain as worse than a lone policy.
    const band = (documents) => scorecard(findings, { documents })
      .criteria.find((c) => c.key === 'control_completeness').band;
    assert.equal(band(1), 1);
    assert.equal(band(12), 3);
    assert.equal(band(24), 4);
  });

  await t.test('the thresholds are the ones the bands are read against', () => {
    assert.equal(scorecard([{ category: 'compliance', severity: 'high' }])
      .criteria.find((c) => c.key === 'policy_alignment').band, KRI_THRESHOLDS.attentionAt);
    assert.equal(scorecard([{ category: 'compliance', severity: 'critical' }])
      .criteria.find((c) => c.key === 'policy_alignment').status, 'breach');
  });
});

test('a real review produces a scorecard beside its score', () => {
  const doc = reviewDocument(policy.id);
  assert.ok(doc.scorecard, 'reviewDocument reports a scorecard');
  assert.equal(doc.scorecard.documents, 1);
  assert.deepEqual(doc.scorecard.unmapped, [], 'a live review emitted a category the scorecard cannot place');

  const domain = reviewDomain('cryptography');
  assert.equal(domain.scorecard.documents, domain.documents);
  assert.deepEqual(domain.scorecard.unmapped, []);
  // The two numbers are derived from one finding list, so they cannot disagree
  // about whether there is a problem.
  if (domain.score.score === 100) assert.equal(domain.scorecard.overall, 5);
});

// ------------------------------------------------------- reviewer ratings --

function rate(reviewer, scores, version = policy.version) {
  const at = nowIso();
  q.run(
    `INSERT INTO document_reviews
       (id, document_id, reviewer_id, reviewer_name, reviewer_role, document_version,
        policy_alignment, role_clarity, applicability, governance_compliance,
        control_completeness, comment, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    `dra_${reviewer}_${version}`, policy.id, users[reviewer].id, users[reviewer].name,
    reviewer, version, scores[0], scores[1], scores[2], scores[3], scores[4], null, at, at
  );
}

test('reviewer assessment', async (t) => {
  await t.test('an unrated document reports an empty panel, not agreement', () => {
    const a = assessmentOf(policy.id);
    assert.equal(a.panelSize, 0);
    assert.equal(a.overall, null);
    assert.equal(a.divergence.material, false);
    assert.equal(compareBases(reviewDocument(policy.id).scorecard, a), null);
  });

  await t.test('one rating is not agreement either', () => {
    rate('reviewer', [5, 5, 5, 5, 5]);
    const a = assessmentOf(policy.id);
    assert.equal(a.panelSize, 1);
    assert.equal(a.meanTotal, 25);
    assert.ok(a.criteria.every((c) => c.range === 0));
    assert.ok(a.criteria.every((c) => c.diverges === false),
      'a single rating must not be reported as reviewers agreeing');
  });

  await t.test('a panel that disagrees materially says so', () => {
    // The shape of the paper's EXP-19: two reviewers near the top of the scale
    // and one near the bottom on the same text (Table 9, page 29).
    rate('auditor', [5, 5, 4, 5, 5]);
    rate('approver', [2, 2, 2, 2, 2]);
    const a = assessmentOf(policy.id);
    assert.equal(a.panelSize, 3);
    assert.equal(a.divergence.material, true);
    assert.equal(a.divergence.maxRange, 3);
    assert.deepEqual(a.divergence.criteria.sort(), CRITERIA.map((c) => c.key).sort(),
      'every criterion in this panel spans three bands');
    // The mean alone would have read as a comfortable pass.
    assert.ok(a.overall > 3, `mean is ${a.overall}, which is why the range is reported next to it`);
  });

  await t.test('ratings are bound to the version they were given against', () => {
    q.run("UPDATE documents SET version = '2.0' WHERE id = ?", policy.id);
    const a = assessmentOf(policy.id);
    assert.equal(a.version, '2.0');
    assert.equal(a.panelSize, 0, 'ratings of the previous wording are history, not the current panel');
    q.run('UPDATE documents SET version = ? WHERE id = ?', policy.version, policy.id);
  });

  await t.test('engine and panel are compared, not reconciled', () => {
    const engine = reviewDocument(policy.id).scorecard;
    const cmp = compareBases(engine, assessmentOf(policy.id));
    assert.equal(cmp.criteria.length, 5);
    for (const c of cmp.criteria) {
      assert.equal(c.delta, Math.round((c.engineBand - c.reviewerMean) * 100) / 100);
    }
    assert.equal(typeof cmp.engineOverall, 'number');
    assert.equal(typeof cmp.reviewerOverall, 'number');
  });
});
