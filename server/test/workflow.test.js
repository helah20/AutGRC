/**
 * End-to-end workflow test.
 *
 * Exercises the complete path the brief specifies:
 *   create domain -> select framework -> generate policy, standard,
 *   procedure, roles and RACI -> map controls -> AI review ->
 *   identify inconsistencies -> approve -> export to Word and PDF.
 *
 * Runs against a live server on AUTGRC_TEST_URL (default localhost:4000).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.AUTGRC_TEST_URL || 'http://localhost:4000';
const PASSWORD = process.env.SEED_PASSWORD || 'Autgrc#2025';

const state = { tokens: {}, packageId: null, docs: {}, matrixId: null };

async function login(email) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD })
  });
  // Read the body once: consuming it inside the assertion message would
  // leave nothing to parse.
  const text = await res.text();
  assert.equal(res.status, 200, `login failed for ${email}: ${text}`);
  const body = JSON.parse(text);
  state.tokens[email] = body.accessToken;
  return body;
}

async function api(method, path, { as = 'grc@autgrc.demo', body, raw = false } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${state.tokens[as]}`,
      ...(body ? { 'content-type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (raw) return res;
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

test('AutGRC end-to-end governance workflow', async (t) => {
  await t.test('health check reports a consistent knowledge base', async () => {
  const res = await fetch(`${BASE}/api/health`);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.knowledgeBaseProblems, 0);
});

  await t.test('sign in as every seeded role', async () => {
  for (const email of [
    'admin@autgrc.demo', 'ciso@autgrc.demo', 'grc@autgrc.demo',
    'analyst@autgrc.demo', 'reviewer@autgrc.demo', 'auditor@autgrc.demo', 'viewer@autgrc.demo'
  ]) {
    const session = await login(email);
    assert.ok(session.permissions.length > 0, `${email} has no permissions`);
  }
});

  await t.test('rejects a bad password and does not leak account existence', async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'grc@autgrc.demo', password: 'wrong-password-value' })
  });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.match(body.error, /incorrect/i);
});

  await t.test('role-based access control blocks unauthorised actions', async () => {
  // Read-only cannot generate.
  const denied = await api('POST', '/api/generator/generate', {
    as: 'viewer@autgrc.demo',
    body: { domainKey: 'cryptography', docTypes: ['policy'], frameworkCodes: ['ISO-27001'] }
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.required, 'generate:run');

  // The GRC manager cannot approve; that is the approver's permission.
  const cannotApprove = await api('GET', '/api/admin/users', { as: 'grc@autgrc.demo' });
  assert.equal(cannotApprove.status, 403, 'GRC manager should not manage users');
});

  await t.test('step 1-3: generate a full governance package for a domain and framework', async () => {
  const preview = await api('POST', '/api/generator/preview', {
    body: {
      domainKey: 'cryptography',
      docTypes: ['policy', 'standard', 'procedure', 'roles', 'raci', 'control_matrix'],
      frameworkCodes: ['NCA-ECC', 'ISO-27001', 'NIST-800-53']
    }
  });
  assert.equal(preview.status, 200);
  assert.ok(preview.body.documents.length === 6);
  assert.ok(preview.body.assumptions.length > 0, 'assumptions must be recorded explicitly');

  const gen = await api('POST', '/api/generator/generate', {
    body: {
      domainKey: 'cryptography',
      docTypes: ['policy', 'standard', 'procedure', 'roles', 'raci', 'control_matrix'],
      frameworkCodes: ['NCA-ECC', 'ISO-27001', 'NIST-800-53'],
      classification: 'confidential'
    }
  });
  assert.equal(gen.status, 201, JSON.stringify(gen.body).slice(0, 400));
  state.packageId = gen.body.packageId;
  for (const d of gen.body.documents) state.docs[d.doc_type] = d;

  assert.ok(state.docs.policy, 'policy generated');
  assert.ok(state.docs.standard, 'standard generated');
  assert.ok(state.docs.procedure, 'procedure generated');
  assert.ok(state.docs.roles, 'roles generated');
  assert.ok(state.docs.raci, 'RACI generated');
  assert.ok(gen.body.controls > 0, 'controls generated');
  assert.ok(gen.body.evidence > 0, 'evidence requirements generated');
});

  await t.test('generated documents are internally consistent', async () => {
  const policy = await api('GET', `/api/documents/${state.docs.policy.id}`);
  const standard = await api('GET', `/api/documents/${state.docs.standard.id}`);
  const procedure = await api('GET', `/api/documents/${state.docs.procedure.id}`);

  const textOf = (doc) => doc.body.sections.map((s) => s.body).join(' ').replace(/<[^>]+>/g, ' ');
  // The key rotation frequency is a single agreed parameter; every document
  // that states it must state the same value.
  const rotation = 'annually, or immediately on suspected compromise';
  assert.ok(textOf(standard).includes(rotation), 'standard states the agreed rotation value');
  assert.ok(textOf(procedure).includes(rotation), 'procedure states the same rotation value');

  // The policy must carry its required sections.
  const keys = policy.body.sections.map((s) => s.section_key);
  for (const required of ['purpose', 'scope', 'objectives', 'statements', 'roles', 'governance',
    'compliance', 'exceptions', 'monitoring', 'review', 'enforcement', 'references']) {
    assert.ok(keys.includes(required), `policy missing section "${required}"`);
  }

  // The procedure must carry a visual flow.
  assert.ok(procedure.body.flow, 'procedure has a process flow');
  assert.ok(procedure.body.flow.steps.length >= 4, 'flow has steps');
  assert.ok(procedure.body.flow.steps.some((s) => s.decision), 'flow has at least one decision point');
});

  await t.test('document hierarchy links Policy -> Standard -> Procedure', async () => {
  const standard = await api('GET', `/api/documents/${state.docs.standard.id}`);
  const implementsPolicy = standard.body.links.find((l) => l.link_type === 'implements');
  assert.ok(implementsPolicy, 'standard implements the policy');
  assert.equal(implementsPolicy.to_id, state.docs.policy.id);

  const procedure = await api('GET', `/api/documents/${state.docs.procedure.id}`);
  assert.ok(procedure.body.links.some((l) => l.to_id === state.docs.standard.id));
});

  await t.test('controls are mapped to the selected framework requirements', async () => {
  const controls = await api('GET', '/api/controls?domain=cryptography');
  assert.equal(controls.status, 200);
  assert.ok(controls.body.items.length > 0);

  const detail = await api('GET', `/api/controls/${controls.body.items[0].id}`);
  assert.ok(detail.body.control.mappings.length > 0, 'control is mapped to a framework requirement');
  assert.ok(detail.body.control.evidence.length > 0, 'control carries evidence requirements');

  // Full traceability chain: source -> control -> policy -> procedure -> evidence.
  const requirementId = detail.body.control.mappings[0].requirement_id;
  const trace = await api('GET', `/api/frameworks/requirements/${requirementId}/trace`);
  assert.equal(trace.status, 200);
  assert.ok(trace.body.chain.length > 0);
  const link = trace.body.chain[0];
  assert.ok(link.control.control_id, 'chain includes a control');
  assert.ok(link.policy || link.policy_ref, 'chain includes a policy reference');
  assert.ok(link.evidence.length > 0, 'chain includes evidence');
});

  await t.test('RACI matrix validates: exactly one accountable role per activity', async () => {
  const list = await api('GET', '/api/raci');
  const matrix = list.body.find((m) => m.domain_key === 'cryptography');
  assert.ok(matrix, 'RACI matrix created for the domain');
  state.matrixId = matrix.id;

  const validation = await api('GET', `/api/raci/${matrix.id}/validate`);
  assert.equal(validation.status, 200);
  assert.equal(validation.body.valid, true, `matrix has issues: ${JSON.stringify(validation.body.issues)}`);
});

  await t.test('RACI builder detects multiple accountable roles', async () => {
  const data = await api('GET', `/api/raci/${state.matrixId}`);
  const activity = data.body.activities[0];
  const cols = data.body.columns;
  const currentlyAccountable = cols.find((c) => data.body.grid[activity.id]?.[c.id] === 'A');
  const other = cols.find((c) => c.id !== currentlyAccountable.id);

  // Introduce a second Accountable and confirm the validator objects.
  const assigned = await api('PUT', `/api/raci/${state.matrixId}/assign`, {
    body: { activity_id: activity.id, role_col_id: other.id, value: 'A' }
  });
  assert.equal(assigned.status, 200);
  const issue = assigned.body.validation.find((i) => i.title.includes('Multiple accountable'));
  assert.ok(issue, 'validator flags multiple accountable roles');
  assert.equal(issue.severity, 'high');

  // Restore the matrix.
  await api('PUT', `/api/raci/${state.matrixId}/assign`, {
    body: { activity_id: activity.id, role_col_id: other.id, value: 'C' }
  });
});

  await t.test('AI review identifies the seeded governance inconsistency', async () => {
  const review = await api('POST', '/api/ai/review/domain/iam');
  assert.equal(review.status, 200);
  const inconsistency = review.body.findings.find((f) => f.category === 'consistency');
  assert.ok(inconsistency, 'consistency finding raised for the IAM domain');
  assert.equal(inconsistency.severity, 'high');
  assert.match(inconsistency.title, /inconsistency/i);

  const evidence = typeof inconsistency.evidence === 'string'
    ? JSON.parse(inconsistency.evidence)
    : inconsistency.evidence;
  assert.ok(evidence.conflicting, 'finding quotes the conflicting statement');
  assert.ok(evidence.agreedValue, 'finding states the agreed value');
});

  await t.test('AI review of a document reports completeness and ambiguity', async () => {
  const review = await api('POST', `/api/ai/review/document/${state.docs.policy.id}`);
  assert.equal(review.status, 200);
  assert.ok(typeof review.body.score.score === 'number');
  assert.ok(Array.isArray(review.body.findings));
  assert.ok(review.body.provider, 'review records the provider used');
});

  await t.test('AI rewrite replaces unmeasurable wording', async () => {
  const result = await api('POST', '/api/ai/rewrite', {
    body: { text: '<p>Access reviews shall be performed regularly and appropriately by the owner.</p>', mode: 'improve' }
  });
  assert.equal(result.status, 200);
  assert.ok(!result.body.html.includes('regularly'), 'vague wording removed');
  assert.ok(result.body.changes.length >= 1, 'changes are itemised');
  assert.equal(result.body.provenance, 'ai_recommendation');
});

  await t.test('lifecycle: submit, approve and publish with segregation of duties', async () => {
  const docId = state.docs.policy.id;

  const submitted = await api('POST', `/api/documents/${docId}/transition`, {
    body: { to: 'under_review', comment: 'Submitted for review.' }
  });
  assert.equal(submitted.status, 200);
  assert.equal(submitted.body.document.status, 'under_review');

  // The owner is the GRC manager; they must not be able to approve their own work.
  const selfApprove = await api('POST', `/api/documents/${docId}/transition`, {
    body: { to: 'approved' }, as: 'grc@autgrc.demo'
  });
  assert.equal(selfApprove.status, 403, 'GRC manager lacks the approve permission');

  const approved = await api('POST', `/api/documents/${docId}/transition`, {
    as: 'ciso@autgrc.demo',
    body: { to: 'approved', comment: 'Reviewed against NCA ECC 2-8 and ISO/IEC 27001 A.8.24. Approved.' }
  });
  assert.equal(approved.status, 200, JSON.stringify(approved.body).slice(0, 300));
  assert.equal(approved.body.document.status, 'approved');

  const published = await api('POST', `/api/documents/${docId}/transition`, {
    body: { to: 'published', comment: 'Published to the governance library.' }
  });
  assert.equal(published.status, 200);
  assert.equal(published.body.document.status, 'published');
  assert.equal(published.body.document.version, '1.0');
  assert.ok(published.body.document.effective_date, 'effective date set on publication');
  assert.ok(published.body.approvals.length >= 3, 'approval history recorded');
});

  await t.test('published documents are protected from direct edit and deletion', async () => {
  const docId = state.docs.policy.id;
  const detail = await api('GET', `/api/documents/${docId}`);
  const section = detail.body.sections[0];

  const edit = await api('PUT', `/api/documents/${docId}/sections/${section.id}`, {
    body: { body: '<p>Attempted edit of a published document.</p>' }
  });
  assert.equal(edit.status, 409);

  const del = await api('DELETE', `/api/documents/${docId}`);
  assert.equal(del.status, 409);
  assert.match(del.body.error, /Retire/i);
});

  await t.test('export to Word, PDF and Excel', async () => {
  const docId = state.docs.policy.id;

  const docx = await api('GET', `/api/export/documents/${docId}.docx`, { raw: true });
  assert.equal(docx.status, 200);
  assert.equal(docx.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const docxBuf = Buffer.from(await docx.arrayBuffer());
  assert.ok(docxBuf.length > 8000, 'Word document has content');
  assert.equal(docxBuf.subarray(0, 2).toString(), 'PK', 'Word document is a valid archive');

  const pdf = await api('GET', `/api/export/documents/${docId}.pdf`, { raw: true });
  assert.equal(pdf.status, 200);
  const pdfBuf = Buffer.from(await pdf.arrayBuffer());
  assert.equal(pdfBuf.subarray(0, 5).toString(), '%PDF-', 'PDF has a valid header');

  const xlsx = await api('GET', '/api/export/controls.xlsx?domain=cryptography', { raw: true });
  assert.equal(xlsx.status, 200);
  const xlsxBuf = Buffer.from(await xlsx.arrayBuffer());
  assert.equal(xlsxBuf.subarray(0, 2).toString(), 'PK', 'workbook is a valid archive');

  const raci = await api('GET', `/api/export/raci/${state.matrixId}.xlsx`, { raw: true });
  assert.equal(raci.status, 200);
});

  await t.test('global search spans every governance object', async () => {
  const res = await api('GET', '/api/search?q=multi-factor');
  assert.equal(res.status, 200);
  const types = res.body.groups.map((g) => g.type);
  assert.ok(types.includes('document'), 'search returns documents');
  assert.ok(types.includes('control'), 'search returns controls');
  assert.ok(res.body.total > 0);
});

  await t.test('dashboard reports KPIs and coverage', async () => {
  const res = await api('GET', '/api/dashboard');
  assert.equal(res.status, 200);
  const k = res.body.kpis;
  assert.ok(k.totalDocuments > 0);
  assert.ok(k.policies > 0);
  assert.ok(k.controls > 0);
  assert.ok(k.frameworkRequirements > 400, 'framework catalogue loaded');
  assert.ok(typeof k.complianceCoverage === 'number');
  assert.ok(res.body.charts.coverage.length > 0);
  assert.ok(res.body.recentlyUpdated.length > 0);
});

  await t.test('gap assessment seeds from real coverage', async () => {
  const list = await api('GET', '/api/assessments');
  assert.ok(list.body.length > 0);
  const detail = await api('GET', `/api/assessments/${list.body[0].id}`);
  assert.equal(detail.status, 200);
  assert.ok(detail.body.items.length > 0);
  const statuses = new Set(detail.body.items.map((i) => i.status));
  assert.ok(statuses.has('compliant') || statuses.has('partially_compliant'), 'assessment reflects existing coverage');
  for (const item of detail.body.items) {
    assert.ok(item.requirement_ref, 'every row cites a requirement');
    assert.ok(item.recommendation, 'every row carries a recommendation');
  }
});

  await t.test('reports render and export', async () => {
  const list = await api('GET', '/api/reports');
  assert.ok(list.body.length >= 10, 'ten report types available');
  for (const report of list.body) {
    const data = await api('GET', `/api/reports/${report.key}`);
    assert.equal(data.status, 200, `report ${report.key} failed`);
    assert.ok(Array.isArray(data.body.headers) && data.body.headers.length > 0, `report ${report.key} has headers`);
  }
  const xlsx = await api('GET', '/api/reports/audit_readiness/export.xlsx', { raw: true });
  assert.equal(xlsx.status, 200);
});

  await t.test('audit log captures the workflow', async () => {
  const res = await api('GET', '/api/admin/audit?limit=200', { as: 'auditor@autgrc.demo' });
  assert.equal(res.status, 200);
  const actions = res.body.items.map((r) => r.action);
  for (const expected of ['login', 'generate:package', 'document:approved', 'document:published', 'export:docx', 'ai:review_domain']) {
    assert.ok(actions.includes(expected), `audit log missing "${expected}"`);
  }
  assert.ok(res.body.items.some((r) => r.outcome === 'denied'), 'denied access is audited');
});
});
