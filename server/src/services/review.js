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

/**
 * The same vocabulary in Arabic.
 *
 * Without it the engine would read an Arabic document, find none of the terms
 * it knows, and report no findings — which reads as "these documents agree"
 * when it means "nothing was checked". That is the worst answer a consistency
 * engine can give, so Arabic frequencies and durations are recognised and
 * mapped to the same canonical values as their English equivalents.
 */
const AR_FREQUENCY_TERMS = {
  'مستمر': 'continuous', 'بشكل مستمر': 'continuous', 'آني': 'continuous', 'الوقت الفعلي': 'continuous',
  'كل ساعة': 'hourly', 'ساعي': 'hourly',
  'يومي': 'daily', 'يومياً': 'daily', 'كل يوم': 'daily',
  'أسبوعي': 'weekly', 'أسبوعياً': 'weekly', 'كل أسبوع': 'weekly',
  'نصف شهري': 'fortnightly', 'كل أسبوعين': 'fortnightly',
  'شهري': 'monthly', 'شهرياً': 'monthly', 'كل شهر': 'monthly',
  'كل شهرين': 'bi-monthly',
  'ربع سنوي': 'quarterly', 'ربع سنوياً': 'quarterly', 'كل ثلاثة أشهر': 'quarterly', 'فصلي': 'quarterly',
  'نصف سنوي': 'semi-annually', 'نصف سنوياً': 'semi-annually', 'كل ستة أشهر': 'semi-annually',
  'سنوي': 'annually', 'سنوياً': 'annually', 'كل سنة': 'annually', 'كل عام': 'annually',
  'كل سنتين': 'biennially',
  'كل وردية': 'every shift', 'عند الطلب': 'per request', 'لكل طلب': 'per request',
  'عند كل حدث': 'per event', 'لكل حدث': 'per event'
};

/** Arabic-Indic digits, so "٩٠ يوماً" is read as ninety days. */
const AR_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };

const AR_DURATION_UNITS = {
  'دقيقة': 'minute', 'دقائق': 'minute',
  'ساعة': 'hour', 'ساعات': 'hour',
  'يوم عمل': 'business day', 'أيام عمل': 'business day',
  'يوم': 'day', 'يوماً': 'day', 'أيام': 'day',
  'أسبوع': 'week', 'أسابيع': 'week',
  'شهر': 'month', 'شهراً': 'month', 'أشهر': 'month', 'شهور': 'month',
  'سنة': 'year', 'سنوات': 'year', 'عام': 'year', 'أعوام': 'year'
};

// Longest first, so "يوم عمل" is matched before "يوم".
const AR_DURATION_RE = new RegExp(
  `([0-9٠-٩]+)\\s*(${Object.keys(AR_DURATION_UNITS).sort((a, b) => b.length - a.length).join('|')})`,
  'g'
);

function arabicDigitsToLatin(text) {
  return String(text).replace(/[٠-٩]/g, (d) => AR_DIGITS[d] ?? d);
}

/** True when a string carries Arabic script, used to pick the vocabulary. */
export function hasArabic(text) {
  return /[\u0600-\u06FF]/.test(String(text || ''));
}

/**
 * Words that only ever describe the shape of a parameter, never its subject.
 * Stripping these leaves the topic; stripping subject words as well (policy,
 * committee, retention) would reduce a parameter to a single generic term
 * such as "review", which then matches any sentence containing that word.
 */
const SUFFIX_WORDS = new Set([
  'frequency', 'sla', 'target', 'default', 'max', 'duration', 'threshold',
  'requirement', 'requirements', 'method', 'type', 'types', 'mode', 'value', 'level'
]);

/** accessReviewFrequency -> ['access','review'] */
function topicWords(paramName) {
  return paramName
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !SUFFIX_WORDS.has(w));
}

/**
 * Match a topic word at a word boundary, allowing an inflected ending.
 * A plain substring test would match "priv" inside "privileged" wherever it
 * appeared, pulling in sentences about an unrelated subject.
 */
function mentions(sentence, word) {
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(sentence);
}

