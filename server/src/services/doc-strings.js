/**
 * Arabic for the document-generation layer.
 *
 * Keyed on the English source string rather than an invented identifier. The
 * builders already contain the English; keying on it means a heading or a
 * sentence is translated by adding one line here, with nothing to keep in
 * step, and an untranslated string falls through as English rather than as a
 * missing key.
 *
 * This covers the platform's own connective prose and headings. The
 * substantive clauses come from the canonical requirement model, which carries
 * its own Arabic in knowledge/ar/.
 */

const AR = {
  // ------------------------------------------------------------ headings --
  'Purpose': 'الغرض',
  'Scope': 'النطاق',
  'Objectives': 'الأهداف',
  'Policy Statements': 'بنود السياسة',
  'Roles and Responsibilities': 'الأدوار والمسؤوليات',
  'Roles': 'الأدوار',
  'Role Summary': 'ملخص الأدوار',
  'Compliance': 'الالتزام',
  'Enforcement': 'الإنفاذ',
  'Exceptions': 'الاستثناءات',
  'Review': 'المراجعة',
  'References': 'المراجع',
  'Mandatory Requirements': 'المتطلبات الإلزامية',
  'Minimum Controls': 'الحد الأدنى من الضوابط',
  'Defined Values': 'القيم المعتمدة',
  'Evidence Requirements': 'متطلبات الأدلة',
  'Key Performance Indicators': 'مؤشرات الأداء الرئيسية',
  'Control Indicators': 'مؤشرات الضوابط',
  'Monitoring and Measurement': 'المراقبة والقياس',
  'Monitoring': 'المراقبة',
  'Security Requirements': 'المتطلبات الأمنية',
  'Process Overview': 'نظرة عامة على العملية',
  'Preconditions': 'المتطلبات المسبقة',
  'Inputs': 'المدخلات',
  'Outputs': 'المخرجات',
  'Detailed Steps': 'الخطوات التفصيلية',
  'Decision Points': 'نقاط القرار',
  'Escalation': 'التصعيد',
  'Records and Evidence': 'السجلات والأدلة',
  'Implementation Guidance': 'الإرشاد التطبيقي',
  'Common Pitfalls': 'الأخطاء الشائعة',
  'Notes': 'ملاحظات',
  'Governance': 'الحوكمة',
  'Framework Governance': 'حوكمة الإطار',
  'Framework Structure': 'هيكل الإطار',
  'Adopted Sources': 'المصادر المعتمدة',
  'Control Matrix': 'مصفوفة الضوابط',
  'Matrix': 'المصفوفة',
  'Control Coverage': 'تغطية الضوابط',
  'Legend': 'دليل الرموز',

  // -------------------------------------------------- document type names --
  'Policy': 'سياسة',
  'Standard': 'معيار',
  'Procedure': 'إجراء',
  'Guideline': 'دليل إرشادي',
  'Control Framework': 'إطار الضوابط',
  'RACI Matrix': 'مصفوفة RACI',
  'Process Flow': 'مخطط سير العملية',

  // -------------------------------------------------------- table headers --
  'Role': 'الدور',
  'Accountable for': 'مسؤول مساءلةً عن',
  'Responsible for': 'مسؤول تنفيذاً عن',
  'Requirement': 'المتطلب',
  'Control': 'الضابط',
  'Control ID': 'رمز الضابط',
  'Type': 'النوع',
  'Nature': 'الطبيعة',
  'Frequency': 'التكرار',
  'Owner': 'المالك',
  'Indicator': 'المؤشر',
  'Evidence': 'الدليل',
  'Parameter': 'المعامل',
  'Value': 'القيمة',
  'Activity': 'النشاط',
  'Phase': 'المرحلة',
  'Step': 'الخطوة',
  'Action': 'الإجراء',
  'Source': 'المصدر',
  'Reference': 'المرجع',
  'Title': 'العنوان',
  'Risk addressed': 'الخطر المُعالَج',
  'Rating': 'التصنيف',
  'Description': 'الوصف',

  // ------------------------------------------------- connective sentences --
  // Interpolated values are marked {name} rather than embedded, so a
  // translation can put them where the sentence needs them rather than where
  // English happened to.
  'policy.purpose': 'تُحدّد هذه السياسة موقف {org} ومتطلباتها الإلزامية في مجال {domain}. وهي تُحدّد ما يجب تحقيقه؛ أما معيار {domain} المصاحب فيُحدّد المتطلبات القابلة للقياس، ويُحدّد إجراء {domain} كيفية تنفيذها.',
  'policy.objectivesLead': 'تهدف هذه السياسة إلى تحقيق ما يلي:',
  'policy.statementsLead': 'البنود التالية إلزامية. والمرجع الوارد بين قوسين بعد كل بند يُحدّد المتطلب المصدري الذي يعالجه.',
  'scope.appliesTo': 'تنطبق هذه الوثيقة على جميع موظفي {org} والمتعاقدين والاستشاريين والموظفين المؤقتين والأطراف الخارجية الذين يصلون إلى أنظمة المعلومات ضمن مجال {domain} أو يشغّلونها أو يدعمونها.',
  'scope.estateLead': 'وتنطبق على النطاق التقني التالي:',
  'scope.allSystems': 'جميع أنظمة المعلومات التي تُخزّن معلومات المنظمة أو تعالجها أو تنقلها، أياً كان موقع استضافتها.',
  'scope.allEnvironments': 'جميع البيئات، بما فيها الإنتاج والتعافي من الكوارث والاختبار والتطوير.',
  'scope.platforms': 'جميع المنصات التقنية المسجّلة في سجل الأصول.',
  'scope.envInUse': 'البيئات التقنية المستخدمة: {list}.',
  'scope.thirdParty': 'جميع خدمات الأطراف الخارجية التي تقدّم وظائف ضمن النطاق أو تدعمها.',
  'scope.conflict': 'وحيثما تعارض متطلب في هذه الوثيقة مع التزام نظامي أو تنظيمي، يسود الالتزام النظامي أو التنظيمي ويُسجَّل التعارض بوصفه استثناءً.',
  'standard.purpose': 'يُحدّد هذا المعيار المتطلبات القابلة للقياس التي تُنفّذ سياسة {domain}. والالتزام به إلزامي، ويخضع للتحقق من خلال الأدلة المنصوص عليها في هذه الوثيقة.',
  'standard.parametersLead': 'القيم التالية هي القيم المعتمدة للمنظمة. وكل موضع تُذكر فيه هذه القيم في السياسة أو المعيار أو الإجراء يُشير إلى هذا الجدول، فتغييرها هنا يغيّرها في كل الوثائق.',
  'standard.evidenceLead': 'تُثبت الأدلة التالية أن كل ضابط قد طُبّق فعلاً. والضابط الذي لا يُنتج دليلاً لا يمكن اختباره ولا تدقيقه.',
  'procedure.purpose': 'يصف هذا الإجراء كيفية تنفيذ متطلبات معيار {domain} عملياً، ومن ينفّذ كل خطوة.',
  'procedure.stepsLead': 'تُنفَّذ الخطوات بالترتيب الوارد أدناه ما لم يُنص على خلاف ذلك.',
  'compliance.body': 'يخضع الالتزام بهذه الوثيقة للمراقبة من خلال المؤشرات والأدلة المنصوص عليها فيها. وتُعالَج حالات عدم الالتزام بوصفها ملاحظات ضمن عملية المعالجة المعتمدة.',
  'exceptions.body': 'يجب طلب أي استثناء من هذه الوثيقة كتابةً، وأن يوثّق المبرر والضابط التعويضي ومدة السريان، وأن يُعتمد من الجهة المخوّلة. ويُراجَع كل استثناء عند انتهاء مدته ولا يُجدَّد تلقائياً.',
  'review.body': 'تُراجَع هذه الوثيقة مرة واحدة سنوياً على الأقل، وعند أي تغيير جوهري في البيئة التقنية أو التنظيمية أو في المتطلبات التنظيمية.',
  'enforcement.body': 'عدم الالتزام بهذه الوثيقة قد يؤدي إلى اتخاذ إجراءات تأديبية وفق سياسات الموارد البشرية المعتمدة، وإلى إجراءات تعاقدية في حالة الأطراف الخارجية.',
  'references.lead': 'تستند هذه الوثيقة إلى المصادر التالية. والمصادر مذكورة كبيانات مرجعية للربط؛ ويجب الرجوع إلى النشرة الرسمية لكل منها عند الاعتماد عليها في إقرار تنظيمي.',

  'compliance.mandatory': 'الالتزام بهذه السياسة إلزامي، ويُقيَّم من خلال اختبار الضوابط والمراجعة الداخلية والتدقيق المستقل.',
  'compliance.sourcesLead': 'تدعم هذه السياسة الالتزام بالمصادر المعتمدة التالية:',
  'compliance.tracebilityTitle': 'تتبّع المصدر',
  'compliance.traceability': 'تُحدّد مراجع الأطر المتطلبات المصدرية التي صُمِّمت هذه السياسة لمعالجتها. وهي مُستنسَخة هنا كبيانات مرجعية، ويجب التحقق منها مقابل النشرة الرسمية قبل الاعتماد عليها في إقرار تنظيمي.',
  'compliance.colSource': 'المصدر',
  'compliance.colType': 'النوع',
  'compliance.colRequirements': 'المتطلبات المُشار إليها',
  'exceptions.lead': 'يتطلب أي خروج عن هذه السياسة استثناءً رسمياً محدد المدة.',
  'exceptions.record': 'يجب أن يوثّق طلب الاستثناء المتطلب غير المُستوفى، والمبرر الوظيفي، والضوابط التعويضية القائمة، والخطر المتبقي.',
  'exceptions.approve': 'يجب أن يعتمد رئيس الأمن السيبراني الاستثناء، وأن تعتمده اللجنة الإشرافية للأمن السيبراني إذا كان الخطر المتبقي مُصنَّفاً حرجاً.',
  'exceptions.expiry': 'يجب أن يحمل الاستثناء تاريخ انتهاء لا يتجاوز ١٢ شهراً، وأن يُعاد تقييمه عند انتهائه لا أن يُجدَّد تلقائياً.',
  'exceptions.register': 'يجب تسجيل كل الاستثناءات السارية في سجل الاستثناءات ورفعها إلى اللجنة الإشرافية للأمن السيبراني.',
  'monitoring.lead': 'تُقاس فاعلية هذه السياسة من خلال المؤشرات التالية:',
  'monitoring.colFrequency': 'تكرار القياس',
  'review.lead': 'تُراجَع هذه السياسة مرة واحدة سنوياً على الأقل، وكذلك عند حدوث أي مما يلي:',
  'review.lawChange': 'تغيّر في الأنظمة أو اللوائح أو الأطر المرجعية المعتمدة.',
  'review.orgChange': 'تغيّر جوهري في الهيكل التنظيمي أو البيئة التقنية أو نموذج التشغيل.',
  'review.incident': 'حادث أمن سيبراني جوهري ضمن هذا المجال.',
  'review.auditFinding': 'ملاحظة تدقيق أو تقييم تشير إلى قصور في السياسة.',
  'review.owner': 'يتولى مالك الوثيقة بدء المراجعة، وتتولى الجهة المعتمِدة إعادة إصدار السياسة.',
  'enforcement.discipline': 'قد يؤدي عدم الالتزام بهذه السياسة إلى اتخاذ إجراءات تأديبية وفق سياسات الموارد البشرية المعمول بها، وقد يُعد في حالة الأطراف الخارجية إخلالاً بالعقد.',
  'enforcement.circumvention': 'يُعامَل التحايل المتعمّد على ضابط أمني تفرضه هذه السياسة بوصفه حادث أمن سيبراني ويُحقَّق فيه وفقاً لذلك.',
  'references.readWith': 'تُقرأ هذه السياسة مع ما يلي:',

  // ------------------------------------------------------------- phrases --
  'No accountability assigned in this domain': 'لا توجد مساءلة مُسنَدة في هذا المجال',
  'Not assigned': 'غير مُسنَد',
  'None': 'لا يوجد',
  'All': 'الكل',
  'Responsible': 'منفّذ',
  'Accountable': 'مساءَل',
  'Consulted': 'مُستشار',
  'Informed': 'مُطّلع',
  'Supportive': 'مساند',

  // ------------------------------------------------- remaining headings --
  'Technical Requirements': 'المتطلبات التقنية',

  // ---------------------------------------------- remaining table headers -
  'Ref': 'الرقم',
  'Risk': 'الخطر',
  'Category': 'الفئة',

  // ------------------------------------------------------ enumerations ----
  // Role categories, RACI phases and control attributes are stored as English
  // keys; the document shows them, so each needs a word rather than a code.
  'Leadership': 'القيادة',
  'Operations': 'العمليات',
  'Architecture': 'الهندسة المعمارية',
  'Business': 'الأعمال',
  'Technology': 'التقنية',
  'Assurance': 'التأكيد',
  'Govern': 'الحكم',
  'Operate': 'التشغيل',
  'Protect': 'الحماية',
  'Detect': 'الكشف',
  'Respond': 'الاستجابة',
  'Assure': 'التأكيد',
  'Resilience': 'الصمود',
  'preventive': 'وقائي',
  'detective': 'كاشف',
  'corrective': 'تصحيحي',
  'directive': 'توجيهي',
  'administrative': 'إداري',
  'technical': 'تقني',
  'hybrid': 'مُختلط',
  'physical': 'مادي',
  'critical': 'حرج',
  'high': 'عالٍ',
  'medium': 'متوسط',
  'low': 'منخفض',

  // --------------------------------------------------------------- policy -
  'policy.rolesLead': 'تتولى الأدوار التالية المساءلة والمسؤولية التنفيذية عن هذه السياسة. والإسناد الكامل مُوثَّق في {matrix}.',
  'governance.lead': 'تُحكَم هذه السياسة على النحو التالي:',
  'governance.owner': 'يملك رئيس الأمن السيبراني هذه السياسة ويُسأل عن كفايتها.',
  'governance.approver': 'تعتمد اللجنة الإشرافية للأمن السيبراني هذه السياسة وأي تعديل جوهري عليها.',
  'governance.maintainer': 'يتولى مدير حوكمة الأمن السيبراني والمخاطر والالتزام صيانة السياسة والمعيار والإجراء المصاحبين لها، ومكتبة الضوابط التي تُنفّذها.',
  'governance.reporting': 'يُرفَع أداء الضوابط إلى اللجنة الإشرافية للأمن السيبراني وفق دورة الرفع المعتمدة.',
  'governance.assurance': 'تقدّم المراجعة الداخلية تأكيداً مستقلاً على الضوابط المُنفِّذة لهذه السياسة.',
  'references.orgPolicy': 'سياسة الأمن السيبراني (على مستوى المنظمة)',
  'references.classification': 'معيار تصنيف المعلومات والتعامل معها',
  'references.incident': 'إجراء إدارة حوادث الأمن السيبراني',
  'references.sourcesLead': 'المصادر المرجعية المعتمدة:',

  // ------------------------------------------------------------- standard -
  'standard.purposeLead': 'يُحدّد هذا المعيار المتطلبات الإلزامية القابلة للقياس التي تُنفّذ {policy} في {org}.',
  'standard.purposeTrace': 'يرتبط كل متطلب في هذا المعيار ببند في السياسة وبالمتطلبات المصدرية المعتمدة التي تعالجها السياسة. وحيثما حدّد هذا المعيار قيمة — تكراراً أو حدّاً أو مدةً — فتلك القيمة هي الرقم المعتمد الوحيد، وتُستخدم كما هي في الإجراء المقابل وفي سجلات الضوابط.',
  'standard.scopeSame': 'ينطبق هذا المعيار على النطاق ذاته الذي تنطبق عليه {policy}.',
  'standard.scopePlatforms': 'تنطبق المتطلبات التقنية على كل منصة قادرة على إنفاذها. وحيثما تعذّر على منصة إنفاذ متطلب، وجب استثناء موثّق مع ضوابط تعويضية قبل إدخال المنصة إلى الخدمة أو استمرارها فيها.',
  'parameters.lead': 'القيم التالية هي المعاملات التنظيمية المعتمدة لهذا المجال. وعلى كل وثيقة أو إعداد أو ضابط يُشير إلى هذه الالتزامات أن يستخدم هذه القيم.',
  'parameters.colValue': 'القيمة المعتمدة',
  'parameters.changeTitle': 'ضبط التغيير',
  'parameters.change': 'تغيير قيمة في هذا الجدول يُغيّر التزاماً تنظيمياً. وتتطلب التعديلات اعتماد مالك السياسة، ويجب تعميمها على الإجراء ومكتبة الضوابط وأي خط أساس إعدادي متأثر.',
  'technical.lead': 'المتطلبات التالية تُنفَّذ عبر الإعداد التقني، ويجب أن تكون قابلة للتحقق من خلال تصدير الإعدادات أو الفحص أو تقارير المنصة:',
  'technical.colPoint': 'موضع الإنفاذ',
  'technical.colVerification': 'التحقق',
  'technical.hybrid': 'تقني بدعم إجرائي',
  'technical.configuration': 'إعداد تقني',
  'technical.defaultEvidence': 'دليل إعدادات',
  'technical.administrativeOnly': 'يُنفَّذ هذا المجال أساساً من خلال ضوابط إدارية. أما متطلبات الإنفاذ التقني فمحدّدة في معايير المجالات ذات الصلة.',
  'security.lead': 'يجب الحفاظ على الخصائص الأمنية التالية في كل تطبيق لهذا المعيار:',
  'security.attribution': 'الإسناد الفردي: يجب أن يكون كل فعل يُتخذ بموجب هذا المعيار قابلاً للإسناد إلى شخص أو خدمة أو جهاز مُعرَّف تعريفاً فريداً.',
  'security.leastPrivilege': 'الحد الأدنى من الصلاحيات: يجب أن يكون الوصول والقدرة المُمنوحان الحد الأدنى الكافي لأداء المهمة.',
  'security.sod': 'الفصل بين المهام: لا يجوز أن يكون الطرف المنفّذ للنشاط هو الطرف الوحيد المؤكِّد عليه.',
  'security.auditability': 'القابلية للتدقيق: يجب أن يُنتج كل متطلب دليلاً كافياً لإثبات تطبيقه لمراجع مستقل.',
  'security.failSecure': 'الإخفاق الآمن: حيثما تعذّر على ضابط العمل، يجب أن يكون السلوك الافتراضي للنظام هو منع الوصول لا السماح به.',
  'controls.lead': 'الضوابط التالية هي الحد الأدنى المطلوب لاستيفاء هذا المعيار. وهي مُدارة في مكتبة الضوابط ومُختبَرة بالتكرار المنصوص عليه.',
  'controls.colResponsible': 'الدور المنفّذ',
  'mandatory.lead': 'يُذكر كل متطلب أدناه في بنود مرقّمة على حدة. والبند التزامٌ واحد قابل للاختبار بذاته، ويُسمّي الدور الواحد المسؤول عنه. وحيثما أحال بندٌ إلى قيمة معتمدة، فتلك القيمة هي الرقم المُسجَّل في جدول القيم المعتمدة.',
  'mandatory.colAccountable': 'الجهة المسؤولة',
  'mandatory.policyRef': 'السياسة',
  'mandatory.unassigned': 'لم تُسنَد بعد',
  'standard.exceptionsLead': 'تخضع الاستثناءات من هذا المعيار لعملية الاستثناء المنصوص عليها في السياسة.',
  'standard.exceptionTechnical': 'يجب أن يوثّق الاستثناء التقني القيد التقني في المنصة الذي يمنع الالتزام.',
  'standard.exceptionCompensating': 'يجب تحديد ضابط تعويضي وإثبات عمله طوال مدة الاستثناء.',
  'standard.exceptionCritical': 'تتطلب الاستثناءات من المتطلبات المُصنَّفة خطراً حرجاً اعتماد اللجنة الإشرافية للأمن السيبراني.',
  'standard.monitoringLead': 'تُراقَب درجة الالتزام بهذا المعيار على النحو التالي:',
  'standard.colReportedTo': 'يُرفَع إلى',
  'standard.complianceLead': 'يدعم هذا المعيار الالتزام بالمصادر المعتمدة التالية:',
  'standard.nonCompliance': 'تُسجَّل حالات عدم الالتزام المكتشفة بالاختبار أو التدقيق بوصفها ملاحظات، وتُصنَّف بحسب الخطر وتُتابَع حتى الإغلاق.',
  'provenance.regulatory': 'متطلب تنظيمي',
  'provenance.framework': 'إرشاد إطار مرجعي',

  // ------------------------------------------------------------ procedure -
  'procedure.implements': 'يُنفّذ هذا الإجراء {policy} و{standard}. والقيم الواردة فيه مأخوذة من المعيار ولم تُحدَّد فيه ابتداءً.',
  'procedure.scope': 'ينطبق هذا الإجراء على جميع من يؤدي الأنشطة الموصوفة فيه، ضمن النطاق المُحدَّد في {policy}.',
  'procedure.preconditionsLead': 'يجب توافر ما يلي قبل تنفيذ هذا الإجراء:',
  'procedure.inputsLead': 'يتلقّى هذا الإجراء المدخلات التالية:',
  'procedure.processLead': 'تسير العملية عبر المراحل التالية:',
  'procedure.colStage': 'المرحلة',
  'procedure.colPerformedBy': 'ينفّذها',
  'procedure.performedBy': 'ينفّذها:',
  'procedure.decision': 'قرار:',
  'procedure.ifYes': 'نعم',
  'procedure.ifNo': 'لا',
  'procedure.colDecision': 'القرار',
  'procedure.colIfYes': 'إذا نعم',
  'procedure.colIfNo': 'إذا لا',
  'procedure.noDecisions': 'لا يحتوي هذا الإجراء على نقاط قرار شرطية؛ وتُنفَّذ جميع الخطوات بالتسلسل.',
  'procedure.escalationLead': 'تستوجب الحالات التالية التصعيد:',
  'procedure.outputsLead': 'يُنتج التنفيذ الناجح ما يلي:',
  'procedure.recordsLead': 'يجب إنشاء السجلات التالية والاحتفاظ بها. وهذه السجلات هي الأدلة المُعتمد عليها في اختبار الضوابط والتدقيق.',
  'kpis.colTarget': 'المستهدف',
  'procedure.rolesLead': 'الأدوار المشاركة في هذا الإجراء وإسنادها هي:',
  'procedure.colAssignment': 'الإسناد في هذا الإجراء',
  'procedure.accountableForN': 'مسؤول مساءلةً عن {n} من الأنشطة',
  'procedure.responsibleForN': 'مسؤول تنفيذاً عن {n} من الأنشطة',
  'procedure.consultedOnly': 'يُستشار أو يُطلَع فقط',
  'procedure.exceptionsLead': 'حيثما تعذّر اتباع هذا الإجراء:',
  'procedure.deviationRecord': 'يجب تسجيل الخروج عن الإجراء وقت وقوعه، مع المبرر والجهة المعتمِدة.',
  'procedure.deviationControl': 'يجب رفع حالات الخروج التي تمسّ ضابطاً يفرضه المعيار بوصفها استثناءً وفق عملية الاستثناء في السياسة.',
  'procedure.deviationRepeat': 'يستوجب تكرار الخروج عن الإجراء للسبب ذاته مراجعةَ الإجراء نفسه لا استمرار الاستثناء.',

  // ------------------------------------------------------------ guideline -
  'guideline.purpose': 'يقدّم هذا الدليل الإرشادي مشورة تطبيقية غير إلزامية بشأن {standard}.',
  'guideline.statusTitle': 'وضع هذه الوثيقة',
  'guideline.status': 'هذا الدليل استشاري ولا يُنشئ التزامات. وحيثما بدا متعارضاً مع السياسة أو المعيار، تسود السياسة أو المعيار.',
  'guideline.scope': 'موجَّه للفرق التي تُطبّق ضوابط {domain} أو تشغّلها في {org}.',
  'guideline.pitfallsLead': 'ما يلي هو أنماط الإخفاق الأكثر شيوعاً في هذا المجال:',

  // ---------------------------------------------------------------- roles -
  'roles.purposeLead': 'تُحدّد هذه الوثيقة أدوار الأمن السيبراني ومسؤولياتها المنطبقة على مجال {domain} في {org}.',
  'roles.purposeContents': 'يُوثّق كل دور غرضه، وخط ارتباطه التنظيمي، وصلاحياته، ومسؤولياته التنفيذية، ومساءلاته، والاعتمادات المطلوبة منه، وواجبات التصعيد المنوطة به، والكفايات اللازمة له، وتماسّه مع بقية الأدوار.',
  'roles.colReportingLine': 'خط الارتباط',
  'roles.colAttribute': 'الخصيصة',
  'roles.colDefinition': 'التعريف',
  'roles.authority': 'الصلاحيات',
  'roles.responsibilities': 'المسؤوليات الرئيسية',
  'roles.accountabilities': 'المساءلات',
  'roles.activities': 'الأنشطة المطلوبة',
  'roles.approvals': 'الاعتمادات المطلوبة',
  'roles.escalations': 'مسؤوليات التصعيد',
  'roles.competencies': 'الكفايات المطلوبة',
  'roles.interfaces': 'التماسّ مع الأدوار الأخرى',
  'roles.colInterfacesWith': 'يتماسّ مع',
  'roles.colInterfaceNature': 'طبيعة التماسّ',
  'roles.raciIn': 'إسناد RACI في مجال {domain}',
  'roles.colAssignment': 'الإسناد',
  'roles.colActivities': 'الأنشطة',
  'roles.consultedSupport': 'مُستشار / مساند',
  'roles.review': 'تُراجَع تعريفات الأدوار مرة واحدة سنوياً على الأقل، وعند أي تغيير في الهيكل التنظيمي. ويجب رفع الأدوار الشاغرة إلى رئيس الأمن السيبراني وإعادة إسنادها خلال ١٠ أيام عمل.',

  // ----------------------------------------------------------------- RACI -
  'raci.purpose': 'تُسند هذه المصفوفة المسؤولية التنفيذية والمساءلة لكل نشاط من أنشطة {domain} في {org}. ويكون دور واحد بالضبط مسؤولاً مساءلةً عن كل نشاط.',
  'raci.colCode': 'الرمز',
  'raci.colMeaning': 'الدلالة',
  'raci.defR': 'ينفّذ النشاط.',
  'raci.defA': 'يُسأل عن النتيجة. دور واحد بالضبط لكل نشاط.',
  'raci.defS': 'يوفّر الموارد أو العون للدور المنفّذ.',
  'raci.defC': 'يقدّم مُدخَلاً قبل اكتمال النشاط. تواصل في اتجاهين.',
  'raci.defI': 'يُخبَر بالنتيجة. تواصل في اتجاه واحد.',
  'raci.noteOneAccountable': 'يكون دور واحد بالضبط مسؤولاً مساءلةً عن كل نشاط. وحيثما ظهر دوران يتقاسمان المساءلة، فالمصفوفة لم تُتَّفق عليها بعد.',
  'raci.noteDelegation': 'المساءلة لا تُفوَّض، والمسؤولية التنفيذية تُفوَّض.',
  'raci.noteConsulted': 'يجب إشراك الأدوار المُدرَجة بوصفها مُستشارة قبل اكتمال النشاط، لا إخبارها بعده.',
  'raci.noteReview': 'تُراجَع هذه المصفوفة عند أي تغيير في الهيكل التنظيمي، ومرة واحدة سنوياً على الأقل.',

  // -------------------------------------------------------- control matrix -
  'matrix.purpose': 'تُوثّق هذه المصفوفة ضوابط {domain} وخصائصها، والأدلة التي تُثبت عملها، والمتطلبات المصدرية التي تستوفيها.',
  'matrix.colMapping': 'الربط بالأطر المرجعية',
  'matrix.colEvidence': 'الدليل المطلوب',
  'matrix.colCollection': 'تكرار الجمع',

  // ----------------------------------------------------------- framework ---
  'framework.purpose': 'تصف هذه الوثيقة إطار ضوابط {org} لمجال {domain}، وكيفية ربطه بالمصادر المرجعية المعتمدة.',
  'framework.structureLead': 'يتبع الإطار التسلسل الحوكمي المعتمد على مستوى المنظمة:',
  'framework.tierRegulation': 'اللوائح والأطر المرجعية — المتطلبات الخارجية المصدرية.',
  'framework.tierControl': 'الضابط التنظيمي — الضابط الذي تشغّله المنظمة لاستيفائها.',
  'framework.tierPolicy': 'السياسة — الموقف التنظيمي الإلزامي.',
  'framework.tierStandard': 'المعيار — المتطلبات القابلة للقياس التي تُنفّذ السياسة.',
  'framework.tierProcedure': 'الإجراء — الخطوات التي تُنفَّذ بها المتطلبات.',
  'framework.tierWorkInstruction': 'تعليمات العمل — تفصيل التنفيذ الخاص بكل منصة.',
  'framework.tierEvidence': 'الدليل — السجل الذي يُثبت أن الضابط قد عمل.',
  'framework.colPublisher': 'الجهة الناشرة',
  'framework.colVersion': 'الإصدار',
  'framework.kindRegulatory': 'تنظيمي',
  'framework.kindFramework': 'إطار مرجعي',
  'framework.provenanceTitle': 'المصدر',
  'framework.provenance': 'المتطلبات المستمدة من هذه المصادر مرجعية مُلزِمة. أما الضوابط والسياسات والمعايير والإجراءات التي تُنتجها المنظمة فهي محتوى تنظيمي، ومُعلَّمة بذلك في كل أرجاء هذه المنصة.',
  'framework.colControl': 'الضابط التنظيمي',
  'framework.colAddresses': 'يعالج',
  'framework.govOwner': 'يملك رئيس الأمن السيبراني هذا الإطار.',
  'framework.govMapping': 'يتولى مدير حوكمة الأمن السيبراني والمخاطر والالتزام صيانة الربط بين المتطلبات المصدرية والضوابط التنظيمية.',
  'framework.govReview': 'تُراجَع تغطية الربط مرة واحدة سنوياً على الأقل، وعند كل تحديث لمصدر معتمد.',
  'framework.govGaps': 'تُسجَّل فجوات التغطية في تقييم الفجوات وتُتابَع حتى الإغلاق.'
};

