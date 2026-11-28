/**
 * A generated Policy read the way a GRC reviewer reads it. Each assertion is a
 * finding from a review of the Social Media Account Security Policy, held
 * here so that a later change cannot quietly bring it back.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autgrc-policy-'));
process.env.AUTGRC_DATA_DIR = tmpDir;
process.env.AUTGRC_DB_FILE = path.join(tmpDir, 'test.db');
process.env.JWT_SECRET = 'test-secret-for-the-policy-suite-only';

const { syncCatalogue } = await import('../src/db/seed.js');
syncCatalogue();
const { previewPackage } = await import('../src/services/generator.js');

const org = { org_name: 'Test Org', technology_env: ['Core Banking', 'Oracle Database', 'VMware'] };
const policy = (frameworkCodes, language = 'en') => previewPackage({
  domainKey: 'social_media_security', docTypes: ['policy'], frameworkCodes, org, language
}).documents[0];
const sectionText = (doc, key) => doc.sections.find((s) => s.key === key).body.replace(/<[^>]+>/g, ' ');

const adopted = ['NCA-ECC', 'NCA-CSCC', 'NCA-OSMACC', 'ISO-27001'];

test('the scope is the social media estate, not the whole technology stack', () => {
  const scope = sectionText(policy(adopted), 'scope');
  assert.doesNotMatch(scope, /Core Banking|Oracle Database|VMware/);
  assert.match(scope, /official accounts on every social media platform/);
});

test('ownership, custody and approval are stated once and agree', () => {
  const governance = sectionText(policy(adopted), 'governance');
  assert.match(governance, /Policy owner\s+Chief Information Security Officer/);
  assert.match(governance, /Document custodian\s+Cybersecurity GRC Manager/);
  assert.match(governance, /Policy approver\s+Cybersecurity Steering Committee/);
});

test('the policy states the account requirements a reviewer looks for', () => {
  const statements = sectionText(policy(adopted), 'statements');
  for (const expected of [
    /corporate email address dedicated to social media/,
    /Personal social media accounts shall not be used/,
    /held only in the organisation&#39;s password vault|held only in the organisation's password vault/,
    /shared credentials shall be issued only through the password vault/,
    /leaves the role or the organisation, their access shall be removed/,
    /recovery information/,
    /content approved by an authorised approver/,
    /suspended or closed only on the Business Owner/,
    /escalated as the Cybersecurity Incident Management Procedure sets/,
    /Impersonation shall be reported to the platform, documented and handled/
  ]) assert.match(statements, expected);
});

test('each clause cites the OSMACC controls it implements, in the publisher\'s words', () => {
  const statements = policy(adopted).sections.find((s) => s.key === 'statements').body;
  assert.match(statements, /NCA-OSMACC 2-2-1-5/);
  assert.match(statements, /class="subclause"><span class="clause-ref">[\d.]+<\/span> Using multi-factor authentication for organization’s social media accounts logins\./);
});

test('a framework the policy never cites is not listed as a compliance source', () => {
  const compliance = sectionText(policy(adopted), 'compliance');
  assert.doesNotMatch(compliance, /Critical Systems Cybersecurity Controls/);
  assert.match(compliance, /not listed: NCA-CSCC/);
});

test('the regulation written for the domain is flagged when it is not adopted', () => {
  const compliance = policy(['NCA-ECC', 'ISO-27001']).sections.find((s) => s.key === 'compliance').body;
  assert.match(compliance, /data-callout="warn"/);
  assert.match(compliance, /NCA-OSMACC sets the controls for this domain/);
});

test('references separate regulation, implementation guidance and international standards', () => {
  const references = sectionText(policy(adopted), 'references');
  const regulatory = references.indexOf('Regulatory requirements');
  const guides = references.indexOf('Implementation guides');
  const international = references.indexOf('International standards and frameworks');
  assert.ok(regulatory >= 0 && guides > regulatory && international > guides);
  assert.match(references, /GOSMACC-1:2023/);
});

test('an exception is approved independently and never breaches a mandatory requirement', () => {
  const exceptions = sectionText(policy(adopted), 'exceptions');
  assert.match(exceptions, /independent of its implementation/);
  assert.match(exceptions, /administrative and organisational controls/);
  assert.match(exceptions, /unless the competent regulator has expressly permitted it/);
});

test('the Arabic policy carries the same structure', () => {
  const doc = policy(adopted, 'ar');
  assert.match(sectionText(doc, 'governance'), /أمين الوثيقة/);
  assert.match(sectionText(doc, 'references'), /الأدلة الإرشادية/);
  assert.doesNotMatch(sectionText(doc, 'scope'), /Core Banking/);
});

test('the quality engine flags a policy made before these rules', async () => {
  const { q, nowIso, fromJson } = await import('../src/db/index.js');
  const { checkPolicyDesign } = await import('../src/services/review.js');
  q.run(`INSERT OR IGNORE INTO org_profile (id, org_name, technology_env, updated_at) VALUES (1, 'Test Org', ?, ?)`,
    JSON.stringify(['Core Banking', 'VMware']), nowIso());
  const doc = { id: 'd1', reference: 'POL-SMA-001', doc_type: 'policy', domain_key: 'social_media_security',
    generation_meta: JSON.stringify({ frameworks: ['NCA-ECC', 'NCA-OSMACC'] }) };
  const old = (key, body) => ({ section_key: key, body });
  const sections = [
    old('scope', '<p>It applies to: Core Banking, VMware.</p>'),
    old('statements', '<p>4.1 Accounts shall be secured. [NCA-OSMACC 2-2; NCA-ECC 2-2-3-2]</p>'),
    old('governance', '<p>The Cybersecurity GRC Manager maintains the Policy.</p>'),
    old('references', '<ul><li>NCA ECC</li><li>ISO/IEC 27001</li></ul>')
  ];
  const titles = checkPolicyDesign({ doc, sections }).map((f) => f.title);
  assert.ok(titles.includes('NCA-OSMACC is cited only by its headings'));
  assert.ok(titles.includes('The scope lists systems outside this domain'));
  assert.ok(titles.includes('The document roles are not stated as owner, custodian and approver'));
  assert.ok(titles.includes('References mix regulation, guidance and international standards'));
  assert.equal(fromJson('[]', []).length, 0);

  const fresh = policy(['NCA-ECC', 'NCA-OSMACC', 'ISO-27001']);
  const generated = fresh.sections.map((s) => ({ section_key: s.key, body: s.body }));
  assert.deepEqual(checkPolicyDesign({ doc: { ...doc, generation_meta: JSON.stringify({ frameworks: ['NCA-ECC', 'NCA-OSMACC', 'ISO-27001'] }) }, sections: generated }), [],
    'a policy generated now passes its own design rules');
});

test('an Arabic policy quotes the ECC in its Arabic wording', () => {
  const doc = previewPackage({ domainKey: 'iam', docTypes: ['policy'], frameworkCodes: ['NCA-ECC'], org, language: 'ar' }).documents[0];
  const statements = doc.sections.find((s) => s.key === 'statements').body;
  assert.match(statements, /التحقق من الهوية أحادي العنصر \(Single-factor authentication\)[^<]*<span class="clause-source">\[NCA-ECC 2-2-3-1\]/);
  assert.doesNotMatch(statements, /data-callout="note"/, 'no ECC control is left in English');
});

test('every ECC control carries Arabic text, and the two renumbered ones carry the right text', async () => {
  const { ECC_2024_CONTROLS } = await import('../src/knowledge/catalogue/ecc-2024.js');
  assert.equal(ECC_2024_CONTROLS.filter((r) => r[6]?.ar).length, 200);
  const ar = Object.fromEntries(ECC_2024_CONTROLS.map((r) => [r[0], r[6].ar]));
  assert.match(ar['1-7-1'], /اتفاقيات أو التزامات دولية/, 'English 1-7-1 is the international agreements control');
  assert.match(ar['2-7-3'], /مراجعة تطبيق متطلبات الأمن السيبراني لحماية بيانات/, 'English 2-7-3 is the periodic review');
});

test('the NCNICC category decides which controls a policy states as recommended', () => {
  const statements = (category) => previewPackage({
    // NCNICC is published in Arabic only, so it is quoted in the Arabic policy.
    domainKey: 'iam', docTypes: ['policy'], frameworkCodes: ['NCA-NCNICC'], org: { ...org, ncnicc_category: category }, language: 'ar'
  }).documents[0].sections.find((s) => s.key === 'statements').body;
  assert.match(statements('B'), /موصى به، وليس ملزماً، للفئة \(ب\)/);
  assert.doesNotMatch(statements('A'), /موصى به، وليس ملزماً/);
  assert.match(statements(null), /حدّد فئة الجهة في ملف المنظمة/);
});

test('a cloud tenant\'s policy does not quote the provider controls', () => {
  const body = previewPackage({
    domainKey: 'cloud_security', docTypes: ['policy'], frameworkCodes: ['NCA-CCC'], org: { ...org, cloud_roles: ['CST'] }, language: 'en'
  }).documents[0].sections.find((s) => s.key === 'statements').body;
  assert.doesNotMatch(body, /class="subclause">[^]*?\[NCA-CCC \d-\d+-P-/);
  assert.match(body, /\[NCA-CCC \d-\d+-T-/);
  assert.match(body, /Cloud controls for the other party are not quoted/);
});

test('the quality engine holds a Standard and a Procedure to the reviewer\'s rules', async () => {
  const { checkTierDesign } = await import('../src/services/review.js');
  const doc = (type) => ({ id: 'd', reference: 'X-001', doc_type: type, domain_key: 'iam' });
  const sec = (key, body) => ({ section_key: key, body });
  const titles = (type, sections) => checkTierDesign({ doc: doc(type), sections }).map((f) => f.title);

  assert.ok(titles('policy', [sec('statements', '<ol><li>Access shall be revoked within 4 hours.</li></ol>')])
    .includes('The Policy states a measurable value'));
  assert.deepEqual(titles('policy', [sec('statements', '<ol><li>Access shall be revoked within the period set in the accompanying Standard.</li><li class="subclause">within 4 hours [NCA-ECC 1-1-1]</li></ol>')]), [],
    'a value quoted from the regulator is not the Policy\'s own');

  const std = titles('standard', [
    sec('mandatory', '<ol><li>3.1.1 Do it. Accountable: Not yet assigned</li></ol>'),
    sec('monitoring', '<table><thead><tr><th>R</th><th>I</th></tr></thead><tbody><tr><td>Reviews</td><td>Reviews completed</td></tr></tbody></table>')
  ]);
  assert.ok(std.includes('1 Standard clause(s) have no accountable role'));
  assert.ok(std.includes('1 indicator(s) have no target'));

  const proc = titles('procedure', [
    sec('steps', '<table><thead><tr><th>In</th><th>Step</th><th>Who</th><th>Out</th></tr></thead><tbody><tr><td>A request</td><td>1. Approve</td><td></td><td>—</td></tr></tbody></table>'),
    sec('kpis', '<table><thead><tr><th>K</th><th>T</th></tr></thead><tbody><tr><td>Timeliness</td><td></td></tr></tbody></table>'),
    sec('records', '<ul><li>Approval record</li><li>Access log (retained 3 years)</li></ul>')
  ]);
  assert.ok(proc.includes('1 procedure step(s) lack a responsible role, an input or an output'));
  assert.ok(proc.includes('1 KPI(s) have no target'));
  assert.ok(proc.includes('1 record(s) have no retention period'));

  const fresh = previewPackage({ domainKey: 'iam', docTypes: ['policy', 'standard', 'procedure'], frameworkCodes: ['NCA-ECC'], org, language: 'en' });
  for (const d of fresh.documents) {
    assert.deepEqual(checkTierDesign({ doc: doc(d.docType), sections: d.sections.map((s) => ({ section_key: s.key, body: s.body })) }), [],
      `a generated ${d.docType} passes the rules it is held to`);
  }
});
