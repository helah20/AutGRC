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
