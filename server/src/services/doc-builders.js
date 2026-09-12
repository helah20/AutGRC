/**
 * Document builders.
 *
 * Every builder renders the SAME canonical requirement model into a different
 * document shape. This is what makes the generated package internally
 * consistent: the policy clause, the standard requirement, the procedure step
 * and the control record are four projections of one record, and numeric
 * commitments come from one shared parameter set.
 *
 * Each returned section carries `provenance` and `sourceRefs` so the platform
 * can always answer "where did this statement come from?".
 */

import { resolveText, domainShort, roleName, roleShort } from '../knowledge/index.js';
import { h, joinBlocks, escapeHtml } from './html.js';

const P = {
  REGULATORY: 'regulatory_requirement',
  FRAMEWORK: 'framework_guidance',
  POLICY: 'organizational_policy',
  STANDARD: 'organizational_standard',
  PROCEDURE: 'procedure',
  GUIDANCE: 'implementation_guidance',
  AI: 'ai_recommendation',
  USER: 'user_input'
};

export const PROVENANCE = P;

/** Source pointer helpers used to populate `document_sections.source_refs`. */
const ref = {
  requirement: (domainKey, key) => ({ type: 'requirement', domain: domainKey, key }),
  framework: (code, r) => ({ type: 'framework', framework: code, ref: r }),
  parameter: (name) => ({ type: 'parameter', name }),
  org: (field) => ({ type: 'org_profile', field })
};

function refsForRequirement(domainKey, req, frameworkCodes) {
  const out = [ref.requirement(domainKey, req.key)];
  for (const [code, list] of Object.entries(req.refs || {})) {
    if (frameworkCodes.length && !frameworkCodes.includes(code)) continue;
    for (const r of list) out.push(ref.framework(code, r));
  }
  return out;
}

/** Framework references applicable to a requirement, filtered to the selection. */
export function applicableRefs(req, frameworkCodes) {
  const out = [];
  for (const [code, list] of Object.entries(req.refs || {})) {
    if (frameworkCodes.length && !frameworkCodes.includes(code)) continue;
    for (const r of list) out.push({ framework: code, ref: r });
  }
  return out;
}

function refLabel(list) {
  if (!list.length) return '—';
  return list.map((x) => `${x.framework} ${x.ref}`).join('; ');
}

const section = (key, heading, body, provenance, sourceRefs = []) => ({
  key, heading, body, provenance, sourceRefs
});

// --------------------------------------------------------------- scope -----

function scopeBody(model, params, org) {
  const env = Array.isArray(org?.technology_env) ? org.technology_env : [];
  return joinBlocks(
    h.p(`This document applies to all ${params.orgName} employees, contractors, consultants, temporary staff and third parties who access, operate or support information systems within the ${model.name} domain.`),
    h.p('It applies to the following in-scope estate:'),
    h.ul([
      'All information systems that store, process or transmit organisational information, regardless of hosting location.',
      'All environments including production, disaster recovery, test and development.',
      env.length ? `Technology environments in use: ${env.join(', ')}.` : 'All technology platforms recorded in the asset inventory.',
      'All third-party services delivering or supporting in-scope functions.'
    ]),
    h.p('Where a requirement in this document conflicts with a legal or regulatory obligation, the legal or regulatory obligation prevails and the conflict shall be recorded as an exception.')
  );
}

// -------------------------------------------------------------- policy -----

