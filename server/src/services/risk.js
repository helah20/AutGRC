/**
 * Risk scoring.
 *
 * A 5x5 likelihood-by-impact matrix, which is what ISO/IEC 27005 and every
 * Saudi regulator's reporting template expect to see. The bands are stated
 * here once so the register, the dashboard, the treatment plan and the
 * exports all read the same number the same way.
 */

export const DEFAULT_LIKELIHOOD_SCALE = [
  { value: 1, label: 'Rare', label_ar: 'نادر', description: 'Would be surprising; no known occurrence in the sector.', description_ar: 'سيكون مفاجئاً؛ لا وقوع معروف في القطاع.' },
  { value: 2, label: 'Unlikely', label_ar: 'غير مرجّح', description: 'Possible but not expected within the planning horizon.', description_ar: 'ممكن لكنه غير متوقع خلال أفق التخطيط.' },
  { value: 3, label: 'Possible', label_ar: 'محتمل', description: 'Has happened to comparable organisations.', description_ar: 'وقع لدى جهات مماثلة.' },
  { value: 4, label: 'Likely', label_ar: 'مرجّح', description: 'Expected at least once a year without effective control.', description_ar: 'متوقع مرة في السنة على الأقل دون ضابط فعّال.' },
  { value: 5, label: 'Almost certain', label_ar: 'شبه مؤكد', description: 'Occurring now, or expected repeatedly.', description_ar: 'يحدث الآن، أو متوقع تكراره.' }
];

export const DEFAULT_IMPACT_SCALE = [
  { value: 1, label: 'Insignificant', label_ar: 'ضئيل', description: 'Absorbed within normal operations.', description_ar: 'يُستوعب ضمن العمليات المعتادة.' },
  { value: 2, label: 'Minor', label_ar: 'طفيف', description: 'Local disruption; no regulatory or customer consequence.', description_ar: 'تعطّل محلي؛ دون أثر تنظيمي أو على العملاء.' },
  { value: 3, label: 'Moderate', label_ar: 'متوسط', description: 'Service degradation, internal escalation, recoverable loss.', description_ar: 'تراجع في الخدمة وتصعيد داخلي وخسارة قابلة للاسترداد.' },
  { value: 4, label: 'Major', label_ar: 'كبير', description: 'Regulatory notification, material loss, customer harm.', description_ar: 'إبلاغ تنظيمي وخسارة جوهرية وضرر للعملاء.' },
  { value: 5, label: 'Severe', label_ar: 'جسيم', description: 'Licence, solvency or public-confidence consequence.', description_ar: 'أثر على الترخيص أو الملاءة أو ثقة الجمهور.' }
];

// The scales in use: the defaults until the organisation's methodology is
// loaded (services/risk-methodology.js), then the organisation's wording.
export let LIKELIHOOD_SCALE = DEFAULT_LIKELIHOOD_SCALE;
export let IMPACT_SCALE = DEFAULT_IMPACT_SCALE;

export const RATINGS = ['low', 'medium', 'high', 'critical'];

/**
 * How effective the controls already in place are. The same four levels
 * describe a control's design and its operation, and the controls a risk
 * relies on.
 */
export const EFFECTIVENESS = ['not_assessed', 'ineffective', 'partially_effective', 'effective'];

export const TREATMENTS = {
  mitigate: 'Reduce the risk by applying or strengthening controls.',
  accept: 'Take the risk knowingly, with a named accountable owner and an expiry.',
  transfer: 'Share the consequence with a third party, by insurance or contract.',
  avoid: 'Stop or change the activity that gives rise to the risk.'
};

export function score(likelihood, impact) {
  return Number(likelihood) * Number(impact);
}

/**
 * Bands for a 1-25 score.
 *
 * Mostly the conventional 5x5 split, with one deliberate asymmetry: a severe
 * impact never bands below high, however unlikely, because a straight product
 * would file a solvency event at 1x5 alongside a printer outage.
 *
 * The thresholds are set so that a rating carried over from the knowledge base
 * round-trips: a requirement the model calls medium risk produces a medium
 * risk in the register, not a high one. A register that inflates every entry
 * by a band is a register nobody believes.
 */
export function defaultRating(likelihood, impact) {
  const l = Number(likelihood);
  const i = Number(impact);
  const product = l * i;
  if (i === 5 && l >= 4) return 'critical';
  if (product >= 16) return 'critical';
  if (i === 5) return 'high';
  if (product >= 11) return 'high';
  if (product >= 5) return 'medium';
  return 'low';
}

/** The default matrix, impact by likelihood: DEFAULT_MATRIX[impact - 1][likelihood - 1]. */
export const DEFAULT_MATRIX = [1, 2, 3, 4, 5].map((i) => [1, 2, 3, 4, 5].map((l) => defaultRating(l, i)));

// The methodology in use, replaced as a whole when the organisation's is loaded.
let active = {
  matrix: DEFAULT_MATRIX,
  effectivenessReduction: { not_assessed: null, ineffective: 0, partially_effective: 1, effective: 2 },
  reviewDays: { critical: 30, high: 90, medium: 180, low: 365 },
  acceptableUpTo: 'high'
};

