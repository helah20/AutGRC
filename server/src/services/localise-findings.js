/**
 * Arabic for the sentences the review engine writes into findings, and the
 * corrective actions raised from them.
 *
 * Findings are stored as the English the engine wrote. Each pattern here
 * matches one of those sentences exactly and renders the same statement in
 * Arabic; the names inside it (a section heading, a control, an activity, a
 * domain) go back through the localiser, so a name a person changed stays as
 * they wrote it. A sentence no pattern matches is shown in English, which is
 * what a person typed into a finding of their own.
 */

import { AR_PARAMETER_LABELS } from '../knowledge/ar/ar-common.js';

const STATUS_AR = {
  draft: 'مسودة', under_review: 'قيد المراجعة', approved: 'معتمدة',
  published: 'منشورة', under_revision: 'قيد التحديث', retired: 'ملغاة'
};

/** review.js turns a parameter name into words; this maps those words back to its Arabic label. */
const PARAMETER_AR = Object.fromEntries(Object.entries(AR_PARAMETER_LABELS)
  .map(([name, label]) => [name.replace(/([A-Z])/g, ' $1').toLowerCase().trim(), label]));

const SUGGEST_AR = {
  'state the interval, for example "at least quarterly"': 'حدّد الدورية، مثل «ربع سنوي على الأقل»',
  'state the interval, for example "at least annually"': 'حدّد الدورية، مثل «سنوياً على الأقل»',
  'state the interval': 'حدّد الدورية',
  'state the trigger condition that creates the need': 'حدّد الحالة التي تنشأ عندها الحاجة',
  'state who determines the requirement and against what criteria': 'حدّد من يقرر الحاجة وبأي معايير',
  'state the criteria that make it appropriate': 'حدّد المعايير التي تجعله مناسباً',
  'state the standard to be met': 'حدّد المستوى المطلوب بلوغه',
  'state the conditions under which it applies': 'حدّد الحالات التي ينطبق فيها',
  'state the constraint and the fallback when it is not possible': 'حدّد القيد والبديل حين يتعذّر',
  'state the feasibility criteria': 'حدّد معايير الإمكان',
  'state the deadline in hours or days': 'حدّد المهلة بالساعات أو الأيام',
  'state the measurable threshold': 'حدّد حداً قابلاً للقياس',
  'state the objective criteria': 'حدّد معايير موضوعية',
  'state the committed outcome or remove the obligation': 'حدّد النتيجة الملتزم بها أو احذف الالتزام',
  'state the length and composition requirement': 'حدّد متطلب الطول والتركيب',
  'state the deadline': 'حدّد المهلة',
  'state whether the action is mandatory or advisory': 'حدّد هل الإجراء إلزامي أم استرشادي',
  'state whether the action is mandatory or permitted': 'حدّد هل الإجراء إلزامي أم جائز',
  'state the threshold that makes it significant': 'حدّد الحد الذي يجعله جوهرياً'
};

const TIER_AR = { Standard: 'معيار', Procedure: 'إجراء', standard: 'المعيار', procedure: 'الإجراء' };

/**
 * [pattern, render(match, t)] pairs. `t` translates a name through the
 * localiser and returns it unchanged when it is not knowledge-base text.
 */