/**
 * Arabic document titles.
 *
 * Not a word substitution: Arabic builds most of these as a genitive
 * construction (إضافة), which needs the head noun indefinite — "سياسة إدارة
 * الهويات", not "السياسة إدارة الهويات" — and the ones that cannot take that
 * form need a preposition instead. Concatenating a translated word onto the
 * domain name produced "الأدوار والمسؤوليات إدارة الهويات والوصول", which is
 * not a phrase, so each type carries its own construction.
 */
/**
 * The preposition "li-" attaches to the following word rather than standing
 * apart: لـ + إدارة is لإدارة, and before the definite article the two lams
 * merge, so لـ + الحوكمة is للحوكمة rather than لالحوكمة. Writing the tatweel
 * form in running text is a typographic convention for showing a prefix in
 * isolation, not how the word is spelled.
 */
function li(word) {
  const text = String(word).trim();
  if (text.startsWith('ال')) return `لل${text.slice(2)}`;
  return `ل${text}`;
}

const AR_TITLE = {
  'Policy': (domain) => `سياسة ${domain}`,
  'Standard': (domain) => `معيار ${domain}`,
  'Procedure': (domain) => `إجراء ${domain}`,
  'Guideline': (domain) => `الدليل الإرشادي ${li(domain)}`,
  'Control Framework': (domain) => `إطار ضوابط ${domain}`,
  'Control Matrix': (domain) => `مصفوفة ضوابط ${domain}`,
  'Roles and Responsibilities': (domain) => `أدوار ومسؤوليات ${domain}`,
  'RACI Matrix': (domain) => `مصفوفة RACI ${li(domain)}`,
  'Process Flow': (domain) => `مخطط سير عملية ${domain}`
};

