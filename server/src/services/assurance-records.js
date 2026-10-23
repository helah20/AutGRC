/**
 * The two assurance records an auditor reads after the plan: the report of an
 * internal audit (ISO/IEC 27001 9.2.2; NCA ECC 1-8-2, 1-8-3) and the minutes
 * of a management review (ISO/IEC 27001 9.3.3; ECC 1-2-3).
 *
 * Each is built as a document payload for the Word and PDF exporters, from
 * what the platform holds. Where a judgement belongs to a person — the audit
 * opinion, the committee's decisions — the record carries what that person
 * recorded, or says plainly that it has not been recorded yet.
 */

import { q } from '../db/index.js';
import { h, joinBlocks } from './html.js';

const label = (s) => String(s || '').replace(/_/g, ' ');

function reportDocument({ reference, title, status, date }) {
  return {
    reference, title, doc_type: 'report', domain_key: '', status,
    classification: 'confidential', version: '1.0',
    created_at: date, review_date: null, effective_date: date.slice(0, 10)
  };
}

/** Corrective actions raised against an assessment or any of its gap items. */
function actionsFor(assessmentId) {
  return q.all(
    `SELECT a.*, u.name AS owner_name, v.name AS verified_by_name, g.requirement_ref
       FROM corrective_actions a
       LEFT JOIN users u ON u.id = a.owner_id
       LEFT JOIN users v ON v.id = a.verified_by
       LEFT JOIN gap_items g ON a.source_type = 'gap_item' AND g.id = a.source_id
      WHERE (a.source_type = 'assessment' AND a.source_id = ?)
         OR (a.source_type = 'gap_item' AND g.assessment_id = ?)
      ORDER BY a.action_id`,
    assessmentId, assessmentId
  );
}

/**
 * Internal audit report for one assessment.
 * Returns null when the assessment does not exist.
 */
export function auditReportPayload(assessmentId) {
  const a = q.get(
    `SELECT a.*, f.code AS framework_code, f.name AS framework_name, f.version AS framework_version, u.name AS owner_name
       FROM assessments a LEFT JOIN frameworks f ON f.id = a.framework_id LEFT JOIN users u ON u.id = a.owner_id
      WHERE a.id = ?`, assessmentId);
  if (!a) return null;

  const items = q.all('SELECT * FROM gap_items WHERE assessment_id = ? ORDER BY requirement_ref', a.id);
  const count = (s) => items.filter((i) => i.status === s).length;
  const assessable = items.length - count('not_applicable');
  const rate = assessable ? Math.round(((count('compliant') + count('partially_compliant') * 0.5) / assessable) * 100) : 0;
  const nonconformities = items.filter((i) => i.status === 'non_compliant' || i.status === 'partially_compliant');
  const actions = actionsFor(a.id);
  const covered = new Set(actions.filter((x) => x.status !== 'cancelled').map((x) => x.requirement_ref).filter(Boolean));
  const withoutAction = nonconformities.filter((n) => !covered.has(n.requirement_ref));
  const overdue = actions.filter((x) => ['open', 'in_progress', 'blocked'].includes(x.status)
    && x.due_date && x.due_date < new Date().toISOString().slice(0, 10));

  const criteria = a.framework_name
    ? `${a.framework_name}${a.framework_version ? ` (${a.framework_version})` : ''}`
    : 'Not linked to a framework in the platform';

  const sections = [
    { heading: 'Audit Objective and Scope', body: joinBlocks(
      h.table(['Item', 'Detail'], [
        ['Audit', a.name],
        ['Audit criteria', criteria],
        ['Scope', a.scope || 'Not recorded'],
        ['Lead auditor', a.owner_name || 'Not assigned'],
        ['Period', `${(a.started_at || a.created_at || '').slice(0, 10)} to ${(a.due_at || '').slice(0, 10) || 'open'}`],
        ['Status', label(a.status)]
      ]),
      h.p('The audit assessed each requirement in scope against the evidence recorded in the platform. NCA ECC 1-8-2 requires the review to be conducted independently of the cybersecurity function; the lead auditor named above is responsible for that independence.')
    ) },
    { heading: 'Summary of Results', body: joinBlocks(
      h.table(['Result', 'Requirements'], [
        ['Compliant', String(count('compliant'))],
        ['Partially compliant', String(count('partially_compliant'))],
        ['Non-compliant', String(count('non_compliant'))],
        ['Not applicable', String(count('not_applicable'))],
        ['Total assessed', String(items.length)],
        ['Compliance rate', `${rate}% (partial compliance counted as half)`]
      ])
    ) },
    { heading: 'Nonconformities', body: nonconformities.length
      ? h.table(['Requirement', 'Result', 'Gap', 'Risk', 'Recommendation', 'Owner', 'Due'],
        nonconformities.map((n) => [n.requirement_ref || '', label(n.status), n.gap || '', n.risk_rating || '',
          n.recommendation || '', n.owner || '', (n.due_date || '').slice(0, 10)]))
      : h.p('No nonconformity was recorded.') },
    { heading: 'Corrective Actions', body: joinBlocks(
      actions.length
        ? h.table(['Action', 'Requirement', 'Owner', 'Status', 'Due', 'Root cause', 'Verified'],
          actions.map((x) => [x.action_id, x.requirement_ref || 'Whole audit', x.owner_name || '', label(x.status),
            (x.due_date || '').slice(0, 10), x.root_cause || 'Not recorded',
            x.verified_at ? `${x.verified_by_name || ''} ${x.verified_at.slice(0, 10)}`.trim() : 'No']))
        : h.p('No corrective action has been raised against this audit.'),
      withoutAction.length
        ? h.callout('warn', 'Nonconformities without a corrective action',
          `${withoutAction.length} nonconformit${withoutAction.length === 1 ? 'y has' : 'ies have'} no corrective action: ${withoutAction.map((n) => n.requirement_ref).join(', ')}. ISO/IEC 27001 10.2 requires each to be acted on.`)
        : '',
      overdue.length
        ? h.callout('warn', 'Overdue corrective actions', `${overdue.map((x) => x.action_id).join(', ')} ${overdue.length === 1 ? 'is' : 'are'} past the due date.`)
        : ''
    ) },
    { heading: 'Audit Conclusion', body: joinBlocks(
      h.p(`Of ${assessable} applicable requirement(s), ${count('compliant')} were found compliant, ${count('partially_compliant')} partially compliant and ${count('non_compliant')} non-compliant. ${nonconformities.length - withoutAction.length} of ${nonconformities.length} nonconformities have a corrective action.`),
      h.p('The audit opinion is the lead auditor\'s judgement and is not generated by the platform. It is to be added here and signed before the report is issued.')
    ) },
    { heading: 'Distribution', body: h.p('NCA ECC 1-8-3 requires audit results, including scope, observations, recommendations and corrective actions, to be presented to the cybersecurity supervisory committee and to the Authorized Official.') }
  ];

  return {
    document: reportDocument({ reference: `IAR-${a.id.slice(-6).toUpperCase()}`, title: `Internal Audit Report — ${a.name}`, status: a.status === 'completed' ? 'published' : 'draft', date: a.updated_at || a.created_at }),
    sections, owner: a.owner_name ? { name: a.owner_name } : null, approver: null, versions: [], approvals: [], frameworks: [],
    domainName: 'All domains', docTypeLabel: 'Internal Audit Report'
  };
}

