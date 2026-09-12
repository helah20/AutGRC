/**
 * Governance quality engine.
 *
 * Runs deterministic checks over generated and hand-edited content:
 * completeness, cross-document consistency, accountability, auditability,
 * compliance coverage and ambiguity. The consistency check is the important
 * one: it detects when a human edit has moved a commitment in one document
 * (for example an access review frequency) without moving it in the others.
 *
 * Findings produced here are engine findings. The AI provider may add its own,
 * which are recorded separately with source = 'ai'.
 */

import { q, fromJson } from '../db/index.js';
import { htmlToText } from './html.js';
import { DOMAIN_MODELS, domainName, resolveText } from '../knowledge/index.js';

// ------------------------------------------------------- required sections --

export const REQUIRED_SECTIONS = {
  policy: ['purpose', 'scope', 'objectives', 'statements', 'roles', 'governance', 'compliance', 'exceptions', 'monitoring', 'review', 'enforcement', 'references'],
  standard: ['purpose', 'scope', 'mandatory', 'technical', 'security', 'controls', 'exceptions', 'monitoring', 'compliance'],
  procedure: ['purpose', 'scope', 'preconditions', 'inputs', 'process', 'steps', 'decisions', 'escalation', 'outputs', 'records', 'kpis', 'roles', 'exceptions'],
  guideline: ['purpose', 'scope', 'guidance', 'references'],
  framework: ['purpose', 'structure', 'sources', 'coverage', 'governance'],
  roles: ['purpose', 'structure'],
  raci: ['purpose', 'legend', 'matrix'],
  control_matrix: ['purpose', 'matrix', 'evidence']
};

const SECTION_LABEL = {
  purpose: 'Purpose', scope: 'Scope', objectives: 'Objectives', statements: 'Policy Statements',
  roles: 'Roles and Responsibilities', governance: 'Governance', compliance: 'Compliance',
  exceptions: 'Exceptions', monitoring: 'Monitoring', review: 'Review', enforcement: 'Enforcement',
  references: 'References', mandatory: 'Mandatory Requirements', technical: 'Technical Requirements',
  security: 'Security Requirements', controls: 'Minimum Controls', preconditions: 'Preconditions',
  inputs: 'Inputs', process: 'Process', steps: 'Detailed Steps', decisions: 'Decision Points',
  escalation: 'Escalation', outputs: 'Outputs', records: 'Records / Evidence', kpis: 'KPIs',
  guidance: 'Guidance', structure: 'Structure', sources: 'Sources', coverage: 'Coverage',
  legend: 'Legend', matrix: 'Matrix', evidence: 'Evidence'
};

// ----------------------------------------------------------- ambiguity -----

const AMBIGUOUS_TERMS = [
  { term: 'regularly', suggest: 'state the interval, for example "at least quarterly"' },
  { term: 'periodically', suggest: 'state the interval, for example "at least annually"' },
  { term: 'from time to time', suggest: 'state the interval' },
  { term: 'as needed', suggest: 'state the trigger condition that creates the need' },
  { term: 'as required', suggest: 'state who determines the requirement and against what criteria' },
  { term: 'as appropriate', suggest: 'state the criteria that make it appropriate' },
  { term: 'appropriately', suggest: 'state the standard to be met' },
  { term: 'where applicable', suggest: 'state the conditions under which it applies' },
  { term: 'where possible', suggest: 'state the constraint and the fallback when it is not possible' },
  { term: 'where feasible', suggest: 'state the feasibility criteria' },
  { term: 'timely', suggest: 'state the deadline in hours or days' },
  { term: 'in a timely manner', suggest: 'state the deadline in hours or days' },
  { term: 'adequate', suggest: 'state the measurable threshold' },
  { term: 'sufficient', suggest: 'state the measurable threshold' },
  { term: 'reasonable', suggest: 'state the objective criteria' },
  { term: 'best effort', suggest: 'state the committed outcome or remove the obligation' },
  { term: 'strong password', suggest: 'state the length and composition requirement' },
  { term: 'as soon as possible', suggest: 'state the deadline' },
  { term: 'should consider', suggest: 'state whether the action is mandatory or advisory' },
  { term: 'may be', suggest: 'state whether the action is mandatory or permitted' },
  { term: 'significant', suggest: 'state the threshold that makes it significant' },
  { term: 'promptly', suggest: 'state the deadline in hours or days' }
];