/**
 * Arabic subjects for the parameters this check compares.
 *
 * The English path derives a topic from the parameter name —
 * accessReviewFrequency gives "access review" — and requires every word in the
 * sentence. There is nothing to derive from for Arabic: an Arabic sentence
 * contains no English word, so the check simply never matched one. It appeared
 * to work only because the Arabic Procedure still carried English prose, and
 * the moment that prose was translated the engine would have gone quiet on
 * Arabic documents without reporting anything. A contradiction nobody hears
 * about is the worst failure this engine has, so the subjects are written out.
 *
 * Terms are stems, matched after normalisation and as substrings, because
 * Arabic attaches the article and prepositions to the word: مراجعة, المراجعة
 * and بمراجعة are one word for this purpose. All of a parameter's terms must
 * appear, which is what keeps "مراجعة الوصول" apart from "مراجعة الأصول".
 */
const AR_PARAMETER_TOPICS = {
  // identity and access. "راجع" rather than "مراجع" because the same statement
  // appears as a noun (مراجعة الوصول) and as a passive verb (تُراجَع), and a
  // stem that only matched the noun would miss half the corpus.
  accessReviewFrequency: ['راجع', 'وصول'],
  privAccessReviewFrequency: ['راجع', 'وصول', 'ممتاز'],
  serviceAccountReviewFrequency: ['راجع', 'حساب', 'خدم'],
  accountLockoutDuration: ['حساب', 'اغلاق'],
  dormantAccountThreshold: ['حساب', 'خامد'],
  sessionIdleTimeout: ['جلس', 'خمول'],
  // vulnerabilities
  criticalRemediationSla: ['عالج', 'حرج'],
  highRemediationSla: ['عالج', 'عالي'],
  mediumRemediationSla: ['عالج', 'متوسط'],
  lowRemediationSla: ['عالج', 'منخفض'],
  emergencyPatchSla: ['ثغر', 'مستغل'],
  internalScanFrequency: ['فحص', 'داخلي'],
  externalScanFrequency: ['فحص', 'خارجي'],
  authenticatedScanFrequency: ['فحص', 'مصادق'],
  // incidents
  regulatoryNotificationSla: ['شعار', 'تنظيمي'],
  lessonsLearnedSla: ['راجع', 'بعد الحادث'],
  irPlanTestFrequency: ['خطة', 'استجاب', 'ختبر'],
  evidenceRetention: ['حتفاظ', 'دلة'],
  postIncidentActionSla: ['جراء', 'بعد الحادث'],
  // assets
  inventoryReviewFrequency: ['سجل', 'صديق'],
  // "اصول" and not "اصل": the plural drops the lam of the singular stem, and
  // the shorter "صول" would also match الوصول, an unrelated subject.
  unauthorisedAssetSla: ['اصول', 'غير المصرح'],
  // third parties. The supplier is المورّد throughout; مزوّد is reserved for a
  // provider of something other than the contracted service, such as the
  // identity provider, so it is not a term for this subject.
  dueDiligenceValidity: ['عناي', 'واجب'],
  criticalSupplierReviewFrequency: ['مورد', 'حرج'],
  supplierIncidentNotificationSla: ['مورد', 'حادث'],
  dataReturnSla: ['بيانات', 'عاد']
};

/**
 * Fold the spellings that carry no meaning for matching.
 *
 * Generated Arabic uses diacritics where they disambiguate a verb — مُمتاز,
 * يُراجَع — and a stem written without them would never match. Alef and yeh
 * variants are folded for the same reason: it is one word spelled two ways,
 * not two words.
 */
function normaliseArabic(text) {
  return String(text || '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[\u0622\u0623\u0625]/g, '\u0627')
    .replace(/\u0649/g, '\u064A')
    .replace(/\u0629/g, '\u0647');
}

/** True when every Arabic subject term for the parameter is present. */
function mentionsArabic(sentence, terms) {
  const text = normaliseArabic(sentence);
  return terms.every((term) => text.includes(normaliseArabic(term)));
}

/**
 * The Arabic subjects for a parameter, or null when it has none.
 * Null means the sentence cannot be attributed, so nothing is asserted about
 * it — silence here is the only honest answer, and `arabicTopicGaps` reports
 * which parameters are in that position so it never passes unnoticed.
 */
export function arabicTopicsFor(paramName) {
  return AR_PARAMETER_TOPICS[paramName] ?? null;
}

function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[.;:])\s+|\n+/)
    .map((s) => s.trim())
    // htmlToText renders table cells tab-separated. A control-matrix row
    // listing one control's frequency is an attribute listing, not a
    // statement of commitment, so comparing it against a parameter produces
    // false conflicts. Analyse prose only.
    .filter((s) => s.length > 15 && !s.includes('\t'));
}