/** Put a (validated) methodology into use. Called by services/risk-methodology.js. */
export function applyMethodology(methodology) {
  active = methodology;
  LIKELIHOOD_SCALE = methodology.likelihood;
  IMPACT_SCALE = methodology.impact;
}

/** The rating of a cell, read from the organisation's matrix. */
export function rating(likelihood, impact) {
  const l = Math.min(Math.max(Number(likelihood) || 1, 1), 5);
  const i = Math.min(Math.max(Number(impact) || 1, 1), 5);
  return active.matrix[i - 1][l - 1];
}

/** Whether a residual rating is within what the organisation may accept. */
export function acceptable(ratingKey) {
  return RATINGS.indexOf(ratingKey) <= RATINGS.indexOf(active.acceptableUpTo);
}

/** The next review date for a risk of this rating, counted from `from`. */
export function nextReviewDate(ratingKey, from = new Date()) {
  const days = active.reviewDays[ratingKey] ?? 180;
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The current position: the inherent position with the controls already in
 * place taken into account. Controls reduce how likely the event is, not
 * what it does when it happens, so the likelihood steps down by the number
 * of levels the methodology gives that effectiveness; the impact stays.
 * Null while the controls' effectiveness has not been assessed.
 */
export function currentPosition(row) {
  const steps = active.effectivenessReduction[row.control_effectiveness];
  if (steps === null || steps === undefined) return null;
  return describe(Math.max(1, Number(row.inherent_likelihood) - steps), row.inherent_impact);
}

/**
 * The effectiveness a risk's controls suggest, from their assessed operating
 * effectiveness: the weakest assessed control decides, since a risk is only
 * as well treated as the control that fails first. Null when none is assessed.
 */
export function suggestedEffectiveness(controls) {
  const assessed = controls.map((c) => c.operating_effectiveness).filter((e) => e && e !== 'not_assessed');
  if (!assessed.length) return null;
  return assessed.reduce((worst, e) => (EFFECTIVENESS.indexOf(e) < EFFECTIVENESS.indexOf(worst) ? e : worst));
}

export function describe(likelihood, impact) {
  return {
    likelihood: Number(likelihood),
    impact: Number(impact),
    score: score(likelihood, impact),
    rating: rating(likelihood, impact),
    likelihoodLabel: LIKELIHOOD_SCALE.find((s) => s.value === Number(likelihood))?.label || null,
    impactLabel: IMPACT_SCALE.find((s) => s.value === Number(impact))?.label || null
  };
}

/**
 * The starting position for a risk derived from a canonical requirement.
 *
 * The knowledge base states a qualitative rating per requirement; this turns
 * it into a likelihood and impact pair so the register has somewhere to begin.
 * It is an assumption, not an assessment: every risk seeded this way carries
 * ai_recommendation provenance and residual_assessed = 0, and the register
 * says so rather than letting a starting guess read as a considered position.
 */
const STARTING_POSITION = {
  critical: { likelihood: 4, impact: 5 },
  high: { likelihood: 3, impact: 4 },
  medium: { likelihood: 3, impact: 3 },
  low: { likelihood: 2, impact: 2 }
};

export function startingPosition(riskRating) {
  return STARTING_POSITION[riskRating] || STARTING_POSITION.medium;
}

/** Enrich a stored row for the client: both positions, and the movement. */
export function enrichRisk(row) {
  if (!row) return null;
  const inherent = describe(row.inherent_likelihood, row.inherent_impact);
  const residual = describe(row.residual_likelihood, row.residual_impact);
  const current = currentPosition(row);
  return {
    ...row,
    inherent,
    current,
    residual,
    // A residual rating above the organisation's appetite cannot be accepted:
    // it has to be treated further.
    withinAppetite: acceptable(residual.rating),
    residual_assessed: Boolean(row.residual_assessed),
    // Null until somebody has actually assessed the residual position, so the
    // dashboard cannot report a reduction that nobody has worked out.
    reduction: row.residual_assessed ? inherent.score - residual.score : null,
    accepted: Boolean(row.accepted_at),
    acceptanceExpired: Boolean(
      row.acceptance_expires && new Date(row.acceptance_expires) < new Date()
    )
  };
}

/** The 5x5 grid, with the risks that fall in each cell. */
export function buildMatrix(risks, { position = 'residual' } = {}) {
  const cells = [];
  for (let impact = 5; impact >= 1; impact -= 1) {
    for (let likelihood = 1; likelihood <= 5; likelihood += 1) {
      const inCell = risks.filter((r) => {
        // A risk whose controls are unassessed sits at its inherent position
        // on the current view: nothing has yet been shown to reduce it.
        const p = position === 'inherent' ? r.inherent : position === 'current' ? (r.current || r.inherent) : r.residual;
        return p.likelihood === likelihood && p.impact === impact;
      });
      cells.push({
        likelihood,
        impact,
        rating: rating(likelihood, impact),
        count: inCell.length,
        risks: inCell.map((r) => ({ id: r.id, risk_id: r.risk_id, title: r.title }))
      });
    }
  }
  return cells;
}
