/**
 * Risk scoring.
 *
 * A 5x5 likelihood-by-impact matrix, which is what ISO/IEC 27005 and every
 * Saudi regulator's reporting template expect to see. The bands are stated
 * here once so the register, the dashboard, the treatment plan and the
 * exports all read the same number the same way.
 */

export const LIKELIHOOD_SCALE = [
  { value: 1, label: 'Rare', description: 'Would be surprising; no known occurrence in the sector.' },
  { value: 2, label: 'Unlikely', description: 'Possible but not expected within the planning horizon.' },
  { value: 3, label: 'Possible', description: 'Has happened to comparable organisations.' },
  { value: 4, label: 'Likely', description: 'Expected at least once a year without effective control.' },
  { value: 5, label: 'Almost certain', description: 'Occurring now, or expected repeatedly.' }
];

export const IMPACT_SCALE = [
  { value: 1, label: 'Insignificant', description: 'Absorbed within normal operations.' },
  { value: 2, label: 'Minor', description: 'Local disruption; no regulatory or customer consequence.' },
  { value: 3, label: 'Moderate', description: 'Service degradation, internal escalation, recoverable loss.' },
  { value: 4, label: 'Major', description: 'Regulatory notification, material loss, customer harm.' },
  { value: 5, label: 'Severe', description: 'Licence, solvency or public-confidence consequence.' }
];

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
export function rating(likelihood, impact) {
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
  return {
    ...row,
    inherent,
    residual,
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
        const p = position === 'inherent' ? r.inherent : r.residual;
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
