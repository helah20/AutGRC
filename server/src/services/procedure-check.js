/**
 * Gap check for an uploaded procedure, and Arabic wording checks for any
 * uploaded document.
 *
 * A procedure can name every requirement of its domain and still fail to work:
 * no step says what it starts from or hands on, nobody is named against a
 * step, nothing says what happens when a deadline is missed. Those are
 * structural gaps, and they are what a reviewer finds first when a procedure
 * is checked against the form procedures are written in — a table of input,
 * step, responsible and output, followed by service levels, exceptions,
 * escalation, indicators and records.
 *
 * Every check reads English and Arabic, because uploaded procedures are
 * written in either. The finding text is fixed, so the localiser can show it
 * in Arabic; what was found goes in the evidence.
 */

const CHECKS = [
  {
    key: 'inputs',
    test: /\binputs?\b|المدخل/i,
    severity: 'high',
    title: 'Procedure steps state no inputs',
    detail: 'The procedure does not state what starts each step, so a step can wait for something no earlier step produces without anyone noticing.',
    recommendation: 'Write the steps as a table of input, step, responsible and output, naming the trigger of the first step.'
  },
  {
    key: 'outputs',
    test: /\boutputs?\b|المخرج/i,
    severity: 'high',
    title: 'Procedure steps state no outputs',
    detail: 'The procedure does not state what each step hands on, so the evidence that a step was performed is not defined.',
    recommendation: 'State the output of every step: the record, decision or artefact it produces.'
  },
  {
    key: 'responsible',
    test: /\bresponsib|\bperformed by\b|\baccountable\b|المسؤول|يتولى|ينفّ?ذ/i,
    severity: 'high',
    title: 'Procedure names no responsible party per step',
    detail: 'Steps are described without the role that performs them, so the procedure cannot be operated or audited against named roles.',
    recommendation: 'Name the responsible role for each step, and the roles it coordinates with.'
  },
  {
    key: 'timelines',
    test: /\d+\s*(business\s+|working\s+)?(hours?|days?)\b|[\d٠-٩]+\s*(ساعة|ساعات|يوم|أيام|يوماً)/i,
    severity: 'medium',
    title: 'Procedure states no service levels',
    detail: 'No step carries a deadline in hours or days, so lateness cannot be measured and nothing triggers escalation.',
    recommendation: 'State the service level for each time-bound step, by severity or class where they differ, and apply the stricter value where two apply.'
  },
  {
    key: 'exceptions',
    test: /\bexception|\bcompensating control|الاستثناء|استثناء|ضوابط? تعويضي/i,
    severity: 'medium',
    title: 'Procedure has no exception path',
    detail: 'The procedure does not say what happens when a step cannot be completed as written, so exceptions are handled informally and are not recorded.',
    recommendation: 'Add a time-bound exception with compensating controls, approved at the defined level and recorded in the risk register.'
  },
  {
    key: 'escalation',
    test: /\bescalat|التصعيد|يُ?صعَّ?د|يُ?رفع إلى/i,
    severity: 'medium',
    title: 'Procedure has no escalation',
    detail: 'The procedure does not say who is told when a deadline is missed or a step fails.',
    recommendation: 'State the escalation path for each condition that can stop the process.'
  },
  {
    key: 'kpis',
    test: /\bkpis?\b|key performance|performance indicator|\bmetrics?\b|مؤشرات?\s+(قياس\s+)?الأداء|المؤشرات/i,
    severity: 'medium',
    title: 'Procedure has no performance indicators',
    detail: 'The procedure does not define how its performance is measured, so management cannot tell whether it is working.',
    recommendation: 'Add indicators such as service level compliance, mean time to complete, coverage, overdue items and open exceptions.'
  },
  {
    key: 'records',
    test: /\brecords?\b|\bretain|\bretention\b|السجلات|الاحتفاظ|يُ?حتفظ/i,
    severity: 'medium',
    title: 'Procedure states no records to retain',
    detail: 'The procedure does not identify the records it produces or how long they are kept, so its operation cannot be evidenced at audit.',
    recommendation: 'List the records each step produces and the retention period for each.'
  },
  {
    key: 'references',
    test: /\breferences\b|related documents|المراجع|الوثائق ذات العلاقة|الوثائق المرتبطة/i,
    severity: 'low',
    title: 'Procedure lists no related documents',
    detail: 'The procedure does not name the policy and standard it implements or the procedures it hands work to.',
    recommendation: 'Add a related documents and references section.'
  }
];

