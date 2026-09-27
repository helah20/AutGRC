/**
 * Risk scoring unit tests.
 *
 * Runs without a server. The round-trip property matters most: a requirement
 * the knowledge base calls medium risk has to produce a medium risk in the
 * register. A register that inflates every entry by a band is one nobody
 * believes, and the band thresholds are easy to get subtly wrong.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  score, rating, describe as describeRisk, startingPosition, enrichRisk, buildMatrix,
  LIKELIHOOD_SCALE, IMPACT_SCALE
} from '../src/services/risk.js';

test('risk scoring', async (t) => {
  await t.test('scores the product of likelihood and impact', () => {
    assert.equal(score(3, 4), 12);
    assert.equal(score(1, 1), 1);
    assert.equal(score(5, 5), 25);
  });

  await t.test('knowledge-base ratings round-trip through the matrix', () => {
    for (const band of ['critical', 'high', 'medium', 'low']) {
      const position = startingPosition(band);
      assert.equal(
        rating(position.likelihood, position.impact), band,
        `a ${band} requirement must produce a ${band} risk`
      );
    }
  });

  await t.test('a severe impact never bands below high, however unlikely', () => {
    for (let likelihood = 1; likelihood <= 5; likelihood += 1) {
      assert.ok(
        ['high', 'critical'].includes(rating(likelihood, 5)),
        `likelihood ${likelihood} with severe impact banded as ${rating(likelihood, 5)}`
      );
    }
    // Without the asymmetry, 1 x 5 = 5 would band as medium.
    assert.equal(rating(1, 5), 'high');
  });

  await t.test('bands rise monotonically with both axes', () => {
    const order = { low: 0, medium: 1, high: 2, critical: 3 };
    for (let likelihood = 1; likelihood <= 5; likelihood += 1) {
      for (let impact = 1; impact < 5; impact += 1) {
        assert.ok(
          order[rating(likelihood, impact + 1)] >= order[rating(likelihood, impact)],
          `raising impact from ${impact} to ${impact + 1} at likelihood ${likelihood} lowered the band`
        );
      }
    }
    for (let impact = 1; impact <= 5; impact += 1) {
      for (let likelihood = 1; likelihood < 5; likelihood += 1) {
        assert.ok(
          order[rating(likelihood + 1, impact)] >= order[rating(likelihood, impact)],
          `raising likelihood from ${likelihood} to ${likelihood + 1} at impact ${impact} lowered the band`
        );
      }
    }
  });

  await t.test('describes a position with both labels', () => {
    const d = describeRisk(4, 5);
    assert.equal(d.score, 20);
    assert.equal(d.rating, 'critical');
    assert.equal(d.likelihoodLabel, LIKELIHOOD_SCALE.find((s) => s.value === 4).label);
    assert.equal(d.impactLabel, IMPACT_SCALE.find((s) => s.value === 5).label);
  });

  await t.test('an unassessed residual reports no reduction', () => {
    const unassessed = enrichRisk({
      inherent_likelihood: 4, inherent_impact: 5,
      residual_likelihood: 4, residual_impact: 5, residual_assessed: 0
    });
    // The figures are equal, but that is not an achievement anybody made.
    assert.equal(unassessed.residual.score, unassessed.inherent.score);
    assert.equal(unassessed.reduction, null, 'no reduction is claimed before an assessment');
    assert.equal(unassessed.residual_assessed, false);

    const assessed = enrichRisk({
      inherent_likelihood: 4, inherent_impact: 5,
      residual_likelihood: 2, residual_impact: 4, residual_assessed: 1
    });
    assert.equal(assessed.reduction, 20 - 8);
  });

  await t.test('flags an acceptance that has lapsed', () => {
    const live = enrichRisk({
      inherent_likelihood: 3, inherent_impact: 3, residual_likelihood: 3, residual_impact: 3,
      accepted_at: '2026-01-01T00:00:00.000Z', acceptance_expires: '2099-01-01'
    });
    assert.equal(live.accepted, true);
    assert.equal(live.acceptanceExpired, false);

    const lapsed = enrichRisk({
      inherent_likelihood: 3, inherent_impact: 3, residual_likelihood: 3, residual_impact: 3,
      accepted_at: '2020-01-01T00:00:00.000Z', acceptance_expires: '2021-01-01'
    });
    assert.equal(lapsed.acceptanceExpired, true);
  });

  await t.test('builds a full 5x5 matrix and places each risk once', () => {
    const risks = [
      enrichRisk({ id: 'a', risk_id: 'RSK-001', title: 'One', inherent_likelihood: 4, inherent_impact: 5, residual_likelihood: 2, residual_impact: 2, residual_assessed: 1 }),
      enrichRisk({ id: 'b', risk_id: 'RSK-002', title: 'Two', inherent_likelihood: 4, inherent_impact: 5, residual_likelihood: 2, residual_impact: 2, residual_assessed: 1 })
    ];
    const residual = buildMatrix(risks, { position: 'residual' });
    assert.equal(residual.length, 25);
    assert.equal(residual.reduce((total, cell) => total + cell.count, 0), 2);
    assert.equal(residual.find((c) => c.likelihood === 2 && c.impact === 2).count, 2);

    const inherent = buildMatrix(risks, { position: 'inherent' });
    assert.equal(inherent.find((c) => c.likelihood === 4 && c.impact === 5).count, 2);
  });
});
