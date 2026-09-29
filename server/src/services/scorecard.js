/**
 * Governance quality scorecard.
 *
 * The quality engine already produces a 0-100 readiness score. One number
 * answers "is this ready" and nothing else: a domain losing 20 points because
 * nobody is accountable for anything reads exactly like a domain losing 20
 * points because two review frequencies disagree, and those need different
 * people to fix them.
 *
 * This translates the same findings into the five-criterion structure used by
 * the expert evaluation in Alharthi et al., "Automating Cybersecurity
 * Governance" (Grant CRPG-25-1063), section 5.6, page 19: Policy Alignment,
 * Clarity of Roles and Responsibilities, Applicability and Ease of
 * Implementation, Governance and Compliance Level, and Completeness of
 * Controls and Procedures. That paper's Table 8 (page 28) is the argument for
 * doing it: at the aggregate its system scored 3.67 of 5, which says nothing,
 * while at criterion level Applicability and Governance & Compliance sat at
 * 3.55 and Role Clarity at 3.82 — a profile that tells a reader where to look.
 *
 * What this is NOT: the paper's five scores are three human experts' opinions
 * on a Likert scale. These are deterministic penalty bands derived from
 * rule-based checks. The rubric is borrowed as a *reporting structure* because
 * it is the vocabulary a GRC reviewer already uses; the measurement is the
 * platform's own and is labelled as such everywhere it is shown. Human ratings
 * against the same five criteria are recorded separately, per reviewer, in
 * `document_reviews` — see `assessmentOf`.
 */

import { q } from '../db/index.js';

/**
 * Every finding category the engine and the import analyser can emit is
 * assigned to exactly one criterion. A category mapped to nothing would
 * silently stop counting, which is the failure mode this whole file exists to
 * avoid, so `scorecard()` reports leftovers rather than dropping them and
 * `scorecard.test.js` asserts there are none.
 */
export const CRITERIA = [
  {
    key: 'policy_alignment',
    short: 'PA',
    label: 'Policy Alignment',
    question: 'Do the adopted framework requirements have organisational controls behind them?',
    categories: ['compliance']
  },
  {
    key: 'role_clarity',
    short: 'RC',
    label: 'Role Clarity',
    question: 'Is every activity accountable to exactly one role, and every document owned?',
    categories: ['accountability', 'ownership']
  },
  {
    key: 'applicability',
    short: 'AP',
    label: 'Applicability',
    question: 'Are the obligations measurable, and do the documents agree on them?',
    categories: ['ambiguity', 'consistency', 'duplication']
  },
  {
    key: 'governance_compliance',
    short: 'GC',
    label: 'Governance and Compliance',
    question: 'Can each control be evidenced, and is the document itself under control?',
    categories: ['auditability', 'currency']
  },
  {
    key: 'control_completeness',
    short: 'CC',
    label: 'Completeness of Controls',
    question: 'Are the required sections present and populated?',
    categories: ['completeness']
  }
];

const CATEGORY_TO_CRITERION = new Map(
  CRITERIA.flatMap((c) => c.categories.map((cat) => [cat, c.key]))
);

/** Same weights as the 0-100 score, so the two numbers cannot disagree. */
const SEVERITY_WEIGHT = { critical: 25, high: 12, medium: 5, low: 2, info: 0 };

/**
 * Penalty per document to a 1-5 band.
 *
 * Divided by the document count first: a domain with eight documents
 * accumulates eight documents' worth of findings, and a band that punished
 * size would make a complete governance chain score worse than a lone policy.
 * The 0-100 score has that property and is read as a per-domain readiness
 * figure; this one is meant to be comparable across domains and over time.
 */
const BANDS = [
  { upTo: 0, band: 5 },
  { upTo: 5, band: 4 },
  { upTo: 15, band: 3 },
  { upTo: 30, band: 2 }
];

function bandFor(penaltyPerDocument) {
  for (const b of BANDS) if (penaltyPerDocument <= b.upTo) return b.band;
  return 1;
}

