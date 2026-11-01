/**
 * The shape of a baseline item, and the areas items are grouped under.
 *
 * Each area carries the requirements it answers, so an item cites the NCA ECC
 * subdomain, the CIS Control and the ISO/IEC 27001 control for its subject
 * without each of three hundred items restating them.
 */

/** An item following the published CIS Benchmark. */
export const c = (area, level, en, ar, checkEn, checkAr) => ({ area, level, source: 'cis', en, ar, checkEn, checkAr });

/** An item the organisation needs beyond what the benchmark covers. */
export const o = (area, level, en, ar, checkEn, checkAr) => ({ area, level, source: 'org', en, ar, checkEn, checkAr });

export const AREAS = {
  accounts: {
    en: 'Accounts and authentication', ar: 'الحسابات والتحقق من الهوية',
    refs: { 'NCA-ECC': ['2-2'], 'CIS-V8': ['5', '6'], 'ISO-27001': ['A.8.5'] }
  },
  services: {
    en: 'Services and attack surface', ar: 'الخدمات وسطح الهجوم',
    refs: { 'NCA-ECC': ['2-3'], 'CIS-V8': ['4'], 'ISO-27001': ['A.8.9'] }
  },
  network: {
    en: 'Network and management access', ar: 'الشبكة والوصول الإداري',
    refs: { 'NCA-ECC': ['2-5'], 'CIS-V8': ['4', '12'], 'ISO-27001': ['A.8.20'] }
  },
  crypto: {
    en: 'Encryption and protocols', ar: 'التشفير والبروتوكولات',
    refs: { 'NCA-ECC': ['2-8'], 'CIS-V8': ['3'], 'ISO-27001': ['A.8.24'] }
  },
  logging: {
    en: 'Logging and time', ar: 'السجلات والوقت',
    refs: { 'NCA-ECC': ['2-12'], 'CIS-V8': ['8'], 'ISO-27001': ['A.8.15'] }
  },
  protection: {
    en: 'Malware protection and system integrity', ar: 'الحماية من البرمجيات الضارة وسلامة النظام',
    refs: { 'NCA-ECC': ['2-3'], 'CIS-V8': ['10'], 'ISO-27001': ['A.8.9'] }
  },
  patching: {
    en: 'Updates and supported versions', ar: 'التحديثات والإصدارات المدعومة',
    refs: { 'NCA-ECC': ['2-10'], 'CIS-V8': ['7'], 'ISO-27001': ['A.8.8'] }
  },
  data: {
    en: 'Data protection and backup', ar: 'حماية البيانات والنسخ الاحتياطي',
    refs: { 'NCA-ECC': ['2-7', '2-9'], 'CIS-V8': ['3', '11'], 'ISO-27001': ['A.8.24'] }
  }
};

export const AREA_ORDER = ['accounts', 'services', 'network', 'crypto', 'logging', 'protection', 'patching', 'data'];

/** Where each technology sits, for the catalogue's grouping. */
export const CATEGORIES = {
  os: { en: 'Server operating systems', ar: 'أنظمة تشغيل الخوادم' },
  endpoint: { en: 'Workstations and mobile devices', ar: 'محطات العمل والأجهزة المحمولة' },
  identity: { en: 'Identity and directory', ar: 'الهوية والدليل' },
  network: { en: 'Network and security devices', ar: 'أجهزة الشبكات والأمن' },
  database: { en: 'Databases', ar: 'قواعد البيانات' },
  web: { en: 'Web and application servers', ar: 'خوادم الويب والتطبيقات' },
  virtualisation: { en: 'Virtualisation and containers', ar: 'المحاكاة الافتراضية والحاويات' },
  cloud: { en: 'Cloud platforms and SaaS', ar: 'المنصات السحابية والخدمات السحابية' },
  other: { en: 'Other technologies', ar: 'تقنيات أخرى' }
};