/** A quantified commitment nearby usually resolves the ambiguity. */
const QUANTIFIER = /\b(\d+\s*(hours?|days?|weeks?|months?|years?|business days?|%)|daily|weekly|monthly|quarterly|annually|semi-annually|continuous(ly)?|at least \d)/i;

// --------------------------------------------------------- commitments -----

const FREQUENCY_TERMS = [
  'continuously', 'continuous', 'real time', 'real-time',
  'hourly', 'daily', 'weekly', 'fortnightly', 'monthly', 'bi-monthly',
  'quarterly', 'semi-annually', 'semi annually', 'half-yearly', 'biannually',
  'annually', 'yearly', 'biennially', 'every shift', 'per request', 'per event'
];

const FREQUENCY_CANON = {
  continuously: 'continuous', continuous: 'continuous', 'real time': 'continuous', 'real-time': 'continuous',
  hourly: 'hourly', daily: 'daily', weekly: 'weekly', fortnightly: 'fortnightly',
  monthly: 'monthly', 'bi-monthly': 'bi-monthly', quarterly: 'quarterly',
  'semi-annually': 'semi-annually', 'semi annually': 'semi-annually', 'half-yearly': 'semi-annually',
  biannually: 'semi-annually', annually: 'annually', yearly: 'annually', biennially: 'biennially',
  'every shift': 'every shift', 'per request': 'per request', 'per event': 'per event'
};

const DURATION_RE = /\b(\d+)\s+(minutes?|hours?|business days?|days?|weeks?|months?|years?)\b/gi;

const STOP_WORDS = new Set([
  'frequency', 'sla', 'target', 'default', 'requirement', 'requirements', 'method',
  'standard', 'type', 'types', 'max', 'duration', 'threshold', 'policy', 'level',
  'source', 'mode', 'authority', 'coverage', 'retention', 'alert', 'storage', 'model', 'value'
]);

/** accessReviewFrequency -> ['access','review'] */
function topicWords(paramName) {
  return paramName
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[.;:])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);
}

function frequenciesIn(sentence) {
  const lower = sentence.toLowerCase();
  const found = new Set();
  for (const term of FREQUENCY_TERMS) {
    const re = new RegExp(`\\b${term.replace(/[-\s]/g, '[-\\s]')}\\b`, 'i');
    if (re.test(lower)) found.add(FREQUENCY_CANON[term]);
  }
  return [...found];
}

function durationsIn(sentence) {
  const out = [];
  let m;
  const re = new RegExp(DURATION_RE.source, 'gi');
  while ((m = re.exec(sentence))) {
    const unit = m[2].toLowerCase().replace(/s$/, '');
    out.push({ value: Number(m[1]), unit: unit.replace(/^business day$/, 'business day'), text: m[0] });
  }
  return out;
}

// ------------------------------------------------------------- helpers -----

function loadDocument(documentId) {
  const doc = q.get('SELECT * FROM documents WHERE id = ?', documentId);
  if (!doc) return null;
  const sections = q.all('SELECT * FROM document_sections WHERE document_id = ? ORDER BY position', documentId);
  return { doc, sections: sections.filter((s) => !s.section_key.startsWith('_')) };
}

function finding(partial) {
  return {
    category: 'completeness', severity: 'medium', source: 'engine',
    detail: '', location: '', recommendation: '', evidence: null,
    ...partial
  };
}

// ------------------------------------------------------------- checks ------

