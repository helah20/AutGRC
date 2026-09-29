/**
 * Shared authoring helpers for the compact domain seeds.
 *
 * `buildProcedure` derives procedure scaffolding from the requirement set so
 * that the KPI published in a Procedure is literally the KPI recorded on the
 * Control — the same consistency guarantee the hand-authored domains have.
 */

export function buildProcedure(domainName, seed, requirements) {
  const kpis = requirements
    .filter((r) => r.kpi)
    .slice(0, 5)
    .map((r) => ({ name: r.controlName, target: r.kpi }));
  return {
    purpose: seed.purpose || `To define how ${domainName.toLowerCase()} controls are operated, evidenced and reviewed at {{orgName}}.`,
    preconditions: seed.preconditions || [
      `The ${domainName} Policy and Standard are approved and published.`,
      'Roles and responsibilities for this domain are assigned to named individuals.',
      'Supporting tooling is deployed and reporting to the control owner.'
    ],
    inputs: seed.inputs || [
      'Approved policy and standard requirements',
      'Asset and system inventory',
      'Change and incident records',
      'Control monitoring output'
    ],
    steps: seed.steps,
    outputs: seed.outputs || [
      'Operated controls with retained evidence',
      'Exception records where requirements cannot be met',
      'Control performance metrics for management reporting'
    ],
    escalation: seed.escalation || [
      'Control failures escalate to the Cybersecurity GRC Manager within 1 business day.',
      'Requirements that cannot be met escalate to the CISO for time-bound risk acceptance.',
      'Suspected compromise escalates immediately to the Incident Management process.'
    ],
    records: seed.records || [
      'Control operation evidence (retained 3 years)',
      'Exception approvals (retained for the exception life plus 3 years)',
      'Review and attestation records (retained 3 years)'
    ],
    kpis: seed.kpis || kpis
  };
}

/**
 * Split a requirement's Standard text into its atomic clauses.
 *
 * A Standard paragraph is authored as a sequence of complete sentences, each
 * stating one testable requirement. That is the unit an auditor cites and the
 * unit an accountable owner is named against, so it is the unit the Standard
 * document renders — not the paragraph that happens to contain several of them.
 *
 * One rule serves both languages: a full stop, whitespace, then the start of a
 * new statement. English starts one with a capital or a `{{placeholder}}`;
 * Arabic has no case, so any Arabic letter opens one. Deriving the clauses from
 * the prose rather than authoring them separately keeps a single source of
 * truth for the text, and makes the English and Arabic clause counts comparable
 * — which is what catches a translation that has quietly grown or lost a
 * requirement.
 */
export function splitClauses(text) {
  return String(text || '')
    .split(/(?<=\.)\s+(?=[A-Z{\u0600-\u06FF])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Default eight-column RACI role set for domains that do not override it. */
export const STD_ROLES = [
  'ciso', 'grc_manager', 'cyber_analyst', 'it_manager',
  'system_owner', 'business_owner', 'internal_auditor', 'risk_manager'
];

/**
 * Compact assignment helper. `spec` is whitespace-separated VALUE:role pairs;
 * `VALUE:*` sets the fallback applied to every unlisted role.
 * e.g. raci('Approve policy', 'Govern', 'A:ciso R:grc_manager C:it_manager')
 */
export function raci(activity, phase, spec) {
  const assign = {};
  let fallback = 'I';
  for (const token of spec.split(/\s+/).filter(Boolean)) {
    const [value, who] = token.split(':');
    if (who === '*') { fallback = value; continue; }
    assign[who] = value;
  }
  for (const role of STD_ROLES) if (!assign[role]) assign[role] = fallback;
  return { activity, phase, assign };
}
