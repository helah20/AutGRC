/**
 * Arabic for vocabulary shared across every domain.
 *
 * A control's test frequency is drawn from a small closed vocabulary that
 * repeats across all twenty-four domains — twenty-seven controls say
 * "Continuous" — so translating it per requirement would mean writing the same
 * word dozens of times and keeping the copies in step. It lives here instead,
 * keyed on the English source string.
 *
 * The keys keep their `{{placeholder}}` exactly as the English model writes it:
 * translation happens before resolution, so the agreed value still arrives
 * through the parameter set rather than being written into the sentence.
 */

export const AR_FREQUENCY = {
  'Continuous': 'مستمر',
  'Continuous, with monthly reconciliation': 'مستمر، مع مطابقة شهرية',
  'Continuous, reviewed {{accessReviewFrequency}}': 'مستمر، ويُراجَع بتكرار {{accessReviewFrequency}}',
  'Continuous, reviewed {{baselineReviewFrequency}}': 'مستمر، ويُراجَع بتكرار {{baselineReviewFrequency}}',
  'Continuous, reviewed {{classificationReviewFrequency}}': 'مستمر، ويُراجَع بتكرار {{classificationReviewFrequency}}',
  'Continuous, reviewed {{firewallReviewFrequency}}': 'مستمر، ويُراجَع بتكرار {{firewallReviewFrequency}}',
  'Continuous, reviewed {{privAccessReviewFrequency}}': 'مستمر، ويُراجَع بتكرار {{privAccessReviewFrequency}}',
  'Continuous, reviewed {{privilegedCloudReview}}': 'مستمر، ويُراجَع بتكرار {{privilegedCloudReview}}',
  'Continuous, reviewed {{criticalSupplierReviewFrequency}}': 'مستمر، ويُراجَع بتكرار {{criticalSupplierReviewFrequency}}',
  'Continuous, reviewed {{cryptoReviewFrequency}}': 'مستمر، ويُراجَع بتكرار {{cryptoReviewFrequency}}',
  'Continuous, reviewed {{cspAssessmentFrequency}}': 'مستمر، ويُراجَع بتكرار {{cspAssessmentFrequency}}',
  'Continuous, reviewed {{restoreTestFrequency}}': 'مستمر، ويُراجَع بتكرار {{restoreTestFrequency}}',
  'Continuous, reviewed {{serviceAccountReviewFrequency}}': 'مستمر، ويُراجَع بتكرار {{serviceAccountReviewFrequency}}',
  'Continuous, rotation {{vaultRotationFrequency}}': 'مستمر، مع تدوير بتكرار {{vaultRotationFrequency}}',
  'Monthly': 'شهري',
  'Monthly reconciliation': 'مطابقة شهرية',
  'Monthly cycle with emergency provision': 'دورة شهرية مع مسار للحالات الطارئة',
  'Monthly to management, quarterly to the Steering Committee': 'شهري إلى الإدارة، وربع سنوي إلى اللجنة الإشرافية',
  'Reviewed annually': 'يُراجَع سنوياً',
  'Reviewed {{accessReviewFrequency}}': 'يُراجَع بتكرار {{accessReviewFrequency}}',
  'Reviewed {{appetiteReviewFrequency}}': 'يُراجَع بتكرار {{appetiteReviewFrequency}}',
  'Reviewed {{architectureReviewFrequency}}': 'يُراجَع بتكرار {{architectureReviewFrequency}}',
  'Reviewed {{bcmsScopeReview}}': 'يُراجَع بتكرار {{bcmsScopeReview}}',
  'Reviewed {{cloudStrategyReview}}': 'يُراجَع بتكرار {{cloudStrategyReview}}',
  'Reviewed {{complianceReviewFrequency}}': 'يُراجَع بتكرار {{complianceReviewFrequency}}',
  'Reviewed {{configReviewFrequency}}': 'يُراجَع بتكرار {{configReviewFrequency}}',
  'Reviewed {{contextReviewFrequency}}': 'يُراجَع بتكرار {{contextReviewFrequency}}',
  'Reviewed {{cryptoInventoryReview}}': 'يُراجَع بتكرار {{cryptoInventoryReview}}',
  'Reviewed {{logReviewFrequency}}': 'يُراجَع بتكرار {{logReviewFrequency}}',
  'Reviewed {{serviceReviewFrequency}}': 'يُراجَع بتكرار {{serviceReviewFrequency}}',
  'Reviewed and exercised {{irPlanTestFrequency}}': 'يُراجَع ويُختبَر بتكرار {{irPlanTestFrequency}}',
  'Reviewed {{classificationReviewFrequency}}': 'يُراجَع بتكرار {{classificationReviewFrequency}}',
  'Reviewed {{cryptoReviewFrequency}}': 'يُراجَع بتكرار {{cryptoReviewFrequency}}',
  'Reviewed {{drPlanReviewFrequency}}': 'يُراجَع بتكرار {{drPlanReviewFrequency}}',
  'Reviewed {{exitPlanReviewFrequency}}': 'يُراجَع بتكرار {{exitPlanReviewFrequency}}',
  'Reviewed {{policyReviewFrequency}}': 'يُراجَع بتكرار {{policyReviewFrequency}}',
  'Reviewed {{retentionScheduleReviewFrequency}}': 'يُراجَع بتكرار {{retentionScheduleReviewFrequency}}',
  'Tested {{bcpTestFrequency}}': 'يُختبَر بتكرار {{bcpTestFrequency}}',
  'Tested {{baselineReviewFrequency}}': 'يُختبَر بتكرار {{baselineReviewFrequency}}',
  'At acquisition and {{inventoryReviewFrequency}}': 'عند الاقتناء، وبتكرار {{inventoryReviewFrequency}}',
  'At creation, reviewed {{classificationReviewFrequency}}': 'عند الإنشاء، ويُراجَع بتكرار {{classificationReviewFrequency}}',
  'At hire and on role change': 'عند التعيين وعند تغيّر الدور',
  'At onboarding and annually': 'عند الإدراج وسنوياً',
  'At onboarding and at renewal': 'عند الإدراج وعند التجديد',
  'At onboarding, reviewed {{cspAssessmentFrequency}}': 'عند الإدراج، ويُراجَع بتكرار {{cspAssessmentFrequency}}',
  'At onboarding, valid {{dueDiligenceValidity}}': 'عند الإدراج، وصالح لمدة {{dueDiligenceValidity}}',
  'Per incident': 'لكل حادث',
  'Per cyber incident': 'لكل حادث سيبراني',
  'Per reportable incident': 'لكل حادث واجب الإبلاغ',
  'Per Severity 1 and 2 incident': 'لكل حادث من الدرجة الأولى والثانية',
  'Per request': 'لكل طلب',
  'Per request, with {{accessReviewFrequency}} matrix validation': 'لكل طلب، مع تحقق من المصفوفة بتكرار {{accessReviewFrequency}}',
  'Per event': 'لكل حدث',
  'Per event, with weekly exception reporting': 'لكل حدث، مع رفع تقرير أسبوعي بالاستثناءات',
  'Per elevation': 'لكل رفع للصلاحيات',
  'Per use; tested {{breakGlassTestFrequency}}': 'لكل استخدام؛ ويُختبَر بتكرار {{breakGlassTestFrequency}}',
  'Per contract': 'لكل عقد',
  'Per engagement': 'لكل تعاقد',
  'Per engagement, reviewed {{accessReviewFrequency}}': 'لكل تعاقد، ويُراجَع بتكرار {{accessReviewFrequency}}',
  'Per termination': 'لكل إنهاء للخدمة',
  'Per leaver event': 'لكل حالة مغادرة',
  'Per disposal event': 'لكل حالة إتلاف أو تخلّص',
  'Per environment refresh': 'لكل تحديث للبيئة',
  'Per project or material change': 'لكل مشروع أو تغيير جوهري',
  'Per qualifying change': 'لكل تغيير مشمول',
  'Per change': 'لكل تغيير',
  'Per application or material change': 'لكل تطبيق أو تغيير جوهري',
  'Per freeze window': 'لكل نافذة تجميد',
  'Per invocation': 'لكل تنشيط',
  'Per trigger': 'لكل حالة استدعاء',
  'Per emergency change': 'لكل تغيير طارئ',
  'Per release, training {{trainingFrequency}}': 'لكل إصدار، مع تدريب بتكرار {{trainingFrequency}}',
  'Per scan cycle': 'لكل دورة فحص',
  'Per acceptance, reviewed {{riskRegisterReviewFrequency}}': 'لكل قبول للخطر، ويُراجَع بتكرار {{riskRegisterReviewFrequency}}',
  'Per exception, reviewed quarterly': 'لكل استثناء، ويُراجَع ربع سنوياً',
  'Per visit': 'لكل زيارة',
  '{{accessReviewFrequency}} (privileged: {{privAccessReviewFrequency}})': '{{accessReviewFrequency}} (المُمتاز: {{privAccessReviewFrequency}})',
  '{{discoveryFrequency}} discovery, {{inventoryReviewFrequency}} attestation': 'استكشاف بتكرار {{discoveryFrequency}}، وتصديق بتكرار {{inventoryReviewFrequency}}',
  '{{internalScanFrequency}} internal, {{externalScanFrequency}} external': 'فحص داخلي بتكرار {{internalScanFrequency}}، وفحص خارجي بتكرار {{externalScanFrequency}}'
};

