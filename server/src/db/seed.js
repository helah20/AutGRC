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
  DOMAIN_MODELS, domainShort, validateKnowledgeBase
} from '../knowledge/index.js';
import { startingPosition } from '../services/risk.js';
import { generatePackage } from '../services/generator.js';
import { indexFrameworkRequirement } from '../services/search.js';
import { reviewDomain } from '../services/review.js';

const force = process.argv.includes('--force');

// --------------------------------------------------------------- sources ---

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
 * The five domains the brief calls out, plus governance for the framework tier.
 *
 * No per-package framework list. Which authoritative sources apply is recorded
 * once on the organisation profile, so every package cites the same adopted
 * set and a domain shows only the ones it actually maps to.
 */
const DEMO_PACKAGES = [
  { domain: 'iam',
    docTypes: ['policy', 'standard', 'procedure', 'guideline', 'roles', 'raci', 'control_matrix', 'framework'],
    classification: 'confidential' },
  { domain: 'asset_management',
    docTypes: ['policy', 'standard', 'procedure', 'roles', 'raci', 'control_matrix'], classification: 'internal' },
  { domain: 'incident_management',
    docTypes: ['policy', 'standard', 'procedure', 'roles', 'raci', 'control_matrix'], classification: 'confidential' },
  { domain: 'vulnerability_management',
    docTypes: ['policy', 'standard', 'procedure', 'roles', 'raci', 'control_matrix'], classification: 'internal' },
  { domain: 'third_party',
    docTypes: ['policy', 'standard', 'procedure', 'roles', 'raci', 'control_matrix'], classification: 'confidential' },
  { domain: 'governance',
    docTypes: ['policy', 'standard', 'roles', 'raci'], classification: 'internal' }
];

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
 * Give the demo data a believable lifecycle history rather than leaving every
 * document at Draft: IAM and Incident Management are published, Asset
 * Management is under review, and one document is deliberately overdue.
 */
