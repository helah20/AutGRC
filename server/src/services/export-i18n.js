/**
 * The language a file is produced in, and the fixed text it carries.
 *
 * Every file follows the language the reader has set in the platform: the
 * interface sends it with each request, downloads included, and an explicit
 * `?lang=` overrides it. A file is then wholly in that language — headings,
 * labels, table headers and, where the platform holds it, the content —
 * rather than English furniture around Arabic text or the other way round.
 *
 * Report headers and values reuse the interface's own dictionaries, so the
 * screen and the exported workbook name the same column the same way.
 */

import arUi from '../../../client/src/i18n/ar.js';
import { localise } from './localise.js';

export function exportLanguage(req) {
  const asked = req.query?.lang || req.get?.('x-language') || req.headers?.['x-language'];
  return String(asked || '').toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** A fixed English label from the interface dictionaries, in the file's language. */
export function uiText(namespace, value, lang) {
  if (lang !== 'ar' || value == null || value === '') return value;
  const table = arUi[namespace] || {};
  return table[slug(value)] ?? table[value] ?? value;
}

/**
 * Data rows in the file's language: knowledge-base wording (control names,
 * requirement titles, domain names, roles) through the same localiser the
 * screens use, then fixed report values through the report dictionary.
 */
export function localiseRows(rows, lang) {
  if (lang !== 'ar') return rows;
  return rows.map((row) => row.map((cell) => cellText(cell, lang)));
}

/**
 * Fixed wording of exported workbooks and reports: sheet names, column
 * headers, cover labels and summary measures. Anything not listed falls back
 * to the interface's report dictionary, then to the knowledge-base localiser.
 */
const FILE_AR = {
  'Generated on': 'أُنشئ في', 'from the live AutGRC data set.': 'من بيانات AutGRC الحية.',
  // Sheets and cover
  Cover: 'الغلاف', Controls: 'الضوابط', Evidence: 'الأدلة', Mapping: 'الربط', Mappings: 'الربط',
  Coverage: 'التغطية', Gaps: 'الفجوات', Summary: 'الملخص', Register: 'السجل', Documents: 'الوثائق',
  Matrix: 'المصفوفة', Legend: 'المفتاح', Validation: 'التحقق', Report: 'التقرير',
  'Gap Assessment': 'تقييم الفجوات', 'Statement of Applicability': 'بيان القابلية للتطبيق',
  'Risk Treatment': 'معالجة المخاطر', 'Risk Treatment Plan': 'خطة معالجة المخاطر',
  Generated: 'تاريخ الإنشاء', Note: 'ملاحظة', Purpose: 'الغرض', 'Columns omitted': 'أعمدة محذوفة',
  'All domains': 'كل المجالات', Organisation: 'الجهة',
  'Control Matrix': 'مصفوفة الضوابط', 'Framework Compliance Mapping': 'ربط الالتزام بالأطر',
  'Governance Document Register': 'سجل وثائق الحوكمة',
  'All governance documents and their lifecycle state': 'جميع وثائق الحوكمة وحالتها في دورة الحياة',
  'Risk register, treatment decisions and corrective actions': 'سجل المخاطر وقرارات المعالجة والإجراءات التصحيحية',
  'responsibility assignment matrix': 'مصفوفة توزيع المسؤوليات',
  'R = Responsible · A = Accountable (exactly one per activity) · S = Support · C = Consulted · I = Informed':
    'R = المنفّذ · A = المساءل (واحد فقط لكل نشاط) · S = الداعم · C = المستشار · I = المُبلَّغ',
  'Framework identifiers and titles in this workbook are reference metadata compiled for mapping purposes. Verify against the official publication before relying on them for regulatory attestation. Organisational controls, policies and procedures are the organisation\'s own content and are not regulatory requirements.':
    'معرّفات الأطر وعناوينها في هذا المصنف بيانات مرجعية جُمعت لأغراض الربط، ويُتحقق منها مقابل الإصدار الرسمي قبل الاعتماد عليها في الإقرار التنظيمي. أما الضوابط والسياسات والإجراءات التنظيمية فهي محتوى الجهة نفسها وليست متطلبات تنظيمية.',
  // Column headers
  'Control ID': 'رقم الضابط', 'Control Name': 'اسم الضابط', Domain: 'المجال', Description: 'الوصف',
  Requirement: 'المتطلب', Type: 'النوع', Nature: 'الطبيعة', 'Implementation Guidance': 'إرشادات التطبيق',
  'Responsible Role': 'الدور المنفّذ', 'Accountable Role': 'الدور المساءل', Frequency: 'الدورية', KPI: 'مؤشر الأداء',
  Risk: 'الخطر', 'Risk Rating': 'تصنيف الخطر', Status: 'الحالة', 'Related Policy': 'السياسة المرتبطة',
  'Related Standard': 'المعيار المرتبط', 'Related Procedure': 'الإجراء المرتبط', 'Framework Mapping': 'الربط بالأطر',
  'Evidence ID': 'رقم الدليل', 'Evidence Required': 'الدليل المطلوب', 'Owner Role': 'الدور المالك',
  'Last Collected': 'آخر جمع', Activity: 'النشاط', Phase: 'المرحلة', Code: 'الرمز', Meaning: 'المعنى',
  Definition: 'التعريف', Severity: 'الخطورة', Issue: 'الملاحظة', Recommendation: 'التوصية',
  Framework: 'الإطار', Requirements: 'المتطلبات', Covered: 'مغطّى', Partial: 'جزئي', 'Not covered': 'غير مغطّى',
  'Not applicable': 'غير منطبق', 'Coverage %': 'نسبة التغطية', 'Requirement Ref': 'مرجع المتطلب',
  'Requirement Title': 'عنوان المتطلب', 'Policy Reference': 'مرجع السياسة', 'Procedure Reference': 'مرجع الإجراء',
  Confidence: 'الثقة', Rationale: 'المسوّغ', 'Requirement Text': 'نص المتطلب', 'Current State': 'الوضع الحالي',
  'Target State': 'الوضع المستهدف', Gap: 'الفجوة', Owner: 'المالك', 'Due Date': 'تاريخ الاستحقاق',
  'Related Document': 'الوثيقة المرتبطة', Count: 'العدد', Share: 'النسبة', Reference: 'المرجع', Title: 'العنوان',
  Version: 'الإصدار', Classification: 'التصنيف', Approver: 'المعتمِد', 'Effective Date': 'تاريخ السريان',
  'Review Date': 'تاريخ المراجعة', 'Last Updated': 'آخر تحديث', Control: 'الضابط', Applicable: 'منطبق',
  Justification: 'المسوّغ', 'Scope per Publication': 'النطاق حسب الإصدار', Implementation: 'التطبيق',
  'Mapped Controls': 'الضوابط المرتبطة', 'Decision Recorded By': 'سجّل القرار', 'Decision Date': 'تاريخ القرار',
  Measure: 'المقياس', 'Risk ID': 'رقم الخطر', Category: 'الفئة', 'Inherent L': 'الاحتمال الأصلي',
  'Inherent I': 'الأثر الأصلي', 'Inherent Score': 'الدرجة الأصلية', 'Inherent Rating': 'التصنيف الأصلي',
  Treatment: 'المعالجة', 'Treatment Summary': 'ملخص المعالجة', 'Residual L': 'الاحتمال المتبقي',
  'Residual I': 'الأثر المتبقي', 'Residual Score': 'الدرجة المتبقية', 'Residual Rating': 'التصنيف المتبقي',
  'Open Actions': 'الإجراءات المفتوحة', 'Accepted By': 'قبله', 'Acceptance Expires': 'انتهاء القبول',
  // Values and measures
  Yes: 'نعم', No: 'لا', 'Not assessed': 'لم يُقيَّم', 'NOT JUSTIFIED': 'بلا مسوّغ',
  Responsible: 'المنفّذ', Accountable: 'المساءل', Support: 'الداعم', Consulted: 'المستشار', Informed: 'المُبلَّغ',
  'Performs the activity.': 'يؤدي النشاط.',
  'Answerable for the outcome. Exactly one per activity.': 'المسؤول عن النتيجة. واحد فقط لكل نشاط.',
  'Provides resources or assistance to the responsible role.': 'يقدّم الموارد أو المساعدة للدور المنفّذ.',
  'Provides input before the activity completes. Two-way communication.': 'يقدّم رأيه قبل اكتمال النشاط. تواصل في الاتجاهين.',
  'Told of the outcome. One-way communication.': 'يُبلَّغ بالنتيجة. تواصل في اتجاه واحد.',
  'Controls in the framework': 'الضوابط في الإطار', Excluded: 'مستثنى',
  'Exclusions without a justification': 'استثناءات بلا مسوّغ',
  'In scope, though the publication does not apply it to this organisation': 'ضمن النطاق رغم أن الإصدار لا يطبّقه على الجهة',
  'Excluded, though the publication applies it to this organisation': 'مستثنى رغم أن الإصدار يطبّقه على الجهة',
  Implemented: 'مُطبَّق', 'Partially implemented': 'مُطبَّق جزئياً', Planned: 'مخطط له',
  'Applicable but not implemented': 'منطبق وغير مُطبَّق', 'Explicit decisions recorded': 'قرارات صريحة مسجّلة',
  'Risks in the register': 'المخاطر في السجل', 'Residual position assessed': 'قُيّم الوضع المتبقي',
  'Residual position NOT assessed': 'لم يُقيَّم الوضع المتبقي', 'Formally accepted': 'مقبولة رسمياً',
  'Acceptances expired': 'قبول منتهٍ', 'Inherent critical': 'أصلي حرج', 'Inherent high': 'أصلي مرتفع',
  'Inherent medium': 'أصلي متوسط', 'Inherent low': 'أصلي منخفض'
};

export function sheetText(text, lang) {
  if (lang !== 'ar' || typeof text !== 'string') return text;
  return FILE_AR[text] ?? arUi.reportHeader?.[slug(text)] ?? text;
}

// Stored values the interface shows through a dictionary rather than as text.
const VALUE_TABLES = ['domainCategory', 'status', 'rating', 'coverage', 'implementation', 'treatment', 'riskStatus', 'docType',
  'classification', 'gapStatus', 'evidenceStatus', 'controlType', 'controlNature', 'evidenceType',
  'riskCategory', 'raciPhase', 'actionStatus', 'findingStatus', 'reportValue'];

/** One cell of data in the file's language. */
export function cellText(value, lang) {
  if (lang !== 'ar' || typeof value !== 'string' || !value.trim()) return value;
  if (FILE_AR[value]) return FILE_AR[value];
  const key = slug(value);
  if (key && key.length < 40) {
    for (const table of VALUE_TABLES) {
      const hit = arUi[table]?.[key] ?? arUi[table]?.[value];
      if (hit) return hit;
    }
  }
  return localise([value], 'ar')[0];
}

/**
 * Content-Disposition for a file whose name may be Arabic: an ASCII name for
 * old clients and the full name in UTF-8 (RFC 6266) for everything current.
 */
export function attachment(filename) {
  const clean = String(filename).replace(/[\\/:*?"<>|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  const ascii = clean.replace(/[^\w.\- ]/g, '').replace(/\s+/g, ' ').replace(/ (?=\.[a-z0-9]+$)/i, '').trim();
  const ext = (clean.match(/\.[a-z0-9]+$/i) || [''])[0];
  const fallback = ascii && ascii !== ext ? ascii : `export${ext}`;
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(clean)}`;
}