export function arabicTitle(type, domainName) {
  const build = AR_TITLE[type];
  return build ? build(domainName) : `${type} ${domainName}`;
}

/**
 * A translator for one language.
 *
 * `t(text)` returns the Arabic for an exact English string, or the English
 * unchanged. `t.has(text)` says whether a translation exists, which lets a
 * caller decide between rewording and falling back.
 */
export function translator(language = 'en') {
  if (language !== 'ar') {
    const identity = (text, values) => (values
      ? String(text).replace(/\{(\w+)\}/g, (m, name) => (values[name] === undefined ? m : String(values[name])))
      : text);
    // English has no translation table, so nothing is "translated" here. This
    // has to read false: `TP(key, english)` asks `has(key)` to decide between a
    // translation and the English at the call site, and a true here returned
    // the key itself — every English document rendered "scope.estateLead"
    // where its scope sentence belonged.
    identity.has = () => false;
    identity.language = 'en';
    identity.isRtl = false;
    return identity;
  }
  const t = (text, values) => {
    const out = AR[text] ?? text;
    if (!values) return out;
    return String(out).replace(/\{(\w+)\}/g, (match, name) => (
      values[name] === undefined ? match : String(values[name])
    ));
  };
  t.has = (text) => Object.prototype.hasOwnProperty.call(AR, text);
  t.language = 'ar';
  t.isRtl = true;
  return t;
}

/** Coverage, for the knowledge-base integrity check to report honestly. */
export function translatedStringCount() {
  return Object.keys(AR).length;
}