export function checkCompleteness({ doc, sections }) {
  const out = [];
  const required = REQUIRED_SECTIONS[doc.doc_type] || [];
  const present = new Set(sections.map((s) => s.section_key));

  for (const key of required) {
    if (!present.has(key)) {
      out.push(finding({
        category: 'completeness', severity: 'high',
        title: `Missing required section: ${SECTION_LABEL[key] || key}`,
        detail: `A ${doc.doc_type.replace('_', ' ')} is expected to contain a "${SECTION_LABEL[key] || key}" section. It is absent from ${doc.reference}.`,
        location: `${doc.reference}`,
        recommendation: `Add a "${SECTION_LABEL[key] || key}" section before submitting this document for approval.`
      }));
    }
  }

  for (const s of sections) {
    const text = htmlToText(s.body);
    if (text.length < 40) {
      out.push(finding({
        category: 'completeness', severity: text.length === 0 ? 'high' : 'low',
        title: `Section "${s.heading}" is ${text.length === 0 ? 'empty' : 'very short'}`,
        detail: text.length === 0
          ? `The section contains no content.`
          : `The section contains only ${text.length} characters, which is unlikely to state a complete requirement.`,
        location: `${doc.reference} — ${s.heading}`,
        recommendation: 'Complete the section or remove it if it does not apply to this document.'
      }));
    }
  }

  if (!doc.owner_id) {
    out.push(finding({
      category: 'ownership', severity: 'high',
      title: 'Document has no assigned owner',
      detail: `${doc.reference} has no Document Owner. An unowned document cannot be maintained or approved.`,
      location: doc.reference,
      recommendation: 'Assign a Document Owner accountable for the content and its review cycle.'
    }));
  }
  if (!doc.approver_id && ['under_review', 'approved', 'published'].includes(doc.status)) {
    out.push(finding({
      category: 'ownership', severity: 'high',
      title: 'Document has no approver',
      detail: `${doc.reference} is at status "${doc.status}" but no Approver is recorded.`,
      location: doc.reference,
      recommendation: 'Record the approving authority before the document proceeds.'
    }));
  }
  if (!doc.review_date) {
    out.push(finding({
      category: 'currency', severity: 'medium',
      title: 'No review date set',
      detail: `${doc.reference} does not carry a review date, so it cannot be reported as overdue.`,
      location: doc.reference,
      recommendation: 'Set a review date, normally 12 months from the effective date.'
    }));
  } else if (new Date(doc.review_date) < new Date() && doc.status === 'published') {
    out.push(finding({
      category: 'currency', severity: 'high',
      title: 'Document is overdue for review',
      detail: `${doc.reference} was due for review on ${doc.review_date} and remains published.`,
      location: doc.reference,
      recommendation: 'Review and reissue the document, or move it to Under Revision.'
    }));
  }
  return out;
}

export function checkAmbiguity({ doc, sections }) {
  const out = [];
  for (const s of sections) {
    const text = htmlToText(s.body);
    for (const sentence of splitSentences(text)) {
      const lower = sentence.toLowerCase();
      for (const { term, suggest } of AMBIGUOUS_TERMS) {
        if (!lower.includes(term)) continue;
        // A quantified commitment in the same sentence resolves the vagueness.
        const quantified = QUANTIFIER.test(sentence);
        out.push(finding({
          category: 'ambiguity',
          severity: quantified ? 'info' : 'medium',
          title: `Unmeasurable wording: "${term}"`,
          detail: quantified
            ? `"${term}" appears alongside a quantified commitment, so the obligation is measurable. Consider removing the vague word for clarity.`
            : `The statement uses "${term}" without a measurable value, so compliance cannot be objectively assessed or audited.`,
          location: `${doc.reference} — ${s.heading}`,
          recommendation: `Replace "${term}": ${suggest}.`,
          evidence: { statement: sentence.slice(0, 400) }
        }));
        break; // one finding per sentence is enough
      }
    }
  }
  return out;
}

export function checkAccountability({ doc, sections }) {
  const out = [];
  const model = DOMAIN_MODELS[doc.domain_key];
  if (!model) return out;

  if (doc.doc_type === 'raci') {
    const matrix = q.get('SELECT * FROM raci_matrices WHERE document_id = ?', doc.id);
    if (matrix) out.push(...validateMatrix(matrix.id).map((f) => ({ ...f, location: `${doc.reference} — ${f.location}` })));
    return out;
  }

  // Controls in this domain must have both an accountable and responsible role.
  const controls = q.all('SELECT * FROM controls WHERE domain_key = ?', doc.domain_key);
  for (const c of controls) {
    if (!c.responsible_role || !c.accountable_role) {
      out.push(finding({
        category: 'accountability', severity: 'high',
        title: `Control ${c.control_id} has no ${!c.accountable_role ? 'accountable' : 'responsible'} role`,
        detail: `${c.control_id} (${c.name}) cannot be operated or assured without a named role.`,
        location: `Control ${c.control_id}`,
        recommendation: 'Assign the role in the Control Library and reflect it in the domain RACI matrix.'
      }));
    }
  }
  return out;
}