export const DECISION_CATEGORY = {
  improvement: 'Opportunity for continual improvement',
  change: 'Change to the management system',
  resources: 'Resources',
  risk: 'Risk acceptance or treatment',
  other: 'Other'
};

/** The decisions of a review, with the state of the action raised for each. */
export function reviewDecisions(reviewId) {
  return q.all(
    `SELECT d.*, u.name AS owner_name, a.action_id AS action_ref, a.status AS action_status, a.verified_at AS action_verified_at
       FROM management_review_decisions d
       LEFT JOIN users u ON u.id = d.owner_id
       LEFT JOIN corrective_actions a ON a.id = d.action_id
      WHERE d.review_id = ? ORDER BY d.position`, reviewId);
}

/** Minutes of one management review, for export. */
export function reviewMinutesPayload(reviewId) {
  const r = q.get('SELECT * FROM management_reviews WHERE id = ? OR review_id = ?', reviewId, reviewId);
  if (!r) return null;
  let inputs = { headers: [], rows: [] };
  try { inputs = JSON.parse(r.inputs_snapshot); } catch { /* an unreadable snapshot is shown as empty */ }
  const decisions = reviewDecisions(r.id);

  const sections = [
    { heading: 'Meeting', body: h.table(['Item', 'Detail'], [
      ['Review', r.review_id],
      ['Date', r.held_on],
      ['Forum', r.forum || 'Not recorded'],
      ['Chair', r.chair || 'Not recorded'],
      ['Attendees', r.attendees || 'Not recorded'],
      ['Status', r.status === 'closed' ? `Closed ${String(r.closed_at || '').slice(0, 10)}` : 'Draft']
    ]) },
    { heading: 'Inputs Considered', body: joinBlocks(
      h.p(`The inputs ISO/IEC 27001 9.3.2 requires, as the platform reported them on ${String(inputs.capturedAt || r.created_at).slice(0, 10)}.`),
      h.table(['Input', 'Reference', 'Position', 'Attention'],
        (inputs.rows || []).map((row) => [row[0], row[1], row[2], row[4]]))
    ) },
    { heading: 'Discussion', body: h.p(r.summary || 'No summary recorded.') },
    { heading: 'Decisions and Actions', body: decisions.length
      ? h.table(['#', 'Category', 'Decision', 'Owner', 'Due', 'Action'],
        decisions.map((d) => [String(d.position), DECISION_CATEGORY[d.category] || d.category, d.decision,
          d.owner_name || '', d.due_date || '',
          d.action_ref ? `${d.action_ref} (${d.action_verified_at ? 'verified' : label(d.action_status)})` : 'None']))
      : h.p('No decision recorded.') }
  ];

  return {
    document: reportDocument({ reference: r.review_id, title: `Management Review Minutes — ${r.held_on}`, status: r.status === 'closed' ? 'published' : 'draft', date: r.updated_at }),
    sections, owner: null, approver: null, versions: [], approvals: [], frameworks: [],
    domainName: 'All domains', docTypeLabel: 'Management Review Minutes'
  };
}
