/**
 * Database seed.
 *
 * Loads the authoritative framework catalogue and creates a realistic demo
 * data set: an organisation profile, users covering every role, and full
 * governance packages for the five domains the brief calls out, together
 * with a gap assessment and a worked lifecycle history.
 *
 * Run with `npm run seed`. Pass --force to rebuild from an existing database.
 */

import { db, q, nowIso, toJson, fromJson } from './index.js';
import { id, padNumber } from '../utils/ids.js';
import config from '../config.js';
import { hashPassword } from '../middleware/auth.js';
import {
  FRAMEWORKS, REQUIREMENTS, CROSSWALKS, SOURCE_NOTE,
  DOMAIN_MODELS, DOMAIN_META, domainShort, validateKnowledgeBase, buildParameterSet, resolveText
} from '../knowledge/index.js';
import { startingPosition } from '../services/risk.js';
import { generatePackage } from '../services/generator.js';
import { indexFrameworkRequirement } from '../services/search.js';
import { reviewDomain } from '../services/review.js';

const force = process.argv.includes('--force');

// --------------------------------------------------------------- sources ---

/**
 * Bring an existing installation's reference catalogue into line with the
 * domain each requirement is now assigned to. A domain is which policy
 * answers for a requirement — the platform's own mapping, not the
 * publisher's text — so it moves when the model learns a requirement belongs
 * elsewhere. Rows the organisation imported from its licensed copy keep
 * whatever domain it gave them.
 */
export function syncCatalogueDomains() {
  let changed = 0;
  for (const f of FRAMEWORKS) {
    const fw = q.get('SELECT id FROM frameworks WHERE code = ?', f.code);
    if (!fw) continue;
    for (const [ref, , domainKey] of REQUIREMENTS[f.code] || []) {
      changed += q.run(
        `UPDATE framework_requirements SET domain_key = ?
          WHERE framework_id = ? AND ref = ? AND source_status = 'reference' AND COALESCE(domain_key, '') != ?`,
        domainKey || null, fw.id, ref, domainKey || ''
      ).changes;
    }
  }
  return changed;
}

