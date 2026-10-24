/**
 * Arabic for fixed English the API itself sends: descriptions and notes
 * that are part of the interface rather than of the knowledge base. Keyed
 * on the English, like the document strings, so adding one is one line.
 */

import { SOURCE_NOTE } from '../knowledge/frameworks.js';
import { DECISION_CATEGORY } from './assurance-records.js';

const DECISION_CATEGORY_AR = {
  improvement: 'فرصة للتحسين المستمر',
  change: 'تغيير في نظام الإدارة',
  resources: 'الموارد',
  risk: 'قبول خطر أو معالجته',
  other: 'أخرى'
};

export const UI_PHRASES_AR = {
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
