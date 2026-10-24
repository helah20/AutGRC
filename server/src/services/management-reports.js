/**
 * The two records an auditor asks for first, built from the live data set:
 * the internal audit plan (ISO/IEC 27001 9.2, NCA ECC 1-8) and the inputs to
 * the management review (ISO/IEC 27001 9.3.2, ECC 1-2-3 and 1-8-3).
 *
 * Both are proposals for people to act on. The plan ranks the audit universe
 * and says why each domain sits where it does; it does not schedule auditors.
 * The review inputs state the position the platform can measure and say
 * plainly where the platform holds nothing, rather than leaving a clause out.
 */

import { q } from '../db/index.js';
import { DOMAIN_META, DOMAIN_MODELS } from '../knowledge/index.js';
import { rating } from './risk.js';

const OPEN_FINDING = "status IN ('open','acknowledged')";
const OPEN_ACTION = "status IN ('open','in_progress','blocked')";

function parseList(json) {
  try { return Array.isArray(JSON.parse(json)) ? JSON.parse(json) : []; } catch { return []; }
}

/** The references a domain's requirements cite in one framework, in order. */
function citedRefs(domainKey, code, max = 6) {
  const refs = [];
  for (const r of DOMAIN_MODELS[domainKey]?.requirements || []) {
    for (const ref of r.refs?.[code] || []) if (!refs.includes(ref)) refs.push(ref);
  }
  const shown = refs.slice(0, max).join(', ');
  return refs.length > max ? `${shown} +${refs.length - max}` : shown;
}

/**
 * A risk's current rating: residual once somebody has assessed it, inherent
 * until then. Reading an unassessed residual would report a reduction nobody
 * worked out, the same rule the risk register applies.
 */
const CURRENT_RISK = `CASE WHEN residual_assessed THEN residual_likelihood ELSE inherent_likelihood END AS l,
                      CASE WHEN residual_assessed THEN residual_impact ELSE inherent_impact END AS i`;

function openRisksAtOrAbove(domainKey, bands) {
  return q.all(`SELECT ${CURRENT_RISK} FROM risks WHERE domain_key = ? AND status != 'closed'`, domainKey)
    .filter((r) => bands.includes(rating(r.l, r.i))).length;
}

/**
 * Risk-based audit programme across the audit universe.
 *
 * Priority is a count of stated drivers, each shown in the Basis column, so a
 * reader can disagree with a ranking by pointing at the driver rather than at
 * a formula they cannot see.
 */
export function internalAuditPlan() {
  const rows = [];
  for (const d of DOMAIN_META) {
    const controls = q.get('SELECT COUNT(*) AS n FROM controls WHERE domain_key = ?', d.key).n;
    const docs = q.get('SELECT COUNT(*) AS n FROM documents WHERE translation_of IS NULL AND domain_key = ?', d.key).n;
    if (!controls && !docs) continue;

    const criticalControls = q.get("SELECT COUNT(*) AS n FROM controls WHERE domain_key = ? AND risk_rating IN ('high','critical')", d.key).n;
    const evidence = q.get(
      "SELECT COUNT(*) AS total, SUM(status = 'verified') AS verified FROM evidence WHERE domain_key = ?", d.key);
    const evidencePct = evidence.total ? Math.round(((evidence.verified || 0) / evidence.total) * 100) : null;
    const findings = q.get(`SELECT COUNT(*) AS n FROM findings WHERE scope_type = 'domain' AND scope_id = ? AND ${OPEN_FINDING} AND severity IN ('high','critical')`, d.key).n;
    const risks = openRisksAtOrAbove(d.key, ['high', 'critical']);
    const overdue = q.get(`SELECT COUNT(*) AS n FROM corrective_actions WHERE domain_key = ? AND ${OPEN_ACTION} AND due_date < date('now')`, d.key).n;
    const policy = q.get("SELECT COUNT(*) AS n FROM documents WHERE translation_of IS NULL AND domain_key = ? AND doc_type = 'policy' AND status = 'published'", d.key).n;

    const basis = [];
    let points = 0;
    if (risks) { points += 3 * risks; basis.push(`${risks} high or critical open risk(s)`); }
    if (findings) { points += 2 * findings; basis.push(`${findings} open high or critical finding(s)`); }
    if (overdue) { points += overdue; basis.push(`${overdue} overdue corrective action(s)`); }
    if (evidencePct !== null && evidencePct < 50) { points += 2; basis.push(`${evidencePct}% of evidence items verified`); }
    if (!policy) { points += 2; basis.push('no published policy'); }
    if (criticalControls >= 5) { points += 1; basis.push(`${criticalControls} high or critical controls`); }

    const priority = points >= 8 ? 'High' : points >= 3 ? 'Medium' : 'Low';
    rows.push({
      points,
      row: [
        d.name, priority,
        priority === 'High' ? 'Within 3 months' : priority === 'Medium' ? 'Within 6 months' : 'Within 12 months',
        citedRefs(d.key, 'NCA-ECC'), citedRefs(d.key, 'ISO-27001'),
        controls, criticalControls, evidencePct === null ? 'No evidence defined' : `${evidencePct}%`,
        findings, risks, overdue,
        basis.length ? basis.join('; ') : 'No adverse indicator; audited within the annual cycle'
      ]
    });
  }
  rows.sort((a, b) => b.points - a.points);
  return {
    headers: ['Domain', 'Priority', 'Proposed timing', 'Audit criteria (ECC)', 'Audit criteria (ISO 27001)', 'Controls',
      'High/critical controls', 'Evidence verified', 'Open high findings', 'High/critical risks', 'Overdue actions', 'Basis'],
    rows: rows.map((r) => r.row),
    widths: [28, 10, 18, 30, 30, 10, 14, 16, 14, 14, 14, 60]
  };
}