export function buildPolicy({ model, params, org, frameworkCodes, frameworks }) {
  const reqs = model.requirements;
  const clauses = reqs.map((r, i) => ({
    ref: `5.${i + 1}`,
    text: resolveText(r.policy, params),
    req: r
  }));

  const statementsBody = `<ol class="clause-list">${clauses
    .map(
      (c) =>
        `<li><span class="clause-ref">${escapeHtml(c.ref)}</span> <strong>${escapeHtml(c.req.title)}.</strong> ` +
        `${escapeHtml(c.text)} ` +
        `<span class="clause-source">[${escapeHtml(refLabel(applicableRefs(c.req, frameworkCodes)))}]</span></li>`
    )
    .join('')}</ol>`;

  const roleRows = model.roles.map((code) => {
    const acts = model.raciActivities.filter((a) => a.assign[code] === 'A').map((a) => a.activity);
    const resp = model.raciActivities.filter((a) => a.assign[code] === 'R').map((a) => a.activity);
    return [
      roleName(code),
      acts.length ? acts.join('; ') : 'No accountability assigned in this domain',
      resp.length ? resp.join('; ') : '—'
    ];
  });

  return {
    reference: null,
    docType: 'policy',
    title: `${model.name} Policy`,
    provenance: P.POLICY,
    sections: [
      section('purpose', 'Purpose',
        joinBlocks(
          h.p(`This Policy establishes the ${params.orgName} position and mandatory requirements for ${model.name.toLowerCase()}. It defines what must be achieved; the accompanying ${model.name} Standard defines the measurable requirements, and the ${model.name} Procedure defines how they are carried out.`),
          h.p(model.description)
        ), P.POLICY, [ref.requirement(model.key, 'domain')]),

      section('scope', 'Scope', scopeBody(model, params, org), P.POLICY, [ref.org('technology_env')]),

      section('objectives', 'Objectives',
        joinBlocks(h.p('This Policy is intended to achieve the following objectives:'), h.ul(model.objectives.map((o) => resolveText(o, params)))),
        P.POLICY, [ref.requirement(model.key, 'objectives')]),

      section('statements', 'Policy Statements',
        joinBlocks(
          h.p(`The following statements are mandatory. The bracketed reference after each statement identifies the authoritative source requirement it addresses.`),
          statementsBody
        ), P.POLICY, reqs.flatMap((r) => refsForRequirement(model.key, r, frameworkCodes))),

      section('roles', 'Roles and Responsibilities',
        joinBlocks(
          h.p(`The following roles carry accountability and responsibility for this Policy. The complete assignment is recorded in the ${model.name} RACI Matrix.`),
          h.table(['Role', 'Accountable for', 'Responsible for'], roleRows)
        ), P.POLICY, [ref.requirement(model.key, 'raci')]),

      section('governance', 'Governance',
        joinBlocks(
          h.p('This Policy is governed as follows:'),
          h.ul([
            'The Chief Information Security Officer owns this Policy and is accountable for its adequacy.',
            'The Cybersecurity Steering Committee approves this Policy and any material amendment to it.',
            'The Cybersecurity GRC Manager maintains the Policy, its supporting Standard and Procedure, and the control library that implements it.',
            'Control performance is reported to the Cybersecurity Steering Committee on the agreed reporting cycle.',
            'Internal Audit provides independent assurance over the controls implementing this Policy.'
          ])
        ), P.POLICY, []),

      section('compliance', 'Compliance',
        joinBlocks(
          h.p(`Compliance with this Policy is mandatory. Compliance is assessed through control testing, internal review and independent audit.`),
          h.p('This Policy supports compliance with the following authoritative sources:'),
          h.table(['Source', 'Type', 'Referenced requirements'],
            frameworks.map((f) => [
              f.name,
              f.kind === 'regulation' ? 'Regulatory requirement' : 'Framework guidance',
              refLabel(reqs.flatMap((r) => applicableRefs(r, [f.code])))
            ])),
          h.callout('note', 'Source traceability',
            'Framework references identify the authoritative requirements this Policy is designed to address. They are reproduced as reference metadata and must be verified against the official publication before being relied upon for regulatory attestation.')
        ), P.FRAMEWORK, frameworkCodes.map((c) => ({ type: 'framework', framework: c }))),

      section('exceptions', 'Exceptions',
        joinBlocks(
          h.p('Any departure from this Policy requires a formal, time-bound exception.'),
          h.ul([
            'Exception requests shall record the requirement not met, the business reason, the compensating controls in place and the residual risk.',
            'Exceptions shall be approved by the Chief Information Security Officer, and by the Cybersecurity Steering Committee where the residual risk is rated Critical.',
            'Exceptions shall carry an expiry date not exceeding 12 months and shall be re-evaluated on expiry rather than automatically renewed.',
            'All exceptions in force shall be recorded in the exception register and reported to the Cybersecurity Steering Committee.'
          ])
        ), P.POLICY, []),

      section('monitoring', 'Monitoring and Measurement',
        joinBlocks(
          h.p('The effectiveness of this Policy is measured through the following indicators:'),
          h.table(['Control', 'Indicator', 'Measurement frequency'],
            reqs.filter((r) => r.kpi).map((r) => [r.controlName, resolveText(r.kpi, params), resolveText(r.frequency, params)]))
        ), P.POLICY, reqs.map((r) => ref.requirement(model.key, r.key))),

      section('review', 'Review',
        joinBlocks(
          h.p('This Policy shall be reviewed at least annually, and additionally when any of the following occurs:'),
          h.ul([
            'A change to applicable laws, regulations or adopted frameworks.',
            'A material change to the organisational structure, technology environment or operating model.',
            'A significant cybersecurity incident within this domain.',
            'An audit or assessment finding indicating that the Policy is inadequate.'
          ]),
          h.p('The Document Owner is responsible for initiating the review and the approving authority for reissuing the Policy.')
        ), P.POLICY, []),

      section('enforcement', 'Enforcement',
        joinBlocks(
          h.p('Failure to comply with this Policy may result in disciplinary action in accordance with the applicable human resources policies, and for third parties may constitute a breach of contract.'),
          h.p('Deliberate circumvention of a security control required by this Policy shall be treated as a cybersecurity incident and investigated accordingly.')
        ), P.POLICY, []),

      section('references', 'References',
        joinBlocks(
          h.p('This Policy should be read together with:'),
          h.ul([
            `${model.name} Standard`,
            `${model.name} Procedure`,
            `${model.name} Roles and Responsibilities`,
            `${model.name} RACI Matrix`,
            `${model.name} Control Matrix`,
            'Cybersecurity Policy (organisation-wide)',
            'Information Classification and Handling Standard',
            'Cybersecurity Incident Management Procedure'
          ]),
          h.p('Authoritative sources:'),
          h.ul(frameworks.map((f) => `${f.name} — ${f.publisher}${f.version ? `, ${f.version}` : ''}`))
        ), P.POLICY, [])
    ]
  };
}

