/**
 * Read-time localisation: an Arabic reader sees the knowledge base in Arabic,
 * and nothing a person wrote is replaced. Run over the seeded data set, which
 * is English, with an Arabic version of each demonstration package.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autgrc-localise-'));
process.env.AUTGRC_DATA_DIR = tmpDir;
process.env.AUTGRC_DB_FILE = path.join(tmpDir, 'test.db');
process.env.JWT_SECRET = 'test-secret-for-the-localise-suite-only';

const { q } = await import('../src/db/index.js');
const { runSeed } = await import('../src/db/seed.js');
const { localise, unlocalise } = await import('../src/services/localise.js');
const { arDomainName } = await import('../src/knowledge/index.js');

const log = console.log;
console.log = () => {};
await runSeed();
console.log = log;

const copy = (value) => JSON.parse(JSON.stringify(value));
const hasArabic = (text) => /[؀-ۿ]/.test(text);

test('generated control wording is shown in Arabic; identifiers and keys are not touched', () => {
  const control = q.get("SELECT * FROM controls WHERE domain_key = 'iam' ORDER BY control_id LIMIT 1");
  const out = localise({ items: [copy(control)] }, 'ar').items[0];
  for (const field of ['name', 'description', 'requirement', 'kpi', 'risk', 'responsible_role']) {
    assert.ok(hasArabic(out[field]), `${field} is Arabic: ${out[field]}`);
  }
  assert.equal(out.control_id, control.control_id);
  assert.equal(out.domain_key, control.domain_key);
  assert.equal(out.control_type, control.control_type, 'an enum the interface switches on stays a key');
  assert.equal(out.risk_rating, control.risk_rating);
  assert.equal(out.status, control.status);
});

test('an edited field is shown as written', () => {
  const control = copy(q.get("SELECT * FROM controls WHERE domain_key = 'iam' ORDER BY control_id LIMIT 1"));
  control.name = 'Our own wording for this control';
  const out = localise({ control }, 'ar').control;
  assert.equal(out.name, 'Our own wording for this control');
  assert.ok(hasArabic(out.description), 'the untouched fields are still translated');
});

test('an English reader gets the body untouched', () => {
  const control = q.get("SELECT * FROM controls WHERE domain_key = 'iam' LIMIT 1");
  assert.deepEqual(localise({ c: copy(control) }, 'en').c, control);
});

test('domain labels, framework names and review findings come back in Arabic', () => {
  const out = localise({
    domain: { domain_key: 'iam', domain_label: 'Identity & Access Management' },
    framework: { code: 'NCA-ECC', name: 'NCA Essential Cybersecurity Controls (ECC-2:2024)' },
    finding: {
      title: 'Document is overdue for review',
      detail: 'POL-TPS-001 was due for review on 2026-09-19 and remains published.',
      location: 'PRC-IAM-001 — Detailed Steps'
    }
  }, 'ar');
  assert.equal(out.domain.domain_label, arDomainName('iam'));
  assert.match(out.framework.name, /^الضوابط الأساسية للأمن السيبراني/);
  assert.equal(out.finding.title, 'تأخرت مراجعة الوثيقة');
  assert.match(out.finding.detail, /^كان موعد مراجعة الوثيقة POL-TPS-001 في 2026-09-19/);
  assert.match(out.finding.location, /^PRC-IAM-001 — /);
  assert.ok(hasArabic(out.finding.location));
});

test('document markup is never rewritten by a sentence pattern', () => {
  const body = '<p>identity &amp; access management; reviewed quarterly</p>';
  assert.equal(localise({ body }, 'ar').body, body);
});

test('Arabic sent to a reader maps back to the stored English when saved unchanged', () => {
  const control = copy(q.get("SELECT * FROM controls WHERE domain_key = 'iam' ORDER BY control_id LIMIT 1"));
  const shown = localise({ ...copy(control) }, 'ar');
  const saved = unlocalise({ name: shown.name, description: shown.description, kpi: 'Typed by the reader' });
  assert.equal(saved.name, control.name);
  assert.equal(saved.description, control.description);
  assert.equal(saved.kpi, 'Typed by the reader');
});

test('the Arabic version of a package adds documents, not a second set of controls', () => {
  const arabic = q.all("SELECT * FROM documents WHERE language = 'ar'");
  assert.ok(arabic.length > 0, 'the seed generates Arabic versions');
  for (const doc of arabic) {
    const original = q.get('SELECT * FROM documents WHERE id = ?', doc.translation_of);
    assert.ok(original, `${doc.reference} points at its English original`);
    assert.equal(original.doc_type, doc.doc_type);
    assert.equal(doc.status, original.status, 'the version carries the original\'s status');
  }
  const duplicates = q.all(
    'SELECT domain_key, requirement_key, COUNT(*) AS n FROM controls GROUP BY domain_key, requirement_key HAVING n > 1');
  assert.deepEqual(duplicates, []);
});