export function seedFrameworks() {
  const at = nowIso();
  const byCode = {};

  db.transaction(() => {
    for (const f of FRAMEWORKS) {
      const existing = q.get('SELECT * FROM frameworks WHERE code = ?', f.code);
      const fwId = existing?.id || id('fwk');
      if (!existing) {
        q.run(
          `INSERT INTO frameworks (id, code, name, publisher, version, kind, jurisdiction, description, source_note, is_mandatory, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          fwId, f.code, f.name, f.publisher, f.version, f.kind, f.jurisdiction,
          f.description, SOURCE_NOTE, f.isMandatory ? 1 : 0, at
        );
      }
      byCode[f.code] = fwId;

      for (const [ref, title, domainKey, level, parentRef] of REQUIREMENTS[f.code] || []) {
        if (q.get('SELECT id FROM framework_requirements WHERE framework_id = ? AND ref = ?', fwId, ref)) continue;
        const reqId = id('frq');
        q.run(
          `INSERT INTO framework_requirements (id, framework_id, ref, parent_ref, title, statement, domain_key, level, provenance, source_status, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          reqId, fwId, ref, parentRef || null, title, title, domainKey || null, level || 1,
          f.provenance || 'framework_guidance', 'reference', at
        );
        indexFrameworkRequirement(
          { id: reqId, ref, title, statement: title, domain_key: domainKey }, f.code
        );
      }
    }

    for (const [srcCode, srcRef, tgtCode, tgtRef, relation] of CROSSWALKS) {
      const src = q.get('SELECT id FROM framework_requirements WHERE framework_id = ? AND ref = ?', byCode[srcCode], srcRef);
      const tgt = q.get('SELECT id FROM framework_requirements WHERE framework_id = ? AND ref = ?', byCode[tgtCode], tgtRef);
      if (!src || !tgt) continue;
      q.run(
        'INSERT OR IGNORE INTO crosswalks (id, source_id, target_id, relation, note, created_at) VALUES (?,?,?,?,?,?)',
        id('cwk'), src.id, tgt.id, relation,
        `Curated equivalence between ${srcCode} ${srcRef} and ${tgtCode} ${tgtRef}.`, at
      );
    }
  })();

  return byCode;
}

// ----------------------------------------------------------------- users ---

const DEMO_USERS = [
  { email: 'admin@autgrc.demo', name: 'Layla Al-Rashid', role: 'admin', job_title: 'Platform Administrator' },
  { email: 'ciso@autgrc.demo', name: 'Faisal Al-Otaibi', role: 'approver', job_title: 'Chief Information Security Officer' },
  { email: 'grc@autgrc.demo', name: 'Noura Al-Harbi', role: 'grc_manager', job_title: 'Cybersecurity GRC Manager' },
  { email: 'analyst@autgrc.demo', name: 'Omar Al-Zahrani', role: 'cyber_user', job_title: 'Cybersecurity Analyst' },
  { email: 'reviewer@autgrc.demo', name: 'Hana Al-Qahtani', role: 'reviewer', job_title: 'Security Architect' },
  { email: 'auditor@autgrc.demo', name: 'Yousef Al-Shammari', role: 'auditor', job_title: 'Internal Auditor' },
  { email: 'viewer@autgrc.demo', name: 'Sara Al-Dosari', role: 'read_only', job_title: 'Business Owner, Retail Banking' }
];

export function seedUsers(password = config.seedPassword) {
  const at = nowIso();
  const hash = hashPassword(password);
  const users = {};
  db.transaction(() => {
    for (const u of DEMO_USERS) {
      const existing = q.get('SELECT * FROM users WHERE email = ?', u.email);
      if (existing) { users[u.role] = existing; continue; }
      const userId = id('usr');
      q.run(
        `INSERT INTO users (id, email, name, password_hash, role, job_title, status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        userId, u.email, u.name, hash, u.role, u.job_title, 'active', at, at
      );
      users[u.role] = q.get('SELECT * FROM users WHERE id = ?', userId);
    }
  })();
  return users;
}

// ------------------------------------------------------------------ org ---

export function seedOrg() {
  const at = nowIso();
  q.run(
    `INSERT INTO org_profile (id, org_name, org_type, industry, size, country, regulators, operating_model,
       technology_env, risk_appetite, business_requirements, data_classifications,
       applicable_frameworks, updated_at)
     VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO NOTHING`,
    'Najd Financial Group', 'Public joint-stock company', 'Banking and financial services',
    '2,500–10,000 employees', 'Saudi Arabia',
    toJson(['National Cybersecurity Authority (NCA)', 'Saudi Central Bank (SAMA)', 'Saudi Data and AI Authority (SDAIA)']),
    'Centralised cybersecurity function with federated system ownership',
    toJson(['Microsoft 365', 'Active Directory', 'Microsoft Azure', 'Oracle Database', 'Core banking platform', 'VMware', 'Palo Alto firewalls', 'CrowdStrike EDR', 'Splunk SIEM']),
    'Moderate — low appetite for regulatory and customer-data risk',
    'Maintain continuous compliance with NCA ECC and the SAMA Cyber Security Framework; support digital banking expansion without increasing the customer-data risk profile; achieve ISO/IEC 27001 certification within 18 months.',
    toJson(['Public', 'Internal', 'Confidential', 'Secret']),
    // The sources this organisation is actually subject to, recorded once. A
    // Saudi bank is bound by the NCA controls and the SAMA framework, and is
    // working towards ISO/IEC 27001; the rest of the catalogue stays available
    // for mapping without being cited as though the organisation had adopted it.
    toJson(['NCA-ECC', 'NCA-CSCC', 'NCA-DCC', 'NCA-TCC', 'NCA-CCC', 'SAMA-CSF', 'ISO-27001', 'ISO-22301']),
    at
  );
  return q.get('SELECT * FROM org_profile WHERE id = 1');
}

// ------------------------------------------------------------ demo data ---

/**
 * Every domain, so the demonstration shows an organisation whose documented
 * framework is largely in place: a policy, standard and procedure in each
 * domain with its roles, RACI and control matrix. Identity and access carries
 * the guideline and the framework document as well.
 *
 * No per-package framework list. Which authoritative sources apply is recorded
 * once on the organisation profile, so every package cites the same adopted
 * set and a domain shows only the ones it actually maps to.
 */
const STANDARD_SET = ['policy', 'standard', 'procedure', 'roles', 'raci', 'control_matrix'];
const CONFIDENTIAL_DOMAINS = new Set([
  'iam', 'pam', 'incident_management', 'third_party', 'data_protection', 'cryptography',
  'network_security', 'database_security', 'ot_security', 'security_monitoring', 'logging_monitoring', 'hr_security'
]);
const DEMO_PACKAGES = DOMAIN_META.map((d) => ({
  domain: d.key,
  docTypes: d.key === 'iam'
    ? ['policy', 'standard', 'procedure', 'guideline', 'roles', 'raci', 'control_matrix', 'framework']
    : STANDARD_SET,
  classification: CONFIDENTIAL_DOMAINS.has(d.key) ? 'confidential' : 'internal'
}));

export function seedDemoPackages(users, org) {
  const results = [];
  // The organisation's adopted sources, restricted to what is in the catalogue.
  const adopted = fromJson(org?.applicable_frameworks, []);
  const known = new Set(q.all('SELECT code FROM frameworks').map((f) => f.code));
  const applicable = adopted.filter((code) => known.has(code));
  for (const spec of DEMO_PACKAGES) {
    if (q.get('SELECT id FROM documents WHERE domain_key = ? LIMIT 1', spec.domain)) continue;
    results.push(generatePackage({
      domainKey: spec.domain,
      docTypes: spec.docTypes,
      frameworkCodes: applicable,
      org,
      userId: users.grc_manager?.id,
      ownerId: users.grc_manager?.id,
      approverId: users.approver?.id,
      classification: spec.classification,
      provider: 'builtin'
    }));
  }
  return results;
}

/**
 * The Arabic version of each demonstration package. An organisation reading
 * the platform in Arabic expects its documents in Arabic too; generating them
 * from the same requirement model gives the same commitments in the other
 * language. Each version takes its English original's status and dates, since
 * it is the approved document in another language rather than a new draft,
 * and adds no second set of controls (see generatePackage).
 */
export function seedTranslations(users, org, packages) {
  const adopted = fromJson(org?.applicable_frameworks, []);
  const known = new Set(q.all('SELECT code FROM frameworks').map((f) => f.code));
  const applicable = adopted.filter((code) => known.has(code));
  let created = 0;
  for (const pkg of packages) {
    const spec = DEMO_PACKAGES.find((p) => p.domain === pkg.domainKey);
    if (!spec) continue;
    if (q.get("SELECT id FROM documents WHERE domain_key = ? AND language = 'ar' LIMIT 1", spec.domain)) continue;
    const result = generatePackage({
      domainKey: spec.domain,
      docTypes: spec.docTypes,
      frameworkCodes: applicable,
      org,
      userId: users.grc_manager?.id,
      ownerId: users.grc_manager?.id,
      approverId: users.approver?.id,
      classification: spec.classification,
      provider: 'builtin',
      language: 'ar',
      translationOf: pkg.packageId
    });
    for (const doc of result.documents) {
      const original = q.get(
        "SELECT * FROM documents WHERE package_id = ? AND doc_type = ? AND language = 'en'", pkg.packageId, doc.docType);
      if (!original) continue;
      q.run('UPDATE documents SET status = ?, version = ?, effective_date = ?, review_date = ? WHERE id = ?',
        original.status, original.version, original.effective_date, original.review_date, doc.id);
      created += 1;
    }
  }
  return created;
}

/**
 * A mature programme: almost every document is published, with effective
 * dates spread over the past months and reviews falling due across the coming
 * year. A few documents are still moving, so the review and approval queues
 * have something in them: one procedure is with its reviewers, one is still a
 * draft, and one published policy comes up for its annual review within the
 * month.
 */
const IN_REVIEW = [['asset_management', 'procedure']];
const IN_DRAFT = [['change_management', 'procedure']];
const REVIEW_SOON = [['third_party', 'policy']];

export function seedLifecycle(users) {
  const at = nowIso();
  const approver = users.approver;
  const grc = users.grc_manager;
  if (!approver || !grc) return;
  const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  const stamp = (offset) => new Date(Date.now() + offset * 86400000).toISOString();
  const is = (list, doc) => list.some(([domain, type]) => doc.domain_key === domain && doc.doc_type === type);

  const record = (doc, action, from, to, actor, comment, when) => q.run(
    `INSERT INTO document_approvals (id, document_id, action, from_status, to_status, actor_id, actor_name, actor_role, comment, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    id('apr'), doc.id, action, from, to, actor.id, actor.name, actor.role, comment, when
  );

  const drafts = q.all("SELECT * FROM documents WHERE status = 'draft' ORDER BY domain_key, doc_type");
  drafts.forEach((doc, i) => {
    if (is(IN_DRAFT, doc)) return;
    if (is(IN_REVIEW, doc)) {
      q.run("UPDATE documents SET status = 'under_review', updated_at = ? WHERE id = ?", at, doc.id);
      record(doc, 'submitted', 'draft', 'under_review', grc, 'Submitted for review by the Asset Owner community.', at);
      return;
    }
    // Spread across the year so the review calendar is not one crowded week.
    const published = -(30 + ((i * 17) % 240));
    const review = is(REVIEW_SOON, doc) ? 21 : published + 365;
    q.run("UPDATE documents SET status = 'published', version = '1.0', effective_date = ?, review_date = ?, updated_at = ? WHERE id = ?",
      day(published), day(review), at, doc.id);
    record(doc, 'submitted', 'draft', 'under_review', grc, 'Submitted for technical and governance review.', stamp(published - 12));
    record(doc, 'approved', 'under_review', 'approved', approver,
      'Reviewed against the applicable NCA ECC and ISO/IEC 27001 requirements. Approved.', stamp(published - 3));
    record(doc, 'published', 'approved', 'published', approver,
      'Published and communicated to all affected personnel.', stamp(published));
  });
}

/**
 * Introduce one deliberate governance inconsistency in the demo data so the
 * "Review with AI" workflow has a genuine finding to surface on first run:
 * the IAM Procedure is edited to say annual access reviews while the Policy
 * and Standard both say quarterly.
 */
export function seedInconsistency() {
  const procedure = q.get("SELECT * FROM documents WHERE domain_key = 'iam' AND doc_type = 'procedure'");
  if (!procedure) return false;
  const section = q.get("SELECT * FROM document_sections WHERE document_id = ? AND section_key = 'steps'", procedure.id);
  if (!section || !section.body.includes('quarterly')) return false;

  // Rewrite the access-review step so it states a single, contradictory
  // frequency. Leaving the original "or quarterly where the entitlement is
  // privileged" clause in place would make the sentence state both values,
  // which is not the inconsistency this demonstration is meant to show.
  const edited = section.body.replace(
    /Recertify the entitlement during the quarterly access review cycle, or quarterly where the entitlement is privileged\./,
    'Recertify the entitlement during the annually access review cycle.'
  );
  if (edited === section.body) return false;

  q.run("UPDATE document_sections SET body = ?, provenance = 'user_input', updated_at = ? WHERE id = ?",
    edited, nowIso(), section.id);
  return true;
}

export function seedAssessment(users) {
  if (q.get('SELECT id FROM assessments LIMIT 1')) return null;
  const framework = q.get("SELECT * FROM frameworks WHERE code = 'NCA-ECC'");
  if (!framework) return null;

  const at = nowIso();
  const assessmentId = id('asm');
  q.run(
    `INSERT INTO assessments (id, name, framework_id, scope, status, owner_id, started_at, due_at, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    assessmentId, 'NCA ECC Annual Compliance Assessment', framework.id,
    'All ECC domains applicable to the organisation, covering head office and the primary data centre.',
    'in_progress', users.grc_manager?.id, at,
    new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10), at, at
  );

  const reqs = q.all('SELECT * FROM framework_requirements WHERE framework_id = ? AND level >= 3', framework.id);
  db.transaction(() => {
    for (const r of reqs) {
      const mapped = q.all(
        `SELECT cm.coverage, c.id AS pk, c.control_id, c.responsible_role, c.policy_id
           FROM control_mappings cm JOIN controls c ON c.id = cm.control_id WHERE cm.requirement_id = ?`, r.id
      );
      const covered = mapped.some((m) => m.coverage === 'covered');
      const status = covered ? 'compliant' : mapped.length ? 'partially_compliant' : 'non_compliant';
      q.run(
        `INSERT INTO gap_items (id, assessment_id, requirement_id, requirement_ref, requirement_txt,
           current_state, target_state, gap, risk, risk_rating, recommendation, owner, due_date, status,
           evidence_ref, document_id, control_id, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id('gap'), assessmentId, r.id, r.ref, r.title,
        mapped.length
          ? `Addressed by ${mapped.map((m) => m.control_id).join(', ')} with documented policy, standard and procedure.`
          : 'No organisational control is currently mapped to this requirement.',
        'A documented, operating control with retained evidence demonstrating compliance.',
        covered ? 'No gap identified; control operating effectiveness to be tested.'
          : mapped.length ? 'Partial coverage: the mapped control addresses part of the requirement only.'
          : 'No control identified. The requirement is not addressed by any documented control.',
        covered ? 'Residual risk of control failure between assurance cycles.'
          : 'The organisation cannot currently demonstrate compliance with this requirement to the regulator.',
        covered ? 'low' : mapped.length ? 'medium' : 'high',
        covered ? 'Test control operating effectiveness during the next assurance cycle.'
          : mapped.length ? 'Extend the mapped control, or add a complementary control covering the remainder.'
          : 'Define and implement a control addressing this requirement, then map and evidence it.',
        mapped[0]?.responsible_role || 'Cybersecurity GRC Manager',
        new Date(Date.now() + (covered ? 180 : 90) * 86400000).toISOString().slice(0, 10),
        status,
        mapped.length ? q.all('SELECT name FROM evidence WHERE control_id = ?', mapped[0].pk).map((e) => e.name).slice(0, 3).join('; ') : '',
        mapped[0]?.policy_id || null, mapped[0]?.pk || null, at, at
      );
    }
  })();
  return assessmentId;
}

// ------------------------------------------------------------------ run ---

/**
 * Seed the risk register from the canonical requirement model.
 *
 * Every canonical requirement already states the risk it exists to address and
 * how serious it is; the register is that, made into rows, with the controls
 * generated from the same requirement linked as its treatment. One model, one
 * set of facts, projected into another view.
 *
 * The inherent figures are a starting position derived from the model's
 * qualitative rating. The demonstration organisation has implemented and
 * published the treating controls, so where a control exists the residual
 * position is recorded as assessed after treatment and the risk as treated —
 * the register of a programme that is working, which is what the demo shows.
 * A risk with no treating control stays at its inherent position, unassessed,
 * and so do the risks of a domain whose procedure is still being drafted: the
 * treatment is not yet in operation, so nobody can yet say what it achieved.
 */
const RESIDUAL_AFTER_TREATMENT = {
  critical: { likelihood: 2, impact: 4 },
  high: { likelihood: 2, impact: 3 },
  medium: { likelihood: 2, impact: 2 },
  low: { likelihood: 1, impact: 2 }
};
export function seedRisks(users) {
  const at = nowIso();
  const owner = users.grc_manager || users.admin || null;
  let created = 0;
  let linked = 0;

  // Only domains that actually have controls, so every risk has a treatment.
  const domains = q.all('SELECT DISTINCT domain_key FROM controls').map((r) => r.domain_key);

  for (const domainKey of domains) {
    const model = DOMAIN_MODELS[domainKey];
    if (!model) continue;
    const orgRow = q.get('SELECT org_name FROM org_profile WHERE id = 1');
    const params = buildParameterSet(domainKey, { org_name: orgRow?.org_name });
    let sequence = 0;

    for (const requirement of model.requirements) {
      if (!requirement.risk) continue;
      sequence += 1;

      const control = q.get(
        'SELECT * FROM controls WHERE domain_key = ? AND requirement_key = ?',
        domainKey, requirement.key
      );
      const position = startingPosition(requirement.riskRating);
      const treated = Boolean(control) && !IN_DRAFT.some(([domain]) => domain === domainKey);
      const residual = treated ? RESIDUAL_AFTER_TREATMENT[requirement.riskRating] || RESIDUAL_AFTER_TREATMENT.medium : position;
      const reference = `RSK-${domainShort(domainKey)}-${padNumber(sequence, 3)}`;
      if (q.get('SELECT id FROM risks WHERE risk_id = ?', reference)) continue;

      const riskId = id('rsk');
      q.run(
        `INSERT INTO risks (id, risk_id, title, description, domain_key, requirement_key, category,
           inherent_likelihood, inherent_impact, residual_likelihood, residual_impact, residual_assessed,
           treatment, treatment_summary, owner_id, owner_role, status, review_date,
           provenance, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        riskId, reference,
        requirement.title,
        resolveText(requirement.risk, params),
        domainKey,
        requirement.key,
        riskCategoryFor(domainKey, requirement),
        position.likelihood, position.impact,
        residual.likelihood, residual.impact, treated ? 1 : 0,
        'mitigate',
        control
          ? `Treated by control ${control.control_id} (${control.name}).`
          : 'No control is yet recorded against this risk.',
        owner?.id || null,
        control?.accountable_role || null,
        treated ? 'treated' : 'identified',
        new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
        'ai_recommendation', at, at
      );
      created += 1;

      if (control) {
        q.run(
          `INSERT INTO risk_controls (id, risk_id, control_id, effect, note, provenance, created_at)
           VALUES (?,?,?,?,?,?,?)`,
          id('rkc'), riskId, control.id,
          control.control_type === 'detective' ? 'detects'
            : control.control_type === 'corrective' ? 'reduces_impact' : 'reduces_likelihood',
          'Generated from the same canonical requirement as this risk.',
          'organizational_policy', at
        );
        linked += 1;
      }
    }
  }
  return { created, linked };
}

/** A rough categorisation from the domain, so the register is filterable. */
function riskCategoryFor(domainKey, requirement) {
  if (domainKey === 'third_party') return 'third_party';
  if (domainKey === 'data_protection' || domainKey === 'cryptography') return 'confidentiality';
  if (domainKey === 'business_continuity' || domainKey === 'backup') return 'availability';
  if (domainKey === 'compliance' || domainKey === 'governance') return 'compliance';
  if (/integrity|change|configuration/i.test(requirement.title)) return 'integrity';
  if (/availability|continuity|capacity/i.test(requirement.title)) return 'availability';
  if (/confidential|disclosure|leak/i.test(requirement.risk || '')) return 'confidentiality';
  return 'operational';
}

/**
 * Raise corrective actions against the most severe findings, most of them
 * already completed and independently verified, so the demo shows the loop
 * closing. The first stays in progress with the cybersecurity user, for the
 * walkthrough in which it is completed and then verified by internal audit.
 */
const ACTION_PLAN = [
  { status: 'in_progress', progress: 60, due: 14 },
  { status: 'open', progress: 0, due: 45 },
  { status: 'completed', progress: 100, due: -20, rootCause: 'The review cycle had no named owner, so it lapsed when the previous owner changed role.' },
  { status: 'completed', progress: 100, due: -35, rootCause: 'The requirement was stated without a measurable value, so it could not be tested.' },
  { status: 'completed', progress: 100, due: -50, rootCause: 'The procedure and the standard were revised separately and fell out of step.' },
  { status: 'completed', progress: 100, due: -65, rootCause: 'Evidence was collected but not linked to the control it demonstrates.' }
];

export function seedCorrectiveActions(users) {
  const at = nowIso();
  const owners = [users.cyber_user, users.grc_manager, users.reviewer].filter(Boolean);
  if (!owners.length) return 0;
  const verifier = users.auditor || users.approver || null;

  const findings = q.all(
    // The deliberate IAM inconsistency first, so it is the action still in
    // progress: its finding stays open while the documents still disagree.
    `SELECT * FROM findings WHERE severity IN ('critical','high','medium') AND status = 'open'
      ORDER BY (category = 'consistency') DESC,
               CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, created_at
      LIMIT 6`
  );
  let created = 0;

  findings.forEach((finding, index) => {
    const owner = owners[index % owners.length];
    const plan = ACTION_PLAN[index] || ACTION_PLAN[1];
    const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString();
    const reference = `CA-${padNumber(q.get('SELECT COUNT(*) AS n FROM corrective_actions').n + 1, 4)}`;
    const done = plan.status === 'completed';
    q.run(
      `INSERT INTO corrective_actions (id, action_id, title, description, source_type, source_id,
         domain_key, owner_id, priority, due_date, status, progress, root_cause, completed_at,
         verified_by, verified_at, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id('act'), reference,
      (finding.recommendation || `Resolve: ${finding.title}`).slice(0, 280),
      `Raised against the finding "${finding.title}".`,
      'finding', finding.id,
      finding.scope_type === 'domain' ? finding.scope_id : null,
      owner.id,
      finding.severity === 'critical' ? 'critical' : finding.severity === 'high' ? 'high' : 'medium',
      day(plan.due).slice(0, 10),
      plan.status, plan.progress,
      plan.rootCause || null,
      done ? day(plan.due - 4) : null,
      // Verified by someone other than the owner, as the route requires.
      done && verifier && verifier.id !== owner.id ? verifier.id : null,
      done && verifier && verifier.id !== owner.id ? day(plan.due - 2) : null,
      users.grc_manager?.id || null, at, at
    );
    if (done) q.run("UPDATE findings SET status = 'resolved', updated_at = ? WHERE id = ?", at, finding.id);
    created += 1;
  });
  return created;
}

/**
 * Close out the rest of the engine's findings as a working programme would
 * have: severe ones resolved, most of the medium ones too, leaving a short
 * list of minor wording points open. The deliberate IAM inconsistency stays
 * acknowledged, so the review walkthrough still has a real finding to show.
 */
export function settleFindings() {
  const at = nowIso();
  const findings = q.all("SELECT * FROM findings WHERE status = 'open' ORDER BY created_at");
  let open = 0;
  findings.forEach((f, i) => {
    let status = 'resolved';
    if (f.category === 'consistency') status = 'acknowledged';
    else if (f.severity === 'low' || f.severity === 'info') status = i % 2 ? 'resolved' : 'open';
    else if (f.severity === 'medium') status = i % 4 === 0 ? 'open' : 'resolved';
    if (status === 'open') { open += 1; return; }
    q.run('UPDATE findings SET status = ?, updated_at = ? WHERE id = ?', status, at, f.id);
  });
  return open;
}

/**
 * Evidence collected on its cycle for the published domains, with the
 * longer-established half already verified by the GRC function.
 */
export function seedEvidence() {
  const rows = q.all(
    `SELECT e.id FROM evidence e JOIN controls c ON c.id = e.control_id
      WHERE c.domain_key IN (SELECT DISTINCT domain_key FROM documents WHERE status = 'published')
      ORDER BY e.evidence_id`
  );
  rows.forEach((row, i) => {
    const collected = new Date(Date.now() - (5 + (i * 11) % 80) * 86400000).toISOString().slice(0, 10);
    q.run('UPDATE evidence SET status = ?, last_collected = ?, updated_at = ? WHERE id = ?',
      i % 2 ? 'verified' : 'collected', collected, nowIso(), row.id);
  });
  return rows.length;
}

export function runSeed({ quiet = false } = {}) {
  const log = quiet ? () => {} : (...a) => console.log(...a);
  const problems = validateKnowledgeBase();
  if (problems.length) {
    console.error(`Knowledge base has ${problems.length} integrity problem(s); refusing to seed.`);
    problems.slice(0, 10).forEach((p) => console.error(`  - ${p}`));
    throw new Error('Knowledge base validation failed');
  }

  log('Seeding authoritative framework catalogue…');
  seedFrameworks();
  log(`  ${q.get('SELECT COUNT(*) AS n FROM frameworks').n} frameworks, ${q.get('SELECT COUNT(*) AS n FROM framework_requirements').n} requirements, ${q.get('SELECT COUNT(*) AS n FROM crosswalks').n} crosswalks`);

  log('Seeding organisation profile…');
  const org = seedOrg();

  log('Seeding users…');
  const users = seedUsers();
  log(`  ${q.get('SELECT COUNT(*) AS n FROM users').n} users`);

  log('Generating demo governance packages…');
  const packages = seedDemoPackages(users, org);
  log(`  ${packages.length} package(s), ${q.get('SELECT COUNT(*) AS n FROM documents').n} documents, ${q.get('SELECT COUNT(*) AS n FROM controls').n} controls, ${q.get('SELECT COUNT(*) AS n FROM evidence').n} evidence items`);

  log('Applying document lifecycle history…');
  seedLifecycle(users);

  log('Introducing a demonstration governance inconsistency…');
  const applied = seedInconsistency();
  log(`  ${applied ? 'IAM Procedure now disagrees with the IAM Standard on access review frequency' : 'skipped'}`);

  log('Seeding gap assessment…');
  const assessmentId = seedAssessment(users);
  if (assessmentId) log(`  ${q.get('SELECT COUNT(*) AS n FROM gap_items WHERE assessment_id = ?', assessmentId).n} gap items`);

  log('Building the risk register from the canonical requirement model…');
  const risks = seedRisks(users);
  log(`  ${risks.created} risks, ${risks.linked} linked to a treating control`);

  log('Running the quality engine over the seeded domains…');
  let findingCount = 0;
  for (const domainKey of [...new Set(DEMO_PACKAGES.map((p) => p.domain))]) {
    const result = reviewDomain(domainKey);
    const at = nowIso();
    for (const f of result.findings) {
      q.run(
        `INSERT INTO findings (id, scope_type, scope_id, category, severity, title, detail, location, recommendation, evidence, status, source, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id('fnd'), 'domain', domainKey, f.category, f.severity, f.title, f.detail,
        f.location, f.recommendation, toJson(f.evidence), 'open', 'engine', at, at
      );
      findingCount += 1;
    }
  }
  log(`  ${findingCount} findings recorded`);

  log('Raising corrective actions against the most severe findings…');
  const actions = seedCorrectiveActions(users);
  log(`  ${actions} corrective actions`);
  log(`  ${settleFindings()} findings left open`);

  log('Recording collected evidence…');
  log(`  ${seedEvidence()} evidence items collected or verified`);

  // After the findings, which demonstrate the review engine on the English
  // originals; the Arabic versions mirror those originals.
  log('Generating the Arabic version of each package…');
  log(`  ${seedTranslations(users, org, packages)} Arabic documents`);

  return {
    frameworks: q.get('SELECT COUNT(*) AS n FROM frameworks').n,
    documents: q.get('SELECT COUNT(*) AS n FROM documents').n,
    controls: q.get('SELECT COUNT(*) AS n FROM controls').n,
    evidence: q.get('SELECT COUNT(*) AS n FROM evidence').n,
    findings: findingCount,
    risks: q.get('SELECT COUNT(*) AS n FROM risks').n,
    actions: q.get('SELECT COUNT(*) AS n FROM corrective_actions').n,
    users: q.get('SELECT COUNT(*) AS n FROM users').n
  };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  const existing = q.get('SELECT COUNT(*) AS n FROM documents').n;
  if (existing > 0 && !force) {
    console.log(`Database already contains ${existing} documents. Re-run with --force to seed anyway.`);
    process.exit(0);
  }
  const summary = runSeed();
  console.log('\nSeed complete:', summary);
  console.log('\nSign in with any of these accounts:');
  for (const u of DEMO_USERS) console.log(`  ${u.email.padEnd(24)} ${u.role.padEnd(14)} ${u.job_title}`);
  console.log(`\nPassword for all demo accounts: ${config.seedPassword}`);
  process.exit(0);
}
