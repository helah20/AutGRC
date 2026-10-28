/**
 * Arabic for fixed English the API itself sends: descriptions and notes
 * that are part of the interface rather than of the knowledge base. Keyed
 * on the English, like the document strings, so adding one is one line.
 */

import { SOURCE_NOTE } from '../knowledge/frameworks.js';
import { DECISION_CATEGORY, DECISION_CATEGORY_AR } from './decision-categories.js';

export const UI_PHRASES_AR = {
  // The analysis of an uploaded document (services/import.js).
  'Consolidate rather than maintaining two statements of the same requirement in separate documents.': 'وحّد الصياغة بدل الإبقاء على بندين للمتطلب نفسه في وثيقتين منفصلتين.',
  'Replace each with a stated frequency, threshold or deadline.': 'استبدل كلاً منها بدورية أو حد أو موعد محدد.',
  'No document owner identified': 'لم يُحدَّد مالك للوثيقة',
  'The document does not name an owner, so no one is accountable for keeping it current.': 'لا تسمّي الوثيقة مالكاً، فلا أحد مساءل عن إبقائها محدّثة.',
  'Add a document control table recording the owner, approver, version and review date.': 'أضف جدول ضبط للوثيقة يسجّل المالك والمعتمِد والإصدار وتاريخ المراجعة.',
  'No approval recorded': 'لم يُسجَّل اعتماد',
  'The document does not record who approved it or when.': 'لا تسجّل الوثيقة من اعتمدها ولا متى.',
  'Add an approval table with name, role and date.': 'أضف جدول اعتماد بالاسم والدور والتاريخ.',
  'No version identifier': 'لا يوجد رقم إصدار',
  'Without a version, it is impossible to establish which issue is in force.': 'دون رقم إصدار يتعذّر تحديد النسخة السارية.',
  'Add a version number and change history.': 'أضف رقم إصدار وسجلاً للتغييرات.',
  'No review date or review cycle': 'لا تاريخ مراجعة ولا دورية مراجعة',
  'The document does not state when it must next be reviewed.': 'لا تحدد الوثيقة موعد مراجعتها القادمة.',
  'State the review cycle and record the next review date.': 'حدّد دورية المراجعة وسجّل تاريخ المراجعة القادمة.',
  'No information classification': 'لا تصنيف للمعلومات',
  'The document does not carry a classification marking.': 'لا تحمل الوثيقة علامة تصنيف.',
  'Apply the organisation classification marking to the cover and page headers.': 'ضع علامة التصنيف المعتمدة في المنشأة على الغلاف وترويسة الصفحات.',
  'No evidence requirements stated': 'لم تُحدَّد متطلبات الأدلة',
  'The document states obligations but does not identify the records that demonstrate they were met, so compliance cannot be tested.': 'تنص الوثيقة على التزامات دون تحديد السجلات التي تثبت الوفاء بها، فلا يمكن اختبار الالتزام.',
  'Add a records and evidence section naming each artefact, its source system and its retention period.': 'أضف قسماً للسجلات والأدلة يسمّي كل سجل ونظامه المصدر ومدة الاحتفاظ به.',
  'Content appears outdated': 'يبدو أن المحتوى قديم',
  'Update references to current framework editions and reissue the document.': 'حدّث المراجع إلى الإصدارات الحالية من الأطر وأعد إصدار الوثيقة.',
  'References ISO/IEC 27001:2013 or earlier; the current edition is 2022.': 'تشير إلى ISO/IEC 27001:2013 أو أقدم؛ والإصدار الحالي 2022.',
  'References NIST CSF 1.x; version 2.0 was published in 2024.': 'تشير إلى NIST CSF 1.x؛ وصدر الإصدار 2.0 عام 2024.',
  'References a CIS Controls version earlier than v8.': 'تشير إلى إصدار من ضوابط CIS أقدم من v8.',
  'References ECC-1:2018; the current edition is ECC-2:2024, in which industrial control systems moved to the OTCC.': 'تشير إلى ECC-1:2018؛ والإصدار الحالي ECC-2:2024، وفيه انتقلت أنظمة التحكم الصناعي إلى ضوابط OTCC.',
  'References CCC-1:2020; the current edition is CCC-2:2024.': 'تشير إلى CCC-1:2020؛ والإصدار الحالي CCC-2:2024.',

  'This document has no process flow to export.': 'لا يتضمن هذا المستند مخطط سير لتصديره.',

  // Gap check for uploaded procedures (procedure-check.js).
  'Procedure steps state no inputs': 'خطوات الإجراء لا تحدد مدخلاتها',
  'The procedure does not state what starts each step, so a step can wait for something no earlier step produces without anyone noticing.': 'لا يحدد الإجراء ما يبدأ كل خطوة، فقد تنتظر خطوةٌ شيئاً لا تنتجه أي خطوة سابقة دون أن يلاحظ أحد.',
  'Write the steps as a table of input, step, responsible and output, naming the trigger of the first step.': 'اكتب الخطوات في جدول: المدخل، الخطوة، المسؤول، المخرج، مع تسمية الحدث الذي يبدأ الخطوة الأولى.',
  'Procedure steps state no outputs': 'خطوات الإجراء لا تحدد مخرجاتها',
  'The procedure does not state what each step hands on, so the evidence that a step was performed is not defined.': 'لا يحدد الإجراء ما تسلّمه كل خطوة، فلا يكون الدليل على تنفيذ الخطوة محدداً.',
  'State the output of every step: the record, decision or artefact it produces.': 'حدّد مخرج كل خطوة: السجل أو القرار أو المنتَج الذي تخرج به.',
  'Procedure names no responsible party per step': 'الإجراء لا يسمّي مسؤولاً لكل خطوة',
  'Steps are described without the role that performs them, so the procedure cannot be operated or audited against named roles.': 'تُوصف الخطوات دون الدور الذي ينفذها، فلا يمكن تشغيل الإجراء ولا تدقيقه مقابل أدوار مسمّاة.',
  'Name the responsible role for each step, and the roles it coordinates with.': 'سمِّ الدور المسؤول عن كل خطوة، والأدوار التي ينسّق معها.',
  'Procedure states no service levels': 'الإجراء لا يحدد مستويات الخدمة',
  'No step carries a deadline in hours or days, so lateness cannot be measured and nothing triggers escalation.': 'لا تحمل أي خطوة مهلة بالساعات أو الأيام، فلا يمكن قياس التأخر ولا شيء يستدعي التصعيد.',
  'State the service level for each time-bound step, by severity or class where they differ, and apply the stricter value where two apply.': 'حدّد مستوى الخدمة لكل خطوة مقيّدة بزمن، بحسب الخطورة أو الفئة حيث تختلف، وطبّق القيمة الأشد حيث تنطبق قيمتان.',
  'Procedure has no exception path': 'الإجراء بلا مسار للاستثناءات',
  'The procedure does not say what happens when a step cannot be completed as written, so exceptions are handled informally and are not recorded.': 'لا يبيّن الإجراء ما يحدث حين يتعذّر إتمام خطوة كما هي مكتوبة، فتُعالَج الاستثناءات بصورة غير رسمية ولا تُسجَّل.',
  'Add a time-bound exception with compensating controls, approved at the defined level and recorded in the risk register.': 'أضف استثناءً محدد المدة بضوابط تعويضية، يُعتمد من المستوى المحدد ويُسجَّل في سجل المخاطر.',
  'Procedure has no escalation': 'الإجراء بلا تصعيد',
  'The procedure does not say who is told when a deadline is missed or a step fails.': 'لا يبيّن الإجراء من يُبلَّغ حين تفوت مهلة أو تخفق خطوة.',
  'State the escalation path for each condition that can stop the process.': 'حدّد مسار التصعيد لكل حالة قد توقف الإجراء.',
  'Procedure has no performance indicators': 'الإجراء بلا مؤشرات أداء',
  'The procedure does not define how its performance is measured, so management cannot tell whether it is working.': 'لا يحدد الإجراء كيف يُقاس أداؤه، فلا تستطيع الإدارة معرفة ما إذا كان يعمل.',
  'Add indicators such as service level compliance, mean time to complete, coverage, overdue items and open exceptions.': 'أضف مؤشرات مثل الالتزام بمستويات الخدمة، ومتوسط زمن الإنجاز، والتغطية، والبنود المتأخرة، والاستثناءات القائمة.',
  'Procedure states no records to retain': 'الإجراء لا يحدد السجلات الواجب الاحتفاظ بها',
  'The procedure does not identify the records it produces or how long they are kept, so its operation cannot be evidenced at audit.': 'لا يحدد الإجراء السجلات التي ينتجها ولا مدة الاحتفاظ بها، فلا يمكن إثبات تشغيله عند التدقيق.',
  'List the records each step produces and the retention period for each.': 'اذكر السجلات التي تنتجها كل خطوة ومدة الاحتفاظ بكل منها.',
  'Procedure lists no related documents': 'الإجراء لا يذكر الوثائق ذات العلاقة',
  'The procedure does not name the policy and standard it implements or the procedures it hands work to.': 'لا يسمّي الإجراء السياسة والمعيار اللذين ينفذهما، ولا الإجراءات التي يسلّمها العمل.',
  'Add a related documents and references section.': 'أضف قسماً للوثائق ذات العلاقة والمراجع.',
  'Procedure has no verification step': 'الإجراء بلا خطوة تحقق',
  'Nothing confirms that the action was effective before the item is closed, so closure rests on an assertion.': 'لا شيء يؤكد فاعلية الإجراء المتخذ قبل إغلاق البند، فيقوم الإغلاق على مجرد إقرار.',
  'Add a verification step, and say where the process returns when verification fails.': 'أضف خطوة تحقق، وبيّن إلى أين يعود الإجراء حين يخفق التحقق.',
  'Arabic wording to correct': 'صياغة عربية تحتاج إلى تصحيح',
  'The document contains Arabic wording that recurs as an error in governance documents: a missing hamza, a gender mismatch, or a term used inconsistently with the policy.': 'تتضمن الوثيقة صياغة عربية تتكرر خطأً في وثائق الحوكمة: همزة ناقصة، أو عدم تطابق في التذكير والتأنيث، أو مصطلح يخالف ما تستخدمه السياسة.',
  'Apply the suggested wording, and use the same term as the organisation policy wherever the two documents share it.': 'طبّق الصياغة المقترحة، واستخدم مصطلح سياسة المنظمة نفسه حيثما اشتركت الوثيقتان فيه.',
  'References that reverse in Arabic layout': 'مراجع تنعكس في التخطيط العربي',
  'Clause references such as 1-2 are written with a non-breaking hyphen, which right-to-left layout displays in reverse order.': 'كُتبت مراجع البنود مثل 1-2 بشرطة غير منفصلة، فيعرضها التخطيط من اليمين إلى اليسار بترتيب معكوس.',
  'Use a plain hyphen between the numbers. Word exports from the platform correct this automatically.': 'استخدم شرطة عادية بين الرقمين. ملفات وورد المصدَّرة من المنصة تصحّح ذلك تلقائياً.',

  // Generator: what each document type is for.
  'The mandatory organisational position. States what must be achieved.': 'موقف المنظمة الإلزامي. يبيّن ما يجب تحقيقه.',
  'Measurable requirements implementing the policy. States the agreed values.': 'متطلبات قابلة للقياس تنفّذ السياسة. يبيّن القيم المتفق عليها.',
  'Step-by-step execution with decision points and a process flow.': 'تنفيذ خطوة بخطوة، مع نقاط القرار ومخطط سير العمل.',
  'Advisory implementation guidance. Creates no obligation.': 'إرشادات تطبيق استرشادية. لا تنشئ التزاماً.',
  'How the domain control framework maps to adopted sources.': 'كيف يرتبط إطار ضوابط المجال بالمصادر المعتمدة.',
  'Role purpose, authority, responsibilities, approvals and escalations.': 'غرض كل دور وصلاحياته ومسؤولياته واعتماداته ومسارات تصعيده.',
  'Responsibility assignment matrix with validation.': 'مصفوفة توزيع المسؤوليات مع التحقق منها.',
  'Controls, evidence, indicators and framework mapping.': 'الضوابط والأدلة والمؤشرات والربط بالأطر.',
  'Platform-specific execution detail beneath a procedure.': 'تفاصيل التنفيذ على منصة محددة، تحت الإجراء.',

  [SOURCE_NOTE]: 'بيانات مرجعية جُمعت لأغراض ربط الضوابط. يجب التحقق من أرقام الضوابط وعناوينها مقابل الإصدار الرسمي قبل الاعتماد عليها في إقرار تنظيمي. استورد نسختك المرخّصة لتحل محل هذه البيانات.',

  // The demonstration assessment the seed records, in the platform's own words.
  'NCA ECC Annual Compliance Assessment': 'تقييم الالتزام السنوي بالضوابط الأساسية للأمن السيبراني',
  'All ECC domains applicable to the organisation, covering head office and the primary data centre.':
    'كل مكونات الضوابط الأساسية المنطبقة على المنظمة، ويشمل المقر الرئيسي ومركز البيانات الرئيسي.',
  'No organisational control is currently mapped to this requirement.': 'لا يرتبط بهذا المتطلب حالياً أي ضابط في المنظمة.',
  'A documented, operating control with retained evidence demonstrating compliance.': 'ضابط موثّق وعامل، مع أدلة محفوظة تثبت الالتزام.',
  'No gap identified; control operating effectiveness to be tested.': 'لا فجوة، وتبقى فعالية تشغيل الضابط بحاجة إلى اختبار.',
  'Partial coverage: the mapped control addresses part of the requirement only.': 'تغطية جزئية: الضابط المرتبط يعالج جزءاً من المتطلب فقط.',
  'No control identified. The requirement is not addressed by any documented control.': 'لا ضابط. ولا يعالج المتطلبَ أي ضابط موثّق.',
  'Residual risk of control failure between assurance cycles.': 'خطر متبقٍ من تعطّل الضابط بين دورات التحقق.',
  'The organisation cannot currently demonstrate compliance with this requirement to the regulator.':
    'لا تستطيع المنظمة حالياً إثبات التزامها بهذا المتطلب أمام الجهة التنظيمية.',
  'Test control operating effectiveness during the next assurance cycle.': 'اختبر فعالية تشغيل الضابط في دورة التحقق القادمة.',
  'Extend the mapped control, or add a complementary control covering the remainder.': 'وسّع الضابط المرتبط، أو أضف ضابطاً مكمّلاً يغطي الباقي.',
  'Define and implement a control addressing this requirement, then map and evidence it.': 'حدّد ضابطاً يعالج هذا المتطلب وطبّقه، ثم اربطه ووثّق أدلته.',

  ...Object.fromEntries(Object.entries(DECISION_CATEGORY).map(([key, en]) => [en, DECISION_CATEGORY_AR[key]]))
};