/**
 * The Arabic for one frequency expression, or the English unchanged.
 *
 * A value that is nothing but a placeholder needs no entry: the parameter it
 * names already carries its Arabic wording.
 */
export function arFrequency(text) {
  if (!text) return text;
  return AR_FREQUENCY[text] ?? text;
}

/**
 * Arabic labels for parameter names.
 *
 * The "Defined Values" table is the most consequential table in a Standard: it
 * is the single place the organisation states each numeric commitment. Its left
 * column was the humanised parameter name — "Access Review Frequency" — so an
 * Arabic Standard listed English subjects against Arabic values.
 *
 * Keyed on the parameter name, so one entry serves every domain that uses it.
 * A name with no entry falls back to the English humanisation, which is visibly
 * English and therefore visibly missing rather than silently wrong.
 */
export const AR_PARAMETER_LABELS = {
  // governance
  policyReviewFrequency: 'تكرار مراجعة السياسات',
  committeeFrequency: 'تكرار اجتماع اللجنة',
  strategyHorizon: 'الأفق الزمني للاستراتيجية',
  complianceReviewFrequency: 'تكرار مراجعة الالتزام',
  auditFrequency: 'تكرار التدقيق',
  policyApprovalAuthority: 'صلاحية اعتماد السياسات',
  contextReviewFrequency: 'تكرار مراجعة السياق',
  criticalSystemDesignation: 'أسلوب تصنيف الأنظمة الحرجة',
  improvementClosureTarget: 'مستهدف إغلاق إجراءات التحسين',
  auditTestingSafeguards: 'ضمانات اختبار التدقيق',
  ipComplianceReview: 'مراجعة الالتزام بالملكية الفكرية',
  businessProcessControls: 'ضوابط عمليات الأعمال',
  // risk management
  riskAssessmentFrequency: 'تكرار تقييم المخاطر',
  riskRegisterReviewFrequency: 'تكرار مراجعة سجل المخاطر',
  riskAcceptanceMaxDuration: 'الحد الأعلى لمدة قبول الخطر',
  criticalRiskEscalation: 'مسار رفع المخاطر الحرجة',
  riskMethodology: 'منهجية المخاطر',
  riskEvaluationCriteria: 'معايير تقييم الخطر',
  assessmentTriggers: 'مُحرِّكات استدعاء التقييم',
  riskOwnerRule: 'قاعدة ملكية الخطر',
  appetiteReviewFrequency: 'تكرار مراجعة نزعة المخاطر',
  assuranceIntegration: 'التكامل مع أنشطة التأكيد',
  // security awareness
  awarenessFrequency: 'تكرار التوعية',
  phishingSimulationFrequency: 'تكرار محاكاة التصيّد',
  trainingCompletionTarget: 'مستهدف إتمام التدريب',
  phishingReportingTarget: 'مستهدف الإبلاغ عن التصيّد',
  screeningRequirement: 'متطلب فحص العاملين',
  onboardingDeadline: 'الموعد النهائي للتعريف التمهيدي',
  acceptableUseAcknowledgement: 'الإقرار بالاستخدام المسموح',
  disciplinaryLinkage: 'الارتباط بالإجراء التأديبي',
  leaverReturnSla: 'مستوى خدمة إعادة أصول المغادرين',
  teleworkAwareness: 'توعية العمل عن بُعد',
  executiveBriefingFrequency: 'تكرار الإيجاز التنفيذي',
  // security operations
  serviceReviewFrequency: 'تكرار مراجعة الخدمات',
  handoverFrequency: 'تكرار تسليم الورديات',
  toolAvailabilityTarget: 'مستهدف إتاحة الأدوات',
  runbookReviewFrequency: 'تكرار مراجعة أدلة التشغيل',
  opsReportFrequency: 'تكرار الرفع التشغيلي',
  capacityPlanningFrequency: 'تكرار تخطيط الطاقة',
  onCallRota: 'جدول المناوبة',
  serviceCatalogueDetail: 'تفاصيل كتالوج الخدمات',
  icsSeparation: 'فصل أنظمة التحكم الصناعي',
  icsChangeRule: 'قاعدة التغيير في أنظمة التحكم الصناعي',
  metricsReported: 'المقاييس المرفوعة',
  // security monitoring
  monitoringCoverage: 'تغطية المراقبة',
  monitoringWindow: 'النافذة الزمنية للمراقبة',
  monitoringAvailabilityTarget: 'مستهدف إتاحة المراقبة',
  p1AlertTriageSla: 'مستوى خدمة فرز تنبيهات الدرجة الأولى',
  useCaseReviewFrequency: 'تكرار مراجعة حالات الاستخدام',
  falsePositiveTarget: 'مستهدف الإيجاب الخاطئ',
  threatModelUpdateFrequency: 'تكرار تحديث نموذج التهديد',
  threatIntelSources: 'مصادر معلومات التهديد',
  intelAssessmentSla: 'مستوى خدمة تقييم المعلومات',
  huntFrequency: 'تكرار تتبّع التهديدات',
  detectionCoverageModel: 'نموذج تغطية الكشف',
  toolHealthCheck: 'فحص سلامة الأدوات',
  // logging
  logRetention: 'مدة الاحتفاظ بالسجلات',
  criticalLogRetention: 'مدة الاحتفاظ بسجلات الأنظمة الحرجة',
  logReviewFrequency: 'تكرار مراجعة السجلات',
  timeSyncSource: 'مصدر مزامنة الوقت',
  logCoverageTarget: 'مستهدف تغطية السجلات',
  logIntegrityMethod: 'أسلوب حماية سلامة السجلات',
  privilegedLogDetail: 'تفاصيل سجل النشاط المُمتاز',
  logOnboardingSla: 'مستوى خدمة إدراج مصادر السجلات',
  cloudLogScope: 'نطاق التسجيل السحابي',
  teleworkLogScope: 'نطاق تسجيل العمل عن بُعد',
  logAvailabilityTarget: 'مستهدف إتاحة السجلات',
  logDisposalRule: 'قاعدة التخلّص من السجلات',
  // backup and recovery
  backupFrequency: 'تكرار النسخ الاحتياطي',
  backupRetention: 'مدة الاحتفاظ بالنسخ الاحتياطية',
  restoreTestFrequency: 'تكرار اختبار الاستعادة',
  restoreTestSuccessTarget: 'مستهدف نجاح اختبار الاستعادة',
  immutabilityRequirement: 'متطلب عدم القابلية للتغيير',
  offsiteRequirement: 'متطلب النسخة الخارجية',
  backupEncryption: 'تشفير النسخ الاحتياطية',
  backupAccessRule: 'قاعدة الوصول إلى النسخ الاحتياطية',
  backupMonitoringSla: 'مستوى خدمة مراقبة النسخ الاحتياطي',
  backupScopeReconciliation: 'مطابقة نطاق النسخ الاحتياطي',
  cyberRecoveryCopy: 'نسخة الاستعادة بعد الهجوم السيبراني',
  backupRestoreAuthority: 'صلاحية الاستعادة',
  // business continuity
  biaFrequency: 'تكرار تحليل أثر الأعمال',
  bcpTestFrequency: 'تكرار اختبار خطة الاستمرارية',
  criticalServiceRto: 'هدف زمن استعادة الخدمات الحرجة',
  planReviewFrequency: 'تكرار مراجعة الخطط',
  exerciseTypes: 'أنواع التمارين',
  bcmsScopeReview: 'مراجعة نطاق إدارة الاستمرارية',
  dependencyMapping: 'نطاق خريطة الاعتماديات',
  minimumServiceLevel: 'مستوى الخدمة الأدنى',
  crisisTeamActivation: 'معيار تنشيط فريق الأزمات',
  continuityCommsChannel: 'قناة الاتصال في الاستمرارية',
  bcmsMeasures: 'مقاييس إدارة الاستمرارية',
  // disaster recovery
  drTestFrequency: 'تكرار اختبار الاستعادة بعد الكوارث',
  rtoDefault: 'هدف زمن الاستعادة',
  rpoDefault: 'هدف نقطة الاستعادة',
  failoverTestType: 'نوع اختبار التحويل',
  drPlanReviewFrequency: 'تكرار مراجعة خطط الاستعادة',
  drSiteSeparation: 'فصل موقع الاستعادة',
  recoveryRunbookDetail: 'مستوى تفصيل أدلة الاستعادة',
  recoveryCommsPlan: 'خطة الاتصال في الاستعادة',
  drDependencyOrder: 'ترتيب اعتماديات الاستعادة',
  invocationCriteria: 'معايير تنشيط الاستعادة',
  // cryptography
  approvedAlgorithms: 'الخوارزميات المعتمدة',
  minTlsVersion: 'الحد الأدنى لإصدار TLS',
  keyRotationFrequency: 'تكرار تدوير المفاتيح',
  certificateExpiryAlert: 'التنبيه على انتهاء صلاحية الشهادات',
  cryptoReviewFrequency: 'تكرار مراجعة التشفير',
  keyStorage: 'موضع حفظ المفاتيح',
  cryptoInventoryReview: 'مراجعة جرد التشفير',
  pqcReadinessReview: 'مراجعة الجهوزية لما بعد الكم',
  dualControlThreshold: 'حد التحكم المزدوج',
  // endpoints
  baselineStandard: 'معيار خط الأساس',
  baselineReviewFrequency: 'تكرار مراجعة خط الأساس',
  malwareSignatureUpdate: 'تحديث بصمات البرمجيات الخبيثة',
  edrCoverageTarget: 'مستهدف تغطية كشف الأجهزة الطرفية',
  mobileEncryption: 'تشفير الأجهزة المحمولة',
  removableMediaPolicy: 'سياسة الوسائط القابلة للنقل',
  patchDeploymentSla: 'مستوى خدمة نشر التحديثات',
  applicationControlMode: 'نمط التحكم في التطبيقات',
  localAdminRule: 'قاعدة صلاحيات المسؤول المحلي',
  diskEncryptionTarget: 'مستهدف تشفير الأقراص',
  endpointLogForwarding: 'تمرير سجلات الأجهزة الطرفية',
  unsupportedOsGrace: 'مهلة أنظمة التشغيل غير المدعومة',
  // networks
  firewallReviewFrequency: 'تكرار مراجعة جدار الحماية',
  segmentationModel: 'نموذج تقسيم الشبكة',
  remoteAccessMethod: 'أسلوب الوصول عن بُعد',
  wirelessEncryption: 'تشفير الشبكة اللاسلكية',
  ruleExpiryReview: 'مراجعة انتهاء القواعد',
  architectureReviewFrequency: 'تكرار مراجعة المعمارية',
  emailAuthentication: 'مصادقة البريد الإلكتروني',
  attachmentHandling: 'التعامل مع المرفقات',
  webFilterCategories: 'فئات تصفية الويب',
  dnsResolvers: 'محلِّلات أسماء النطاقات',
  availabilityTarget: 'مستهدف الإتاحة',
  ddosProtection: 'الحماية من حجب الخدمة',
  deviceConfigBackup: 'نسخ تهيئات الأجهزة',
  nacEnforcement: 'إنفاذ التحكم في الوصول إلى الشبكة',
  // applications
  appTestFrequency: 'تكرار اختبار التطبيقات',
  criticalAppFindingSla: 'مستوى خدمة الملاحظات الحرجة في التطبيقات',
  wafMode: 'وضع جدار حماية تطبيقات الويب',
  apiAuthStandard: 'معيار مصادقة واجهات البرمجة',
  appInventoryReviewFrequency: 'تكرار مراجعة جرد التطبيقات',
  threatModelTrigger: 'مُحرِّك استدعاء نمذجة التهديد',
  sessionStandard: 'معيار الجلسات',
  sessionIdleLimit: 'حد خمول الجلسة',
  inputValidationRule: 'قاعدة التحقق من المدخلات',
  dependencyScanFrequency: 'تكرار فحص الاعتماديات',
  secretHandling: 'التعامل مع الأسرار',
  // secure development
  codeReviewCoverage: 'تغطية مراجعة الشيفرة',
  secretScanFrequency: 'تكرار فحص الأسرار',
  envSeparation: 'فصل البيئات',
  trainingFrequency: 'تكرار التدريب',
  pipelineGate: 'بوابة خط الأنابيب',
  projectSecurityGate: 'البوابة الأمنية للمشروع',
  sbomRequirement: 'متطلب قائمة المكوّنات البرمجية',
  buildIntegrity: 'سلامة البناء',
  changeFreezeRule: 'قاعدة تجميد التغيير',
  // change management
  cabFrequency: 'تكرار مجلس المشورة للتغيير',
  emergencyChangeReviewSla: 'مستوى خدمة مراجعة التغيير الطارئ',
  backoutRequirement: 'متطلب خطة التراجع',
  configReviewFrequency: 'تكرار مراجعة التهيئة',
  securityReviewThreshold: 'حد المراجعة الأمنية',
  unauthorisedChangeSla: 'مستوى خدمة التغيير غير المصرح به',
  patchChangeRoute: 'مسار تغيير التحديثات',
  releaseVerification: 'التحقق بعد الإصدار',
  changeFreezeWindows: 'نوافذ تجميد التغيير',
  segregationRule: 'قاعدة فصل المهام',
  // identity and access
  accessReviewFrequency: 'تكرار مراجعة الوصول',
  privAccessReviewFrequency: 'تكرار مراجعة الوصول المُمتاز',
  serviceAccountReviewFrequency: 'تكرار مراجعة حسابات الخدمة',
  accessRecertCompletionTarget: 'مستهدف إتمام إعادة التصديق على الوصول',
  accountLockoutThreshold: 'حد إغلاق الحساب',
  accountLockoutDuration: 'مدة إغلاق الحساب',
  dormantAccountThreshold: 'حد اعتبار الحساب خامداً',
  passwordMinLength: 'الحد الأدنى لطول كلمة المرور',
  passwordHistory: 'سجل كلمات المرور السابقة',
  sessionIdleTimeout: 'مدة انتهاء الجلسة بالخمول',
  mfaMethods: 'أساليب التحقق متعدد العوامل',
  mfaCoverageTarget: 'مستهدف تغطية التحقق متعدد العوامل',
  provisioningSla: 'مستوى خدمة منح الوصول',
  revocationSla: 'مستوى خدمة إلغاء الوصول',
  // privileged access
  jitMaxDuration: '\u0627\u0644\u062d\u062f \u0627\u0644\u0623\u0639\u0644\u0649 \u0644\u0645\u062f\u0629 \u0631\u0641\u0639 \u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0629',
  vaultRotationFrequency: '\u062a\u0643\u0631\u0627\u0631 \u062a\u062f\u0648\u064a\u0631 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0627\u0639\u062a\u0645\u0627\u062f \u0641\u064a \u0627\u0644\u062e\u0632\u0627\u0646\u0629',
  privRevocationSla: 'مستوى خدمة إلغاء الوصول المُمتاز',
  sessionRecordingRetention: '\u0645\u062f\u0629 \u0627\u0644\u0627\u062d\u062a\u0641\u0627\u0637 \u0628\u062a\u0633\u062c\u064a\u0644\u0627\u062a \u0627\u0644\u062c\u0644\u0633\u0627\u062a',
  breakGlassTestFrequency: '\u062a\u0643\u0631\u0627\u0631 \u0627\u062e\u062a\u0628\u0627\u0631 \u0643\u0633\u0631 \u0627\u0644\u0632\u062c\u0627\u062c',
  privSessionTimeout: '\u0645\u062f\u0629 \u0627\u0646\u062a\u0647\u0627\u0621 \u0627\u0644\u062c\u0644\u0633\u0629 \u0627\u0644\u0645\u064f\u0645\u062a\u0627\u0632\u0629 \u0628\u0627\u0644\u062e\u0645\u0648\u0644',
  emergencyAccessReviewSla: '\u0645\u0633\u062a\u0648\u0649 \u062e\u062f\u0645\u0629 \u0645\u0631\u0627\u062c\u0639\u0629 \u0627\u0644\u0648\u0635\u0648\u0644 \u0627\u0644\u0637\u0627\u0631\u0626',
  // assets
  inventoryReviewFrequency: 'تكرار مراجعة سجل الأصول',
  inventoryAccuracyTarget: 'مستهدف دقة سجل الأصول',
  discoveryFrequency: 'تكرار الاستكشاف الآلي',
  assetReturnSla: 'مستوى خدمة إعادة الأصول',
  disposalStandard: 'معيار التخلص من الأصول',
  unauthorisedAssetSla: 'مستوى خدمة معالجة الأصول غير المصرّح بها',
  assetRequirementReview: 'مراجعة متطلبات إدارة الأصول',
  criticalAssetBaseline: 'خط الأساس للأصول الحرجة',
  licenceReconciliation: 'مطابقة التراخيص',
  endOfLifeHorizon: 'مدى التخطيط لانتهاء الدعم',
  // incidents
  p1TriageSla: 'مستوى خدمة فرز حوادث الدرجة الأولى',
  p2TriageSla: 'مستوى خدمة فرز حوادث الدرجة الثانية',
  p1ContainmentSla: 'مستوى خدمة احتواء حوادث الدرجة الأولى',
  regulatoryNotificationSla: 'مستوى خدمة الإشعار التنظيمي',
  lessonsLearnedSla: 'مستوى خدمة مراجعة ما بعد الحادث',
  postIncidentActionSla: 'مستوى خدمة إجراءات ما بعد الحادث',
  evidenceRetention: 'مدة الاحتفاظ بالأدلة',
  irPlanTestFrequency: 'تكرار اختبار خطة الاستجابة',
  // vulnerabilities
  criticalRemediationSla: 'مستوى خدمة معالجة الثغرات الحرجة',
  highRemediationSla: 'مستوى خدمة معالجة الثغرات عالية الخطورة',
  mediumRemediationSla: 'مستوى خدمة معالجة الثغرات متوسطة الخطورة',
  lowRemediationSla: 'مستوى خدمة معالجة الثغرات منخفضة الخطورة',
  emergencyPatchSla: 'مستوى خدمة الترقيع الطارئ',
  internalScanFrequency: 'تكرار الفحص الداخلي',
  externalScanFrequency: 'تكرار الفحص الخارجي',
  authenticatedScanFrequency: 'تكرار الفحص المُصادَق',
  scanCoverageTarget: 'مستهدف تغطية الفحص',
  pentestFrequency: 'تكرار اختبار الاختراق',
  // physical security
  visitorEscortRequirement: 'متطلب مرافقة الزوار',
  cctvRetention: 'مدة الاحتفاظ بتسجيلات المراقبة المرئية',
  environmentalMonitoring: 'نطاق المراقبة البيئية',
  badgeRevocationSla: 'موعد إلغاء بطاقة الوصول',
  equipmentSiting: 'معيار موضع المعدات',
  cablingProtection: 'حماية الكابلات ونقاط التوزيع',
  deliveryAreaRule: 'قاعدة منطقة التوريد',
  cleanDeskRule: 'قاعدة المكتب النظيف',
  maintenanceSupervision: 'الإشراف على أعمال الصيانة',
  // data protection
  classificationLevels: 'مستويات التصنيف',
  classificationReviewFrequency: 'تكرار مراجعة التصنيف',
  dlpCoverageTarget: 'مستهدف تغطية منع تسريب البيانات',
  retentionScheduleReviewFrequency: 'تكرار مراجعة جدول الاحتفاظ',
  dataResidency: 'موطن البيانات',
  piiBreachAssessmentSla: 'مستوى خدمة تقدير تسريب البيانات الشخصية',
  dataGovernanceOwner: 'مالك حوكمة البيانات',
  transferControls: 'ضوابط نقل المعلومات',
  criticalDataProtection: 'حماية بيانات الأنظمة الحرجة',
  teleworkDataRule: 'قاعدة تداول البيانات عن بُعد',
  dataProcessingRegister: 'سجل أنشطة المعالجة',
  // cloud security
  cspAssessmentFrequency: 'تكرار تقييم مزوّد الخدمة السحابية',
  configBaselineStandard: 'معيار خط أساس التهيئة',
  cspmScanFrequency: 'تكرار فحص الوضع الأمني السحابي',
  exitPlanReviewFrequency: 'تكرار مراجعة خطة الخروج',
  privilegedCloudReview: 'تكرار مراجعة الوصول المُمتاز السحابي',
  cloudStrategyReview: 'تكرار مراجعة استراتيجية السحابة',
  tenancyApprovalRule: 'قاعدة اعتماد المستأجَر السحابي',
  cloudDataClassificationRule: 'قاعدة تصنيف البيانات السحابية',
  cloudEncryptionKeys: 'مفاتيح التشفير السحابية',
  cloudSaasAssessment: 'تقييم البرمجيات كخدمة',
  cloudIncidentTerms: 'شروط الإشعار بالحوادث لدى المزوّد',
  // third parties
  dueDiligenceValidity: 'مدة صلاحية العناية الواجبة',
  criticalSupplierReviewFrequency: 'تكرار مراجعة المورّدين الحرجين',
  criticalSupplierCriteria: 'معايير تحديد المورّد الحرج',
  supplierIncidentNotificationSla: 'مستوى خدمة إشعار المورّد بالحوادث',
  supplierRemoteWorkRule: 'قاعدة العمل عن بُعد للمورّدين',
  subProcessorRule: 'قاعدة المعالجين من الباطن',
  offboardingSla: 'مستوى خدمة إنهاء التعامل',
  dataReturnSla: 'مستوى خدمة إعادة البيانات',
  assuranceEvidenceTypes: 'أنواع أدلة التأكيد المقبولة',
  fourthPartyReview: 'مراجعة الاعتماد على الطرف الرابع',
  supplierExitTesting: 'اختبار خطة الخروج من المورّد'
};