// ------------------------------------------------------------ standard -----

export function buildStandard({ model, params, frameworkCodes, frameworks }) {
  const reqs = model.requirements;
  const mandatory = reqs.map((r, i) => ({
    ref: `3.${i + 1}`,
    title: r.title,
    text: resolveText(r.standard, params),
    policyRef: `5.${i + 1}`,
    req: r
  }));

  const mandatoryBody = `<ol class="clause-list">${mandatory
    .map(
      (c) =>
        `<li><span class="clause-ref">${escapeHtml(c.ref)}</span> <strong>${escapeHtml(c.title)}.</strong> ` +
        `${escapeHtml(c.text)} ` +
        `<span class="clause-source">[Policy §${escapeHtml(c.policyRef)} · ${escapeHtml(refLabel(applicableRefs(c.req, frameworkCodes)))}]</span></li>`
    )
    .join('')}</ol>`;

  const technical = reqs.filter((r) => r.controlNature === 'technical' || r.controlNature === 'hybrid');
  const administrative = reqs.filter((r) => r.controlNature === 'administrative' || r.controlNature === 'physical');

  const paramRows = Object.entries(model.parameters).map(([k, v]) => [
    k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim(),
    resolveText(String(v), params)
  ]);

  return {
    docType: 'standard',
    title: `${model.name} Standard`,
    provenance: P.STANDARD,
    sections: [
      section('purpose', 'Purpose',
        joinBlocks(
          h.p(`This Standard defines the mandatory, measurable requirements that implement the ${model.name} Policy at ${params.orgName}.`),
          h.p('Each requirement in this Standard traces to a clause of the Policy and to the authoritative source requirements the Policy addresses. Where this Standard specifies a value — a frequency, a threshold or a period — that value is the single agreed figure and is used unchanged in the corresponding Procedure and control records.')
        ), P.STANDARD, []),

      section('scope', 'Scope',
        joinBlocks(
          h.p(`This Standard applies to the same scope as the ${model.name} Policy.`),
          h.p('Technical requirements apply to every platform capable of enforcing them. Where a platform cannot enforce a requirement, a documented exception with compensating controls is required before the platform enters or remains in service.')
        ), P.STANDARD, []),

      section('mandatory', 'Mandatory Requirements', mandatoryBody, P.STANDARD,
        reqs.flatMap((r) => refsForRequirement(model.key, r, frameworkCodes))),

      section('parameters', 'Defined Values',
        joinBlocks(
          h.p('The following values are the agreed organisational parameters for this domain. Any document, configuration or control referring to these commitments shall use these values.'),
          h.table(['Parameter', 'Agreed value'], paramRows),
          h.callout('warning', 'Change control',
            'Changing a value in this table changes an organisational commitment. Amendments require Policy Owner approval and shall be propagated to the Procedure, the control library and any affected configuration baseline.')
        ), P.STANDARD, Object.keys(model.parameters).map((k) => ref.parameter(k))),

      section('technical', 'Technical Requirements',
        technical.length
          ? joinBlocks(
              h.p('The following requirements are enforced through technical configuration and shall be verifiable by configuration export, scan or platform report:'),
              h.table(['Ref', 'Requirement', 'Enforcement point', 'Verification'],
                technical.map((r) => {
                  const i = reqs.indexOf(r);
                  return [`3.${i + 1}`, r.title, r.controlNature === 'hybrid' ? 'Technical with procedural support' : 'Technical configuration', r.evidence[0] || 'Configuration evidence'];
                }))
            )
          : h.p('This domain is implemented primarily through administrative controls. Technical enforcement requirements are specified in the related domain Standards.'),
        P.STANDARD, technical.map((r) => ref.requirement(model.key, r.key))),

      section('security', 'Security Requirements',
        joinBlocks(
          h.p('The following security properties shall be preserved by every implementation of this Standard:'),
          h.ul([
            'Individual attribution: every action taken under this Standard shall be attributable to a uniquely identified person, service or device.',
            'Least privilege: access and capability granted shall be the minimum sufficient for the task.',
            'Segregation of duties: the party performing an activity shall not be the sole party assuring it.',
            'Auditability: each requirement shall produce evidence sufficient to demonstrate operation to an independent reviewer.',
            'Fail-secure: where a control cannot operate, the system shall default to denying access rather than permitting it.'
          ])
        ), P.STANDARD, []),

      section('controls', 'Minimum Controls',
        joinBlocks(
          h.p('The following controls are the minimum required to satisfy this Standard. They are maintained in the Control Library and tested on the stated frequency.'),
          h.table(['Control ID', 'Control', 'Type', 'Frequency', 'Responsible role'],
            reqs.map((r, i) => [
              `${domainShort(model.key)}-${String(i + 1).padStart(3, '0')}`,
              r.controlName,
              r.controlType,
              resolveText(r.frequency, params),
              roleName(defaultResponsible(model, r))
            ]))
        ), P.STANDARD, reqs.map((r) => ref.requirement(model.key, r.key))),

      section('exceptions', 'Exceptions',
        joinBlocks(
          h.p('Exceptions to this Standard follow the exception process defined in the Policy.'),
          h.ul([
            'Technical exceptions shall record the platform limitation preventing compliance.',
            'A compensating control shall be identified and its operation evidenced for the duration of the exception.',
            'Exceptions to requirements rated Critical risk shall require Cybersecurity Steering Committee approval.'
          ])
        ), P.STANDARD, []),

      section('monitoring', 'Monitoring',
        joinBlocks(
          h.p('Compliance with this Standard is monitored as follows:'),
          h.table(['Requirement', 'Indicator', 'Frequency', 'Reported to'],
            reqs.filter((r) => r.kpi).map((r) => [r.title, resolveText(r.kpi, params), resolveText(r.frequency, params), 'Cybersecurity GRC Manager']))
        ), P.STANDARD, []),

      section('compliance', 'Compliance',
        joinBlocks(
          h.p('This Standard supports compliance with the following authoritative sources:'),
          h.table(['Source', 'Referenced requirements'],
            frameworks.map((f) => [f.name, refLabel(reqs.flatMap((r) => applicableRefs(r, [f.code])))])),
          h.p('Non-compliance identified through testing or audit shall be recorded as a finding, risk-rated and tracked to closure.')
        ), P.FRAMEWORK, [])
    ]
  };
}