export const FINDING_PATTERNS = [
  [/^Finding: (.+)$/, (m, t) => `ملاحظة: ${t(m[1])}`],
  [/^Resolve: (.+)$/, (m, t) => `معالجة: ${t(m[1])}`],
  [/^Addressed by (.+) with documented policy, standard and procedure\.$/,
    (m) => `يعالجه ${m[1].split(', ').join('، ')} بسياسة ومعيار وإجراء موثّقة.`],

  [/^Missing required section: (.+)$/, (m, t) => `قسم مطلوب غير موجود: ${t(m[1])}`],
  [/^A .+ is expected to contain a "(.+)" section\. It is absent from (\S+)\.$/,
    (m, t) => `يُتوقَّع أن تتضمن الوثيقة قسم «${t(m[1])}»، وهو غير موجود في ${m[2]}.`],
  [/^Add a "(.+)" section before submitting this document for approval\.$/,
    (m, t) => `أضف قسم «${t(m[1])}» قبل تقديم الوثيقة للاعتماد.`],
  [/^Section "(.+)" is empty$/, (m, t) => `القسم «${t(m[1])}» فارغ`],
  [/^Section "(.+)" is very short$/, (m, t) => `القسم «${t(m[1])}» قصير جداً`],
  [/^The section contains no content\.$/, () => 'لا يحتوي القسم على أي محتوى.'],
  [/^The section contains only (\d+) characters, which is unlikely to state a complete requirement\.$/,
    (m) => `يحتوي القسم على ${m[1]} حرفاً فقط، ولا يكفي ذلك غالباً لبيان متطلب كامل.`],
  [/^Complete the section or remove it if it does not apply to this document\.$/,
    () => 'أكمل القسم، أو احذفه إن لم ينطبق على هذه الوثيقة.'],

  [/^Document has no assigned owner$/, () => 'لا مالك للوثيقة'],
  [/^(\S+) has no Document Owner\. An unowned document cannot be maintained or approved\.$/,
    (m) => `لا مالك للوثيقة ${m[1]}. والوثيقة التي لا مالك لها لا يمكن صيانتها ولا اعتمادها.`],
  [/^Assign a Document Owner accountable for the content and its review cycle\.$/,
    () => 'عيّن مالكاً للوثيقة مسؤولاً عن محتواها ودورة مراجعتها.'],
  [/^Document has no approver$/, () => 'لا معتمِد للوثيقة'],
  [/^(\S+) is at status "(\w+)" but no Approver is recorded\.$/,
    (m) => `الوثيقة ${m[1]} في حالة «${STATUS_AR[m[2]] || m[2]}» ولم يُسجَّل لها معتمِد.`],
  [/^Record the approving authority before the document proceeds\.$/,
    () => 'سجّل جهة الاعتماد قبل أن تمضي الوثيقة.'],
  [/^No review date set$/, () => 'لم يُحدَّد تاريخ مراجعة'],
  [/^(\S+) does not carry a review date, so it cannot be reported as overdue\.$/,
    (m) => `لا تحمل الوثيقة ${m[1]} تاريخ مراجعة، فلا يمكن الإبلاغ عن تأخرها.`],
  [/^Set a review date, normally 12 months from the effective date\.$/,
    () => 'حدّد تاريخ مراجعة، وعادةً يكون بعد 12 شهراً من تاريخ السريان.'],
  [/^Document is overdue for review$/, () => 'تأخرت مراجعة الوثيقة'],
  [/^(\S+) was due for review on (\S+) and remains published\.$/,
    (m) => `كان موعد مراجعة الوثيقة ${m[1]} في ${m[2]}، وما زالت منشورة.`],
  [/^Review and reissue the document, or move it to Under Revision\.$/,
    () => 'راجِع الوثيقة وأعد إصدارها، أو انقلها إلى حالة «قيد التحديث».'],

  [/^Unmeasurable wording: "(.+)"$/, (m) => `صياغة غير قابلة للقياس: «${m[1]}»`],
  [/^"(.+)" appears alongside a quantified commitment, so the obligation is measurable\. Consider removing the vague word for clarity\.$/,
    (m) => `ترد «${m[1]}» مع التزام محدد بقيمة، فالالتزام قابل للقياس. ويُستحسن حذف الكلمة المبهمة للوضوح.`],
  [/^The statement uses "(.+)" without a measurable value, so compliance cannot be objectively assessed or audited\.$/,
    (m) => `يستخدم البند «${m[1]}» دون قيمة قابلة للقياس، فلا يمكن تقييم الالتزام به أو تدقيقه بموضوعية.`],
  [/^Replace "(.+)": (.+)\.$/, (m) => `استبدل «${m[1]}»: ${SUGGEST_AR[m[2]] || m[2]}.`],

  [/^Control (\S+) has no accountable role$/, (m) => `لا دور مساءل للضابط ${m[1]}`],
  [/^Control (\S+) has no responsible role$/, (m) => `لا دور منفّذ للضابط ${m[1]}`],
  [/^(\S+) \((.+)\) cannot be operated or assured without a named role\.$/,
    (m, t) => `لا يمكن تشغيل الضابط ${m[1]} (${t(m[2])}) ولا التحقق منه دون دور محدد.`],
  [/^Assign the role in the Control Library and reflect it in the domain RACI matrix\.$/,
    () => 'عيّن الدور في مكتبة الضوابط، وأظهره في مصفوفة RACI للمجال.'],
  [/^No accountable role for "(.+)"$/, (m, t) => `لا دور مساءل عن «${t(m[1])}»`],
  [/^Every activity requires exactly one Accountable role\. Without one, no individual answers for the outcome\.$/,
    () => 'يحتاج كل نشاط إلى دور مساءل واحد فقط، ومن دونه لا يُسأل أحد عن النتيجة.'],
  [/^Assign exactly one role as Accountable \(A\)\.$/, () => 'عيّن دوراً واحداً فقط مساءلاً (A).'],
  [/^Multiple accountable roles for "(.+)"$/, (m, t) => `أكثر من دور مساءل عن «${t(m[1])}»`],
  [/^(\d+) roles are marked Accountable \((.+)\)\. Shared accountability means no one is accountable\.$/,
    (m, t) => `${m[1]} أدوار محددة مساءلة (${m[2].split(', ').map(t).join('، ')}). والمساءلة المشتركة تعني ألا يُساءل أحد.`],
  [/^Retain exactly one Accountable role; change the others to Responsible or Consulted\.$/,
    () => 'أبقِ دوراً مساءلاً واحداً، وغيّر الأدوار الأخرى إلى منفّذ أو مستشار.'],
  [/^No responsible role for "(.+)"$/, (m, t) => `لا دور منفّذ لنشاط «${t(m[1])}»`],
  [/^No role is assigned to perform this activity\.$/, () => 'لم يُسنَد أي دور لأداء هذا النشاط.'],
  [/^Assign at least one role as Responsible \(R\)\.$/, () => 'عيّن دوراً واحداً على الأقل منفّذاً (R).'],
  [/^Role column "(.+)" has no assignments$/, (m, t) => `عمود الدور «${t(m[1])}» بلا إسناد`],
  [/^The role appears in the matrix but carries no responsibility in any activity\.$/,
    () => 'يظهر الدور في المصفوفة دون أي مسؤولية في أي نشاط.'],
  [/^Assign the role where it participates, or remove the column\.$/, () => 'أسند الدور حيث يشارك، أو احذف العمود.'],

  [/^Control (\S+) has no evidence requirement$/, (m) => `لا دليل مطلوب للضابط ${m[1]}`],
  [/^(\S+) \((.+)\) states a requirement but nothing records that it operated, so it cannot be tested or audited\.$/,
    (m, t) => `يحدد الضابط ${m[1]} (${t(m[2])}) متطلباً، لكن لا شيء يسجّل أنه عمل، فلا يمكن اختباره ولا تدقيقه.`],
  [/^Define at least one evidence artefact, its source system and its collection frequency\.$/,
    () => 'حدّد دليلاً واحداً على الأقل، ونظامه المصدر، ودورية جمعه.'],
  [/^Control (\S+) has no performance indicator$/, (m) => `لا مؤشر أداء للضابط ${m[1]}`],
  [/^Without an indicator the control cannot be reported on or trended\.$/,
    () => 'دون مؤشر لا يمكن الإبلاغ عن الضابط ولا تتبّع اتجاهه.'],
  [/^Define a measurable indicator with a target\.$/, () => 'حدّد مؤشراً قابلاً للقياس له قيمة مستهدفة.'],

  [/^(\d+) (\S+) requirements? in this domain have no mapped control$/,
    (m) => `${m[1]} من متطلبات ${m[2]} في هذا المجال بلا ضابط مرتبط`],
  [/^Requirements (.+) are within the (.+) domain but no organisational control is mapped to them\.$/,
    (m, t) => `المتطلبات ${m[1]} ضمن مجال ${t(m[2])}، ولا يرتبط بها أي ضابط في المنظمة.`],
  [/^Map an existing control, create a control, or record the requirement as Not Applicable with a documented rationale\.$/,
    () => 'اربط ضابطاً قائماً، أو أنشئ ضابطاً، أو سجّل المتطلب «غير منطبق» مع مبرر موثّق.'],

  [/^Governance inconsistency: (.+)$/, (m) => `تعارض في الحوكمة: ${PARAMETER_AR[m[1]] || m[1]}`],
  [/^(\S+) states "(.+)" where the agreed organisational value is "(.+)" and (\S+) states it correctly\. Documents in the same domain must state the same commitment\.$/,
    (m, t) => `تنص الوثيقة ${m[1]} على «${t(m[2])}»، والقيمة المتفق عليها في المنظمة «${t(m[3])}»، وتنص عليها الوثيقة ${m[4]} صحيحة. ويجب أن تنص وثائق المجال الواحد على الالتزام نفسه.`],
  [/^(\S+) states "(.+)" where the agreed organisational value is "(.+)"\. Documents in the same domain must state the same commitment\.$/,
    (m, t) => `تنص الوثيقة ${m[1]} على «${t(m[2])}»، والقيمة المتفق عليها في المنظمة «${t(m[3])}». ويجب أن تنص وثائق المجال الواحد على الالتزام نفسه.`],
  [/^(\S+) states "(.+)" where the agreed organisational value is "(.+)"\.$/,
    (m, t) => `تنص الوثيقة ${m[1]} على «${t(m[2])}»، والقيمة المتفق عليها في المنظمة «${t(m[3])}».`],
  [/^Reconcile to the value recorded in the Standard \((.+)\), or change the Standard and propagate the change to every document in this domain\.$/,
    (m, t) => `وحّد القيمة على ما في المعيار (${t(m[1])})، أو عدّل المعيار وانقل التعديل إلى كل وثائق المجال.`],
  [/^Reconcile to the value recorded in the Standard \((.+)\)\.$/,
    (m, t) => `وحّد القيمة على ما في المعيار (${t(m[1])}).`],

  [/^(.+) has a Policy but no (Standard|Procedure)$/,
    (m, t) => `لمجال ${t(m[1])} سياسة دون ${TIER_AR[m[2]]}`],
  [/^The governance hierarchy expects Policy → Standard → Procedure\. The (standard|procedure) tier is missing, so the policy position is not translated into (?:measurable requirements|operational steps)\.$/,
    (m) => `يتوقع هرم الحوكمة: سياسة ← معيار ← إجراء. ومستوى ${TIER_AR[m[1]]} غير موجود، فلا يتحول موقف السياسة إلى ${m[1] === 'standard' ? 'متطلبات قابلة للقياس' : 'خطوات تشغيلية'}.`],
  [/^Generate the (.+) (Standard|Procedure) from the domain requirement model\.$/,
    (m, t) => `ولّد ${TIER_AR[m[2]]} مجال ${t(m[1])} من نموذج متطلبات المجال.`],

  // Generic shapes last, so a specific sentence above is matched first.
  [/^(\S+) — (.+)$/, (m, t) => `${m[1]} — ${t(m[2])}`],
  [/^([A-Z]{2,4}-(?:[A-Z]{2,4}-)?\d{3}) (.+)$/, (m, t) => `${m[1]} ${t(m[2])}`],
  // A list the platform joined with semicolons, such as evidence names.
  [/^[^;]+(?:; [^;]+)+$/, (m, t) => m[0].split('; ').map(t).join('؛ ')]
];