/**
 * The Arabic label for a parameter name, or null when there is none.
 * The caller falls back to the English humanisation rather than rendering the
 * raw camel-case key.
 */
export function arParameterLabel(name) {
  return AR_PARAMETER_LABELS[name] ?? null;
}

// ------------------------------------------- shared procedure boilerplate --

/**
 * The procedure lists most domains share verbatim.
 *
 * Seventeen of the twenty-four domain models use identical English for a
 * procedure's inputs, outputs, escalation path and records, and identical text
 * for all but the first of its preconditions — the generic scaffolding around
 * the steps, which are what actually differ per domain. Translating them once
 * here rather than seventeen times keeps them worded the same way in every
 * Arabic Procedure, which is the whole point of them being shared. A domain
 * whose English differs writes its own; validateKnowledgeBase compares the list
 * lengths against the English either way, so a domain that borrowed these
 * wrongly fails at load rather than shipping a mismatched document.
 */

/** The three preconditions, given the domain-specific first one. */
export const arPreconditions = (opening) => [
  opening,
  'أن تُسنَد أدوار هذا المجال ومسؤولياته إلى أفراد مُسمّين.',
  'أن تكون الأدوات المساندة مُنصَّبة وترفع تقاريرها إلى مالك الضابط.'
];

/** "The <Domain> Policy and Standard are approved and published." */
export const arPolicyPublished = (domainNameAr) =>
  `أن تكون سياسة ${domainNameAr} ومعيارها معتمدين ومنشورين.`;

