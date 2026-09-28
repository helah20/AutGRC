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

import { resolveText, domainShort, roleName, roleShort, arParameterLabel } from '../knowledge/index.js';
import { h, joinBlocks, escapeHtml } from './html.js';
import { translator, arabicTitle } from './doc-strings.js';

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

/**
 * The heading is translated here rather than at each of the forty call sites.
 * `activeT` is set for the duration of one synchronous build; the builders do
 * no I/O, so there is no interleaving to worry about, and the alternative —
 * threading a translator through every helper signature — obscured the shape
 * of the builders for no gain.
 */
let activeT = translator('en');

const section = (key, heading, body, provenance, sourceRefs = []) => ({
  key, heading: activeT(heading), body, provenance, sourceRefs
});

/**
 * A document title in the right word order.
 *
 * English puts the type after the domain — "Identity & Access Management
 * Policy". Arabic puts it first — "سياسة إدارة الهويات والوصول". Substituting
 * the word alone would leave the English order behind, so the template differs
 * rather than the vocabulary.
 */
const docTitle = (model, type) => (activeT.isRtl
  ? arabicTitle(type, model.name)
  : `${model.name} ${type}`);

/** Translate a phrase inside a builder. Falls back to the English unchanged. */
const T = (text, values) => activeT(text, values);

/**
 * Role names in the language of the document being built.
 *
 * A role name is not interface chrome: it names the party answerable for a
 * clause, and it appears in the Policy role table, the RACI column headers,
 * the Procedure actor column and every control record.
 */
const RN = (code) => roleName(code, activeT.language);
const RS = (code) => roleShort(code, activeT.language);

/**
 * The label for a parameter, in the language of the document.
 *
 * The Defined Values table is where the organisation states each numeric
 * commitment, so its subject column is document content rather than chrome. The
 * English fallback is the humanised camel-case name, which is visibly English
 * and so visibly missing rather than silently wrong.
 */
const PL = (name) => (activeT.isRtl && arParameterLabel(name))
  || name.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();

/**
 * Connective prose.
 *
 * `key` selects a translation; `english` is the sentence to use when there is
 * none, and stays at the call site so the builder still reads as the document
 * it produces. Interpolated values are named so a translation can place them
 * where its own grammar needs them.
 */
const TP = (key, english, values) => (activeT.has(key) ? activeT(key, values) : english);

/** Run one build with a language in effect, and always put it back. */
export function withLanguage(language, build) {
  const previous = activeT;
  activeT = translator(language);
  try {
    return build();
  } finally {
    activeT = previous;
  }
}

// --------------------------------------------------------------- scope -----

