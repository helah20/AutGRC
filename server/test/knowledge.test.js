/**
 * Knowledge-base integrity tests.
 *
 * These assert properties of the requirement model itself, independent of the
 * database: depth, framework traceability, and that no clause states a numeric
 * commitment outside the parameter set.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-secret-for-the-knowledge-suite-only';

const { DOMAIN_MODELS, REQUIREMENTS, FRAMEWORKS, validateKnowledgeBase, unresolvedPlaceholders } =
  await import('../src/knowledge/index.js');

/**
 * A reference that prefixes another in the same framework is a section heading,
 * not a testable control. NCA numbering nests as 2-5, 2-5-1, 2-5-3, so "2-5" is
 * the heading and the leaves are what a control can be mapped to.
 */
function leafRequirements() {
  const out = [];
  for (const [code, list] of Object.entries(REQUIREMENTS)) {
    const refs = list.map((r) => String(r[0]));
    for (const [ref, title, domain] of list) {
      const isHeading = refs.some((other) =>
        other !== ref && (other.startsWith(`${ref}-`) || other.startsWith(`${ref}.`)));
      if (!isHeading) out.push({ code, ref, title, domain });
    }
  }
  return out;
}

const citedRefs = new Set();
for (const model of Object.values(DOMAIN_MODELS)) {
  for (const requirement of model.requirements) {
    for (const [code, refs] of Object.entries(requirement.refs || {})) {
      for (const ref of refs) citedRefs.add(`${code}::${ref}`);
    }
  }
}

test('knowledge base', async (t) => {
  await t.test('reports no integrity problems', () => {
    const problems = validateKnowledgeBase();
    assert.deepEqual(problems, [], problems.join('\n'));
  });

  await t.test('every domain carries enough clauses to be a governance document', () => {
    // Below this, a generated Policy reads as a summary rather than a position:
    // four clauses cannot cover a domain any framework treats as a section.
    const MINIMUM = 8;
    const thin = Object.values(DOMAIN_MODELS)
      .filter((m) => m.requirements.length < MINIMUM)
      .map((m) => `${m.key} (${m.requirements.length})`);
    assert.deepEqual(thin, [], `domains below ${MINIMUM} clauses`);
  });

  await t.test('every testable framework requirement is addressed by a control', () => {
    // The platform's claim is traceability from source requirement to control,
    // document and evidence. An uncited requirement is a gap in that claim, and
    // the platform reports it as a compliance finding — so it should not exist
    // in the shipped model.
    const uncited = leafRequirements()
      .filter(({ code, ref }) => !citedRefs.has(`${code}::${ref}`))
      .map(({ code, ref, title }) => `${code} ${ref} — ${title}`);
    assert.deepEqual(uncited, [], `${uncited.length} framework requirement(s) with no mapped control`);
  });

  await t.test('no clause cites a reference the catalogue does not hold', () => {
    // A reference to a requirement that does not exist is an invented
    // regulatory citation, which docs/GOVERNANCE.md rule 1 forbids.
    const codes = new Set(FRAMEWORKS.map((f) => f.code));
    const known = new Set();
    for (const [code, list] of Object.entries(REQUIREMENTS)) {
      for (const [ref] of list) known.add(`${code}::${ref}`);
    }
    const invented = [];
    for (const model of Object.values(DOMAIN_MODELS)) {
      for (const requirement of model.requirements) {
        for (const [code, refs] of Object.entries(requirement.refs || {})) {
          if (!codes.has(code)) invented.push(`${model.key}.${requirement.key}: unknown framework ${code}`);
          for (const ref of refs) {
            if (!known.has(`${code}::${ref}`)) invented.push(`${model.key}.${requirement.key}: ${code} ${ref}`);
          }
        }
      }
    }
    assert.deepEqual(invented, []);
  });

  await t.test('every placeholder resolves to a parameter of its own domain', () => {
    // A placeholder naming another domain's parameter renders as literal braces
    // in the document, and the commitment it was meant to carry is lost.
    const orphans = [];
    for (const model of Object.values(DOMAIN_MODELS)) {
      const available = new Set([...Object.keys(model.parameters), 'orgName']);
      const texts = [];
      for (const r of model.requirements) {
        texts.push(...['policy', 'standard', 'guidance', 'kpi', 'frequency', 'controlName', 'risk']
          .map((f) => r[f]).filter(Boolean));
        texts.push(...(r.evidence || []));
      }
      texts.push(model.procedure.purpose, ...model.procedure.preconditions, ...model.procedure.inputs,
        ...model.procedure.outputs, ...model.procedure.escalation, ...model.procedure.records);
      for (const kpi of model.procedure.kpis) texts.push(kpi.name, kpi.target);
      for (const step of model.procedure.steps) {
        texts.push(step.name, step.actor, step.detail);
        if (step.decision) texts.push(step.decision.question, step.decision.yes, step.decision.no);
      }
      for (const text of texts.filter(Boolean)) {
        for (const name of unresolvedPlaceholders(text)) {
          if (!available.has(name)) orphans.push(`${model.key}: {{${name}}}`);
        }
      }
    }
    assert.deepEqual([...new Set(orphans)], []);
  });

  await t.test('every clause carries the fields a control record needs', () => {
    const incomplete = [];
    for (const model of Object.values(DOMAIN_MODELS)) {
      for (const r of model.requirements) {
        for (const field of ['title', 'policy', 'standard', 'controlName', 'controlType',
          'controlNature', 'frequency', 'kpi', 'risk', 'riskRating', 'evidence', 'refs']) {
          if (!r[field]) incomplete.push(`${model.key}.${r.key}: missing ${field}`);
        }
        if (Array.isArray(r.evidence) && r.evidence.length < 2) {
          incomplete.push(`${model.key}.${r.key}: fewer than two evidence items`);
        }
      }
    }
    assert.deepEqual(incomplete, []);
  });
});
