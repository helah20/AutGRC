/**
 * Consistency engine tests.
 *
 * Runs against an isolated database so planted conflicts cannot disturb the
 * demonstration data set.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autgrc-test-'));
process.env.AUTGRC_DATA_DIR = tmpDir;
process.env.AUTGRC_DB_FILE = path.join(tmpDir, 'test.db');
process.env.JWT_SECRET = 'test-secret-for-the-consistency-suite-only';

const { q } = await import('../src/db/index.js');
const { seedFrameworks, seedOrg, seedUsers } = await import('../src/db/seed.js');
const { generatePackage } = await import('../src/services/generator.js');
const { reviewDomain, reviewDocument, validateMatrix, checkAmbiguity } = await import('../src/services/review.js');

seedFrameworks();
const org = seedOrg();
const users = seedUsers('Test#Password123');

const pkg = generatePackage({
  domainKey: 'backup_recovery',
  docTypes: ['policy', 'standard', 'procedure', 'roles', 'raci', 'control_matrix'],
  frameworkCodes: ['NCA-ECC', 'ISO-27001'],
  org,
  userId: users.grc_manager.id,
  ownerId: users.grc_manager.id
});

const docOf = (type) => q.get('SELECT * FROM documents WHERE package_id = ? AND doc_type = ?', pkg.packageId, type);
const sectionOf = (docId, key) => q.get('SELECT * FROM document_sections WHERE document_id = ? AND section_key = ?', docId, key);

function rewriteSection(docId, key, replacer) {
  const section = sectionOf(docId, key);
  assert.ok(section, `section ${key} exists`);
  const next = replacer(section.body);
  assert.notEqual(next, section.body, `replacement changed the ${key} section`);
  q.run('UPDATE document_sections SET body = ? WHERE id = ?', next, section.id);
  return () => q.run('UPDATE document_sections SET body = ? WHERE id = ?', section.body, section.id);
}

test('consistency engine', async (t) => {
  await t.test('a freshly generated package is internally consistent', () => {
    const findings = reviewDomain('backup_recovery').findings.filter((f) => f.category === 'consistency');
    assert.equal(findings.length, 0, `unexpected findings: ${JSON.stringify(findings.map((f) => f.title))}`);
  });

  await t.test('detects a frequency that disagrees between documents', () => {
    const restore = rewriteSection(docOf('procedure').id, 'steps',
      (html) => html.replace(/quarterly for critical systems/g, 'annually for critical systems'));

    const findings = reviewDomain('backup_recovery').findings.filter((f) => f.category === 'consistency');
    assert.ok(findings.length >= 1, 'a conflicting frequency is reported');

    const finding = findings[0];
    assert.equal(finding.severity, 'high');
    assert.match(finding.title, /inconsistency/i);
    assert.ok(finding.evidence.conflicting.statement.includes('annually'), 'quotes the conflicting statement');
    assert.ok(finding.evidence.agreedValue.includes('quarterly'), 'states the agreed value');
    assert.ok(finding.recommendation, 'offers a reconciliation');

    restore();
    assert.equal(
      reviewDomain('backup_recovery').findings.filter((f) => f.category === 'consistency').length, 0,
      'the finding clears once the documents agree again'
    );
  });

  await t.test('does not flag a control matrix row as a conflicting commitment', () => {
    // Control matrix rows list each control's own frequency. Those values
    // legitimately differ from a domain parameter and must not be compared.
    const matrix = docOf('control_matrix');
    const findings = reviewDomain('backup_recovery').findings.filter(
      (f) => f.category === 'consistency' && f.location?.includes(matrix.reference)
    );
    assert.equal(findings.length, 0, 'control matrix rows are excluded from commitment comparison');
  });

  await t.test('does not confuse one parameter for another with an overlapping word', () => {
    // "backup retention" and "restore test frequency" share no full topic, so
    // a sentence about one must not be compared against the other's value.
    const findings = reviewDomain('backup_recovery').findings;
    const misattributed = findings.filter((f) =>
      f.category === 'consistency' &&
      f.evidence?.parameter === 'restoreTestFrequency' &&
      /retention|retained/i.test(f.evidence?.conflicting?.statement || ''));
    assert.equal(misattributed.length, 0);
  });

  await t.test('reports an incomplete governance chain', () => {
    const procedure = docOf('procedure');
    q.run("UPDATE documents SET status = 'retired' WHERE id = ?", procedure.id);
    const findings = reviewDomain('backup_recovery').findings;
    assert.ok(
      findings.some((f) => f.category === 'completeness' && /no Procedure/i.test(f.title)),
      'a policy without a procedure is reported'
    );
    q.run("UPDATE documents SET status = 'draft' WHERE id = ?", procedure.id);
  });

  await t.test('flags unmeasurable wording but not quantified statements', () => {
    const doc = docOf('policy');
    const findings = checkAmbiguity({
      doc,
      sections: [
        { heading: 'Test', body: '<p>Backups shall be reviewed regularly by the system owner.</p>' },
        { heading: 'Test2', body: '<p>Backups shall be tested at least quarterly by the system owner.</p>' }
      ]
    });
    const vague = findings.filter((f) => f.severity !== 'info');
    assert.equal(vague.length, 1, 'only the unmeasurable statement is flagged');
    assert.match(vague[0].title, /regularly/);
    assert.ok(vague[0].recommendation.includes('interval'), 'suggests a measurable replacement');
  });

  await t.test('validates RACI accountability', () => {
    const matrix = q.get('SELECT * FROM raci_matrices WHERE domain_key = ?', 'backup_recovery');
    assert.ok(matrix, 'a matrix was generated');
    assert.equal(validateMatrix(matrix.id).length, 0, 'the generated matrix is structurally valid');

    // Plant a second accountable role on one activity, remembering the cell's
    // previous state so it can be restored exactly.
    const activity = q.get('SELECT * FROM raci_activities WHERE matrix_id = ? ORDER BY position LIMIT 1', matrix.id);
    const target = q.get(
      `SELECT ra.* FROM raci_assignments ra
        WHERE ra.activity_id = ? AND ra.value = 'C' LIMIT 1`, activity.id
    );
    assert.ok(target, 'the activity has a consulted role to promote');
    const previousValue = target.value;

    q.run("UPDATE raci_assignments SET value = 'A' WHERE id = ?", target.id);

    const issues = validateMatrix(matrix.id);
    const duplicate = issues.find((i) => /Multiple accountable/.test(i.title));
    assert.ok(duplicate, 'two accountable roles are reported');
    assert.equal(duplicate.severity, 'high');
    assert.equal(duplicate.category, 'accountability');
    assert.ok(duplicate.evidence.roles.length === 2, 'both accountable roles are named');

    q.run('UPDATE raci_assignments SET value = ? WHERE id = ?', previousValue, target.id);
    assert.equal(validateMatrix(matrix.id).length, 0, 'the matrix is valid again');
  });

  await t.test('scores a document and reports every check category', () => {
    const result = reviewDocument(docOf('policy').id);
    assert.ok(result.score.score >= 0 && result.score.score <= 100);
    assert.ok(Array.isArray(result.findings));
    for (const f of result.findings) {
      assert.ok(['completeness', 'consistency', 'accountability', 'auditability', 'compliance',
        'ambiguity', 'duplication', 'currency', 'ownership'].includes(f.category), `unexpected category ${f.category}`);
      assert.ok(f.title && f.detail, 'every finding explains itself');
    }
  });
});

test.after(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
});