/** RACI integrity: exactly one Accountable, at least one Responsible. */
export function validateMatrix(matrixId) {
  const out = [];
  const activities = q.all('SELECT * FROM raci_activities WHERE matrix_id = ? ORDER BY position', matrixId);
  const cols = q.all('SELECT * FROM raci_roles WHERE matrix_id = ? ORDER BY position', matrixId);
  const assignments = q.all('SELECT * FROM raci_assignments WHERE matrix_id = ?', matrixId);
  const byActivity = new Map();
  for (const a of assignments) {
    if (!byActivity.has(a.activity_id)) byActivity.set(a.activity_id, []);
    byActivity.get(a.activity_id).push(a);
  }
  const colLabel = Object.fromEntries(cols.map((c) => [c.id, c.label]));

  for (const act of activities) {
    const rows = byActivity.get(act.id) || [];
    const accountable = rows.filter((r) => r.value === 'A');
    const responsible = rows.filter((r) => r.value === 'R');

    if (accountable.length === 0) {
      out.push(finding({
        category: 'accountability', severity: 'high',
        title: `No accountable role for "${act.activity}"`,
        detail: 'Every activity requires exactly one Accountable role. Without one, no individual answers for the outcome.',
        location: act.activity,
        recommendation: 'Assign exactly one role as Accountable (A).'
      }));
    } else if (accountable.length > 1) {
      out.push(finding({
        category: 'accountability', severity: 'high',
        title: `Multiple accountable roles for "${act.activity}"`,
        detail: `${accountable.length} roles are marked Accountable (${accountable.map((r) => colLabel[r.role_col_id]).join(', ')}). Shared accountability means no one is accountable.`,
        location: act.activity,
        recommendation: 'Retain exactly one Accountable role; change the others to Responsible or Consulted.',
        evidence: { roles: accountable.map((r) => colLabel[r.role_col_id]) }
      }));
    }

    if (responsible.length === 0) {
      out.push(finding({
        category: 'accountability', severity: 'medium',
        title: `No responsible role for "${act.activity}"`,
        detail: 'No role is assigned to perform this activity.',
        location: act.activity,
        recommendation: 'Assign at least one role as Responsible (R).'
      }));
    }
  }

  // A role column with no assignment at all is noise in the matrix.
  for (const col of cols) {
    const used = assignments.some((a) => a.role_col_id === col.id && a.value);
    if (!used) {
      out.push(finding({
        category: 'accountability', severity: 'low',
        title: `Role column "${col.label}" has no assignments`,
        detail: 'The role appears in the matrix but carries no responsibility in any activity.',
        location: col.label,
        recommendation: 'Assign the role where it participates, or remove the column.'
      }));
    }
  }
  return out;
}

export function checkAuditability({ doc }) {
  const out = [];
  const controls = q.all('SELECT * FROM controls WHERE domain_key = ?', doc.domain_key);
  for (const c of controls) {
    const evidence = q.all('SELECT * FROM evidence WHERE control_id = ?', c.id);
    if (!evidence.length) {
      out.push(finding({
        category: 'auditability', severity: 'high',
        title: `Control ${c.control_id} has no evidence requirement`,
        detail: `${c.control_id} (${c.name}) states a requirement but nothing records that it operated, so it cannot be tested or audited.`,
        location: `Control ${c.control_id}`,
        recommendation: 'Define at least one evidence artefact, its source system and its collection frequency.'
      }));
    }
    if (!c.kpi) {
      out.push(finding({
        category: 'auditability', severity: 'low',
        title: `Control ${c.control_id} has no performance indicator`,
        detail: 'Without an indicator the control cannot be reported on or trended.',
        location: `Control ${c.control_id}`,
        recommendation: 'Define a measurable indicator with a target.'
      }));
    }
  }
  return out;
}

export function checkCompliance({ doc }) {
  const out = [];
  const meta = fromJson(doc.generation_meta, {});
  const codes = meta.frameworks || [];
  if (!codes.length) return out;

  for (const code of codes) {
    const fw = q.get('SELECT * FROM frameworks WHERE code = ?', code);
    if (!fw) continue;
    const reqs = q.all(
      'SELECT * FROM framework_requirements WHERE framework_id = ? AND domain_key = ?',
      fw.id, doc.domain_key
    );
    if (!reqs.length) continue;
    const covered = new Set(
      q.all(
        `SELECT cm.requirement_id FROM control_mappings cm
           JOIN controls c ON c.id = cm.control_id
          WHERE c.domain_key = ? AND cm.coverage IN ('covered','partial')`,
        doc.domain_key
      ).map((r) => r.requirement_id)
    );
    const uncovered = reqs.filter((r) => !covered.has(r.id));
    if (uncovered.length) {
      out.push(finding({
        category: 'compliance',
        severity: uncovered.length > reqs.length / 2 ? 'high' : 'medium',
        title: `${uncovered.length} ${fw.code} requirement${uncovered.length === 1 ? '' : 's'} in this domain have no mapped control`,
        detail: `Requirements ${uncovered.slice(0, 8).map((r) => r.ref).join(', ')}${uncovered.length > 8 ? ', …' : ''} are within the ${domainName(doc.domain_key)} domain but no organisational control is mapped to them.`,
        location: `${fw.code} — ${domainName(doc.domain_key)}`,
        recommendation: 'Map an existing control, create a control, or record the requirement as Not Applicable with a documented rationale.',
        evidence: { framework: fw.code, refs: uncovered.map((r) => r.ref) }
      }));
    }
  }
  return out;
}

