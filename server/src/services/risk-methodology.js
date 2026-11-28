/**
 * The organisation's risk methodology and reminder schedule.
 *
 * The register scores every risk on a 5×5 likelihood-by-impact matrix. What
 * each level means, which rating each cell carries, how high a residual
 * rating may be and still be accepted, how often a risk of each rating is
 * reviewed, and how far each level of control effectiveness lowers the
 * likelihood are the organisation's decisions, made once by an administrator
 * and applied everywhere the register is read. Nothing here is a formula the
 * platform invents: the defaults are the conventional matrix, and every value
 * can be changed.
 */

import { q, toJson, fromJson } from '../db/index.js';
import {
  DEFAULT_LIKELIHOOD_SCALE, DEFAULT_IMPACT_SCALE, DEFAULT_MATRIX, RATINGS, applyMethodology
} from './risk.js';

export const DEFAULT_METHODOLOGY = {
  likelihood: DEFAULT_LIKELIHOOD_SCALE,
  impact: DEFAULT_IMPACT_SCALE,
  // matrix[impact - 1][likelihood - 1]
  matrix: DEFAULT_MATRIX,
  // The highest residual rating that may be formally accepted; above it the
  // risk has to be treated further.
  acceptableUpTo: 'high',
  // Days between reviews of a risk, by its residual rating.
  reviewDays: { critical: 30, high: 90, medium: 180, low: 365 },
  // Levels of likelihood the controls already in place remove, by their
  // effectiveness. Not assessed gives no current position.
  effectivenessReduction: { not_assessed: null, ineffective: 0, partially_effective: 1, effective: 2 }
};

export const DEFAULT_AUTOMATION = {
  // Days before a deadline at which its owner is reminded.
  reminderDays: [30, 15, 5],
  // Days past a deadline after which overdue work is escalated.
  escalateAfterDays: 3
};

const clampInt = (v, min, max, fallback) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};
const text = (v, fallback, max = 300) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback);

/** A complete, valid methodology from whatever was stored or sent. */
export function normaliseMethodology(input = {}) {
  const m = input && typeof input === 'object' ? input : {};
  const scale = (given, defaults) => defaults.map((d, i) => {
    const g = Array.isArray(given) ? given[i] || {} : {};
    return {
      value: d.value,
      label: text(g.label, d.label, 40), label_ar: text(g.label_ar, d.label_ar, 40),
      description: text(g.description, d.description), description_ar: text(g.description_ar, d.description_ar)
    };
  });
  const matrix = DEFAULT_MATRIX.map((row, i) => row.map((cell, l) => {
    const given = Array.isArray(m.matrix) && Array.isArray(m.matrix[i]) ? m.matrix[i][l] : undefined;
    return RATINGS.includes(given) ? given : cell;
  }));
  const reviewDays = Object.fromEntries(RATINGS.map((r) => [r, clampInt(m.reviewDays?.[r], 1, 1095, DEFAULT_METHODOLOGY.reviewDays[r])]));
  const effectivenessReduction = {
    not_assessed: null,
    ineffective: clampInt(m.effectivenessReduction?.ineffective, 0, 4, 0),
    partially_effective: clampInt(m.effectivenessReduction?.partially_effective, 0, 4, 1),
    effective: clampInt(m.effectivenessReduction?.effective, 0, 4, 2)
  };
  return {
    likelihood: scale(m.likelihood, DEFAULT_LIKELIHOOD_SCALE),
    impact: scale(m.impact, DEFAULT_IMPACT_SCALE),
    matrix,
    acceptableUpTo: RATINGS.includes(m.acceptableUpTo) ? m.acceptableUpTo : DEFAULT_METHODOLOGY.acceptableUpTo,
    reviewDays,
    effectivenessReduction
  };
}

/**
 * Problems that make a methodology unusable, as sentences: a matrix where
 * a more likely or more severe cell rates lower than a less likely or less
 * severe one would rank risks backwards.
 */
export function methodologyProblems(m) {
  const problems = [];
  const rank = (r) => RATINGS.indexOf(r);
  for (let i = 0; i < 5; i += 1) {
    for (let l = 0; l < 5; l += 1) {
      if (l < 4 && rank(m.matrix[i][l]) > rank(m.matrix[i][l + 1])) {
        problems.push(`Impact ${i + 1}: likelihood ${l + 2} rates lower than likelihood ${l + 1}.`);
      }
      if (i < 4 && rank(m.matrix[i][l]) > rank(m.matrix[i + 1][l])) {
        problems.push(`Likelihood ${l + 1}: impact ${i + 2} rates lower than impact ${i + 1}.`);
      }
    }
  }
  const e = m.effectivenessReduction;
  if (!(e.ineffective <= e.partially_effective && e.partially_effective <= e.effective)) {
    problems.push('A more effective control must lower the likelihood at least as much as a less effective one.');
  }
  return problems;
}

export function normaliseAutomation(input = {}) {
  const a = input && typeof input === 'object' ? input : {};
  const days = Array.isArray(a.reminderDays)
    ? [...new Set(a.reminderDays.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 365))].sort((x, y) => y - x).slice(0, 6)
    : DEFAULT_AUTOMATION.reminderDays;
  return {
    reminderDays: days.length ? days : DEFAULT_AUTOMATION.reminderDays,
    escalateAfterDays: clampInt(a.escalateAfterDays, 0, 90, DEFAULT_AUTOMATION.escalateAfterDays)
  };
}

/** Read the stored methodology, put it into use and return it. */
export function loadMethodology() {
  const row = q.get('SELECT risk_methodology FROM org_profile WHERE id = 1');
  const methodology = normaliseMethodology(fromJson(row?.risk_methodology, {}));
  applyMethodology(methodology);
  return methodology;
}

export function saveMethodology(input) {
  const methodology = normaliseMethodology(input);
  const problems = methodologyProblems(methodology);
  if (problems.length) return { problems };
  q.run('UPDATE org_profile SET risk_methodology = ? WHERE id = 1', toJson(methodology));
  applyMethodology(methodology);
  return { methodology };
}

export function getAutomation() {
  const row = q.get('SELECT automation FROM org_profile WHERE id = 1');
  return normaliseAutomation(fromJson(row?.automation, {}));
}

export function saveAutomation(input) {
  const automation = normaliseAutomation(input);
  q.run('UPDATE org_profile SET automation = ? WHERE id = 1', toJson(automation));
  return automation;
}