export const AR_PROC_INPUTS = [
  'متطلبات السياسة والمعيار المعتمدة',
  'جرد الأصول والأنظمة',
  'سجلات التغييرات والحوادث',
  'مخرجات مراقبة الضوابط'
];

export const AR_PROC_OUTPUTS = [
  'ضوابط مُشغَّلة بأدلة محفوظة',
  'سجلات استثناءات حيث يتعذّر استيفاء المتطلبات',
  'مقاييس أداء الضوابط لرفعها إلى الإدارة'
];

export const AR_PROC_ESCALATION = [
  'يُصعَّد إخفاق الضوابط إلى مدير حوكمة الأمن السيبراني والمخاطر والالتزام خلال يوم عمل واحد.',
  'تُصعَّد المتطلبات التي يتعذّر استيفاؤها إلى رئيس الأمن السيبراني لقبول الخطر لمدة محددة.',
  'يُصعَّد الاختراق المشتبه به فوراً إلى عملية إدارة الحوادث.'
];

export const AR_PROC_RECORDS = [
  'أدلة تشغيل الضوابط (يُحتفظ بها ٣ سنوات)',
  'اعتمادات الاستثناءات (يُحتفظ بها لمدة الاستثناء زائد ٣ سنوات)',
  'سجلات المراجعة والتصديق (يُحتفظ بها ٣ سنوات)'
];