// -------------------------------------------------- cross-document check ---

/**
 * Detect commitments that disagree between documents in the same domain.
 *
 * For each canonical parameter the generator agreed (for example
 * `accessReviewFrequency: quarterly`), find the sentences across every
 * document in the domain that talk about that topic, extract the frequency
 * or duration each states, and report any that disagree.
 */
export function checkConsistency(domainKey) {
  const out = [];
  const model = DOMAIN_MODELS[domainKey];
  if (!model) return out;

  const docs = q.all(
    "SELECT * FROM documents WHERE domain_key = ? AND status != 'retired'", domainKey
  );
  if (docs.length < 2) return out;

  // Prefer the parameter set actually agreed at generation time.
  let params = { ...model.parameters };
  for (const d of docs) {
    const meta = fromJson(d.generation_meta, {});
    if (meta.parameters) { params = { ...params, ...meta.parameters }; break; }
  }

  const corpus = docs.map((d) => ({
    doc: d,
    sections: q.all('SELECT * FROM document_sections WHERE document_id = ? ORDER BY position', d.id)
      .filter((s) => !s.section_key.startsWith('_'))
  }));

  for (const [paramName, rawValue] of Object.entries(model.parameters)) {
    const value = resolveText(String(params[paramName] ?? rawValue), params);
    const words = topicWords(paramName);
    if (words.length < 1) continue;

    const expectedFreq = frequenciesIn(value);
    const expectedDur = durationsIn(value);
    if (!expectedFreq.length && !expectedDur.length) continue;

    const observations = [];
    for (const { doc, sections } of corpus) {
      for (const s of sections) {
        const text = htmlToText(s.body);
        for (const sentence of splitSentences(text)) {
          const lower = sentence.toLowerCase();
          const hits = words.filter((w) => lower.includes(w)).length;
          if (hits < Math.min(2, words.length)) continue;

          const freqs = frequenciesIn(sentence);
          const durs = durationsIn(sentence);
          if (!freqs.length && !durs.length) continue;
          observations.push({ doc, section: s, sentence: sentence.slice(0, 400), freqs, durs });
        }
      }
    }

    if (observations.length < 2) continue;

    // Frequency disagreement across documents.
    if (expectedFreq.length) {
      const withFreq = observations.filter((o) => o.freqs.length);
      const distinct = new Set(withFreq.flatMap((o) => o.freqs));
      const conflicting = withFreq.filter((o) => !o.freqs.some((f) => expectedFreq.includes(f)));
      if (distinct.size > 1 && conflicting.length) {
        const agreeing = withFreq.filter((o) => o.freqs.some((f) => expectedFreq.includes(f)));
        for (const bad of conflicting) {
          const good = agreeing.find((a) => a.doc.id !== bad.doc.id) || agreeing[0];
          out.push(finding({
            category: 'consistency', severity: 'high',
            title: `Governance inconsistency: ${humanParam(paramName)}`,
            detail: `${bad.doc.reference} states "${bad.freqs.join(', ')}" where the agreed organisational value is "${expectedFreq.join(', ')}"${good ? ` and ${good.doc.reference} states it correctly` : ''}. Documents in the same domain must state the same commitment.`,
            location: `${bad.doc.reference} — ${bad.section.heading}`,
            recommendation: `Reconcile to the value recorded in the Standard (${value}), or change the Standard and propagate the change to every document in this domain.`,
            evidence: {
              parameter: paramName,
              agreedValue: value,
              conflicting: { document: bad.doc.reference, section: bad.section.heading, statement: bad.sentence },
              agreeing: good ? { document: good.doc.reference, section: good.section.heading, statement: good.sentence } : null
            }
          }));
        }
      }
    }

    // Duration disagreement across documents (e.g. 4 hours vs 24 hours).
    if (expectedDur.length) {
      const expected = expectedDur[0];
      const withDur = observations.filter((o) => o.durs.length);
      for (const obs of withDur) {
        const match = obs.durs.some((d) => d.unit === expected.unit && d.value === expected.value);
        if (match) continue;
        const sameUnit = obs.durs.filter((d) => d.unit === expected.unit);
        if (!sameUnit.length) continue;
        out.push(finding({
          category: 'consistency', severity: 'high',
          title: `Governance inconsistency: ${humanParam(paramName)}`,
          detail: `${obs.doc.reference} states "${sameUnit.map((d) => d.text).join(', ')}" where the agreed organisational value is "${expected.text}".`,
          location: `${obs.doc.reference} — ${obs.section.heading}`,
          recommendation: `Reconcile to the value recorded in the Standard (${value}).`,
          evidence: {
            parameter: paramName,
            agreedValue: value,
            conflicting: { document: obs.doc.reference, section: obs.section.heading, statement: obs.sentence }
          }
        }));
      }
    }
  }

  // A domain with a Policy but no Standard or Procedure is an incomplete chain.
  const types = new Set(docs.map((d) => d.doc_type));
  if (types.has('policy')) {
    for (const missing of ['standard', 'procedure']) {
      if (!types.has(missing)) {
        out.push(finding({
          category: 'completeness', severity: 'medium',
          title: `${domainName(domainKey)} has a Policy but no ${missing === 'standard' ? 'Standard' : 'Procedure'}`,
          detail: `The governance hierarchy expects Policy → Standard → Procedure. The ${missing} tier is missing, so the policy position is not translated into ${missing === 'standard' ? 'measurable requirements' : 'operational steps'}.`,
          location: domainName(domainKey),
          recommendation: `Generate the ${domainName(domainKey)} ${missing === 'standard' ? 'Standard' : 'Procedure'} from the domain requirement model.`
        }));
      }
    }
  }

  return dedupe(out);
}