/**
 * Inputs to the management review, one row per input ISO/IEC 27001 9.3.2
 * requires. ECC 1-8-3 has the review and audit results presented to the
 * cybersecurity supervisory committee and the Authorized Official, which is
 * the same meeting for most organisations.
 */
export function managementReviewInputs() {
  const count = (sql, ...args) => q.get(sql, ...args).n;

  const actions = {
    open: count(`SELECT COUNT(*) AS n FROM corrective_actions WHERE ${OPEN_ACTION}`),
    overdue: count(`SELECT COUNT(*) AS n FROM corrective_actions WHERE ${OPEN_ACTION} AND due_date < date('now')`),
    awaiting: count("SELECT COUNT(*) AS n FROM corrective_actions WHERE status = 'completed' AND verified_at IS NULL"),
    verified: count("SELECT COUNT(*) AS n FROM corrective_actions WHERE verified_at >= date('now','-12 months')")
  };
  const applicable = new Set(parseList(q.get('SELECT applicable_frameworks FROM org_profile WHERE id = 1')?.applicable_frameworks));
  const frameworks = {
    applicable: applicable.size,
    // A draft edition of a framework the organisation is not subject to is
    // nobody's change in context.
    draft: q.all("SELECT code, version FROM frameworks WHERE edition_status = 'draft' ORDER BY code")
      .filter((f) => !applicable.size || applicable.has(f.code))
  };
  const bySeverity = Object.fromEntries(q.all(`SELECT severity, COUNT(*) AS n FROM findings WHERE ${OPEN_FINDING} GROUP BY severity`)
    .map((r) => [r.severity, r.n]));
  const findingsOpen = Object.values(bySeverity).reduce((a, b) => a + b, 0);
  const controls = q.get("SELECT COUNT(*) AS total, SUM(status = 'implemented') AS implemented FROM controls WHERE status != 'retired'");
  const evidence = q.get(
    "SELECT COUNT(*) AS total, SUM(status = 'verified') AS verified, SUM(status IN ('missing','expired')) AS lapsed FROM evidence");
  const gaps = q.get(
    `SELECT COUNT(*) AS total, SUM(status = 'compliant') AS compliant, SUM(status = 'partially_compliant') AS partial,
            SUM(status = 'non_compliant') AS non FROM gap_items`);
  const assessments = count('SELECT COUNT(*) AS n FROM assessments');
  const chains = DOMAIN_META.filter((d) =>
    ['policy', 'standard', 'procedure'].every((t) =>
      count("SELECT COUNT(*) AS n FROM documents WHERE translation_of IS NULL AND domain_key = ? AND doc_type = ? AND status = 'published'", d.key, t)));
  const overdueReviews = count("SELECT COUNT(*) AS n FROM documents WHERE translation_of IS NULL AND status != 'retired' AND review_date < date('now')");
  const openRisks = q.all(`SELECT ${CURRENT_RISK}, residual_assessed, status, acceptance_expires FROM risks WHERE status != 'closed'`);
  const riskBands = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const r of openRisks) riskBands[rating(r.l, r.i)] += 1;
  const expiredAcceptances = openRisks.filter((r) => r.status === 'accepted' && r.acceptance_expires
    && r.acceptance_expires < new Date().toISOString().slice(0, 10)).length;
  const untreated = openRisks.filter((r) => r.status === 'identified' || r.status === 'assessed').length;
  const unassessed = openRisks.filter((r) => !r.residual_assessed).length;
  const exclusions = count('SELECT COUNT(*) AS n FROM soa_decisions WHERE applicable = 0');
  const unjustified = count("SELECT COUNT(*) AS n FROM soa_decisions WHERE applicable = 0 AND TRIM(COALESCE(justification, '')) = ''");

  const pct = (a, b) => (b ? `${Math.round(((a || 0) / b) * 100)}%` : 'n/a');
  const decide = (flag) => (flag ? 'Decision needed' : 'For information');

  // The decisions of the last closed review are what 9.3.2 a asks about; the
  // whole action register follows as context.
  const previous = q.get("SELECT id, review_id, held_on FROM management_reviews WHERE status = 'closed' ORDER BY held_on DESC, closed_at DESC LIMIT 1");
  let previousLine = 'No earlier management review is recorded in the platform. ';
  let previousOpen = 0;
  if (previous) {
    const decisions = q.all(
      `SELECT d.action_id, a.status, a.due_date, a.verified_at FROM management_review_decisions d
         LEFT JOIN corrective_actions a ON a.id = d.action_id WHERE d.review_id = ?`, previous.id);
    const withAction = decisions.filter((d) => d.action_id);
    const verifiedPrev = withAction.filter((d) => d.verified_at).length;
    previousOpen = withAction.filter((d) => ['open', 'in_progress', 'blocked'].includes(d.status)).length;
    const overduePrev = withAction.filter((d) => ['open', 'in_progress', 'blocked'].includes(d.status)
      && d.due_date && d.due_date < new Date().toISOString().slice(0, 10)).length;
    previousLine = `${previous.review_id} (${previous.held_on}) recorded ${decisions.length} decision(s), ${withAction.length} with an action: `
      + `${verifiedPrev} verified, ${previousOpen} open (${overduePrev} overdue). `;
  }

  const rows = [
    ['Status of actions from previous management reviews', 'ISO 9.3.2 a',
      `${previousLine}Across the register: ${actions.open} open corrective action(s), ${actions.overdue} overdue; ${actions.awaiting} completed and awaiting verification; ${actions.verified} verified in the last 12 months.`,
      'Management reviews; corrective actions', decide(previousOpen || actions.overdue || actions.awaiting)],
    ['Changes in external and internal issues', 'ISO 9.3.2 b; ECC 1-7',
      `${frameworks.applicable ? `${frameworks.applicable} applicable framework(s) recorded in the organisation profile.` : 'No applicable frameworks recorded in the organisation profile.'}${frameworks.draft.length
        ? ` Draft edition(s) awaiting migration: ${frameworks.draft.map((f) => `${f.code} ${f.version || ''}`.trim()).join(', ')}.` : ''}`
        + ' Changes in the business, technology and threat context are not held in the platform and are presented by the CISO.',
      'Frameworks; CISO', decide(frameworks.draft.length)],
    ['Changes in the needs and expectations of interested parties', 'ISO 9.3.2 c',
      'Not held in the platform. Presented by the CISO, including any new regulatory instruction.', 'CISO', 'For information'],
    ['Nonconformities and corrective actions', 'ISO 9.3.2 d 1; ECC 1-8-3',
      `${findingsOpen} open finding(s): ${['critical', 'high', 'medium', 'low', 'info'].map((s) => `${bySeverity[s] || 0} ${s}`).join(', ')}.`,
      'Findings; corrective actions', decide((bySeverity.critical || 0) + (bySeverity.high || 0))],
    ['Monitoring and measurement results', 'ISO 9.3.2 d 2; ECC 1-8-1',
      `Controls implemented: ${controls.implemented || 0} of ${controls.total} (${pct(controls.implemented, controls.total)}). `
        + `Evidence verified: ${evidence.verified || 0} of ${evidence.total} (${pct(evidence.verified, evidence.total)}); ${evidence.lapsed || 0} missing or expired.`,
      'Controls; evidence', decide(evidence.lapsed)],
    ['Audit results', 'ISO 9.3.2 d 3; ECC 1-8-2, 1-8-3',
      assessments
        ? `${assessments} assessment(s), ${gaps.total} requirement(s) assessed: ${gaps.compliant || 0} compliant, ${gaps.partial || 0} partially compliant, ${gaps.non || 0} non-compliant.`
        : 'No assessment recorded in the platform. Independent audit results are presented by the internal audit function.',
      'Gap assessments', decide(gaps.non)],
    ['Fulfilment of information security objectives', 'ISO 9.3.2 d 4; ECC 1-1',
      `${chains.length} of ${DOMAIN_META.length} domains hold a published Policy, Standard and Procedure. ${overdueReviews} document(s) past their review date.`,
      'Documents', decide(overdueReviews)],
    ['Feedback from interested parties', 'ISO 9.3.2 e',
      'Not held in the platform. Presented by the CISO: regulator correspondence, customer and supplier feedback, complaints.', 'CISO', 'For information'],
    ['Results of risk assessment and status of the risk treatment plan', 'ISO 9.3.2 f; ECC 1-5',
      `${openRisks.length} open risk(s) by current rating: ${riskBands.critical} critical, ${riskBands.high} high, ${riskBands.medium} medium, ${riskBands.low} low `
        + `(residual where assessed, inherent for the ${unassessed} not yet reassessed). `
        + `${untreated} not yet treated; ${expiredAcceptances} acceptance(s) past expiry.`,
      'Risk register', decide(riskBands.critical || untreated || expiredAcceptances)],
    ['Opportunities for continual improvement', 'ISO 9.3.2 g; ISO 10.1',
      `${exclusions} requirement(s) excluded in the Statement of Applicability, ${unjustified} without a justification. `
        + 'Improvement proposals are recorded as decisions of this review.',
      'Statement of Applicability', decide(unjustified)]
  ];
  return {
    headers: ['Input', 'Reference', 'Current position', 'Source', 'Attention'],
    rows,
    widths: [40, 22, 90, 26, 18]
  };
}
