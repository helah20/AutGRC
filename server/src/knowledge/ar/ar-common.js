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
  'Continuous, reviewed {{serviceAccountReviewFrequency}}': 'مستمر، ويُراجَع بتكرار {{serviceAccountReviewFrequency}}',
  'Continuous, rotation {{vaultRotationFrequency}}': 'مستمر، مع تدوير بتكرار {{vaultRotationFrequency}}',
  'Monthly': 'شهري',
  'Monthly reconciliation': 'مطابقة شهرية',
  'Monthly cycle with emergency provision': 'دورة شهرية مع مسار للحالات الطارئة',
  'Monthly to management, quarterly to the Steering Committee': 'شهري إلى الإدارة، وربع سنوي إلى اللجنة الإشرافية',
  'Reviewed annually': 'يُراجَع سنوياً',
  'Reviewed and exercised {{irPlanTestFrequency}}': 'يُراجَع ويُختبَر بتكرار {{irPlanTestFrequency}}',
  'Reviewed {{classificationReviewFrequency}}': 'يُراجَع بتكرار {{classificationReviewFrequency}}',
  'Reviewed {{cryptoReviewFrequency}}': 'يُراجَع بتكرار {{cryptoReviewFrequency}}',
  'Reviewed {{drPlanReviewFrequency}}': 'يُراجَع بتكرار {{drPlanReviewFrequency}}',
  'Reviewed {{exitPlanReviewFrequency}}': 'يُراجَع بتكرار {{exitPlanReviewFrequency}}',
  'Reviewed {{policyReviewFrequency}}': 'يُراجَع بتكرار {{policyReviewFrequency}}',
  'Reviewed {{retentionScheduleReviewFrequency}}': 'يُراجَع بتكرار {{retentionScheduleReviewFrequency}}',
  'Tested {{bcpTestFrequency}}': 'يُختبَر بتكرار {{bcpTestFrequency}}',
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
