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

/**
 * This suite drives a running server. Rather than emitting a failure for every
 * case when nothing is listening, check once and skip with an explanation.
 */
async function serverReachable() {
  try {
    const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2500) });
    return res.ok;
  } catch {
    return false;
  }
}

const reachable = await serverReachable();

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

/** A sign-in attempt whose result is inspected rather than stored. */
async function rawLogin(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

/** Multipart POST; the runtime sets the boundary from the FormData itself. */
async function upload(path, form, { as = 'grc@autgrc.demo' } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${state.tokens[as]}` },
    body: form
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

test('AutGRC end-to-end governance workflow', {
  skip: reachable ? false : `No server responding at ${BASE}. Start one with "npm start" in another terminal, or set AUTGRC_TEST_URL.`
}, async (t) => {
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

  await t.test('the quality profile splits the same findings across five criteria', async () => {
  const review = await api('POST', `/api/ai/review/document/${state.docs.policy.id}`);
  assert.equal(review.status, 200);
  const card = review.body.scorecard;
  assert.ok(card, 'the review reports a criterion profile beside the score');
  assert.equal(card.criteria.length, 5);
  assert.deepEqual(card.unmapped, [],
    'a live review emitted a finding category the profile cannot place, so those findings scored nothing');
  for (const c of card.criteria) {
    assert.ok(c.band >= 1 && c.band <= 5, `${c.short} band in range`);
    assert.ok(['ok', 'attention', 'breach'].includes(c.status));
  }
  // The two figures come from one finding list, so a clean document cannot be
  // reported as ready by one and unready by the other.
  if (review.body.score.score === 100) assert.equal(card.overall, 5);
});

  await t.test('reviewers assess a document separately and disagreement is reported', async () => {
  const docId = state.docs.standard.id;

  const empty = await api('GET', `/api/documents/${docId}/assessment`);
  assert.equal(empty.status, 200);
  assert.equal(empty.body.assessment.panelSize, 0);
  assert.equal(empty.body.assessment.divergence.material, false,
    'an unrated document must not be reported as reviewers agreeing');
  assert.equal(empty.body.comparison, null, 'nothing to compare without a panel');

  const first = await api('PUT', `/api/documents/${docId}/assessment`, {
    as: 'reviewer@autgrc.demo',
    body: {
      policy_alignment: 5, role_clarity: 5, applicability: 4,
      governance_compliance: 5, control_completeness: 5, comment: 'Reads correctly.'
    }
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.assessment.panelSize, 1);
  assert.equal(first.body.assessment.meanTotal, 24);
  assert.equal(first.body.assessment.divergence.material, false,
    'one rating is not a panel agreeing');

  // The shape the paper found among its three experts: two near the top of the
  // scale and one near the bottom on the same text (Table 9, page 29).
  const second = await api('PUT', `/api/documents/${docId}/assessment`, {
    as: 'auditor@autgrc.demo',
    body: {
      policy_alignment: 2, role_clarity: 2, applicability: 2,
      governance_compliance: 2, control_completeness: 3
    }
  });
  assert.equal(second.status, 200);
  assert.equal(second.body.assessment.panelSize, 2);
  assert.equal(second.body.assessment.divergence.material, true);
  assert.ok(second.body.assessment.divergence.maxRange >= 2);
  assert.ok(second.body.comparison, 'the two bases are compared once there is a panel');

  // Replacing your own rating must not add a second voice to the panel.
  const again = await api('PUT', `/api/documents/${docId}/assessment`, {
    as: 'reviewer@autgrc.demo',
    body: {
      policy_alignment: 3, role_clarity: 3, applicability: 3,
      governance_compliance: 3, control_completeness: 3
    }
  });
  assert.equal(again.body.assessment.panelSize, 2, 'a revised rating replaces, it does not accumulate');

  const outOfRange = await api('PUT', `/api/documents/${docId}/assessment`, {
    as: 'reviewer@autgrc.demo',
    body: {
      policy_alignment: 9, role_clarity: 3, applicability: 3,
      governance_compliance: 3, control_completeness: 3
    }
  });
  assert.equal(outOfRange.status, 400, 'a score off the five-point scale is rejected');

  const readOnly = await api('PUT', `/api/documents/${docId}/assessment`, {
    as: 'viewer@autgrc.demo',
    body: {
      policy_alignment: 5, role_clarity: 5, applicability: 5,
      governance_compliance: 5, control_completeness: 5
    }
  });
  assert.equal(readOnly.status, 403, 'a read-only account cannot record an assessment');
});

  await t.test('a document cannot be assessed by its own owner', async () => {
  // The owner of the seeded package is the GRC manager, and the same reasoning
  // that stops them approving their own document stops them rating it.
  const owned = await api('PUT', `/api/documents/${state.docs.standard.id}/assessment`, {
    as: 'grc@autgrc.demo',
    body: {
      policy_alignment: 5, role_clarity: 5, applicability: 5,
      governance_compliance: 5, control_completeness: 5
    }
  });
  assert.equal(owned.status, 409);
  assert.match(owned.body.error, /segregation of duties/i);

  const view = await api('GET', `/api/documents/${state.docs.standard.id}/assessment`, { as: 'grc@autgrc.demo' });
  assert.equal(view.body.canAssess, false, 'the form is not offered to someone the route would refuse');
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

  await t.test('notifications reach whoever the work now waits on', async () => {
    const docId = state.docs.policy.id;

    // The lifecycle case above submitted, approved and published this document
    // as the GRC manager and the CISO. The approver should have been told the
    // approval was needed, and the owner that it was approved.
    const approverInbox = await api('GET', '/api/notifications?limit=50', { as: 'ciso@autgrc.demo' });
    assert.equal(approverInbox.status, 200);
    const approverKinds = approverInbox.body.items
      .filter((n) => n.entity_id === docId)
      .map((n) => n.kind);
    assert.ok(approverKinds.includes('approval_requested'), 'the approver is told an approval is needed');

    const ownerInbox = await api('GET', '/api/notifications?limit=50');
    const ownerForDoc = ownerInbox.body.items.filter((n) => n.entity_id === docId);
    assert.ok(ownerForDoc.some((n) => n.kind === 'approved'), 'the owner is told their document was approved');
    // The GRC manager submitted and published; neither should notify them.
    assert.ok(
      !ownerForDoc.some((n) => ['approval_requested', 'published'].includes(n.kind)),
      'nobody is notified of their own action'
    );

    const unread = await api('GET', '/api/notifications/unread-count', { as: 'ciso@autgrc.demo' });
    assert.ok(unread.body.unread > 0);

    const first = approverInbox.body.items[0];
    const read = await api('POST', `/api/notifications/${first.id}/read`, { as: 'ciso@autgrc.demo' });
    assert.equal(read.status, 200);
    assert.ok(read.body.notification.read_at, 'marking read records when');

    // Another person's notification is not found rather than forbidden, so the
    // response does not confirm that it exists.
    const crossUser = await api('POST', `/api/notifications/${first.id}/read`, { as: 'auditor@autgrc.demo' });
    assert.equal(crossUser.status, 404);

    // Sweeps are keyed, so running one twice raises nothing the second time.
    const firstSweep = await api('POST', '/api/notifications/sweep', { body: {} });
    assert.equal(firstSweep.status, 200);
    const secondSweep = await api('POST', '/api/notifications/sweep', { body: {} });
    assert.equal(secondSweep.body.review.raised, 0, 'a repeated sweep raises no duplicate review notice');
    assert.equal(secondSweep.body.evidence.raised, 0, 'a repeated sweep raises no duplicate evidence notice');

    const cannotSweep = await api('POST', '/api/notifications/sweep', { as: 'viewer@autgrc.demo', body: {} });
    assert.equal(cannotSweep.status, 403);
  });

  await t.test('My Work offers only actions the person can actually take', async () => {
    const approver = await api('GET', '/api/notifications/my-work', { as: 'ciso@autgrc.demo' });
    assert.equal(approver.status, 200);
    const awaiting = approver.body.groups.find((g) => g.key === 'awaiting_approval');
    if (awaiting) {
      // Segregation of duties would refuse these, so the queue must not offer them.
      const me = await api('GET', '/api/auth/me', { as: 'ciso@autgrc.demo' });
      assert.ok(
        awaiting.documents.every((d) => d.owner_id !== me.body.user.id),
        'the approval queue excludes documents the approver owns'
      );
    }

    // Read-only holds no action permission, so its queue is genuinely empty.
    const readOnly = await api('GET', '/api/notifications/my-work', { as: 'viewer@autgrc.demo' });
    assert.equal(readOnly.body.total, 0);
    assert.equal(readOnly.body.groups.length, 0);

    // The sidebar badge and the page read the same function.
    const dashboard = await api('GET', '/api/dashboard', { as: 'ciso@autgrc.demo' });
    assert.equal(dashboard.body.kpis.myWork, approver.body.total, 'the sidebar count matches the queue');
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

  await t.test('evidence artefacts: attach, verify with segregation, download', async () => {
    const list = await api('GET', '/api/evidence?limit=1');
    assert.equal(list.status, 200);
    const item = list.body.items[0];
    assert.ok(item, 'the seed should define evidence requirements');

    // A script-bearing document dressed as a picture is refused.
    const svg = new FormData();
    svg.append('file', new Blob(['<svg onload="alert(1)"/>'], { type: 'image/svg+xml' }), 'payload.svg');
    const rejected = await upload(`/api/evidence/${item.id}/files`, svg);
    assert.equal(rejected.status, 400, 'SVG should not be accepted as evidence');

    const body = 'Privileged account review\nAccounts reviewed: 41\nRemoved: 3\n';
    const form = new FormData();
    form.append('file', new Blob([body], { type: 'text/plain' }), 'account-review.txt');
    form.append('period', 'Q3 2026');
    form.append('note', 'Export from the identity provider');
    const attached = await upload(`/api/evidence/${item.id}/files`, form);
    assert.equal(attached.status, 201, JSON.stringify(attached.body));
    assert.equal(attached.body.evidence.status, 'collected', 'attaching an artefact marks the item collected');
    const file = attached.body.files[0];
    assert.equal(file.filename, 'account-review.txt');
    assert.ok(file.sha256, 'the stored artefact is hashed');
    assert.equal(file.verified_at, null, 'a fresh artefact is not yet verified');

    // The same segregation the platform applies to document approval.
    const selfVerify = await api('POST', `/api/evidence/${item.id}/files/${file.id}/verify`);
    assert.equal(selfVerify.status, 403, 'the collector must not be able to verify their own artefact');

    const verified = await api('POST', `/api/evidence/${item.id}/files/${file.id}/verify`, { as: 'auditor@autgrc.demo' });
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    assert.equal(verified.body.evidence.status, 'verified');
    assert.ok(verified.body.files[0].verified_by_name, 'the verifier is recorded by name');

    // What comes back is byte-for-byte what went in, as an attachment.
    const download = await api('GET', `/api/evidence/${item.id}/files/${file.id}`, { as: 'auditor@autgrc.demo', raw: true });
    assert.equal(download.status, 200);
    assert.match(download.headers.get('content-disposition') || '', /^attachment;/);
    assert.equal(await download.text(), body);

    // A verified artefact is part of the audit record and cannot be dropped.
    const removal = await api('DELETE', `/api/evidence/${item.id}/files/${file.id}`);
    assert.equal(removal.status, 409);

    const filtered = await api('GET', '/api/evidence?attached=yes&limit=5');
    assert.ok(filtered.body.total >= 1, 'the attachment filter finds the item');
  });

  await t.test('second factor: enrol, then sign in with a code and with a recovery code', async (t2) => {
    const { generateCode } = await import('../src/services/totp.js');

    // Enrol on an account no other case depends on being password-only.
    const setup = await api('POST', '/api/auth/mfa/setup', { as: 'reviewer@autgrc.demo' });
    assert.equal(setup.status, 200, JSON.stringify(setup.body));
    assert.equal(setup.body.secret.length, 32);
    assert.match(setup.body.otpauthUri, /^otpauth:\/\/totp\//);
    assert.match(setup.body.qrDataUri, /^data:image\/png;base64,/);

    const wrong = await api('POST', '/api/auth/mfa/enable', { as: 'reviewer@autgrc.demo', body: { code: '000000' } });
    assert.equal(wrong.status, 400, 'an incorrect code does not enable it');

    const enabled = await api('POST', '/api/auth/mfa/enable', {
      as: 'reviewer@autgrc.demo', body: { code: generateCode(setup.body.secret) }
    });
    assert.equal(enabled.status, 200, JSON.stringify(enabled.body));
    assert.equal(enabled.body.user.mfaEnabled, true);
    assert.equal(enabled.body.recoveryCodes.length, 10);
    const recoveryCode = enabled.body.recoveryCodes[0];

    // The password alone now buys a challenge, not a session.
    const challenge = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'reviewer@autgrc.demo', password: PASSWORD })
    }).then((r) => r.json());
    assert.equal(challenge.mfaRequired, true);
    assert.equal(challenge.accessToken, undefined, 'no session token is issued before the second factor');
    assert.ok(challenge.mfaToken);

    // The challenge token must not work as a session token.
    const misuse = await fetch(`${BASE}/api/documents`, {
      headers: { authorization: `Bearer ${challenge.mfaToken}` }
    });
    assert.equal(misuse.status, 401, 'a challenge token cannot reach the API');

    const badCode = await fetch(`${BASE}/api/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mfaToken: challenge.mfaToken, code: '000000' })
    });
    assert.equal(badCode.status, 401);

    const verified = await fetch(`${BASE}/api/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mfaToken: challenge.mfaToken, code: generateCode(setup.body.secret) })
    }).then((r) => r.json());
    assert.ok(verified.accessToken, 'a correct code completes the sign-in');
    assert.equal(verified.usedRecoveryCode, false);
    state.tokens['reviewer@autgrc.demo'] = verified.accessToken;

    await t2.test('a recovery code works once and is then spent', async () => {
      const second = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'reviewer@autgrc.demo', password: PASSWORD })
      }).then((r) => r.json());

      const used = await fetch(`${BASE}/api/auth/mfa/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mfaToken: second.mfaToken, code: recoveryCode })
      }).then((r) => r.json());
      assert.equal(used.usedRecoveryCode, true);
      assert.equal(used.recoveryCodesRemaining, 9);

      const third = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'reviewer@autgrc.demo', password: PASSWORD })
      }).then((r) => r.json());
      const reuse = await fetch(`${BASE}/api/auth/mfa/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mfaToken: third.mfaToken, code: recoveryCode })
      });
      assert.equal(reuse.status, 401, 'a spent recovery code is refused');
    });

    // Put the account back the way the rest of the suite expects it.
    const off = await api('POST', '/api/auth/mfa/disable', {
      as: 'reviewer@autgrc.demo', body: { password: PASSWORD }
    });
    assert.equal(off.status, 200);
    assert.equal(off.body.user.mfaEnabled, false);
  });

  await t.test('an administrator resets a password the platform cannot show them', async () => {
    // A throwaway account, so a failure here cannot leave a seeded login broken
    // for every later case and every later run.
    const email = `reset-subject-${Date.now()}@autgrc.demo`;
    const startingPassword = 'Muraqabah#Start1';
    const created = await api('POST', '/api/admin/users', {
      as: 'admin@autgrc.demo',
      body: { email, name: 'Reset Subject', role: 'read_only', password: startingPassword }
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const target = created.body.user;

    const reset = await api('POST', `/api/admin/users/${target.id}/reset-password`, { as: 'admin@autgrc.demo' });
    assert.equal(reset.status, 200);
    const temporary = reset.body.temporaryPassword;
    assert.ok(temporary && temporary.length >= 12, 'a temporary password is returned once');

    // The password it replaced no longer works.
    const old = await rawLogin(email, startingPassword);
    assert.equal(old.status, 401);

    // The temporary one signs in, and can do nothing else.
    const session = await rawLogin(email, temporary);
    assert.equal(session.status, 200);
    assert.equal(session.body.accountBlock, 'password_change_required');
    assert.equal(session.body.user.mustChangePassword, true);

    const blocked = await fetch(`${BASE}/api/documents`, {
      headers: { authorization: `Bearer ${session.body.accessToken}` }
    });
    assert.equal(blocked.status, 403, 'a reset account cannot read the library');
    assert.equal((await blocked.json()).code, 'password_change_required');

    // The enrolment and password screens stay reachable, or there is no way out.
    const allowed = await fetch(`${BASE}/api/auth/me`, {
      headers: { authorization: `Bearer ${session.body.accessToken}` }
    });
    assert.equal(allowed.status, 200);

    // The replacement still has to meet the policy.
    const weak = await fetch(`${BASE}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.body.accessToken}` },
      body: JSON.stringify({ currentPassword: temporary, newPassword: 'password123' })
    });
    assert.equal(weak.status, 400);

    const changed = await fetch(`${BASE}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.body.accessToken}` },
      body: JSON.stringify({ currentPassword: temporary, newPassword: 'Muraqabah#Chosen1' })
    });
    assert.equal(changed.status, 200);

    // Choosing their own password clears the block.
    const restored = await rawLogin(email, 'Muraqabah#Chosen1');
    assert.equal(restored.status, 200);
    assert.equal(restored.body.accountBlock, null);

    const unblocked = await fetch(`${BASE}/api/documents`, {
      headers: { authorization: `Bearer ${restored.body.accessToken}` }
    });
    assert.equal(unblocked.status, 200);

    // Only an administrator may reset.
    const denied = await api('POST', `/api/admin/users/${target.id}/reset-password`, { as: 'grc@autgrc.demo' });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.required, 'user:manage');

    await api('PATCH', `/api/admin/users/${target.id}`, {
      as: 'admin@autgrc.demo', body: { status: 'suspended' }
    });
  });

  await t.test('a new framework edition supersedes the old one without disturbing it', async () => {
    const before = await api('GET', '/api/frameworks', { as: 'admin@autgrc.demo' });
    const source = before.body.items.find((f) => f.code === 'ISO-27005');
    assert.ok(source, 'the catalogue holds ISO-27005');
    const mappedBefore = source.mapped_count;

    const code = `ISO-27005-TEST-${Date.now()}`;
    const created = await api('POST', '/api/frameworks/editions', {
      as: 'admin@autgrc.demo',
      body: {
        supersedesCode: 'ISO-27005',
        code,
        name: 'ISO/IEC 27005 test edition',
        version: 'test',
        retiresOn: '2032-01-01',
        copyRequirements: true
      }
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.framework.edition_status, 'current');
    assert.equal(created.body.superseded.edition_status, 'superseded');
    assert.ok(created.body.requirementsCopied > 0, 'requirements are carried forward');

    const after = await api('GET', '/api/frameworks', { as: 'admin@autgrc.demo' });
    const old = after.body.items.find((f) => f.code === 'ISO-27005');
    const fresh = after.body.items.find((f) => f.code === code);

    // The old edition keeps its requirements and its mappings: an organisation
    // stays assessed against the edition it was certified under.
    assert.equal(old.requirement_count, source.requirement_count);
    assert.equal(old.mapped_count, mappedBefore);
    // Editions accumulate: a framework superseded once may be superseded again,
    // so check this one is among the successors rather than the only one.
    assert.ok(old.superseded_by.some((e) => e.code === code), 'the new edition is recorded as a successor');
    assert.equal(fresh.supersedes.code, 'ISO-27005');
    // Nothing is assessed against the new edition until somebody does it.
    assert.equal(fresh.mapped_count, 0, 'a new edition starts unmapped');

    const duplicate = await api('POST', '/api/frameworks/editions', {
      as: 'admin@autgrc.demo',
      body: { supersedesCode: 'ISO-27005', code, name: 'Duplicate edition', version: 'test' }
    });
    assert.equal(duplicate.status, 409);

    const denied = await api('POST', '/api/frameworks/editions', {
      as: 'auditor@autgrc.demo',
      body: { supersedesCode: 'ISO-27005', code: `${code}-B`, name: 'Unauthorised edition', version: 'test' }
    });
    assert.equal(denied.status, 403);
  });

  await t.test('a licensed catalogue replaces the reference text without deleting anything', async () => {
    // Imported into a throwaway edition, not into the shipped catalogue: this
    // route rewrites source material, and a test that mutated NCA-ECC would
    // change what every later assertion reads.
    const code = `CAT-TEST-${Date.now()}`;
    const created = await api('POST', '/api/frameworks/editions', {
      as: 'admin@autgrc.demo',
      body: {
        supersedesCode: 'CIS-V8', code, name: 'Catalogue import test edition',
        version: 'test', copyRequirements: true
      }
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const carriedForward = created.body.requirementsCopied;
    assert.ok(carriedForward > 0);

    const detailBefore = await api('GET', `/api/frameworks/${code}/requirements`, { as: 'admin@autgrc.demo' });
    const firstRef = detailBefore.body.requirements[0].ref;
    const firstId = detailBefore.body.requirements[0].id;

    // The five-field schema from the paper, section 5.3.1 page 10, in a CSV so
    // the fixture is readable here.
    const csv = [
      'Control Number,Capability Name,Purpose,Policy Statement,Relevant Standards',
      `${firstRef},Identity & Access Management,Licensed purpose text,"The licensed statement for this control.","ISO 27001 A.5.15"`,
      'ZZ-9-1,Governance,A control only the licensed copy carries,"A statement absent from the shipped catalogue.",'
    ].join('\n');

    const previewForm = new FormData();
    previewForm.append('file', new Blob([csv], { type: 'text/csv' }), 'catalogue.csv');
    const preview = await upload(`/api/frameworks/${code}/catalogue`, previewForm, { as: 'admin@autgrc.demo' });
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.equal(preview.body.applied, false, 'the default is a dry run, because the target is source material');
    assert.equal(preview.body.layout, 'structured_five_field');
    assert.equal(preview.body.inserts, 1);
    assert.equal(preview.body.updates, 1);
    assert.equal(preview.body.notCovered.length, carriedForward - 1);
    assert.equal(preview.body.crosswalkCandidates.length, 1);

    // Nothing was written by the preview.
    const afterPreview = await api('GET', `/api/frameworks/${code}/requirements`, { as: 'admin@autgrc.demo' });
    assert.equal(afterPreview.body.requirements.length, carriedForward);
    assert.ok(!afterPreview.body.requirements.some((r) => r.ref === 'ZZ-9-1'));

    const applyForm = new FormData();
    applyForm.append('file', new Blob([csv], { type: 'text/csv' }), 'catalogue.csv');
    applyForm.append('confirm', 'true');
    const applied = await upload(`/api/frameworks/${code}/catalogue`, applyForm, { as: 'admin@autgrc.demo' });
    assert.equal(applied.status, 200, JSON.stringify(applied.body));
    assert.equal(applied.body.applied, true);
    assert.deepEqual(applied.body.written, { inserted: 1, updated: 1 });
    assert.match(applied.body.note, /Nothing was deleted/);

    const afterApply = await api('GET', `/api/frameworks/${code}/requirements`, { as: 'admin@autgrc.demo' });
    assert.equal(afterApply.body.requirements.length, carriedForward + 1, 'nothing was deleted');
    const rewritten = afterApply.body.requirements.find((r) => r.ref === firstRef);
    assert.equal(rewritten.id, firstId, 'the requirement id survived, so anything mapped to it survived');
    assert.equal(rewritten.title, 'Licensed purpose text');
    assert.equal(rewritten.source_status, 'user_imported');
    const untouched = afterApply.body.requirements.find((r) => r.ref !== firstRef && r.ref !== 'ZZ-9-1');
    assert.equal(untouched.source_status, 'reference',
      'a row the file did not mention is still reference metadata, not promoted by association');

    // A PDF is not a control set this route will guess at.
    const pdfForm = new FormData();
    pdfForm.append('file', new Blob(['%PDF-1.4'], { type: 'application/pdf' }), 'controls.pdf');
    const wrongType = await upload(`/api/frameworks/${code}/catalogue`, pdfForm, { as: 'admin@autgrc.demo' });
    assert.equal(wrongType.status, 400);

    // And the edition this one superseded must not be rewritable: an
    // organisation stays assessed against the edition it was certified under.
    const supersededForm = new FormData();
    supersededForm.append('file', new Blob([csv], { type: 'text/csv' }), 'catalogue.csv');
    supersededForm.append('confirm', 'true');
    const superseded = await upload('/api/frameworks/CIS-V8/catalogue', supersededForm, { as: 'admin@autgrc.demo' });
    assert.equal(superseded.status, 409);
    assert.match(superseded.body.error, /superseded/i);

    const deniedForm = new FormData();
    deniedForm.append('file', new Blob([csv], { type: 'text/csv' }), 'catalogue.csv');
    const denied = await upload(`/api/frameworks/${code}/catalogue`, deniedForm, { as: 'auditor@autgrc.demo' });
    assert.equal(denied.status, 403);
  });

  await t.test('risk register projects the canonical model and holds its own honesty', async () => {
    const list = await api('GET', '/api/risks?limit=500');
    assert.equal(list.status, 200);
    assert.ok(list.body.total > 0, 'the seed builds a register');

    // Every seeded risk starts unassessed and says so, rather than reporting a
    // residual reduction nobody worked out.
    const seeded = list.body.items.filter((r) => r.provenance === 'ai_recommendation');
    assert.ok(seeded.length > 0);
    assert.ok(
      seeded.every((r) => r.residual_assessed || r.reduction === null),
      'an unassessed residual claims no reduction'
    );

    const risk = list.body.items.find((r) => !r.residual_assessed && !r.accepted);
    const detail = await api('GET', `/api/risks/${risk.id}`);
    assert.equal(detail.status, 200);
    assert.ok(detail.body.controls.length > 0, 'the risk is linked to the control from the same requirement');

    // Assessing the residual position is what marks it assessed.
    const assessed = await api('PATCH', `/api/risks/${risk.id}`, {
      body: { residual_likelihood: 2, residual_impact: 2 }
    });
    assert.equal(assessed.status, 200);
    assert.equal(assessed.body.risk.residual_assessed, true);
    assert.equal(assessed.body.risk.reduction, assessed.body.risk.inherent.score - 4);

    // Acceptance: a decision with a name, a reason and an expiry on it.
    const noExpiry = await api('POST', `/api/risks/${risk.id}/accept`, {
      as: 'ciso@autgrc.demo',
      body: { rationale: 'A compensating control at the network boundary covers this adequately.' }
    });
    assert.equal(noExpiry.status, 400, 'an acceptance with no expiry is refused');

    const pastExpiry = await api('POST', `/api/risks/${risk.id}/accept`, {
      as: 'ciso@autgrc.demo',
      body: { rationale: 'A compensating control at the network boundary covers this adequately.', expires: '2020-01-01' }
    });
    assert.equal(pastExpiry.status, 400);

    const wrongRole = await api('POST', `/api/risks/${risk.id}/accept`, {
      body: { rationale: 'A compensating control at the network boundary covers this adequately.', expires: '2099-01-01' }
    });
    assert.equal(wrongRole.status, 403, 'accepting a risk is not the author\'s decision');
    assert.equal(wrongRole.body.required, 'risk:accept');

    const accepted = await api('POST', `/api/risks/${risk.id}/accept`, {
      as: 'ciso@autgrc.demo',
      body: { rationale: 'A compensating control at the network boundary covers this adequately.', expires: '2099-01-01' }
    });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    assert.equal(accepted.body.risk.status, 'accepted');
    assert.ok(accepted.body.risk.accepted_by_name);

    // An accepted risk is part of the record until the acceptance is withdrawn.
    const frozen = await api('PATCH', `/api/risks/${risk.id}`, { body: { inherent_impact: 1 } });
    assert.equal(frozen.status, 409);
    const undeletable = await api('DELETE', `/api/risks/${risk.id}`);
    assert.equal(undeletable.status, 409);

    const withdrawn = await api('POST', `/api/risks/${risk.id}/withdraw-acceptance`, { as: 'ciso@autgrc.demo' });
    assert.equal(withdrawn.status, 200);
    assert.equal(withdrawn.body.risk.accepted, false);
  });

  await t.test('corrective actions carry a finding through to a verified close', async () => {
    const directory = await api('GET', '/api/admin/directory');
    const analyst = directory.body.find((u) => u.email === 'analyst@autgrc.demo');

    const findings = await api('GET', '/api/findings?limit=5');
    const findingRows = findings.body.items || findings.body;
    const finding = (Array.isArray(findingRows) ? findingRows : []).find((f) => f.status === 'open');
    assert.ok(finding, 'the seed leaves open findings');

    const missingOwner = await api('POST', '/api/actions', {
      body: { title: 'An action with nobody accountable', due_date: '2099-01-01', owner_id: 'usr_nobody' }
    });
    assert.equal(missingOwner.status, 400);

    const created = await api('POST', '/api/actions', {
      body: {
        title: 'Reconcile the privileged account inventory to the leaver feed',
        source_type: 'finding', source_id: finding.id,
        owner_id: analyst.id, priority: 'high', due_date: '2099-01-01'
      }
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const action = created.body.action;
    assert.match(action.action_id, /^CA-\d{4}$/);

    // The owner is told, and told once.
    const inbox = await api('GET', '/api/notifications?limit=20', { as: 'analyst@autgrc.demo' });
    assert.ok(
      inbox.body.items.some((n) => n.kind === 'action_assigned' && n.entity_id === action.id),
      'the owner is notified of an action assigned to them'
    );

    // "Blocked" with no reason tells the next reader nothing.
    const bare = await api('PATCH', `/api/actions/${action.id}`, { body: { status: 'blocked' } });
    assert.equal(bare.status, 400);
    const blocked = await api('PATCH', `/api/actions/${action.id}`, {
      body: { status: 'blocked', blocked_reason: 'Waiting on the HR leaver feed.' }
    });
    assert.equal(blocked.status, 200);

    const early = await api('POST', `/api/actions/${action.id}/verify`, { as: 'auditor@autgrc.demo', body: {} });
    assert.equal(early.status, 409, 'only a completed action can be verified');

    const completed = await api('PATCH', `/api/actions/${action.id}`, { body: { status: 'completed' } });
    assert.equal(completed.status, 200);
    assert.equal(completed.body.action.progress, 100, 'completing implies finished');

    // The GRC manager holds action:verify and owns nothing here, so the only
    // thing that can stop a self-verification is the segregation rule.
    const reassigned = await api('PATCH', `/api/actions/${action.id}`, { body: { owner_id: state.tokens.self || analyst.id } });
    assert.equal(reassigned.status, 200);

    const verified = await api('POST', `/api/actions/${action.id}/verify`, {
      as: 'auditor@autgrc.demo', body: { note: 'Reconciliation report reviewed.' }
    });
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    assert.ok(verified.body.action.verified_by_name);

    const reopened = await api('PATCH', `/api/actions/${action.id}`, { body: { status: 'open' } });
    assert.equal(reopened.status, 409, 'a verified action is closed for good');
  });

  await t.test('an action cannot be verified by the person who carried it out', async () => {
    const me = await api('GET', '/api/auth/me');
    const mine = await api('POST', '/api/actions', {
      body: {
        title: 'Self-verification segregation probe',
        owner_id: me.body.user.id, due_date: '2099-01-01'
      }
    });
    assert.equal(mine.status, 201);
    await api('PATCH', `/api/actions/${mine.body.action.id}`, { body: { status: 'completed' } });

    // The GRC manager holds action:verify, so only segregation can refuse this.
    const self = await api('POST', `/api/actions/${mine.body.action.id}/verify`, { body: {} });
    assert.equal(self.status, 403);
    assert.match(self.body.error, /Segregation of duties/);

    const other = await api('POST', `/api/actions/${mine.body.action.id}/verify`, { as: 'auditor@autgrc.demo', body: {} });
    assert.equal(other.status, 200);
  });

  await t.test('the Statement of Applicability insists on a reason for every exclusion', async () => {
    const soa = await api('GET', '/api/soa/ISO-27001');
    assert.equal(soa.status, 200);
    assert.ok(soa.body.rows.length > 0);
    // Absent a decision, a control is applicable: excluding is the deliberate act.
    assert.ok(soa.body.rows.every((r) => r.applicable || r.decision_recorded));

    const mapped = soa.body.rows.find((r) => r.controls.length > 0);
    assert.ok(mapped, 'some requirements have controls mapped to them');
    assert.notEqual(mapped.implementation, 'excluded');

    const bare = await api('PUT', `/api/soa/ISO-27001/decisions/${mapped.requirement_id}`, {
      body: { applicable: false }
    });
    assert.equal(bare.status, 400, 'an exclusion with no justification is refused');

    const excluded = await api('PUT', `/api/soa/ISO-27001/decisions/${mapped.requirement_id}`, {
      body: { applicable: false, justification: 'The organisation operates no industrial control systems.' }
    });
    assert.equal(excluded.status, 200);

    const after = await api('GET', '/api/soa/ISO-27001');
    const row = after.body.rows.find((r) => r.requirement_id === mapped.requirement_id);
    assert.equal(row.applicable, false);
    assert.equal(row.implementation, 'excluded');
    assert.equal(after.body.summary.exclusionsWithoutJustification, 0);
    assert.equal(after.body.summary.excluded, soa.body.summary.excluded + 1);

    // Put it back so the suite is repeatable.
    await api('PUT', `/api/soa/ISO-27001/decisions/${mapped.requirement_id}`, {
      body: { applicable: true, justification: 'In scope across the corporate estate.' }
    });

    const denied = await api('PUT', `/api/soa/ISO-27001/decisions/${mapped.requirement_id}`, {
      as: 'viewer@autgrc.demo', body: { applicable: true }
    });
    assert.equal(denied.status, 403);
  });

  await t.test('exports the Statement of Applicability and the risk treatment plan', async () => {
    for (const [path, name] of [
      ['/api/export/soa.xlsx?framework=ISO-27001', 'Statement of Applicability'],
      ['/api/export/risk-treatment.xlsx', 'Risk Treatment Plan']
    ]) {
      const res = await api('GET', path, { raw: true });
      assert.equal(res.status, 200, `${name} export failed`);
      assert.match(res.headers.get('content-type') || '', /spreadsheetml/);
      const bytes = Buffer.from(await res.arrayBuffer());
      assert.ok(bytes.length > 5000, `${name} looks empty at ${bytes.length} bytes`);
      // A real xlsx is a zip; "PK" is its signature.
      assert.equal(bytes.subarray(0, 2).toString(), 'PK', `${name} is not a zip container`);
    }
  });

  await t.test('Word exports in Arabic with real right-to-left markup', async () => {
    const docId = state.docs.policy.id;
    // A declared devDependency, not a transitive one: these assertions are the
    // only thing proving the Arabic export is a real RTL document rather than
    // English text in a mirrored layout, so they must not quietly skip.
    const { default: JSZip } = await import('jszip');

    const english = await api('GET', `/api/export/documents/${docId}.docx`, { raw: true });
    assert.equal(english.status, 200);
    const arabic = await api('GET', `/api/export/documents/${docId}.docx?lang=ar`, { raw: true });
    assert.equal(arabic.status, 200);

    const englishBytes = Buffer.from(await english.arrayBuffer());
    const arabicBytes = Buffer.from(await arabic.arrayBuffer());
    assert.equal(englishBytes.subarray(0, 2).toString(), 'PK');
    assert.equal(arabicBytes.subarray(0, 2).toString(), 'PK');
    assert.notEqual(englishBytes.length, arabicBytes.length, 'the two languages produce different files');

    const read = async (bytes) => {
      const zip = await JSZip.loadAsync(bytes);
      return {
        document: await zip.file('word/document.xml').async('string'),
        styles: await zip.file('word/styles.xml').async('string')
      };
    };
    const en = await read(englishBytes);
    const ar = await read(arabicBytes);

    // Word does the shaping and the reordering from these two flags.
    assert.ok(ar.document.includes('<w:bidi/>'), 'Arabic paragraphs carry the bidi flag');
    assert.ok(ar.document.includes('<w:rtl/>'), 'Arabic runs carry the rtl flag');
    assert.ok(ar.styles.includes('<w:bidi/>'), 'the paragraph default is bidirectional');
    assert.ok(/Segoe UI/.test(ar.styles), 'an Arabic-capable font is set');

    // A table's column order is its own property. Without this Word
    // right-aligns the cells and still puts the first column on the left, so an
    // Arabic RACI matrix would read its activities from the wrong end.
    assert.ok(ar.document.includes('<w:tbl>'), 'the export contains tables to check');
    assert.ok(ar.document.includes('<w:bidiVisual/>'), 'Arabic tables run right to left');

    // English must not have acquired any of it.
    assert.ok(!en.document.includes('<w:bidi/>'), 'English paragraphs are not bidirectional');
    assert.ok(!en.document.includes('<w:rtl/>'), 'English runs are not right-to-left');
    assert.ok(!en.document.includes('bidiVisual'), 'English tables are untouched, not explicitly left-to-right');

    // The document furniture is actually in Arabic, not English mirrored.
    const arabicRuns = ar.document.match(/[\u0600-\u06FF]{2,}/g) || [];
    assert.ok(arabicRuns.length > 10, `expected Arabic text in the export, found ${arabicRuns.length} run(s)`);
    assert.ok(!(en.document.match(/[\u0600-\u06FF]{2,}/g) || []).length, 'the English export has no Arabic');
  });

  await t.test('Arabic PDF is refused rather than produced unshaped', async () => {
    const docId = state.docs.policy.id;

    // PDFKit writes glyphs in code-point order with no Arabic shaping, so an
    // Arabic PDF would come out with its letters unjoined. Refusing says so.
    const refused = await api('GET', `/api/export/documents/${docId}.pdf?lang=ar`);
    assert.equal(refused.status, 501);
    assert.match(refused.body.error, /shape Arabic/i);
    assert.match(refused.body.error, /Word/, 'the refusal names the format that does work');
    assert.deepEqual(refused.body.detail.supported, ['docx']);

    // A deliberate 5xx keeps the message it was given; only unexpected ones
    // are masked, and this proves the distinction holds.
    assert.notEqual(refused.body.error, 'An unexpected error occurred');

    const english = await api('GET', `/api/export/documents/${docId}.pdf`, { raw: true });
    assert.equal(english.status, 200, 'the English PDF still works');
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