function humanParam(name) {
  return name.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
}

function dedupe(findings) {
  const seen = new Set();
  return findings.filter((f) => {
    const key = `${f.category}|${f.title}|${f.location}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ------------------------------------------------------------ entrypoint ---

/** Full review of one document plus the domain consistency picture. */
export function reviewDocument(documentId) {
  const loaded = loadDocument(documentId);
  if (!loaded) throw Object.assign(new Error('Document not found'), { status: 404 });

  const findings = dedupe([
    ...checkCompleteness(loaded),
    ...checkAmbiguity(loaded),
    ...checkAccountability(loaded),
    ...checkAuditability(loaded),
    ...checkCompliance(loaded),
    ...checkConsistency(loaded.doc.domain_key)
  ]);

  return { document: loaded.doc, findings, score: scoreOf(findings) };
}

/** Domain-wide review across every document in the domain. */
export function reviewDomain(domainKey) {
  const docs = q.all("SELECT * FROM documents WHERE domain_key = ? AND status != 'retired'", domainKey);
  let findings = [...checkConsistency(domainKey)];
  for (const d of docs) {
    const loaded = loadDocument(d.id);
    findings.push(
      ...checkCompleteness(loaded),
      ...checkAmbiguity(loaded),
      ...checkAccountability(loaded)
    );
  }
  if (docs.length) {
    findings.push(...checkAuditability({ doc: docs[0] }), ...checkCompliance({ doc: docs[0] }));
  }
  findings = dedupe(findings);
  return { domainKey, documents: docs.length, findings, score: scoreOf(findings) };
}

const SEVERITY_WEIGHT = { critical: 25, high: 12, medium: 5, low: 2, info: 0 };

/** 0–100 readiness score. Deterministic, so it can be trended. */
export function scoreOf(findings) {
  const penalty = findings.reduce((acc, f) => acc + (SEVERITY_WEIGHT[f.severity] || 0), 0);
  const score = Math.max(0, 100 - penalty);
  const byCategory = {};
  for (const f of findings) byCategory[f.category] = (byCategory[f.category] || 0) + 1;
  const bySeverity = {};
  for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  return { score, penalty, byCategory, bySeverity, total: findings.length };
}
