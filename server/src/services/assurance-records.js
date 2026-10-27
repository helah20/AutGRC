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
import { cellText } from './export-i18n.js';
import { DECISION_CATEGORY, DECISION_CATEGORY_AR } from './decision-categories.js';

export { DECISION_CATEGORY };

const label = (s) => String(s || '').replace(/_/g, ' ');

/**
 * The record's wording in the reader's language. Fixed text is written in
 * both here; stored values (statuses, knowledge-base names) go through the
 * same dictionaries as the screens.
 */
function speaker(lang) {
  const ar = lang === 'ar';
  return {
    ar,
    tx: (en, arabic) => (ar ? arabic : en),
    value: (v) => (ar ? cellText(v || '', 'ar') : label(v)),
    text: (v) => (ar ? cellText(v, 'ar') : v)
  };
}

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
export function auditReportPayload(assessmentId, lang = 'en') {
  const { ar, tx, value, text } = speaker(lang);
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
    ? `${text(a.framework_name)}${a.framework_version ? ` (${a.framework_version})` : ''}`
    : tx('Not linked to a framework in the platform', 'غير مرتبط بإطار في المنصة');
  const day = (d) => String(d || '').slice(0, 10);

  const sections = [
    { heading: tx('Audit Objective and Scope', 'هدف التدقيق ونطاقه'), body: joinBlocks(
      h.table([tx('Item', 'البند'), tx('Detail', 'التفاصيل')], [
        [tx('Audit', 'التدقيق'), text(a.name)],
        [tx('Audit criteria', 'معايير التدقيق'), criteria],
        [tx('Scope', 'النطاق'), text(a.scope) || tx('Not recorded', 'غير مسجّل')],
        [tx('Lead auditor', 'رئيس فريق التدقيق'), a.owner_name || tx('Not assigned', 'غير معيّن')],
        [tx('Period', 'الفترة'), ar
          ? `من ${day(a.started_at || a.created_at)} إلى ${day(a.due_at) || 'غير محدد'}`
          : `${day(a.started_at || a.created_at)} to ${day(a.due_at) || 'open'}`],
        [tx('Status', 'الحالة'), value(a.status)]
      ]),
      h.p(tx('The audit assessed each requirement in scope against the evidence recorded in the platform. NCA ECC 1-8-2 requires the review to be conducted independently of the cybersecurity function; the lead auditor named above is responsible for that independence.',
        'قيّم التدقيق كل متطلب ضمن النطاق مقابل الأدلة المسجّلة في المنصة. ويشترط الضابط 1-8-2 من الضوابط الأساسية للأمن السيبراني أن تُجرى المراجعة باستقلالية عن إدارة الأمن السيبراني، ورئيس فريق التدقيق المذكور أعلاه مسؤول عن هذه الاستقلالية.'))
    ) },
    { heading: tx('Summary of Results', 'ملخص النتائج'), body: joinBlocks(
      h.table([tx('Result', 'النتيجة'), tx('Requirements', 'المتطلبات')], [
        [tx('Compliant', 'ملتزم'), String(count('compliant'))],
        [tx('Partially compliant', 'ملتزم جزئياً'), String(count('partially_compliant'))],
        [tx('Non-compliant', 'غير ملتزم'), String(count('non_compliant'))],
        [tx('Not applicable', 'غير منطبق'), String(count('not_applicable'))],
        [tx('Total assessed', 'إجمالي ما قُيّم'), String(items.length)],
        [tx('Compliance rate', 'نسبة الالتزام'), tx(`${rate}% (partial compliance counted as half)`, `${rate}٪ (يُحتسب الالتزام الجزئي نصفاً)`)]
      ])
    ) },
    { heading: tx('Nonconformities', 'حالات عدم المطابقة'), body: nonconformities.length
      ? h.table([tx('Requirement', 'المتطلب'), tx('Result', 'النتيجة'), tx('Gap', 'الفجوة'), tx('Risk', 'الخطر'),
        tx('Recommendation', 'التوصية'), tx('Owner', 'المالك'), tx('Due', 'الاستحقاق')],
        nonconformities.map((n) => [n.requirement_ref || '', value(n.status), text(n.gap || ''), n.risk_rating ? value(n.risk_rating) : '',
          text(n.recommendation || ''), n.owner || '', day(n.due_date)]))
      : h.p(tx('No nonconformity was recorded.', 'لم تُسجَّل أي حالة عدم مطابقة.')) },
    { heading: tx('Corrective Actions', 'الإجراءات التصحيحية'), body: joinBlocks(
      actions.length
        ? h.table([tx('Action', 'الإجراء'), tx('Requirement', 'المتطلب'), tx('Owner', 'المالك'), tx('Status', 'الحالة'),
          tx('Due', 'الاستحقاق'), tx('Root cause', 'السبب الجذري'), tx('Verified', 'التحقق')],
          actions.map((x) => [x.action_id, x.requirement_ref || tx('Whole audit', 'التدقيق كاملاً'), x.owner_name || '', value(x.status),
            day(x.due_date), text(x.root_cause) || tx('Not recorded', 'غير مسجّل'),
            x.verified_at ? `${x.verified_by_name || ''} ${day(x.verified_at)}`.trim() : tx('No', 'لا')]))
        : h.p(tx('No corrective action has been raised against this audit.', 'لم يُفتح أي إجراء تصحيحي على هذا التدقيق.')),
      withoutAction.length
        ? h.callout('warn', tx('Nonconformities without a corrective action', 'حالات عدم مطابقة بلا إجراء تصحيحي'), ar
          ? `${withoutAction.length} من حالات عدم المطابقة بلا إجراء تصحيحي: ${withoutAction.map((n) => n.requirement_ref).join('، ')}. ويشترط البند 10.2 من ISO/IEC 27001 معالجة كل منها.`
          : `${withoutAction.length} nonconformit${withoutAction.length === 1 ? 'y has' : 'ies have'} no corrective action: ${withoutAction.map((n) => n.requirement_ref).join(', ')}. ISO/IEC 27001 10.2 requires each to be acted on.`)
        : '',
      overdue.length
        ? h.callout('warn', tx('Overdue corrective actions', 'إجراءات تصحيحية متأخرة'), ar
          ? `تجاوز تاريخ الاستحقاق: ${overdue.map((x) => x.action_id).join('، ')}.`
          : `${overdue.map((x) => x.action_id).join(', ')} ${overdue.length === 1 ? 'is' : 'are'} past the due date.`)
        : ''
    ) },
    { heading: tx('Audit Conclusion', 'خلاصة التدقيق'), body: joinBlocks(
      h.p(ar
        ? `من أصل ${assessable} متطلباً منطبقاً، وُجد ${count('compliant')} ملتزماً و${count('partially_compliant')} ملتزماً جزئياً و${count('non_compliant')} غير ملتزم. ولـ${nonconformities.length - withoutAction.length} من أصل ${nonconformities.length} حالة عدم مطابقة إجراء تصحيحي.`
        : `Of ${assessable} applicable requirement(s), ${count('compliant')} were found compliant, ${count('partially_compliant')} partially compliant and ${count('non_compliant')} non-compliant. ${nonconformities.length - withoutAction.length} of ${nonconformities.length} nonconformities have a corrective action.`),
      h.p(tx('The audit opinion is the lead auditor\'s judgement and is not generated by the platform. It is to be added here and signed before the report is issued.',
        'رأي التدقيق حكم يعود لرئيس فريق التدقيق ولا تولّده المنصة، ويُضاف هنا ويُوقَّع قبل إصدار التقرير.'))
    ) },
    { heading: tx('Distribution', 'التوزيع'), body: h.p(tx('NCA ECC 1-8-3 requires audit results, including scope, observations, recommendations and corrective actions, to be presented to the cybersecurity supervisory committee and to the Authorized Official.',
      'يشترط الضابط 1-8-3 من الضوابط الأساسية للأمن السيبراني عرض نتائج التدقيق، بما فيها النطاق والملاحظات والتوصيات والإجراءات التصحيحية، على اللجنة الإشرافية للأمن السيبراني وعلى صاحب الصلاحية.')) }
  ];

  return {
    document: reportDocument({ reference: `IAR-${a.id.slice(-6).toUpperCase()}`, title: `${tx('Internal Audit Report', 'تقرير التدقيق الداخلي')} — ${text(a.name)}`, status: a.status === 'completed' ? 'published' : 'draft', date: a.updated_at || a.created_at }),
    sections, owner: a.owner_name ? { name: a.owner_name } : null, approver: null, versions: [], approvals: [], frameworks: [],
    domainName: tx('All domains', 'كل المجالات'), docTypeLabel: tx('Internal Audit Report', 'تقرير التدقيق الداخلي'), lang
  };
}

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
export function reviewMinutesPayload(reviewId, lang = 'en') {
  const { ar, tx, value, text } = speaker(lang);
  const r = q.get('SELECT * FROM management_reviews WHERE id = ? OR review_id = ?', reviewId, reviewId);
  if (!r) return null;
  let inputs = { headers: [], rows: [] };
  try { inputs = JSON.parse(r.inputs_snapshot); } catch { /* an unreadable snapshot is shown as empty */ }
  const decisions = reviewDecisions(r.id);

  const sections = [
    { heading: tx('Meeting', 'الاجتماع'), body: h.table([tx('Item', 'البند'), tx('Detail', 'التفاصيل')], [
      [tx('Review', 'المراجعة'), r.review_id],
      [tx('Date', 'التاريخ'), r.held_on],
      [tx('Forum', 'الجهة المنعقدة'), r.forum || tx('Not recorded', 'غير مسجّل')],
      [tx('Chair', 'رئيس الاجتماع'), r.chair || tx('Not recorded', 'غير مسجّل')],
      [tx('Attendees', 'الحضور'), r.attendees || tx('Not recorded', 'غير مسجّل')],
      [tx('Status', 'الحالة'), r.status === 'closed'
        ? `${tx('Closed', 'مغلق')} ${String(r.closed_at || '').slice(0, 10)}` : tx('Draft', 'مسودة')]
    ]) },
    { heading: tx('Inputs Considered', 'المدخلات التي نُظر فيها'), body: joinBlocks(
      h.p(ar
        ? `المدخلات التي يشترطها البند 9.3.2 من ISO/IEC 27001، كما عرضتها المنصة في ${String(inputs.capturedAt || r.created_at).slice(0, 10)}.`
        : `The inputs ISO/IEC 27001 9.3.2 requires, as the platform reported them on ${String(inputs.capturedAt || r.created_at).slice(0, 10)}.`),
      h.table([tx('Input', 'المدخل'), tx('Reference', 'المرجع'), tx('Position', 'الوضع'), tx('Attention', 'الأولوية')],
        // Minutes recorded before the Arabic wording was captured fall back to
        // the English rows, through the same dictionaries as the screens.
        (ar && inputs.ar?.rows ? inputs.ar.rows : inputs.rows || [])
          .map((row) => [text(row[0]), row[1], text(row[2]), ar ? value(row[4]) : row[4]]))
    ) },
    { heading: tx('Discussion', 'النقاش'), body: h.p(r.summary || tx('No summary recorded.', 'لم يُسجَّل ملخص.')) },
    { heading: tx('Decisions and Actions', 'القرارات والإجراءات'), body: decisions.length
      ? h.table(['#', tx('Category', 'الفئة'), tx('Decision', 'القرار'), tx('Owner', 'المالك'), tx('Due', 'الاستحقاق'), tx('Action', 'الإجراء')],
        decisions.map((d) => [String(d.position), (ar ? DECISION_CATEGORY_AR : DECISION_CATEGORY)[d.category] || d.category, d.decision,
          d.owner_name || '', d.due_date || '',
          d.action_ref ? `${d.action_ref} (${d.action_verified_at ? tx('verified', 'تم التحقق') : value(d.action_status)})` : tx('None', 'لا يوجد')]))
      : h.p(tx('No decision recorded.', 'لم يُسجَّل قرار.')) }
  ];

  return {
    document: reportDocument({ reference: r.review_id, title: `${tx('Management Review Minutes', 'محضر مراجعة الإدارة')} — ${r.held_on}`, status: r.status === 'closed' ? 'published' : 'draft', date: r.updated_at }),
    sections, owner: null, approver: null, versions: [], approvals: [], frameworks: [],
    domainName: tx('All domains', 'كل المجالات'), docTypeLabel: tx('Management Review Minutes', 'محضر مراجعة الإدارة'), lang
  };
}