/**
 * Key risk indicators on the scorecard itself.
 *
 * These thresholds are the platform's proposal, not a requirement of any
 * framework and not a finding of the paper. The paper's contribution here is
 * narrower and worth stating exactly: it showed that criterion-level scores
 * separate outputs that an aggregate does not, and that its own best
 * configuration still sat near 3.5 on Applicability and Governance &
 * Compliance (Table 8, page 28). That is why a floor is set per criterion
 * rather than on the average — an organisation may raise or lower it.
 */
export const KRI_THRESHOLDS = {
  /** A criterion at this band or below is a breach of the indicator. */
  breachAtOrBelow: 2,
  /** A criterion at this band is within tolerance but trending wrong. */
  attentionAt: 3,
  /**
   * Spread between the highest and lowest human rating of one criterion at
   * which the reviewers are taken to disagree materially rather than to be
   * rounding differently. On a five-point scale a range of 2 is the point at
   * which two reviewers have placed the same document in different halves of
   * the scale.
   */
  reviewerRange: 2
};

function statusFor(band) {
  if (band <= KRI_THRESHOLDS.breachAtOrBelow) return 'breach';
  if (band <= KRI_THRESHOLDS.attentionAt) return 'attention';
  return 'ok';
}

/**
 * Build the scorecard from a finding list.
 *
 * `documents` is the number of documents the findings were drawn from, so a
 * domain review normalises and a single-document review does not.
 */
export function scorecard(findings, { documents = 1 } = {}) {
  const divisor = Math.max(1, Number(documents) || 1);
  const perCriterion = new Map(CRITERIA.map((c) => [c.key, { penalty: 0, findings: 0 }]));
  const unmapped = new Map();

  for (const f of findings) {
    const weight = SEVERITY_WEIGHT[f.severity] || 0;
    const key = CATEGORY_TO_CRITERION.get(f.category);
    if (!key) {
      const seen = unmapped.get(f.category) || { category: f.category, findings: 0, penalty: 0 };
      seen.findings += 1;
      seen.penalty += weight;
      unmapped.set(f.category, seen);
      continue;
    }
    const acc = perCriterion.get(key);
    acc.penalty += weight;
    acc.findings += 1;
  }

  const criteria = CRITERIA.map((c) => {
    const acc = perCriterion.get(c.key);
    const perDocument = Math.round((acc.penalty / divisor) * 100) / 100;
    const band = bandFor(perDocument);
    return {
      key: c.key,
      short: c.short,
      label: c.label,
      question: c.question,
      categories: c.categories,
      findings: acc.findings,
      penalty: acc.penalty,
      // Reported so the band is inspectable rather than asserted: this is the
      // figure the band is read from, and the 0-100 score is the domain total.
      penaltyPerDocument: perDocument,
      band,
      status: statusFor(band)
    };
  });

  const overall = Math.round((criteria.reduce((a, c) => a + c.band, 0) / criteria.length) * 100) / 100;
  // Reported so a reader can see which criterion to argue about first. Ties go
  // to the earlier criterion, which is stable rather than meaningful.
  const weakest = criteria.reduce((a, c) => (c.band < a.band ? c : a), criteria[0]);

  return {
    basis: 'engine',
    documents: divisor,
    criteria,
    overall,
    weakest: weakest.band < 5 ? weakest.key : null,
    breaches: criteria.filter((c) => c.status === 'breach').map((c) => c.key),
    attention: criteria.filter((c) => c.status === 'attention').map((c) => c.key),
    unmapped: [...unmapped.values()]
  };
}

// -------------------------------------------------- human reviewer ratings --


/** Column name per criterion, in the order the rubric lists them. */
const SCORE_COLUMNS = CRITERIA.map((c) => c.key);

