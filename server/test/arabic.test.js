/**
 * Arabic generation tests.
 *
 * Three things have to hold for Arabic to be more than a translated menu bar:
 * the Arabic requirement model must carry the same numeric commitments as the
 * English one, generated documents must actually come out in Arabic, and the
 * consistency engine must read Arabic well enough to catch a contradiction in
 * it. A silently-passing engine on Arabic documents would be worse than no
 * Arabic at all, so each is asserted separately.
 *
 * Runs against an isolated database so generated packages cannot disturb the
 * demonstration data set.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autgrc-ar-test-'));
process.env.AUTGRC_DATA_DIR = tmpDir;
process.env.AUTGRC_DB_FILE = path.join(tmpDir, 'test.db');
process.env.JWT_SECRET = 'test-secret-for-the-arabic-suite-only';

const { q } = await import('../src/db/index.js');
const { seedFrameworks, seedOrg, seedUsers } = await import('../src/db/seed.js');
const { generatePackage } = await import('../src/services/generator.js');
const { reviewDomain, frequenciesIn, durationsIn, hasArabic } = await import('../src/services/review.js');
const { DOMAIN_MODELS, localisedModel, validateKnowledgeBase, buildParameterSet } =
  await import('../src/knowledge/index.js');
const { translatedDomains, isTranslated } = await import('../src/knowledge/ar/index.js');
const { arabicTitle, translator } = await import('../src/services/doc-strings.js');

seedFrameworks();
const org = seedOrg();
const users = seedUsers('Test#Password123');

const placeholders = (text) =>
  [...String(text || '').matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

// ------------------------------------------------- the translated model ----

test('Arabic requirement model', async (t) => {
  await t.test('the knowledge base reports no integrity problems', () => {
    const problems = validateKnowledgeBase();
    assert.deepEqual(problems, [], problems.join('\n'));
  });

  await t.test('at least one domain is translated, and each claims full coverage', () => {
    const domains = translatedDomains();
    assert.ok(domains.length >= 1, 'a translated domain exists to test against');
    for (const key of domains) {
      const model = localisedModel(key, 'ar');
      assert.equal(model.language, 'ar', `${key} is served in Arabic`);
      assert.equal(model.fullyTranslated, true,
        `${key} is ${Math.round((model.translationCoverage || 0) * 100)}% translated, not 100%`);
    }
  });

  await t.test('every translated string carries the same placeholders as its English source', () => {
    // A placeholder is the only channel through which an agreed numeric value
    // reaches the text. Dropping one in translation would leave the Arabic
    // document asserting a hard-coded number nobody agreed to, and adding one
    // would make it assert a value the English document never committed.
    const fields = ['title', 'policy', 'standard', 'guidance', 'controlName', 'kpi', 'risk'];
    for (const key of translatedDomains()) {
      const en = localisedModel(key, 'en');
      const ar = localisedModel(key, 'ar');
      for (const [i, req] of en.requirements.entries()) {
        const arReq = ar.requirements[i];
        assert.equal(arReq.key, req.key, `${key} requirement order is preserved`);
        for (const field of fields) {
          if (!req[field]) continue;
          assert.deepEqual(placeholders(arReq[field]), placeholders(req[field]),
            `${key}.${req.key}.${field}: placeholders differ between English and Arabic`);
        }
      }
    }
  });

  await t.test('translated parameters cover exactly the English parameter set', () => {
    for (const key of translatedDomains()) {
      assert.deepEqual(
        Object.keys(localisedModel(key, 'ar').parameters).sort(),
        Object.keys(localisedModel(key, 'en').parameters).sort(),
        `${key}: Arabic and English parameter names differ`
      );
    }
  });

  await t.test('an untranslated domain falls back to English and says so', () => {
    const untranslated = Object.keys(DOMAIN_MODELS).find((k) => !isTranslated(k));
    assert.ok(untranslated, 'a domain without a translation exists');
    const model = localisedModel(untranslated, 'ar');
    assert.equal(model.language, 'en', 'the fallback reports the language it actually is');
    assert.equal(model.fullyTranslated, false, 'and does not claim to be translated');
  });

  await t.test('an English request is never reported as a partial translation', () => {
    const model = localisedModel(translatedDomains()[0], 'en');
    assert.equal(model.language, 'en');
    assert.equal(model.fullyTranslated, true);
  });

  await t.test('resolved Arabic parameter values are Arabic', () => {
    const key = translatedDomains()[0];
    const params = buildParameterSet(key, org, {}, 'ar');
    const values = Object.values(params).map((p) => (typeof p === 'object' ? p.value : p));
    assert.ok(values.some((v) => hasArabic(v)), 'the Arabic parameter set carries Arabic values');
  });
});

// --------------------------------------------------- Arabic vocabulary -----

test('Arabic frequency and duration vocabulary', async (t) => {
  await t.test('reads an Arabic frequency', () => {
    assert.deepEqual(frequenciesIn('يجب تنفيذ المراجعة بتكرار ربع سنوي على الأقل.'), ['quarterly']);
    assert.deepEqual(frequenciesIn('يجب تنفيذ التدقيق بتكرار سنوي على الأقل.'), ['annually']);
  });

  await t.test('does not read "نصف سنوي" as annual', () => {
    // "نصف سنوي" contains "سنوي"; reading both would make a correct
    // semi-annual commitment look self-contradictory.
    assert.deepEqual(frequenciesIn('تُراجَع حسابات الخدمة بتكرار نصف سنوي على الأقل.'), ['semi-annually']);
  });

  await t.test('still finds a genuine second frequency beside a longer term', () => {
    // The opposite error to the one above, and the worse one: suppressing the
    // short term globally would hide a real contradiction from the reader.
    const found = frequenciesIn('تكون المراجعة ربع سنوية والتدقيق سنوي لكل نطاق مشمول.');
    assert.deepEqual(found.sort(), ['annually', 'quarterly']);
  });

  await t.test('reads Arabic-Indic digits and units', () => {
    const found = durationsIn('يجب إلغاء الحسابات الخامدة بعد ٩٠ يوماً من آخر استخدام.');
    assert.deepEqual(found.map((d) => [d.value, d.unit]), [[90, 'day']]);
  });

  await t.test('reads "يوم عمل" as a business day, not a day', () => {
    const found = durationsIn('يجب إنجاز التزويد خلال ٣ أيام عمل من اعتماد الطلب.');
    assert.deepEqual(found.map((d) => [d.value, d.unit]), [[3, 'business day']]);
  });

  await t.test('hasArabic distinguishes the two scripts', () => {
    assert.equal(hasArabic('quarterly'), false);
    assert.equal(hasArabic('ربع سنوي'), true);
    assert.equal(hasArabic('FIDO2 مفتاح'), true);
  });
});

// ------------------------------------------------------ Arabic titling -----

test('Arabic document titles', async (t) => {
  await t.test('builds a genitive construction rather than concatenating words', () => {
    assert.equal(arabicTitle('Policy', 'إدارة الهويات والوصول'), 'سياسة إدارة الهويات والوصول');
    assert.equal(arabicTitle('Roles and Responsibilities', 'إدارة الأصول'), 'أدوار ومسؤوليات إدارة الأصول');
  });

  await t.test('attaches the preposition to the following word', () => {
    // لـ + إدارة is إدارة with the lam attached, and لـ + ال merges into لل.
    assert.equal(arabicTitle('RACI Matrix', 'إدارة الأصول'), 'مصفوفة RACI لإدارة الأصول');
    assert.equal(arabicTitle('Guideline', 'الحوكمة'), 'الدليل الإرشادي للحوكمة');
    for (const type of ['RACI Matrix', 'Guideline']) {
      const title = arabicTitle(type, 'إدارة الأصول');
      assert.ok(!title.includes('ـ'), `${title} should not carry a tatweel`);
      assert.ok(!title.includes('لال'), `${title} should merge the two lams`);
    }
  });

  await t.test('the translator falls back to the English source string', () => {
    const t = translator('ar');
    assert.equal(t.has('Purpose'), true);
    assert.equal(t('A string nobody has translated'), 'A string nobody has translated');
    assert.equal(t.has('A string nobody has translated'), false);
  });

  await t.test('the English translator is the identity, with interpolation', () => {
    const t = translator('en');
    assert.equal(t('Purpose'), 'Purpose');
    assert.equal(t('Owned by {name}', { name: 'GRC' }), 'Owned by GRC');
  });
});

// ------------------------------------------------- translation plumbing ----

test('the translator never leaks its own keys into a document', async (t) => {
  // TP(key, english) asks the translator whether it has that key. The English
  // translator has no table, so it must answer no and let the English at the
  // call site through; answering yes returned the key itself, and every
  // English document rendered "scope.estateLead" where its scope sentence
  // belonged. A dotted lowercase token in body text is the signature.
  const KEY_SHAPED = /\b[a-z]{3,}\.[a-zA-Z]{3,}\b/g;
  const isKey = (token) => !/\.(com|sa|org|net|gov)$/.test(token);
  const types = ['policy', 'standard', 'procedure', 'roles', 'raci', 'control_matrix', 'guideline', 'framework'];

  for (const language of ['en', 'ar']) {
    await t.test(`no keys survive a ${language} package`, () => {
      const pkg = generatePackage({
        domainKey: 'iam', docTypes: types, frameworkCodes: ['NCA-ECC'],
        org, userId: users.grc_manager.id, ownerId: users.grc_manager.id, language
      });
      const leaks = [];
      for (const doc of q.all('SELECT * FROM documents WHERE package_id = ?', pkg.packageId)) {
        for (const s of q.all('SELECT section_key, heading, body FROM document_sections WHERE document_id = ?', doc.id)) {
          for (const m of `${s.heading} ${s.body}`.matchAll(KEY_SHAPED)) {
            if (isKey(m[0])) leaks.push(`${doc.doc_type}/${s.section_key}: ${m[0]}`);
          }
        }
      }
      assert.deepEqual([...new Set(leaks)], []);
    });
  }
});

// ------------------------------------------------- end-to-end generation ---

const arPkg = generatePackage({
  domainKey: 'iam',
  docTypes: ['policy', 'standard', 'procedure', 'roles', 'raci', 'control_matrix'],
  frameworkCodes: ['NCA-ECC', 'ISO-27001'],
  org,
  userId: users.grc_manager.id,
  ownerId: users.grc_manager.id,
  language: 'ar'
});

const arDocs = q.all('SELECT * FROM documents WHERE package_id = ?', arPkg.packageId);
const arDocOf = (type) => arDocs.find((d) => d.doc_type === type);

test('Arabic package generation', async (t) => {
  await t.test('every document is recorded and titled in Arabic', () => {
    assert.equal(arDocs.length, 6);
    for (const doc of arDocs) {
      assert.equal(doc.language, 'ar', `${doc.reference} records its language`);
      assert.ok(hasArabic(doc.title), `${doc.reference} has an Arabic title, got "${doc.title}"`);
      assert.ok(hasArabic(doc.summary), `${doc.reference} has an Arabic summary`);
    }
  });

  await t.test('section headings and bodies are Arabic', () => {
    for (const doc of arDocs) {
      const sections = q.all(
        "SELECT * FROM document_sections WHERE document_id = ? AND section_key NOT LIKE '\\_%' ESCAPE '\\'",
        doc.id
      );
      assert.ok(sections.length > 0, `${doc.reference} has sections`);
      for (const s of sections) {
        assert.ok(hasArabic(s.heading), `${doc.reference}/${s.section_key}: heading "${s.heading}" is not Arabic`);
      }
      const prose = sections.map((s) => s.body).join(' ');
      assert.ok(hasArabic(prose), `${doc.reference} body is not Arabic`);
    }
  });

  await t.test('no unresolved placeholder survives into an Arabic document', () => {
    for (const doc of arDocs) {
      const bodies = q.all('SELECT body FROM document_sections WHERE document_id = ?', doc.id)
        .map((s) => s.body).join('\n');
      assert.equal(placeholders(bodies).length, 0,
        `${doc.reference} leaks placeholders: ${placeholders(bodies).join(', ')}`);
    }
  });

  await t.test('controls and evidence are Arabic too', () => {
    const controls = q.all('SELECT * FROM controls WHERE domain_key = ? AND name IS NOT NULL', 'iam');
    assert.ok(controls.length > 0, 'controls were generated');
    for (const c of controls) {
      assert.ok(hasArabic(c.name), `control ${c.control_id} name "${c.name}" is not Arabic`);
      assert.ok(hasArabic(c.description), `control ${c.control_id} description is not Arabic`);
    }
  });

  await t.test('framework requirement text is deliberately left in its published wording', () => {
    // Translating an NCA or ISO control and presenting it as the publisher's
    // wording would be inventing a regulatory requirement, which the platform
    // must never do. Mappings therefore stay in the source language.
    const mapping = q.get(
      `SELECT cm.* FROM control_mappings cm
         JOIN controls c ON c.id = cm.control_id
        WHERE c.domain_key = ? AND cm.requirement_text IS NOT NULL LIMIT 1`, 'iam');
    assert.ok(mapping, 'the Arabic package still carries framework mappings');
    assert.equal(hasArabic(mapping.requirement_text), false,
      'framework requirement text must not be paraphrased into Arabic');
  });

  await t.test('an untranslated domain generated as Arabic records the language it is', () => {
    const untranslated = Object.keys(DOMAIN_MODELS).find((k) => !isTranslated(k));
    const pkg = generatePackage({
      domainKey: untranslated,
      docTypes: ['policy'],
      frameworkCodes: ['NCA-ECC'],
      org,
      userId: users.grc_manager.id,
      ownerId: users.grc_manager.id,
      language: 'ar'
    });
    const doc = q.get('SELECT * FROM documents WHERE package_id = ?', pkg.packageId);
    assert.equal(doc.language, 'en', 'a fallback document is not labelled Arabic');
  });
});

// ------------------------------------- consistency, read in Arabic ---------

test('Arabic consistency detection', async (t) => {
  await t.test('a freshly generated Arabic package is internally consistent', () => {
    const findings = reviewDomain('iam').findings.filter((f) => f.category === 'consistency');
    assert.deepEqual(findings.map((f) => f.title), [],
      `unexpected findings: ${JSON.stringify(findings.map((f) => f.title))}`);
  });

  await t.test('detects an Arabic frequency that disagrees with the agreed value', () => {
    const procedure = arDocOf('procedure');
    const rows = q.all('SELECT * FROM document_sections WHERE document_id = ?', procedure.id);
    const target = rows.find((s) => s.body.includes('ربع سنوي'));
    assert.ok(target, 'the Arabic procedure states the agreed quarterly interval somewhere');

    // Demote the agreed quarterly interval to annual in one document only.
    // Nothing else changes, so a finding here can only come from reading the
    // Arabic text.
    q.run('UPDATE document_sections SET body = ? WHERE id = ?',
      target.body.split('ربع سنوي').join('سنوي'), target.id);

    const findings = reviewDomain('iam').findings.filter((f) => f.category === 'consistency');
    assert.ok(findings.length >= 1, 'the contradiction is reported');
    const finding = findings[0];
    assert.equal(finding.severity, 'high');
    assert.ok(finding.evidence?.conflicting?.statement, 'the finding quotes the conflicting statement');
    assert.ok(hasArabic(finding.evidence.conflicting.statement), 'and quotes it in Arabic');
    assert.ok(finding.evidence.agreedValue, 'and states the agreed value');
    assert.ok(finding.recommendation, 'and offers a reconciliation');

    q.run('UPDATE document_sections SET body = ? WHERE id = ?', target.body, target.id);
    assert.equal(
      reviewDomain('iam').findings.filter((f) => f.category === 'consistency').length, 0,
      'the finding clears once the documents agree again'
    );
  });
});

test.after(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
});