function scopeBody(model, params, org) {
  const env = Array.isArray(org?.technology_env) ? org.technology_env : [];
  return joinBlocks(
    h.p(TP('scope.appliesTo',
      `This document applies to all ${params.orgName} employees, contractors, consultants, temporary staff and third parties who access, operate or support information systems within the ${model.name} domain.`,
      { org: params.orgName, domain: model.name })),
    h.p(TP('scope.estateLead', 'It applies to the following in-scope estate:')),
    h.ul([
      TP('scope.allSystems', 'All information systems that store, process or transmit organisational information, regardless of hosting location.'),
      TP('scope.allEnvironments', 'All environments including production, disaster recovery, test and development.'),
      env.length
        ? TP('scope.envInUse', `Technology environments in use: ${env.join(', ')}.`, { list: env.join('، ') })
        : TP('scope.platforms', 'All technology platforms recorded in the asset inventory.'),
      TP('scope.thirdParty', 'All third-party services delivering or supporting in-scope functions.')
    ]),
    h.p(TP('scope.conflict', 'Where a requirement in this document conflicts with a legal or regulatory obligation, the legal or regulatory obligation prevails and the conflict shall be recorded as an exception.'))
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
      RN(code),
      acts.length ? acts.join('; ') : T('No accountability assigned in this domain'),
      resp.length ? resp.join('; ') : '—'
    ];
  });

  return {
    reference: null,
    docType: 'policy',
    title: docTitle(model, 'Policy'),
    provenance: P.POLICY,
    sections: [
      section('purpose', 'Purpose',
        joinBlocks(
          h.p(TP('policy.purpose',
          `This Policy establishes the ${params.orgName} position and mandatory requirements for ${model.name.toLowerCase()}. It defines what must be achieved; the accompanying ${model.name} Standard defines the measurable requirements, and the ${model.name} Procedure defines how they are carried out.`,
          { org: params.orgName, domain: model.name })),
          h.p(model.description)
        ), P.POLICY, [ref.requirement(model.key, 'domain')]),

      section('scope', 'Scope', scopeBody(model, params, org), P.POLICY, [ref.org('technology_env')]),

      section('objectives', 'Objectives',
        joinBlocks(
          h.p(TP('policy.objectivesLead', 'This Policy is intended to achieve the following objectives:')),
          h.ul(model.objectives.map((o) => resolveText(o, params)))
        ),
        P.POLICY, [ref.requirement(model.key, 'objectives')]),

      section('statements', 'Policy Statements',
        joinBlocks(
          h.p(TP('policy.statementsLead', 'The following statements are mandatory. The bracketed reference after each statement identifies the authoritative source requirement it addresses.')),
          statementsBody
        ), P.POLICY, reqs.flatMap((r) => refsForRequirement(model.key, r, frameworkCodes))),

      section('roles', 'Roles and Responsibilities',
        joinBlocks(
          h.p(TP('policy.rolesLead',
            `The following roles carry accountability and responsibility for this Policy. The complete assignment is recorded in the ${model.name} RACI Matrix.`,
            { matrix: docTitle(model, 'RACI Matrix') })),
          h.table([T('Role'), T('Accountable for'), T('Responsible for')], roleRows)
        ), P.POLICY, [ref.requirement(model.key, 'raci')]),

      section('governance', 'Governance',
        joinBlocks(
          h.p(TP('governance.lead', 'This Policy is governed as follows:')),
          h.ul([
            TP('governance.owner', 'The Chief Information Security Officer owns this Policy and is accountable for its adequacy.'),
            TP('governance.approver', 'The Cybersecurity Steering Committee approves this Policy and any material amendment to it.'),
            TP('governance.maintainer', 'The Cybersecurity GRC Manager maintains the Policy, its supporting Standard and Procedure, and the control library that implements it.'),
            TP('governance.reporting', 'Control performance is reported to the Cybersecurity Steering Committee on the agreed reporting cycle.'),
            TP('governance.assurance', 'Internal Audit provides independent assurance over the controls implementing this Policy.')
          ])
        ), P.POLICY, []),

      section('compliance', 'Compliance',
        joinBlocks(
          h.p(TP('compliance.mandatory', 'Compliance with this Policy is mandatory. Compliance is assessed through control testing, internal review and independent audit.')),
          h.p(TP('compliance.sourcesLead', 'This Policy supports compliance with the following authoritative sources:')),
          h.table([TP('compliance.colSource', 'Source'), TP('compliance.colType', 'Type'), TP('compliance.colRequirements', 'Referenced requirements')],
            frameworks.map((f) => [
              f.name,
              f.kind === 'regulation' ? TP('provenance.regulatory', 'Regulatory requirement') : TP('provenance.framework', 'Framework guidance'),
              refLabel(reqs.flatMap((r) => applicableRefs(r, [f.code])))
            ])),
          h.callout('note', TP('compliance.tracebilityTitle', 'Source traceability'),
            TP('compliance.traceability', 'Framework references identify the authoritative requirements this Policy is designed to address. They are reproduced as reference metadata and must be verified against the official publication before being relied upon for regulatory attestation.'))
        ), P.FRAMEWORK, frameworkCodes.map((c) => ({ type: 'framework', framework: c }))),

      section('exceptions', 'Exceptions',
        joinBlocks(
          h.p(TP('exceptions.lead', 'Any departure from this Policy requires a formal, time-bound exception.')),
          h.ul([
            TP('exceptions.record', 'Exception requests shall record the requirement not met, the business reason, the compensating controls in place and the residual risk.'),
            TP('exceptions.approve', 'Exceptions shall be approved by the Chief Information Security Officer, and by the Cybersecurity Steering Committee where the residual risk is rated Critical.'),
            TP('exceptions.expiry', 'Exceptions shall carry an expiry date not exceeding 12 months and shall be re-evaluated on expiry rather than automatically renewed.'),
            TP('exceptions.register', 'All exceptions in force shall be recorded in the exception register and reported to the Cybersecurity Steering Committee.')
          ])
        ), P.POLICY, []),

      section('monitoring', 'Monitoring and Measurement',
        joinBlocks(
          h.p(TP('monitoring.lead', 'The effectiveness of this Policy is measured through the following indicators:')),
          h.table([T('Control'), T('Indicator'), TP('monitoring.colFrequency', 'Measurement frequency')],
            reqs.filter((r) => r.kpi).map((r) => [r.controlName, resolveText(r.kpi, params), resolveText(r.frequency, params)]))
        ), P.POLICY, reqs.map((r) => ref.requirement(model.key, r.key))),

      section('review', 'Review',
        joinBlocks(
          h.p(TP('review.lead', 'This Policy shall be reviewed at least annually, and additionally when any of the following occurs:')),
          h.ul([
            TP('review.lawChange', 'A change to applicable laws, regulations or adopted frameworks.'),
            TP('review.orgChange', 'A material change to the organisational structure, technology environment or operating model.'),
            TP('review.incident', 'A significant cybersecurity incident within this domain.'),
            TP('review.auditFinding', 'An audit or assessment finding indicating that the Policy is inadequate.')
          ]),
          h.p(TP('review.owner', 'The Document Owner is responsible for initiating the review and the approving authority for reissuing the Policy.'))
        ), P.POLICY, []),

      section('enforcement', 'Enforcement',
        joinBlocks(
          h.p(TP('enforcement.discipline', 'Failure to comply with this Policy may result in disciplinary action in accordance with the applicable human resources policies, and for third parties may constitute a breach of contract.')),
          h.p(TP('enforcement.circumvention', 'Deliberate circumvention of a security control required by this Policy shall be treated as a cybersecurity incident and investigated accordingly.'))
        ), P.POLICY, []),

      section('references', 'References',
        joinBlocks(
          h.p(TP('references.readWith', 'This Policy should be read together with:')),
          h.ul([
            docTitle(model, 'Standard'),
            docTitle(model, 'Procedure'),
            docTitle(model, 'Roles and Responsibilities'),
            docTitle(model, 'RACI Matrix'),
            docTitle(model, 'Control Matrix'),
            TP('references.orgPolicy', 'Cybersecurity Policy (organisation-wide)'),
            TP('references.classification', 'Information Classification and Handling Standard'),
            TP('references.incident', 'Cybersecurity Incident Management Procedure')
          ]),
          h.p(TP('references.sourcesLead', 'Authoritative sources:')),
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
    PL(k),
    resolveText(String(v), params)
  ]);

  return {
    docType: 'standard',
    title: docTitle(model, 'Standard'),
    provenance: P.STANDARD,
    sections: [
      section('purpose', 'Purpose',
        joinBlocks(
          h.p(TP('standard.purposeLead',
            `This Standard defines the mandatory, measurable requirements that implement the ${model.name} Policy at ${params.orgName}.`,
            { org: params.orgName, policy: docTitle(model, 'Policy') })),
          h.p(TP('standard.purposeTrace', 'Each requirement in this Standard traces to a clause of the Policy and to the authoritative source requirements the Policy addresses. Where this Standard specifies a value — a frequency, a threshold or a period — that value is the single agreed figure and is used unchanged in the corresponding Procedure and control records.'))
        ), P.STANDARD, []),

      section('scope', 'Scope',
        joinBlocks(
          h.p(TP('standard.scopeSame', `This Standard applies to the same scope as the ${model.name} Policy.`,
            { policy: docTitle(model, 'Policy') })),
          h.p(TP('standard.scopePlatforms', 'Technical requirements apply to every platform capable of enforcing them. Where a platform cannot enforce a requirement, a documented exception with compensating controls is required before the platform enters or remains in service.'))
        ), P.STANDARD, []),

      section('mandatory', 'Mandatory Requirements', mandatoryBody, P.STANDARD,
        reqs.flatMap((r) => refsForRequirement(model.key, r, frameworkCodes))),

      section('parameters', 'Defined Values',
        joinBlocks(
          h.p(TP('parameters.lead', 'The following values are the agreed organisational parameters for this domain. Any document, configuration or control referring to these commitments shall use these values.')),
          h.table([T('Parameter'), TP('parameters.colValue', 'Agreed value')], paramRows),
          h.callout('warning', TP('parameters.changeTitle', 'Change control'),
            TP('parameters.change', 'Changing a value in this table changes an organisational commitment. Amendments require Policy Owner approval and shall be propagated to the Procedure, the control library and any affected configuration baseline.'))
        ), P.STANDARD, Object.keys(model.parameters).map((k) => ref.parameter(k))),

      section('technical', 'Technical Requirements',
        technical.length
          ? joinBlocks(
              h.p(TP('technical.lead', 'The following requirements are enforced through technical configuration and shall be verifiable by configuration export, scan or platform report:')),
              h.table([T('Ref'), T('Requirement'), TP('technical.colPoint', 'Enforcement point'), TP('technical.colVerification', 'Verification')],
                technical.map((r) => {
                  const i = reqs.indexOf(r);
                  return [`3.${i + 1}`, r.title,
                    r.controlNature === 'hybrid'
                      ? TP('technical.hybrid', 'Technical with procedural support')
                      : TP('technical.configuration', 'Technical configuration'),
                    r.evidence[0] || TP('technical.defaultEvidence', 'Configuration evidence')];
                }))
            )
          : h.p(TP('technical.administrativeOnly', 'This domain is implemented primarily through administrative controls. Technical enforcement requirements are specified in the related domain Standards.')),
        P.STANDARD, technical.map((r) => ref.requirement(model.key, r.key))),

      section('security', 'Security Requirements',
        joinBlocks(
          h.p(TP('security.lead', 'The following security properties shall be preserved by every implementation of this Standard:')),
          h.ul([
            TP('security.attribution', 'Individual attribution: every action taken under this Standard shall be attributable to a uniquely identified person, service or device.'),
            TP('security.leastPrivilege', 'Least privilege: access and capability granted shall be the minimum sufficient for the task.'),
            TP('security.sod', 'Segregation of duties: the party performing an activity shall not be the sole party assuring it.'),
            TP('security.auditability', 'Auditability: each requirement shall produce evidence sufficient to demonstrate operation to an independent reviewer.'),
            TP('security.failSecure', 'Fail-secure: where a control cannot operate, the system shall default to denying access rather than permitting it.')
          ])
        ), P.STANDARD, []),

      section('controls', 'Minimum Controls',
        joinBlocks(
          h.p(TP('controls.lead', 'The following controls are the minimum required to satisfy this Standard. They are maintained in the Control Library and tested on the stated frequency.')),
          h.table([T('Control ID'), T('Control'), T('Type'), T('Frequency'), TP('controls.colResponsible', 'Responsible role')],
            reqs.map((r, i) => [
              `${domainShort(model.key)}-${String(i + 1).padStart(3, '0')}`,
              r.controlName,
              r.controlType,
              resolveText(r.frequency, params),
              RN(defaultResponsible(model, r))
            ]))
        ), P.STANDARD, reqs.map((r) => ref.requirement(model.key, r.key))),

      section('exceptions', 'Exceptions',
        joinBlocks(
          h.p(TP('standard.exceptionsLead', 'Exceptions to this Standard follow the exception process defined in the Policy.')),
          h.ul([
            TP('standard.exceptionTechnical', 'Technical exceptions shall record the platform limitation preventing compliance.'),
            TP('standard.exceptionCompensating', 'A compensating control shall be identified and its operation evidenced for the duration of the exception.'),
            TP('standard.exceptionCritical', 'Exceptions to requirements rated Critical risk shall require Cybersecurity Steering Committee approval.')
          ])
        ), P.STANDARD, []),

      section('monitoring', 'Monitoring',
        joinBlocks(
          h.p(TP('standard.monitoringLead', 'Compliance with this Standard is monitored as follows:')),
          h.table([T('Requirement'), T('Indicator'), T('Frequency'), TP('standard.colReportedTo', 'Reported to')],
            reqs.filter((r) => r.kpi).map((r) => [r.title, resolveText(r.kpi, params), resolveText(r.frequency, params), RN('grc_manager')]))
        ), P.STANDARD, []),

      section('compliance', 'Compliance',
        joinBlocks(
          h.p(TP('standard.complianceLead', 'This Standard supports compliance with the following authoritative sources:')),
          h.table([T('Source'), TP('compliance.colRequirements', 'Referenced requirements')],
            frameworks.map((f) => [f.name, refLabel(reqs.flatMap((r) => applicableRefs(r, [f.code])))])),
          h.p(TP('standard.nonCompliance', 'Non-compliance identified through testing or audit shall be recorded as a finding, risk-rated and tracked to closure.'))
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
        `<div class="proc-step"><h4>${escapeHtml(T('Step'))} ${s.no} — ${escapeHtml(resolveText(s.name, params))}</h4>` +
        `<p class="proc-actor"><strong>${escapeHtml(TP('procedure.performedBy', 'Performed by:'))}</strong> ${escapeHtml(resolveText(s.actor, params))}</p>` +
        `<p>${escapeHtml(resolveText(s.detail, params))}</p>` +
        (s.decision
          ? `<div class="callout" data-callout="decision"><strong>${escapeHtml(TP('procedure.decision', 'Decision:'))} ${escapeHtml(resolveText(s.decision.question, params))}</strong>` +
            `<p><strong>${escapeHtml(TP('procedure.ifYes', 'Yes'))} →</strong> ${escapeHtml(resolveText(s.decision.yes, params))}</p>` +
            `<p><strong>${escapeHtml(TP('procedure.ifNo', 'No'))} →</strong> ${escapeHtml(resolveText(s.decision.no, params))}</p></div>`
          : '') +
        `</div>`
    )
    .join('');

  const flow = steps.map((s) => resolveText(s.name, params)).join(' → ');

  return {
    docType: 'procedure',
    title: docTitle(model, 'Procedure'),
    provenance: P.PROCEDURE,
    flow: { steps, title: docTitle(model, 'Process Flow') },
    sections: [
      section('purpose', 'Purpose',
        joinBlocks(
          h.p(resolveText(proc.purpose, params)),
          h.p(TP('procedure.implements',
            `This Procedure implements the ${model.name} Policy and ${model.name} Standard. Values stated here are taken from the Standard and are not independently set.`,
            { policy: docTitle(model, 'Policy'), standard: docTitle(model, 'Standard') }))
        ), P.PROCEDURE, []),

      section('scope', 'Scope',
        h.p(TP('procedure.scope',
          `This Procedure applies to all personnel performing the activities described, across the scope defined in the ${model.name} Policy.`,
          { policy: docTitle(model, 'Policy') })),
        P.PROCEDURE, []),

      section('preconditions', 'Preconditions',
        joinBlocks(h.p(TP('procedure.preconditionsLead', 'The following shall be in place before this Procedure is executed:')), h.ul(proc.preconditions.map((p) => resolveText(p, params)))),
        P.PROCEDURE, []),

      section('inputs', 'Inputs',
        joinBlocks(h.p(TP('procedure.inputsLead', 'This Procedure takes the following inputs:')), h.ul(proc.inputs.map((p) => resolveText(p, params)))),
        P.PROCEDURE, []),

      section('process', 'Process Overview',
        joinBlocks(
          h.p(TP('procedure.processLead', 'The process proceeds through the following stages:')),
          `<p class="proc-flow">${escapeHtml(flow)}</p>`,
          h.table([T('Step'), TP('procedure.colStage', 'Stage'), TP('procedure.colPerformedBy', 'Performed by')],
            steps.map((s) => [String(s.no), resolveText(s.name, params), resolveText(s.actor, params)]))
        ), P.PROCEDURE, []),

      section('steps', 'Detailed Steps', stepBody, P.PROCEDURE, [ref.requirement(model.key, 'procedure')]),

      section('decisions', 'Decision Points',
        decisions.length
          ? h.table([T('Step'), TP('procedure.colDecision', 'Decision'), TP('procedure.colIfYes', 'If yes'), TP('procedure.colIfNo', 'If no')],
              decisions.map((s) => [String(s.no), resolveText(s.decision.question, params), resolveText(s.decision.yes, params), resolveText(s.decision.no, params)]))
          : h.p(TP('procedure.noDecisions', 'This Procedure contains no conditional decision points; all steps are executed in sequence.')),
        P.PROCEDURE, []),

      section('escalation', 'Escalation',
        joinBlocks(h.p(TP('procedure.escalationLead', 'The following conditions require escalation:')), h.ul(proc.escalation.map((p) => resolveText(p, params)))),
        P.PROCEDURE, []),

      section('outputs', 'Outputs',
        joinBlocks(h.p(TP('procedure.outputsLead', 'Successful execution produces:')), h.ul(proc.outputs.map((p) => resolveText(p, params)))),
        P.PROCEDURE, []),

      section('records', 'Records and Evidence',
        joinBlocks(
          h.p(TP('procedure.recordsLead', 'The following records shall be created and retained. These records are the evidence relied upon during control testing and audit.')),
          h.ul(proc.records.map((p) => resolveText(p, params)))
        ), P.PROCEDURE, []),

      section('kpis', 'Key Performance Indicators',
        h.table([T('Indicator'), TP('kpis.colTarget', 'Target')], proc.kpis.map((k) => [resolveText(k.name, params), resolveText(k.target, params)])),
        P.PROCEDURE, []),

      section('roles', 'Roles',
        joinBlocks(
          h.p(TP('procedure.rolesLead', 'The roles participating in this Procedure and their assignment are:')),
          h.table([T('Role'), TP('procedure.colAssignment', 'Assignment in this Procedure')],
            model.roles.map((code) => {
              const a = model.raciActivities.filter((x) => x.assign[code] === 'A').length;
              const r = model.raciActivities.filter((x) => x.assign[code] === 'R').length;
              const parts = [];
              if (a) parts.push(TP('procedure.accountableForN', `Accountable for ${a} activit${a === 1 ? 'y' : 'ies'}`, { n: a }));
              if (r) parts.push(TP('procedure.responsibleForN', `Responsible for ${r} activit${r === 1 ? 'y' : 'ies'}`, { n: r }));
              return [RN(code), parts.length ? parts.join('; ') : TP('procedure.consultedOnly', 'Consulted or informed only')];
            }))
        ), P.PROCEDURE, []),

      section('exceptions', 'Exceptions',
        joinBlocks(
          h.p(TP('procedure.exceptionsLead', 'Where this Procedure cannot be followed:')),
          h.ul([
            TP('procedure.deviationRecord', 'The deviation shall be recorded at the time it occurs, with the reason and the approver.'),
            TP('procedure.deviationControl', 'Deviations affecting a control required by the Standard shall be raised as an exception under the Policy exception process.'),
            TP('procedure.deviationRepeat', 'Repeated deviation for the same cause shall trigger a review of this Procedure rather than continued exception.')
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
    title: docTitle(model, 'Guideline'),
    provenance: P.GUIDANCE,
    sections: [
      section('purpose', 'Purpose',
        joinBlocks(
          h.p(TP('guideline.purpose', `This Guideline offers non-mandatory implementation advice for the ${model.name} Standard.`,
            { standard: docTitle(model, 'Standard') })),
          h.callout('note', TP('guideline.statusTitle', 'Status of this document'),
            TP('guideline.status', 'This Guideline is advisory. It does not create obligations. Where it appears to conflict with the Policy or Standard, the Policy or Standard prevails.'))
        ), P.GUIDANCE, []),
      section('scope', 'Scope',
        h.p(TP('guideline.scope', `Intended for teams implementing or operating ${model.name.toLowerCase()} controls at ${params.orgName}.`,
          { domain: model.name, org: params.orgName })), P.GUIDANCE, []),
      section('guidance', 'Implementation Guidance',
        reqs.map((r) => `<h4>${escapeHtml(r.title)}</h4><p>${escapeHtml(resolveText(r.guidance || r.standard, params))}</p>`).join(''),
        P.GUIDANCE, reqs.map((r) => ref.requirement(model.key, r.key))),
      section('pitfalls', 'Common Pitfalls',
        joinBlocks(
          h.p(TP('guideline.pitfallsLead', 'The following are the failure modes most frequently observed in this domain:')),
          h.ul(reqs.map((r) => `${r.title}: ${resolveText(r.risk, params)}`))
        ), P.GUIDANCE, []),
      section('references', 'References',
        h.ul([docTitle(model, 'Policy'), docTitle(model, 'Standard'), docTitle(model, 'Procedure')]), P.GUIDANCE, [])
    ]
  };
}

// ----------------------------------------------- roles & responsibilities --

export function buildRolesDoc({ model, params, roles }) {
  const sections = [
    section('purpose', 'Purpose',
      joinBlocks(
        h.p(TP('roles.purposeLead',
          `This document defines the cybersecurity roles and responsibilities applicable to the ${model.name} domain at ${params.orgName}.`,
          { domain: model.name, org: params.orgName })),
        h.p(TP('roles.purposeContents', 'Each role records its purpose, reporting line, authority, responsibilities, accountabilities, required approvals, escalation duties, competencies and interfaces with other roles.'))
      ), P.POLICY, []),
    section('structure', 'Role Summary',
      h.table([T('Role'), T('Category'), TP('roles.colReportingLine', 'Reporting line')],
        roles.map((r) => [r.name, T(r.category), resolveText(r.reportingLine, params)])),
      P.POLICY, [])
  ];

  for (const role of roles) {
    const accountable = model.raciActivities.filter((a) => a.assign[role.code] === 'A').map((a) => a.activity);
    const responsible = model.raciActivities.filter((a) => a.assign[role.code] === 'R').map((a) => a.activity);
    const consulted = model.raciActivities.filter((a) => ['C', 'S'].includes(a.assign[role.code])).map((a) => a.activity);

    sections.push(section(`role_${role.code}`, role.name,
      joinBlocks(
        `<p class="role-purpose">${escapeHtml(resolveText(role.purpose, params))}</p>`,
        h.table([TP('roles.colAttribute', 'Attribute'), TP('roles.colDefinition', 'Definition')], [
          [TP('roles.colReportingLine', 'Reporting line'), resolveText(role.reportingLine, params)],
          [TP('roles.authority', 'Authority'), resolveText(role.authority, params)],
          [T('Category'), T(role.category)]
        ]),
        h.heading(4, TP('roles.responsibilities', 'Key Responsibilities')), h.ul(role.responsibilities.map((x) => resolveText(x, params))),
        h.heading(4, TP('roles.accountabilities', 'Accountabilities')), h.ul(role.accountabilities.map((x) => resolveText(x, params))),
        h.heading(4, TP('roles.activities', 'Required Activities')), h.ul(role.activities.map((x) => resolveText(x, params))),
        h.heading(4, TP('roles.approvals', 'Required Approvals')), h.ul(role.approvals.map((x) => resolveText(x, params))),
        h.heading(4, TP('roles.escalations', 'Escalation Responsibilities')), h.ul(role.escalations.map((x) => resolveText(x, params))),
        h.heading(4, TP('roles.competencies', 'Required Competencies')), h.ul(role.competencies),
        h.heading(4, TP('roles.interfaces', 'Interfaces with Other Roles')),
        h.table([TP('roles.colInterfacesWith', 'Interfaces with'), TP('roles.colInterfaceNature', 'Nature of the interface')],
          role.interfaces.map((i) => [i.role, i.nature])),
        h.heading(4, TP('roles.raciIn', `RACI Assignment in ${model.name}`, { domain: model.name })),
        h.table([TP('roles.colAssignment', 'Assignment'), TP('roles.colActivities', 'Activities')], [
          [T('Accountable'), accountable.length ? accountable.join('; ') : '—'],
          [T('Responsible'), responsible.length ? responsible.join('; ') : '—'],
          [TP('roles.consultedSupport', 'Consulted / Support'), consulted.length ? consulted.join('; ') : '—']
        ])
      ), P.POLICY, [ref.requirement(model.key, 'roles')]));
  }

  sections.push(section('review', 'Review',
    h.p(TP('roles.review', 'Role definitions shall be reviewed at least annually and whenever the organisational structure changes. Vacant roles shall be reported to the Chief Information Security Officer and reassigned within 10 business days.')),
    P.POLICY, []));

  return { docType: 'roles', title: docTitle(model, 'Roles and Responsibilities'), provenance: P.POLICY, sections };
}

// ---------------------------------------------------------------- RACI -----

export function buildRaciDoc({ model, params, mode = 'raci' }) {
  const cols = model.roles;
  const headers = [T('Activity'), T('Phase'), ...cols.map((c) => RS(c))];
  const rows = model.raciActivities.map((a) => [
    a.activity,
    a.phase ? T(a.phase) : '—',
    ...cols.map((c) => a.assign[c] || '')
  ]);

  const LEGEND = {
    R: [T('Responsible'), TP('raci.defR', 'Performs the activity.')],
    A: [T('Accountable'), TP('raci.defA', 'Answerable for the outcome. Exactly one per activity.')],
    S: [T('Supportive'), TP('raci.defS', 'Provides resources or assistance to the responsible role.')],
    C: [T('Consulted'), TP('raci.defC', 'Provides input before the activity completes. Two-way communication.')],
    I: [T('Informed'), TP('raci.defI', 'Told of the outcome. One-way communication.')]
  };
  const legend = (mode === 'rasci' ? ['R', 'A', 'S', 'C', 'I'] : ['R', 'A', 'C', 'I'])
    .map((code) => [code, ...LEGEND[code]]);

  return {
    docType: 'raci',
    title: docTitle(model, 'RACI Matrix'),
    provenance: P.POLICY,
    matrix: { cols, activities: model.raciActivities, mode },
    sections: [
      section('purpose', 'Purpose',
        h.p(TP('raci.purpose',
          `This matrix assigns responsibility and accountability for each ${model.name} activity at ${params.orgName}. Exactly one role is Accountable for every activity.`,
          { domain: model.name, org: params.orgName })),
        P.POLICY, []),
      section('legend', 'Legend',
        h.table([TP('raci.colCode', 'Code'), TP('raci.colMeaning', 'Meaning'), TP('roles.colDefinition', 'Definition')], legend),
        P.POLICY, []),
      section('matrix', 'Matrix', h.table(headers, rows), P.POLICY, [ref.requirement(model.key, 'raci')]),
      section('notes', 'Notes',
        h.ul([
          TP('raci.noteOneAccountable', 'Exactly one role is Accountable for each activity. Where two roles appear to share accountability, the matrix has not yet been agreed.'),
          TP('raci.noteDelegation', 'Accountability may not be delegated; responsibility may.'),
          TP('raci.noteConsulted', 'Roles listed as Consulted shall be engaged before the activity completes, not informed afterwards.'),
          TP('raci.noteReview', 'This matrix is reviewed whenever the organisational structure changes and at least annually.')
        ]), P.POLICY, [])
    ]
  };
}

// ------------------------------------------------------- control matrix ----

export function buildControlMatrix({ model, params, frameworkCodes, controls }) {
  return {
    docType: 'control_matrix',
    title: docTitle(model, 'Control Matrix'),
    provenance: P.STANDARD,
    sections: [
      section('purpose', 'Purpose',
        h.p(TP('matrix.purpose',
          `This matrix records the ${model.name} controls, their attributes, the evidence that demonstrates their operation, and the authoritative requirements they satisfy.`,
          { domain: model.name })),
        P.STANDARD, []),
      section('matrix', 'Control Matrix',
        h.table(
          [T('Control ID'), T('Control'), T('Type'), T('Frequency'), T('Responsible'), T('Risk'), TP('matrix.colMapping', 'Framework mapping')],
          controls.map((c) => [c.control_id, c.name, `${T(c.control_type)} / ${T(c.control_nature)}`, c.frequency, c.responsible_role, T(c.risk_rating), c.mappingLabel || '—'])
        ), P.STANDARD, []),
      section('evidence', 'Evidence Requirements',
        h.table([T('Control ID'), TP('matrix.colEvidence', 'Evidence required'), TP('matrix.colCollection', 'Collection frequency')],
          controls.flatMap((c) => c.evidenceItems.map((e) => [c.control_id, e, c.frequency]))),
        P.STANDARD, []),
      section('kpis', 'Control Indicators',
        h.table([T('Control ID'), T('Indicator'), T('Risk addressed')], controls.map((c) => [c.control_id, c.kpi || '—', c.risk])),
        P.STANDARD, [])
    ]
  };
}

// -------------------------------------------------------- framework doc ----

export function buildFrameworkDoc({ model, params, frameworks, frameworkCodes }) {
  const reqs = model.requirements;
  return {
    docType: 'framework',
    title: docTitle(model, 'Control Framework'),
    provenance: P.POLICY,
    sections: [
      section('purpose', 'Purpose',
        h.p(TP('framework.purpose',
          `This document describes the ${params.orgName} control framework for the ${model.name} domain and how it maps to the adopted authoritative sources.`,
          { org: params.orgName, domain: model.name })),
        P.POLICY, []),
      section('structure', 'Framework Structure',
        joinBlocks(
          h.p(TP('framework.structureLead', 'The framework follows the organisation-wide governance hierarchy:')),
          h.ol([
            TP('framework.tierRegulation', 'Regulation and framework — authoritative external requirements.'),
            TP('framework.tierControl', 'Organisational control — the control the organisation operates to satisfy them.'),
            TP('framework.tierPolicy', 'Policy — the mandatory organisational position.'),
            TP('framework.tierStandard', 'Standard — measurable requirements implementing the policy.'),
            TP('framework.tierProcedure', 'Procedure — the steps by which requirements are carried out.'),
            TP('framework.tierWorkInstruction', 'Work instruction — platform-specific execution detail.'),
            TP('framework.tierEvidence', 'Evidence — the record demonstrating the control operated.')
          ])
        ), P.POLICY, []),
      section('sources', 'Adopted Sources',
        joinBlocks(
          h.table([T('Source'), TP('framework.colPublisher', 'Publisher'), T('Type'), TP('framework.colVersion', 'Version')],
            frameworks.map((f) => [f.name, f.publisher,
              f.kind === 'regulation' ? TP('framework.kindRegulatory', 'Regulatory') : TP('framework.kindFramework', 'Framework'),
              f.version || '—'])),
          h.callout('note', TP('framework.provenanceTitle', 'Provenance'),
            TP('framework.provenance', 'Requirements drawn from these sources are authoritative. Controls, policies, standards and procedures produced by the organisation are organisational content and are labelled as such throughout this platform.'))
        ), P.FRAMEWORK, []),
      section('coverage', 'Control Coverage',
        h.table([TP('framework.colControl', 'Organisational control'), TP('framework.colAddresses', 'Addresses')],
          reqs.map((r, i) => [`${domainShort(model.key)}-${String(i + 1).padStart(3, '0')} — ${r.controlName}`, refLabel(applicableRefs(r, frameworkCodes))])),
        P.POLICY, []),
      section('governance', 'Framework Governance',
        h.ul([
          TP('framework.govOwner', 'The Chief Information Security Officer owns this framework.'),
          TP('framework.govMapping', 'The Cybersecurity GRC Manager maintains the mapping between source requirements and organisational controls.'),
          TP('framework.govReview', 'Mapping coverage is reviewed at least annually and whenever an adopted source is revised.'),
          TP('framework.govGaps', 'Coverage gaps are recorded in the gap assessment and tracked to closure.')
        ]), P.POLICY, [])
    ]
  };
}