/** Structural gaps in an uploaded procedure, as findings. */
export function checkProcedureStructure(text) {
  const findings = [];
  const missing = [];
  for (const check of CHECKS) {
    if (check.test.test(text)) continue;
    missing.push(check.key);
    findings.push({
      category: 'completeness',
      severity: check.severity,
      title: check.title,
      detail: check.detail,
      recommendation: check.recommendation,
      evidence: { check: check.key }
    });
  }

  // A closed loop: verification after the action, and a route back when it
  // fails. A procedure that ends on "apply the fix" closes on assertion.
  if (!/\bverif|\bre-?scan|\bretest|\bconfirm (that|closure)|التحقق|إعادة الفحص|إعادة الاختبار/i.test(text)) {
    missing.push('verification');
    findings.push({
      category: 'completeness',
      severity: 'medium',
      title: 'Procedure has no verification step',
      detail: 'Nothing confirms that the action was effective before the item is closed, so closure rests on an assertion.',
      recommendation: 'Add a verification step, and say where the process returns when verification fails.',
      evidence: { check: 'verification' }
    });
  }
  return { findings, missing };
}

/**
 * Wording that recurs in Arabic governance documents and reads as an error:
 * a missing hamza on the commonest words, a gender mismatch, and a cloud
 * abbreviation expanded as the web-security term it shares letters with.
 * Each is a suggestion, shown with the sentence it came from.
 */
const ARABIC_WORDING = [
  { pattern: /(^|[\s(«"،])(ال)?ادارة/g, found: 'ادارة', suggested: 'إدارة' },
  { pattern: /(^|[\s(«"،])(ال)?اجراء/g, found: 'اجراء', suggested: 'إجراء' },
  { pattern: /(^|[\s(«"،])(ال)?امن(\s)/g, found: 'امن', suggested: 'أمن' },
  { pattern: /(^|[\s(«"،])(ال)?اصول/g, found: 'اصول', suggested: 'أصول' },
  { pattern: /(^|[\s(«"،])احد\s+ال(ثغرات|مخاطر)/g, found: 'احد/أحد + جمع مؤنث', suggested: 'إحدى', feminine: true },
  { pattern: /(^|[\s(«"،])أحد\s+ال(ثغرات|مخاطر)/g, found: 'أحد + جمع مؤنث', suggested: 'إحدى', feminine: true },
  { pattern: /سياسة أمن المحتوى[^.]{0,120}سحاب|سحاب[^.]{0,120}سياسة أمن المحتوى/g, found: 'سياسة أمن المحتوى (CSP)', suggested: 'مقدم الخدمة السحابية' },
  { pattern: /(^|[\s(«"،])(تواتر|وتيرة)/g, found: 'تواتر / وتيرة', suggested: 'معدل التكرار' }
];

export function checkArabicWording(text) {
  if (!/[؀-ۿ]/.test(text)) return null;
  const hits = [];
  for (const rule of ARABIC_WORDING) {
    rule.pattern.lastIndex = 0;
    const m = rule.pattern.exec(text);
    if (!m) continue;
    const at = m.index;
    hits.push({
      found: rule.found,
      suggested: rule.suggested,
      excerpt: text.slice(Math.max(0, at - 40), at + m[0].length + 40).replace(/\s+/g, ' ').trim()
    });
  }
  if (!hits.length) return null;
  return {
    category: 'language',
    severity: 'low',
    title: 'Arabic wording to correct',
    detail: 'The document contains Arabic wording that recurs as an error in governance documents: a missing hamza, a gender mismatch, or a term used inconsistently with the policy.',
    recommendation: 'Apply the suggested wording, and use the same term as the organisation policy wherever the two documents share it.',
    evidence: { corrections: hits }
  };
}

/** Clause references written with a non-breaking hyphen reverse in right-to-left text. */
export function checkDigitHyphens(text) {
  const hits = [...text.matchAll(/\d‑\d/g)];
  if (!hits.length) return null;
  return {
    category: 'formatting',
    severity: 'low',
    title: 'References that reverse in Arabic layout',
    detail: 'Clause references such as 1-2 are written with a non-breaking hyphen, which right-to-left layout displays in reverse order.',
    recommendation: 'Use a plain hyphen between the numbers. Word exports from the platform correct this automatically.',
    evidence: { count: hits.length }
  };
}

/**
 * Framework editions superseded by the NCA. Cited by name rather than by
 * sub-control number: a number that moved between editions is exactly what
 * this check cannot confirm.
 */
export function outdatedNcaEditions(text) {
  const out = [];
  if (/ECC\s*[-–]?\s*1\s*:\s*2018|(الضوابط الأساسية للأمن السيبراني)[^.\n]{0,40}2018/i.test(text)) {
    out.push('References ECC-1:2018; the current edition is ECC-2:2024, in which industrial control systems moved to the OTCC.');
  }
  if (/CCC\s*[-–]?\s*1\s*:\s*2020|(ضوابط الأمن السيبراني للحوسبة السحابية)[^.\n]{0,40}2020/i.test(text)) {
    out.push('References CCC-1:2020; the current edition is CCC-2:2024.');
  }
  return out;
}