/** The role carrying 'R' for the activity most closely matching the control. */
function defaultResponsible(model, req) {
  const words = req.controlName.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
  let best = null;
  let bestScore = 0;
  for (const activity of model.raciActivities) {
    const text = activity.activity.toLowerCase();
    const score = words.reduce((acc, w) => acc + (text.includes(w) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; best = activity; }
  }
  const chosen = best || model.raciActivities[0];
  return Object.keys(chosen.assign).find((k) => chosen.assign[k] === 'R') || model.roles[0];
}

function defaultAccountable(model, req) {
  const words = req.controlName.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
  let best = null;
  let bestScore = 0;
  for (const activity of model.raciActivities) {
    const text = activity.activity.toLowerCase();
    const score = words.reduce((acc, w) => acc + (text.includes(w) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; best = activity; }
  }
  const chosen = best || model.raciActivities[0];
  return Object.keys(chosen.assign).find((k) => chosen.assign[k] === 'A') || 'ciso';
}

export { defaultResponsible, defaultAccountable };

// ----------------------------------------------------------- procedure -----

export function buildProcedureDoc({ model, params, frameworkCodes }) {
  const proc = model.procedure;
  const steps = proc.steps.map((s, i) => ({ ...s, no: i + 1 }));
  const decisions = steps.filter((s) => s.decision);

  const stepBody = steps
    .map(
      (s) =>
        `<div class="proc-step"><h4>Step ${s.no} — ${escapeHtml(resolveText(s.name, params))}</h4>` +
        `<p class="proc-actor"><strong>Performed by:</strong> ${escapeHtml(resolveText(s.actor, params))}</p>` +
        `<p>${escapeHtml(resolveText(s.detail, params))}</p>` +
        (s.decision
          ? `<div class="callout" data-callout="decision"><strong>Decision: ${escapeHtml(resolveText(s.decision.question, params))}</strong>` +
            `<p><strong>Yes →</strong> ${escapeHtml(resolveText(s.decision.yes, params))}</p>` +
            `<p><strong>No →</strong> ${escapeHtml(resolveText(s.decision.no, params))}</p></div>`
          : '') +
        `</div>`
    )
    .join('');

  const flow = steps.map((s) => resolveText(s.name, params)).join(' → ');

  return {
    docType: 'procedure',
    title: `${model.name} Procedure`,
    provenance: P.PROCEDURE,
    flow: { steps, title: `${model.name} Process Flow` },
    sections: [
      section('purpose', 'Purpose',
        joinBlocks(
          h.p(resolveText(proc.purpose, params)),
          h.p(`This Procedure implements the ${model.name} Policy and ${model.name} Standard. Values stated here are taken from the Standard and are not independently set.`)
        ), P.PROCEDURE, []),

      section('scope', 'Scope',
        h.p(`This Procedure applies to all personnel performing the activities described, across the scope defined in the ${model.name} Policy.`),
        P.PROCEDURE, []),

      section('preconditions', 'Preconditions',
        joinBlocks(h.p('The following shall be in place before this Procedure is executed:'), h.ul(proc.preconditions.map((p) => resolveText(p, params)))),
        P.PROCEDURE, []),

      section('inputs', 'Inputs',
        joinBlocks(h.p('This Procedure takes the following inputs:'), h.ul(proc.inputs.map((p) => resolveText(p, params)))),
        P.PROCEDURE, []),

      section('process', 'Process Overview',
        joinBlocks(
          h.p('The process proceeds through the following stages:'),
          `<p class="proc-flow">${escapeHtml(flow)}</p>`,
          h.table(['Step', 'Stage', 'Performed by'], steps.map((s) => [String(s.no), resolveText(s.name, params), resolveText(s.actor, params)]))
        ), P.PROCEDURE, []),

      section('steps', 'Detailed Steps', stepBody, P.PROCEDURE, [ref.requirement(model.key, 'procedure')]),

      section('decisions', 'Decision Points',
        decisions.length
          ? h.table(['Step', 'Decision', 'If yes', 'If no'],
              decisions.map((s) => [String(s.no), resolveText(s.decision.question, params), resolveText(s.decision.yes, params), resolveText(s.decision.no, params)]))
          : h.p('This Procedure contains no conditional decision points; all steps are executed in sequence.'),
        P.PROCEDURE, []),

      section('escalation', 'Escalation',
        joinBlocks(h.p('The following conditions require escalation:'), h.ul(proc.escalation.map((p) => resolveText(p, params)))),
        P.PROCEDURE, []),

      section('outputs', 'Outputs',
        joinBlocks(h.p('Successful execution produces:'), h.ul(proc.outputs.map((p) => resolveText(p, params)))),
        P.PROCEDURE, []),

      section('records', 'Records and Evidence',
        joinBlocks(
          h.p('The following records shall be created and retained. These records are the evidence relied upon during control testing and audit.'),
          h.ul(proc.records.map((p) => resolveText(p, params)))
        ), P.PROCEDURE, []),

      section('kpis', 'Key Performance Indicators',
        h.table(['Indicator', 'Target'], proc.kpis.map((k) => [resolveText(k.name, params), resolveText(k.target, params)])),
        P.PROCEDURE, []),

      section('roles', 'Roles',
        joinBlocks(
          h.p('The roles participating in this Procedure and their assignment are:'),
          h.table(['Role', 'Assignment in this Procedure'],
            model.roles.map((code) => {
              const a = model.raciActivities.filter((x) => x.assign[code] === 'A').length;
              const r = model.raciActivities.filter((x) => x.assign[code] === 'R').length;
              const parts = [];
              if (a) parts.push(`Accountable for ${a} activit${a === 1 ? 'y' : 'ies'}`);
              if (r) parts.push(`Responsible for ${r} activit${r === 1 ? 'y' : 'ies'}`);
              return [roleName(code), parts.length ? parts.join('; ') : 'Consulted or informed only'];
            }))
        ), P.PROCEDURE, []),

      section('exceptions', 'Exceptions',
        joinBlocks(
          h.p('Where this Procedure cannot be followed:'),
          h.ul([
            'The deviation shall be recorded at the time it occurs, with the reason and the approver.',
            'Deviations affecting a control required by the Standard shall be raised as an exception under the Policy exception process.',
            'Repeated deviation for the same cause shall trigger a review of this Procedure rather than continued exception.'
          ])
        ), P.PROCEDURE, [])
    ]
  };
}

// ----------------------------------------------------------- guideline -----

export function buildGuideline({ model, params }) {
  const reqs = model.requirements;
  return {
    docType: 'guideline',
    title: `${model.name} Guideline`,
    provenance: P.GUIDANCE,
    sections: [
      section('purpose', 'Purpose',
        joinBlocks(
          h.p(`This Guideline offers non-mandatory implementation advice for the ${model.name} Standard.`),
          h.callout('note', 'Status of this document',
            'This Guideline is advisory. It does not create obligations. Where it appears to conflict with the Policy or Standard, the Policy or Standard prevails.')
        ), P.GUIDANCE, []),
      section('scope', 'Scope', h.p(`Intended for teams implementing or operating ${model.name.toLowerCase()} controls at ${params.orgName}.`), P.GUIDANCE, []),
      section('guidance', 'Implementation Guidance',
        reqs.map((r) => `<h4>${escapeHtml(r.title)}</h4><p>${escapeHtml(resolveText(r.guidance || r.standard, params))}</p>`).join(''),
        P.GUIDANCE, reqs.map((r) => ref.requirement(model.key, r.key))),
      section('pitfalls', 'Common Pitfalls',
        joinBlocks(
          h.p('The following are the failure modes most frequently observed in this domain:'),
          h.ul(reqs.map((r) => `${r.title}: ${resolveText(r.risk, params)}`))
        ), P.GUIDANCE, []),
      section('references', 'References',
        h.ul([`${model.name} Policy`, `${model.name} Standard`, `${model.name} Procedure`]), P.GUIDANCE, [])
    ]
  };
}

// ----------------------------------------------- roles & responsibilities --

export function buildRolesDoc({ model, params, roles }) {
  const sections = [
    section('purpose', 'Purpose',
      joinBlocks(
        h.p(`This document defines the cybersecurity roles and responsibilities applicable to the ${model.name} domain at ${params.orgName}.`),
        h.p('Each role records its purpose, reporting line, authority, responsibilities, accountabilities, required approvals, escalation duties, competencies and interfaces with other roles.')
      ), P.POLICY, []),
    section('structure', 'Role Summary',
      h.table(['Role', 'Category', 'Reporting line'], roles.map((r) => [r.name, r.category, resolveText(r.reportingLine, params)])),
      P.POLICY, [])
  ];

  for (const role of roles) {
    const accountable = model.raciActivities.filter((a) => a.assign[role.code] === 'A').map((a) => a.activity);
    const responsible = model.raciActivities.filter((a) => a.assign[role.code] === 'R').map((a) => a.activity);
    const consulted = model.raciActivities.filter((a) => ['C', 'S'].includes(a.assign[role.code])).map((a) => a.activity);

    sections.push(section(`role_${role.code}`, role.name,
      joinBlocks(
        `<p class="role-purpose">${escapeHtml(resolveText(role.purpose, params))}</p>`,
        h.table(['Attribute', 'Definition'], [
          ['Reporting line', resolveText(role.reportingLine, params)],
          ['Authority', resolveText(role.authority, params)],
          ['Category', role.category]
        ]),
        h.heading(4, 'Key Responsibilities'), h.ul(role.responsibilities.map((x) => resolveText(x, params))),
        h.heading(4, 'Accountabilities'), h.ul(role.accountabilities.map((x) => resolveText(x, params))),
        h.heading(4, 'Required Activities'), h.ul(role.activities.map((x) => resolveText(x, params))),
        h.heading(4, 'Required Approvals'), h.ul(role.approvals.map((x) => resolveText(x, params))),
        h.heading(4, 'Escalation Responsibilities'), h.ul(role.escalations.map((x) => resolveText(x, params))),
        h.heading(4, 'Required Competencies'), h.ul(role.competencies),
        h.heading(4, 'Interfaces with Other Roles'),
        h.table(['Interfaces with', 'Nature of the interface'], role.interfaces.map((i) => [i.role, i.nature])),
        h.heading(4, `RACI Assignment in ${model.name}`),
        h.table(['Assignment', 'Activities'], [
          ['Accountable', accountable.length ? accountable.join('; ') : '—'],
          ['Responsible', responsible.length ? responsible.join('; ') : '—'],
          ['Consulted / Support', consulted.length ? consulted.join('; ') : '—']
        ])
      ), P.POLICY, [ref.requirement(model.key, 'roles')]));
  }

  sections.push(section('review', 'Review',
    h.p('Role definitions shall be reviewed at least annually and whenever the organisational structure changes. Vacant roles shall be reported to the Chief Information Security Officer and reassigned within 10 business days.'),
    P.POLICY, []));

  return { docType: 'roles', title: `${model.name} Roles and Responsibilities`, provenance: P.POLICY, sections };
}

// ---------------------------------------------------------------- RACI -----

export function buildRaciDoc({ model, params, mode = 'raci' }) {
  const cols = model.roles;
  const headers = ['Activity', 'Phase', ...cols.map((c) => roleShort(c))];
  const rows = model.raciActivities.map((a) => [
    a.activity,
    a.phase || '—',
    ...cols.map((c) => a.assign[c] || '')
  ]);

  const legend = mode === 'rasci'
    ? [['R', 'Responsible', 'Performs the activity.'], ['A', 'Accountable', 'Answerable for the outcome. Exactly one per activity.'], ['S', 'Support', 'Provides resources or assistance to the responsible role.'], ['C', 'Consulted', 'Provides input before the activity completes. Two-way communication.'], ['I', 'Informed', 'Told of the outcome. One-way communication.']]
    : [['R', 'Responsible', 'Performs the activity.'], ['A', 'Accountable', 'Answerable for the outcome. Exactly one per activity.'], ['C', 'Consulted', 'Provides input before the activity completes. Two-way communication.'], ['I', 'Informed', 'Told of the outcome. One-way communication.']];

  return {
    docType: 'raci',
    title: `${model.name} RACI Matrix`,
    provenance: P.POLICY,
    matrix: { cols, activities: model.raciActivities, mode },
    sections: [
      section('purpose', 'Purpose',
        h.p(`This matrix assigns responsibility and accountability for each ${model.name} activity at ${params.orgName}. Exactly one role is Accountable for every activity.`),
        P.POLICY, []),
      section('legend', 'Legend', h.table(['Code', 'Meaning', 'Definition'], legend), P.POLICY, []),
      section('matrix', 'Matrix', h.table(headers, rows), P.POLICY, [ref.requirement(model.key, 'raci')]),
      section('notes', 'Notes',
        h.ul([
          'Exactly one role is Accountable for each activity. Where two roles appear to share accountability, the matrix has not yet been agreed.',
          'Accountability may not be delegated; responsibility may.',
          'Roles listed as Consulted shall be engaged before the activity completes, not informed afterwards.',
          'This matrix is reviewed whenever the organisational structure changes and at least annually.'
        ]), P.POLICY, [])
    ]
  };
}

// ------------------------------------------------------- control matrix ----

export function buildControlMatrix({ model, params, frameworkCodes, controls }) {
  return {
    docType: 'control_matrix',
    title: `${model.name} Control Matrix`,
    provenance: P.STANDARD,
    sections: [
      section('purpose', 'Purpose',
        h.p(`This matrix records the ${model.name} controls, their attributes, the evidence that demonstrates their operation, and the authoritative requirements they satisfy.`),
        P.STANDARD, []),
      section('matrix', 'Control Matrix',
        h.table(
          ['Control ID', 'Control', 'Type', 'Frequency', 'Responsible', 'Risk', 'Framework mapping'],
          controls.map((c) => [c.control_id, c.name, `${c.control_type} / ${c.control_nature}`, c.frequency, c.responsible_role, c.risk_rating, c.mappingLabel || '—'])
        ), P.STANDARD, []),
      section('evidence', 'Evidence Requirements',
        h.table(['Control ID', 'Evidence required', 'Collection frequency'],
          controls.flatMap((c) => c.evidenceItems.map((e) => [c.control_id, e, c.frequency]))),
        P.STANDARD, []),
      section('kpis', 'Control Indicators',
        h.table(['Control ID', 'Indicator', 'Risk addressed'], controls.map((c) => [c.control_id, c.kpi || '—', c.risk])),
        P.STANDARD, [])
    ]
  };
}

// -------------------------------------------------------- framework doc ----

export function buildFrameworkDoc({ model, params, frameworks, frameworkCodes }) {
  const reqs = model.requirements;
  return {
    docType: 'framework',
    title: `${model.name} Control Framework`,
    provenance: P.POLICY,
    sections: [
      section('purpose', 'Purpose',
        h.p(`This document describes the ${params.orgName} control framework for the ${model.name} domain and how it maps to the adopted authoritative sources.`),
        P.POLICY, []),
      section('structure', 'Framework Structure',
        joinBlocks(
          h.p('The framework follows the organisation-wide governance hierarchy:'),
          h.ol([
            'Regulation and framework — authoritative external requirements.',
            'Organisational control — the control the organisation operates to satisfy them.',
            'Policy — the mandatory organisational position.',
            'Standard — measurable requirements implementing the policy.',
            'Procedure — the steps by which requirements are carried out.',
            'Work instruction — platform-specific execution detail.',
            'Evidence — the record demonstrating the control operated.'
          ])
        ), P.POLICY, []),
      section('sources', 'Adopted Sources',
        joinBlocks(
          h.table(['Source', 'Publisher', 'Type', 'Version'], frameworks.map((f) => [f.name, f.publisher, f.kind === 'regulation' ? 'Regulatory' : 'Framework', f.version || '—'])),
          h.callout('note', 'Provenance',
            'Requirements drawn from these sources are authoritative. Controls, policies, standards and procedures produced by the organisation are organisational content and are labelled as such throughout this platform.')
        ), P.FRAMEWORK, []),
      section('coverage', 'Control Coverage',
        h.table(['Organisational control', 'Addresses'],
          reqs.map((r, i) => [`${domainShort(model.key)}-${String(i + 1).padStart(3, '0')} — ${r.controlName}`, refLabel(applicableRefs(r, frameworkCodes))])),
        P.POLICY, []),
      section('governance', 'Framework Governance',
        h.ul([
          'The Chief Information Security Officer owns this framework.',
          'The Cybersecurity GRC Manager maintains the mapping between source requirements and organisational controls.',
          'Mapping coverage is reviewed at least annually and whenever an adopted source is revised.',
          'Coverage gaps are recorded in the gap assessment and tracked to closure.'
        ]), P.POLICY, [])
    ]
  };
}