export function frequenciesIn(sentence) {
  const lower = sentence.toLowerCase();
  const found = new Set();
  for (const term of FREQUENCY_TERMS) {
    // The leading guard stops "semi-annually" from also registering as
    // "annually", which would make a correct document look self-contradictory.
    const re = new RegExp(`(?<![\\w-])${term.replace(/[-\s]/g, '[-\\s]')}\\b`, 'i');
    if (re.test(lower)) found.add(FREQUENCY_CANON[term]);
  }

  if (hasArabic(sentence)) {
    // "نصف سنوي" contains "سنوي", so matching the shorter term inside the
    // longer one would turn a correct semi-annual commitment into an apparent
    // annual contradiction. The English path avoids that with a lookbehind,
    // which is positional; this does the same by consuming each match from the
    // text, longest first. Suppressing the short term globally instead would
    // lose a genuine second frequency in a sentence that states both — the
    // opposite error, and a worse one, because a missed contradiction is a
    // contradiction the reader never hears about.
    let remaining = sentence;
    for (const term of Object.keys(AR_FREQUENCY_TERMS).sort((a, b) => b.length - a.length)) {
      if (!remaining.includes(term)) continue;
      found.add(AR_FREQUENCY_TERMS[term]);
      // Blank out only the occurrences of this term, leaving everything else
      // available to the shorter terms that follow.
      remaining = remaining.split(term).join(' '.repeat(term.length));
    }
  }
  return [...found];
}

export function durationsIn(sentence) {
  const out = [];
  let m;
  const re = new RegExp(DURATION_RE.source, 'gi');
  while ((m = re.exec(sentence))) {
    const unit = m[2].toLowerCase().replace(/s$/, '');
    out.push({ value: Number(m[1]), unit: unit.replace(/^business day$/, 'business day'), text: m[0] });
  }

  if (hasArabic(sentence)) {
    const arabic = new RegExp(AR_DURATION_RE.source, 'g');
    while ((m = arabic.exec(sentence))) {
      out.push({
        value: Number(arabicDigitsToLatin(m[1])),
        unit: AR_DURATION_UNITS[m[2]],
        text: m[0]
      });
    }
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

/**
 * Parameters a translated domain compares across documents but has no Arabic
 * subject for, so Arabic prose about them is never attributed.
 *
 * Exported so the test suite can assert the list is empty: the engine going
 * quiet on Arabic is exactly the failure that is invisible from the outside,
 * and a passing consistency check on documents nothing was compared in would
 * read as a clean bill of health.
 */
export function arabicTopicGaps(domainKey) {
  const model = DOMAIN_MODELS[domainKey];
  if (!model) return [];
  const gaps = [];
  for (const [paramName, rawValue] of Object.entries(model.parameters)) {
    if (topicWords(paramName).length < 2) continue;
    const value = String(rawValue);
    if (!frequenciesIn(value).length && !durationsIn(value).length) continue;
    if (!arabicTopicsFor(paramName)) gaps.push(paramName);
  }
  return gaps;
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
    // A single-word topic cannot be matched precisely enough to assert a
    // conflict, so those parameters are not compared across documents.
    if (words.length < 2) continue;
    // The Arabic subject is written out rather than derived; without one an
    // Arabic sentence cannot be attributed to this parameter at all.
    const arabicTerms = arabicTopicsFor(paramName);

    const expectedFreq = frequenciesIn(value);
    const expectedDur = durationsIn(value);
    if (!expectedFreq.length && !expectedDur.length) continue;

    const observations = [];
    for (const { doc, sections } of corpus) {
      for (const s of sections) {
        const text = htmlToText(s.body);
        for (const sentence of splitSentences(text)) {
          // Every topic word must appear. Requiring only some of them lets
          // "service account review" match a sentence about "accountable"
          // reviewers, and lets the privileged-access parameter match any
          // sentence about access review. Arabic is matched the same way
          // against its own written-out subject; a parameter with none is not
          // compared against Arabic prose rather than compared wrongly.
          const arabic = hasArabic(sentence);
          if (arabic && !arabicTerms) continue;
          if (arabic
            ? !mentionsArabic(sentence, arabicTerms)
            : !words.every((w) => mentions(sentence, w))) continue;

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
