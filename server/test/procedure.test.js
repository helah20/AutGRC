/**
 * Procedures in the input | step | responsible | output form, and the gap
 * check applied to procedures an organisation uploads.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

const { DOMAIN_MODELS, localisedModel, buildParameterSet } = await import('../src/knowledge/index.js');
const { buildProcedureDoc, withLanguage } = await import('../src/services/doc-builders.js');
const { htmlToBlocks } = await import('../src/services/html-to-blocks.js');
const { fixDigitHyphens } = await import('../src/services/export-docx.js');
const { checkProcedureStructure, checkArabicWording, checkDigitHyphens, outdatedNcaEditions } =
  await import('../src/services/procedure-check.js');

const hasArabic = (text) => /[؀-ۿ]/.test(text);

test('every procedure step has an input and an output', () => {
  for (const model of Object.values(DOMAIN_MODELS)) {
    for (const [i, step] of model.procedure.steps.entries()) {
      assert.ok(step.input, `${model.key} step ${i + 1} has an input`);
      assert.ok(step.output, `${model.key} step ${i + 1} has an output`);
    }
  }
  // An unauthored input is the previous step's output, not a guess.
  const iam = DOMAIN_MODELS.iam.procedure.steps;
  assert.equal(iam[1].input, iam[0].output);
});

test('the Arabic procedure carries Arabic inputs and outputs', () => {
  for (const key of Object.keys(DOMAIN_MODELS)) {
    const model = localisedModel(key, 'ar');
    for (const [i, step] of model.procedure.steps.entries()) {
      assert.ok(hasArabic(step.input), `${key} step ${i + 1} input is Arabic: ${step.input}`);
      assert.ok(hasArabic(step.output), `${key} step ${i + 1} output is Arabic: ${step.output}`);
    }
  }
});

test('detailed steps render as one input | step | responsible | output table', () => {
  for (const language of ['en', 'ar']) {
    const model = localisedModel('hr_security', language);
    const params = buildParameterSet('hr_security', { org_name: 'Test Org' }, {}, language);
    const doc = withLanguage(language, () => buildProcedureDoc({ model, params, frameworkCodes: [] }));
    const steps = doc.sections.find((s) => s.key === 'steps');
    const html = steps.html ?? steps.body ?? steps.content;
    const table = htmlToBlocks(html).find((b) => b.type === 'table');
    assert.ok(table, `${language}: the steps are a table`);
    assert.equal(table.head[0].length, 4);
    assert.equal(table.rows.length, model.procedure.steps.length);
    assert.deepEqual(table.widths, [22, 40, 16, 22], 'the step column is the widest');
    const headers = table.head[0].map((runs) => runs.map((r) => r.text).join(''));
    assert.deepEqual(headers, language === 'ar'
      ? ['المدخل', 'الخطوة', 'المسؤول', 'المخرج']
      : ['Input', 'Step', 'Responsible', 'Output']);
    // The step cell opens with its number and name in bold.
    const first = table.rows[0][1];
    assert.ok(first[0].bold && first[0].text.startsWith('1. '), `${language}: ${first[0].text}`);
    assert.doesNotMatch(html, /\{\{\w+\}\}/, 'no placeholder reaches the table');
  }
});

test('an uploaded procedure without its operating parts is reported', () => {
  const thin = 'إجراء إدارة الثغرات. يقوم الفريق بفحص الأنظمة ومعالجة الثغرات المكتشفة.';
  const { missing } = checkProcedureStructure(thin);
  for (const key of ['inputs', 'outputs', 'responsible', 'timelines', 'exceptions', 'escalation', 'kpis', 'records', 'verification']) {
    assert.ok(missing.includes(key), `${key} is reported missing`);
  }

  const complete = `المدخل | الخطوة | المسؤول | المخرج
    عند اكتشاف ثغرة حرجة: تُعالَج خلال 15 يوماً. يُرفع الاستثناء مع ضوابط تعويضية إلى اللجنة،
    ويُصعَّد التأخير إلى رئيس الأمن السيبراني. التحقق بإعادة الفحص. مؤشرات الأداء: الالتزام بمستوى الخدمة.
    السجلات يُحتفظ بها 3 سنوات. الوثائق ذات العلاقة: سياسة إدارة الثغرات.`;
  assert.deepEqual(checkProcedureStructure(complete).missing, []);
});

test('Arabic wording errors are suggested with their context', () => {
  const finding = checkArabicWording('يجب على ادارة الأمن السيبراني معالجة احد الثغرات المكتشفة.');
  assert.ok(finding);
  const suggested = finding.evidence.corrections.map((c) => c.suggested);
  assert.ok(suggested.includes('إدارة'));
  assert.ok(suggested.includes('إحدى'));
  assert.equal(checkArabicWording('يجب على إدارة الأمن السيبراني معالجة إحدى الثغرات.'), null);
  assert.equal(checkArabicWording('English only text.'), null);
});

test('clause references keep their digit order in right-to-left Word output', () => {
  assert.equal(fixDigitHyphens('ECC 1‑2‑3 and 12‑أ'), 'ECC 1-2-3 and 12‑أ');
  assert.ok(checkDigitHyphens('الضابط 2‑3'));
  assert.equal(checkDigitHyphens('الضابط 2-3'), null);
});

test('superseded NCA editions are named', () => {
  assert.equal(outdatedNcaEditions('aligned to ECC-1:2018').length, 1);
  assert.equal(outdatedNcaEditions('aligned to CCC-1:2020').length, 1);
  assert.deepEqual(outdatedNcaEditions('aligned to ECC-2:2024'), []);
});