export function seedLifecycle(users) {
  const at = nowIso();
  const approver = users.approver;
  const grc = users.grc_manager;
  if (!approver || !grc) return;

  const transition = (doc, to, action, comment, effectiveOffsetDays, reviewOffsetDays, version) => {
    const effective = new Date(Date.now() + effectiveOffsetDays * 86400000).toISOString().slice(0, 10);
    const review = new Date(Date.now() + reviewOffsetDays * 86400000).toISOString().slice(0, 10);
    q.run(
      'UPDATE documents SET status = ?, version = ?, effective_date = ?, review_date = ?, updated_at = ? WHERE id = ?',
      to, version || doc.version, effective, review, at, doc.id
    );
    q.run(
      `INSERT INTO document_approvals (id, document_id, action, from_status, to_status, actor_id, actor_name, actor_role, comment, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      id('apr'), doc.id, action, doc.status, to,
      action === 'approved' || action === 'published' ? approver.id : grc.id,
      action === 'approved' || action === 'published' ? approver.name : grc.name,
      action === 'approved' || action === 'published' ? approver.role : grc.role,
      comment, at
    );
  };

  for (const domain of ['iam', 'incident_management']) {
    for (const doc of q.all("SELECT * FROM documents WHERE domain_key = ? AND status = 'draft'", domain)) {
      transition(doc, 'under_review', 'submitted', 'Submitted for technical and governance review.', 0, 365);
      const reloaded = q.get('SELECT * FROM documents WHERE id = ?', doc.id);
      transition(reloaded, 'approved', 'approved', 'Reviewed against the applicable NCA ECC and ISO/IEC 27001 requirements. Approved.', 0, 365);
      const approved = q.get('SELECT * FROM documents WHERE id = ?', doc.id);
      transition(approved, 'published', 'published', 'Published and communicated to all affected personnel.', -45, 320, '1.0');
    }
  }

  for (const doc of q.all("SELECT * FROM documents WHERE domain_key = 'asset_management' AND status = 'draft'")) {
    transition(doc, 'under_review', 'submitted', 'Submitted for review by the Asset Owner community.', 0, 365);
  }

  for (const doc of q.all("SELECT * FROM documents WHERE domain_key = 'vulnerability_management' AND doc_type IN ('policy','standard') AND status = 'draft'")) {
    transition(doc, 'under_review', 'submitted', 'Submitted for review ahead of the annual regulatory submission.', 0, 365);
  }

  // One published policy deliberately left overdue, so the review-due
  // dashboards and the "overdue for review" finding have something real to show.
  const overdue = q.get("SELECT * FROM documents WHERE domain_key = 'third_party' AND doc_type = 'policy'");
  if (overdue) {
    q.run(
      "UPDATE documents SET status = 'published', version = '1.0', effective_date = ?, review_date = ?, updated_at = ? WHERE id = ?",
      new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10),
      new Date(Date.now() - 35 * 86400000).toISOString().slice(0, 10),
      at, overdue.id
    );
    q.run(
      `INSERT INTO document_approvals (id, document_id, action, from_status, to_status, actor_id, actor_name, actor_role, comment, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      id('apr'), overdue.id, 'published', 'approved', 'published', approver.id, approver.name, approver.role,
      'Published following Cybersecurity Steering Committee approval.', at
    );
  }
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
 * The likelihood and impact figures are a starting position derived from the
 * model's qualitative rating, not an assessment of this organisation. Every row
 * is marked ai_recommendation with residual_assessed = 0, so the register says
 * as much rather than letting a default read as somebody's considered judgement.
 */
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
    let sequence = 0;

    for (const requirement of model.requirements) {
      if (!requirement.risk) continue;
      sequence += 1;

      const control = q.get(
        'SELECT * FROM controls WHERE domain_key = ? AND requirement_key = ?',
        domainKey, requirement.key
      );
      const position = startingPosition(requirement.riskRating);
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
        requirement.risk,
        domainKey,
        requirement.key,
        riskCategoryFor(domainKey, requirement),
        position.likelihood, position.impact,
        // Residual starts at inherent and is flagged unassessed: a reduction
        // nobody has worked out must not read as one somebody achieved.
        position.likelihood, position.impact, 0,
        'mitigate',
        control
          ? `Treated by control ${control.control_id} (${control.name}).`
          : 'No control is yet recorded against this risk.',
        owner?.id || null,
        control?.accountable_role || null,
        'identified',
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
 * Raise corrective actions against the most severe findings, so the demo shows
 * the loop closing rather than a list of findings nobody owns.
 */
export function seedCorrectiveActions(users) {
  const at = nowIso();
  const owners = [users.cyber_user, users.grc_manager, users.reviewer].filter(Boolean);
  if (!owners.length) return 0;

  const findings = q.all(
    "SELECT * FROM findings WHERE severity IN ('critical','high') AND status = 'open' ORDER BY created_at LIMIT 6"
  );
  let created = 0;

  findings.forEach((finding, index) => {
    const owner = owners[index % owners.length];
    // One of these lands in the past, so the overdue filter has something real.
    const due = new Date(Date.now() + (index - 1) * 21 * 86400000).toISOString().slice(0, 10);
    const reference = `CA-${padNumber(q.get('SELECT COUNT(*) AS n FROM corrective_actions').n + 1, 4)}`;
    const rowId = id('act');
    q.run(
      `INSERT INTO corrective_actions (id, action_id, title, description, source_type, source_id,
         domain_key, owner_id, priority, due_date, status, progress, blocked_reason, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      rowId, reference,
      (finding.recommendation || `Resolve: ${finding.title}`).slice(0, 280),
      `Raised against the finding "${finding.title}".`,
      'finding', finding.id,
      finding.scope_type === 'domain' ? finding.scope_id : null,
      owner.id,
      finding.severity === 'critical' ? 'critical' : 'high',
      due,
      index === 0 ? 'in_progress' : index === 1 ? 'blocked' : 'open',
      index === 0 ? 40 : 0,
      index === 1 ? 'Waiting on the identity platform upgrade scheduled for next quarter.' : null,
      users.grc_manager?.id || null, at, at
    );
    created += 1;
  });
  return created;
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