function mean(values) {
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

/**
 * The reviewer panel's assessment of one document, with the disagreement left
 * in.
 *
 * Ratings are read for the document's current version only. A rating given
 * against wording that has since been rewritten is history: showing it as the
 * panel's current view would attribute an opinion to someone who never held it
 * about this text.
 */
export function assessmentOf(documentId) {
  const doc = q.get('SELECT id, version FROM documents WHERE id = ?', documentId);
  if (!doc) return null;

  const rows = q.all(
    `SELECT * FROM document_reviews
      WHERE document_id = ? AND document_version = ?
      ORDER BY created_at`,
    documentId, doc.version
  );

  const reviewers = rows.map((r) => ({
    id: r.id,
    reviewerId: r.reviewer_id,
    reviewerName: r.reviewer_name,
    reviewerRole: r.reviewer_role,
    scores: Object.fromEntries(SCORE_COLUMNS.map((k) => [k, r[k]])),
    total: SCORE_COLUMNS.reduce((a, k) => a + r[k], 0),
    comment: r.comment,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));

  if (!reviewers.length) {
    return {
      basis: 'reviewers', version: doc.version, panelSize: 0,
      reviewers: [], criteria: [], overall: null, meanTotal: null,
      divergence: { material: false, maxRange: 0, criteria: [] }
    };
  }

  const criteria = CRITERIA.map((c) => {
    const values = reviewers.map((r) => r.scores[c.key]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    return {
      key: c.key,
      short: c.short,
      label: c.label,
      mean: mean(values),
      min,
      max,
      range,
      // A single rating has a range of zero. That is not agreement, and
      // calling it agreement is exactly the overstatement the paper's Table 9
      // warns about, so divergence is only asserted with a panel.
      diverges: reviewers.length > 1 && range >= KRI_THRESHOLDS.reviewerRange
    };
  });

  const diverging = criteria.filter((c) => c.diverges);

  return {
    basis: 'reviewers',
    version: doc.version,
    panelSize: reviewers.length,
    reviewers,
    criteria,
    overall: mean(criteria.map((c) => c.mean)),
    meanTotal: mean(reviewers.map((r) => r.total)),
    divergence: {
      material: diverging.length > 0,
      maxRange: Math.max(...criteria.map((c) => c.range)),
      criteria: diverging.map((c) => c.key)
    }
  };
}

/**
 * Engine band beside reviewer mean, per criterion.
 *
 * The two are different measurements of the same thing and are not expected to
 * be equal — the engine can only see what a rule can express, and a reviewer
 * can see whether the policy suits the organisation. The reason to put them
 * side by side is that a large gap is informative in both directions: the
 * engine passing a criterion the panel failed means a rule is missing, and the
 * panel passing one the engine failed means the rule is firing on something
 * that does not matter to a reader.
 *
 * The paper ran the equivalent comparison between its expert panel and its
 * automated evaluator and found the two ranked outputs similarly (Spearman's
 * rho = 0.782, exact permutation p = 0.0476, section 6.7, page 30). That was
 * seven matched outputs and the authors describe it as exploratory, so it is
 * cited here as a reason to keep both measurements rather than as evidence
 * that either can stand in for the other.
 */
export function compareBases(engine, assessment) {
  if (!engine || !assessment || !assessment.panelSize) return null;
  const byKey = new Map(assessment.criteria.map((c) => [c.key, c]));
  const criteria = engine.criteria.map((c) => {
    const human = byKey.get(c.key);
    const delta = human ? Math.round((c.band - human.mean) * 100) / 100 : null;
    return {
      key: c.key,
      short: c.short,
      label: c.label,
      engineBand: c.band,
      reviewerMean: human ? human.mean : null,
      delta,
      // Two bands apart is the engine and the panel placing the same document
      // in different halves of the scale, the same threshold used for
      // disagreement between reviewers.
      material: delta !== null && Math.abs(delta) >= KRI_THRESHOLDS.reviewerRange
    };
  });
  return {
    criteria,
    engineOverall: engine.overall,
    reviewerOverall: assessment.overall,
    material: criteria.filter((c) => c.material).map((c) => c.key)
  };
}
