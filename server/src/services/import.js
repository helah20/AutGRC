/**
 * Import and analysis of existing governance documents.
 *
 * Accepts Word, PDF, Excel, CSV and plain text, extracts the text, and
 * analyses it against the platform knowledge base to report duplicate,
 * missing, conflicting and outdated content, missing ownership and evidence,
 * and compliance gaps.
 *
 * The analysis is advisory. Nothing is written into the document library
 * unless the user explicitly promotes the import.
 */

import { checkProcedureStructure, checkArabicWording, checkDigitHyphens, outdatedNcaEditions } from './procedure-check.js';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import { q } from '../db/index.js';
import { DOMAIN_MODELS, DOMAIN_META, domainName, resolveText, buildParameterSet, localisedModel, arDomainName } from '../knowledge/index.js';
import { htmlToText, sanitiseHtml } from './html.js';
import { localise } from './localise.js';

// ------------------------------------------------------------ extraction ---

export async function extractText(filePath, mime, originalName = '') {
  const ext = (originalName.split('.').pop() || '').toLowerCase();

  if (ext === 'docx' || mime?.includes('wordprocessingml')) {
    const { value } = await mammoth.extractRawText({ path: filePath });
    return { text: value, format: 'docx' };
  }

  if (ext === 'pdf' || mime === 'application/pdf') {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await fs.readFile(filePath));
    const doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // Re-join items into lines using their vertical position.
      const lines = new Map();
      for (const item of content.items) {
        if (!item.str) continue;
        const y = Math.round(item.transform[5]);
        if (!lines.has(y)) lines.set(y, []);
        lines.get(y).push(item.str);
      }
      const ordered = [...lines.entries()].sort((a, b) => b[0] - a[0]).map(([, parts]) => parts.join(''));
      pages.push(ordered.join('\n'));
    }
    await doc.destroy();
    return { text: pages.join('\n\n'), format: 'pdf', pages: doc.numPages };
  }

  if (ext === 'xlsx' || ext === 'xlsm' || mime?.includes('spreadsheetml')) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    const out = [];
    const tables = [];
    wb.eachSheet((sheet) => {
      out.push(`## Sheet: ${sheet.name}`);
      const rows = [];
      sheet.eachRow({ includeEmpty: false }, (row) => {
        const values = row.values.slice(1).map((v) => {
          if (v == null) return '';
          if (typeof v === 'object') return v.text || v.result || v.richText?.map((r) => r.text).join('') || '';
          return String(v);
        });
        rows.push(values);
        out.push(values.join(' | '));
      });
      tables.push({ sheet: sheet.name, rows });
    });
    return { text: out.join('\n'), format: 'xlsx', tables };
  }

  if (ext === 'csv') {
    const raw = await fs.readFile(filePath, 'utf8');
    const rows = raw.split(/\r?\n/).filter(Boolean).map((line) => line.split(','));
    return { text: raw, format: 'csv', tables: [{ sheet: 'CSV', rows }] };
  }

  const raw = await fs.readFile(filePath, 'utf8');
  return { text: raw, format: ext === 'html' ? 'html' : 'text' };
}

export async function sha256File(filePath) {
  const buf = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// -------------------------------------------------------------- analysis ---

const FREQ_WORDS = ['continuously', 'hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'semi-annually', 'annually', 'yearly', 'biennially'];
const FREQ_CANON = { yearly: 'annually', continuously: 'continuous' };

function canonFreq(word) {
  const w = word.toLowerCase();
  return FREQ_CANON[w] || w;
}

function sentencesOf(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .split(/(?<=[.;:])\s+|\n+/)
    .map((s) => s.trim().replace(/\s{2,}/g, ' '))
    .filter((s) => s.length > 25 && s.length < 800);
}

// ------------------------------------------------- language of the text ---

/**
 * The language a document is written in: Arabic when Arabic letters
 * outnumber Latin ones. An Arabic policy quotes English references and
 * framework names, so a plain "contains Arabic" test would misread nothing,
 * but a mostly English one with an Arabic heading would be misread.
 */
export function textLanguage(text) {
  const arabic = (String(text).match(/[\u0621-\u064A]/g) || []).length;
  const latin = (String(text).match(/[A-Za-z]/g) || []).length;
  return arabic > latin ? 'ar' : 'en';
}

/** Arabic spelling variants folded together: hamza seats, taa marbuta, alef maqsura, diacritics. */
function foldArabic(value) {
  return String(value)
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');
}

const AR_STOP = new Set(['من', 'في', 'علي', 'الي', 'عن', 'مع', 'او', 'ان', 'التي', 'الذي', 'ذلك', 'هذه', 'هذا', 'كل', 'عند', 'بعد', 'قبل', 'بين', 'غير', 'لدي', 'حيث', 'اي']);

/**
 * The words of a title worth matching on. Arabic words lose the article and
 * a joined conjunction or preposition, so "والوصول" matches "الوصول" and
 * "وصول"; they are matched as substrings, which carries the rest.
 */
function matchWords(title, language, minLength) {
  if (language !== 'ar') return title.toLowerCase().split(/\W+/).filter((w) => w.length > minLength);
  return foldArabic(title).split(/[^\u0621-\u064A]+/)
    .map((w) => w.replace(/^(وال|بال|فال|كال|لل|ال)/, '').replace(/^[وبفل](?=[\u0621-\u064A]{4,})/, ''))
    .filter((w) => w.length >= 3 && !AR_STOP.has(w));
}

/** The text prepared for matching in its own language. */
function matchText(text, language) {
  return language === 'ar' ? foldArabic(text) : text.toLowerCase();
}

/** The opening of a document, where its title is: the first few non-empty lines. */
function titleRegion(text) {
  return String(text).split(/\n+/).map((l) => l.trim()).filter(Boolean).slice(0, 4).join(' \n ').slice(0, 400);
}

/** Detect the most likely domain from the document text. */
export function detectDomain(text) {
  const language = textLanguage(text);
  const haystack = matchText(text, language);
  const head = matchText(titleRegion(text), language);
  const scores = DOMAIN_META.map((meta) => {
    // An Arabic document is read against the Arabic model: its domain name
    // and requirement titles, not the English ones it does not contain.
    const model = language === 'ar' ? localisedModel(meta.key, 'ar') : DOMAIN_MODELS[meta.key];
    const name = language === 'ar' ? (arDomainName(meta.key) || meta.name) : meta.name;
    let score = 0;
    // The title names the domain more reliably than anything in the body,
    // where every domain's vocabulary turns up somewhere.
    if (head.includes(matchText(name, language))) score += 40;
    // Domain name and abbreviation are strong signals.
    if (haystack.includes(matchText(name, language))) score += 12;
    for (const word of matchWords(name, language, 4)) {
      if (haystack.includes(word)) score += 2;
    }
    for (const req of model?.requirements || []) {
      const words = matchWords(req.title, language, 5);
      const hits = words.filter((w) => haystack.includes(w)).length;
      if (words.length && hits / words.length > 0.5) score += 3;
    }
    return { key: meta.key, name: meta.name, score };
  }).sort((a, b) => b.score - a.score);

  return { best: scores[0], candidates: scores.slice(0, 4).filter((s) => s.score > 0), language };
}

/** Detect the document type from its headings and language. */
export function detectDocType(text) {
  // A title that names the type settles it: "Change Management Procedure",
  // «معيار النسخ الاحتياطي».
  const title = titleRegion(text).toLowerCase();
  const TITLE_TYPES = [
    ['raci', /\b(raci|rasci)\b|مصفوفة raci/i],
    ['control_matrix', /control matrix|مصفوفة الضوابط|مصفوفة ضوابط/i],
    ['roles', /roles and responsibilities|الأدوار والمسؤوليات|أدوار ومسؤوليات/i],
    ['procedure', /\bprocedure\b|إجراء/i],
    ['standard', /\bstandard\b|معيار/i],
    ['guideline', /\bguideline\b|دليل إرشادي/i],
    ['policy', /\bpolicy\b|سياسة/i]
  ];
  const named = TITLE_TYPES.find(([, re]) => re.test(title));
  if (named) return named[0];

  const lower = text.slice(0, 6000).toLowerCase();
  const signals = [
    ['procedure', /\b(procedure|step \d|process flow|work instruction)\b/g],
    ['standard', /\b(standard|minimum requirements|technical requirements|baseline)\b/g],
    ['policy', /\b(policy|policy statements|shall be|enforcement)\b/g],
    ['control_matrix', /\b(control id|control matrix|control objective)\b/g],
    ['raci', /\b(raci|rasci|responsible.*accountable|accountable.*consulted)\b/g],
    ['guideline', /\b(guideline|guidance|recommended practice|advisory)\b/g],
    // The same signals in an Arabic document.
    ['procedure', /(إجراء|الإجراء|الخطوة|المدخل|المخرج|مخطط سير)/g],
    ['standard', /(معيار|المعيار|الحد الأدنى|المتطلبات التقنية|خط الأساس)/g],
    ['policy', /(سياسة|السياسة|بنود السياسة|الالتزام بهذه)/g],
    ['control_matrix', /(مصفوفة الضوابط|رقم الضابط|هدف الضابط)/g],
    ['guideline', /(دليل إرشادي|إرشادات|الممارسات الموصى بها)/g]
  ];
  let best = { type: 'policy', score: 0 };
  for (const [type, re] of signals) {
    const score = (lower.match(re) || []).length;
    if (score > best.score) best = { type, score };
  }
  return best.type;
}

/**
 * Analyse extracted text against the knowledge base and the existing library.
 * @returns {object} structured findings report
 */
export function analyseText({ text, domainKey, docType, org = {} }) {
  const model = DOMAIN_MODELS[domainKey];
  const params = buildParameterSet(domainKey, org);
  const lower = text.toLowerCase();
  // Requirements are matched in the document's own language. The findings
  // keep the English titles: the response localiser shows them in Arabic.
  const language = textLanguage(text);
  const haystack = matchText(text, language);
  const arModel = language === 'ar' ? localisedModel(domainKey, 'ar') : null;
  const sentences = sentencesOf(text);
  const findings = [];
  const add = (f) => findings.push({ severity: 'medium', category: 'completeness', ...f });

  // ---------------------------------------------------- missing content ----
  const covered = [];
  const missing = [];
  if (model) {
    model.requirements.forEach((req, i) => {
      const title = arModel ? arModel.requirements[i]?.title || req.title : req.title;
      const words = matchWords(title, language, 4);
      const hits = words.filter((w) => haystack.includes(w)).length;
      const ratio = words.length ? hits / words.length : 0;
      (ratio >= 0.5 ? covered : missing).push({ key: req.key, title: req.title, ratio: Number(ratio.toFixed(2)), refs: req.refs });
    });
    for (const m of missing) {
      add({
        category: 'completeness',
        severity: 'high',
        title: `Requirement not addressed: ${m.title}`,
        detail: `The uploaded document does not appear to address "${m.title}", which the ${domainName(domainKey)} requirement model treats as mandatory. This leaves a gap against ${Object.entries(m.refs).map(([c, l]) => `${c} ${l.join('/')}`).join(', ')}.`,
        recommendation: `Add a statement covering "${m.title}", or record why it does not apply.`
      });
    }
  }

  // -------------------------------------------------- conflicting values ---
  if (model) {
    for (const [name, rawValue] of Object.entries(model.parameters)) {
      const agreed = resolveText(String(rawValue), params);
      const agreedFreq = FREQ_WORDS.filter((w) => agreed.toLowerCase().includes(w)).map(canonFreq);
      if (!agreedFreq.length) continue;
      const topic = name.replace(/([A-Z])/g, ' $1').toLowerCase()
        .split(/\s+/).filter((w) => w.length > 3 && !['frequency', 'target', 'sla', 'default', 'requirement', 'method', 'standard'].includes(w));
      if (!topic.length) continue;

      for (const sentence of sentences) {
        const sl = sentence.toLowerCase();
        const hits = topic.filter((w) => sl.includes(w)).length;
        if (hits < Math.min(2, topic.length)) continue;
        const found = FREQ_WORDS.filter((w) => sl.includes(w)).map(canonFreq);
        if (!found.length) continue;
        if (found.some((f) => agreedFreq.includes(f))) continue;
        add({
          category: 'consistency',
          severity: 'high',
          title: `Conflicting commitment: ${name.replace(/([A-Z])/g, ' $1').toLowerCase().trim()}`,
          detail: `The uploaded document states "${found.join(', ')}" where the organisational Standard for this domain records "${agreed}".`,
          recommendation: `Reconcile the uploaded document to "${agreed}", or change the Standard and propagate the change to every document in the domain.`,
          evidence: { statement: sentence.slice(0, 400), agreedValue: agreed }
        });
        break;
      }
    }
  }

  // ------------------------------------------------------- duplication -----
  const existingControls = q.all('SELECT control_id, name, domain_key FROM controls');
  // An Arabic document is compared with the Arabic names of the controls.
  const controlNames = language === 'ar'
    ? localise(existingControls.map((c) => c.name), 'ar')
    : existingControls.map((c) => c.name);
  const duplicates = [];
  for (const [i, c] of existingControls.entries()) {
    // Arabic stems are short and the domain vocabulary is shared ("أمن",
    // "إدارة"), so an Arabic name needs longer words and a closer match.
    const words = language === 'ar'
      ? matchWords(controlNames[i], language, 0).filter((w) => w.length >= 4)
      : matchWords(controlNames[i], language, 5);
    if (words.length < (language === 'ar' ? 3 : 2)) continue;
    const hits = words.filter((w) => haystack.includes(w)).length;
    if (hits / words.length >= (language === 'ar' ? 0.85 : 0.7)) duplicates.push(c);
  }
  if (duplicates.length) {
    add({
      category: 'duplication',
      severity: 'low',
      title: `${duplicates.length} requirement${duplicates.length === 1 ? '' : 's'} already exist in the control library`,
      detail: `The uploaded document restates subject matter already covered by ${duplicates.slice(0, 8).map((d) => d.control_id).join(', ')}${duplicates.length > 8 ? ', …' : ''}.`,
      recommendation: 'Consolidate rather than maintaining two statements of the same requirement in separate documents.',
      evidence: { controls: duplicates.slice(0, 20).map((d) => ({ id: d.control_id, name: d.name })) }
    });
  }

  // -------------------------------------------------------- ambiguity ------
  const vague = ['regularly', 'periodically', 'as needed', 'as appropriate', 'where applicable', 'timely', 'adequate', 'sufficient', 'from time to time',
    'بشكل دوري', 'بصفة دورية', 'دورياً', 'دوريا', 'عند الحاجة', 'حسب الحاجة', 'كلما دعت الحاجة', 'في الوقت المناسب', 'بشكل مناسب', 'بشكل كاف', 'من وقت لآخر'];
  const vagueHits = [];
  for (const sentence of sentences) {
    const sl = sentence.toLowerCase();
    const term = vague.find((v) => sl.includes(v));
    if (term && !/[\d٠-٩]/.test(sentence)) vagueHits.push({ term, sentence: sentence.slice(0, 300) });
  }
  if (vagueHits.length) {
    add({
      category: 'ambiguity',
      severity: vagueHits.length > 5 ? 'high' : 'medium',
      title: `${vagueHits.length} unmeasurable statement${vagueHits.length === 1 ? '' : 's'}`,
      detail: `The document contains obligations expressed without a measurable value (for example "${vagueHits[0].term}"), which cannot be objectively audited.`,
      recommendation: 'Replace each with a stated frequency, threshold or deadline.',
      evidence: { examples: vagueHits.slice(0, 10) }
    });
  }

  // -------------------------------------------------------- ownership ------
  // Each marking in English or Arabic, the two languages documents arrive in.
  const hasOwner = /(document owner|policy owner|owned by|owner\s*[:|]|مالك الوثيقة|مالك السياسة|مالك الإجراء|مالك المعيار)/i.test(text);
  const hasApprover = /(approved by|approver|approval date|authorised by|المعتمِ?د|اعتمدها|اعتمده|تاريخ الاعتماد|جهة الاعتماد|صاحب الصلاحية)/i.test(text);
  const hasVersion = /(version|v\d+\.\d+|revision|الإصدار|رقم الإصدار|النسخة|سجل الإصدارات)/i.test(text);
  const hasReview = /(review date|next review|shall be reviewed|تاريخ المراجعة|المراجعة القادمة|دورية المراجعة|تُ?راجَ?ع هذه|يجب مراجعة)/i.test(text);
  const hasClassification = /(classification|confidential|internal use|restricted|التصنيف|مقيّ?د|سري|داخلي|للاستخدام الداخلي)/i.test(text);

  if (!hasOwner) add({ category: 'ownership', severity: 'high', title: 'No document owner identified', detail: 'The document does not name an owner, so no one is accountable for keeping it current.', recommendation: 'Add a document control table recording the owner, approver, version and review date.' });
  if (!hasApprover) add({ category: 'ownership', severity: 'high', title: 'No approval recorded', detail: 'The document does not record who approved it or when.', recommendation: 'Add an approval table with name, role and date.' });
  if (!hasVersion) add({ category: 'currency', severity: 'medium', title: 'No version identifier', detail: 'Without a version, it is impossible to establish which issue is in force.', recommendation: 'Add a version number and change history.' });
  if (!hasReview) add({ category: 'currency', severity: 'medium', title: 'No review date or review cycle', detail: 'The document does not state when it must next be reviewed.', recommendation: 'State the review cycle and record the next review date.' });
  if (!hasClassification) add({ category: 'completeness', severity: 'low', title: 'No information classification', detail: 'The document does not carry a classification marking.', recommendation: 'Apply the organisation classification marking to the cover and page headers.' });

  // --------------------------------------------------------- evidence ------
  const hasEvidence = /(evidence|record(s)? (shall|are|will) be|audit trail|log(s)? shall be retained|الأدلة|الدليل|السجلات|سجل التدقيق|يُ?حتفظ|الاحتفاظ)/i.test(text);
  if (!hasEvidence) {
    add({
      category: 'auditability', severity: 'high',
      title: 'No evidence requirements stated',
      detail: 'The document states obligations but does not identify the records that demonstrate they were met, so compliance cannot be tested.',
      recommendation: 'Add a records and evidence section naming each artefact, its source system and its retention period.'
    });
  }

  // -------------------------------------------------------- outdated -------
  const outdated = [];
  if (/ISO\s*\/?\s*IEC\s*27001\s*:?\s*20(05|13)/i.test(text)) outdated.push('References ISO/IEC 27001:2013 or earlier; the current edition is 2022.');
  if (/NIST\s+(CSF|Cybersecurity Framework)\s*(v?1\.[01])/i.test(text)) outdated.push('References NIST CSF 1.x; version 2.0 was published in 2024.');
  if (/CIS\s+(Controls?|CSC)\s*(v?[1-7]\b)/i.test(text)) outdated.push('References a CIS Controls version earlier than v8.');
  outdated.push(...outdatedNcaEditions(text));
  const years = [...text.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => Number(m[0])).filter((y) => y > 1990 && y <= new Date().getFullYear());
  const latestYear = years.length ? Math.max(...years) : null;
  if (latestYear && new Date().getFullYear() - latestYear >= 3) {
    outdated.push(`The most recent year referenced is ${latestYear}, suggesting the document has not been reviewed for at least ${new Date().getFullYear() - latestYear} years.`);
  }
  // One finding per signal, so each reads as a sentence of its own in either
  // language.
  for (const signal of outdated) {
    add({
      category: 'currency', severity: 'medium',
      title: 'Content appears outdated',
      detail: signal,
      recommendation: 'Update references to current framework editions and reissue the document.',
      evidence: { signals: [signal] }
    });
  }

  // ---------------------------------------------- procedure structure ----
  // A procedure is checked for the parts that make it operable, not only for
  // the requirements it names: inputs, outputs and a responsible role per step,
  // service levels, exceptions, escalation, verification, indicators, records.
  const procedureGaps = docType === 'procedure' ? checkProcedureStructure(text) : null;
  if (procedureGaps) for (const f of procedureGaps.findings) add(f);

  // ---------------------------------------------------- wording, layout ----
  const wording = checkArabicWording(text);
  if (wording) add(wording);
  const hyphens = checkDigitHyphens(text);
  if (hyphens) add(hyphens);

  // ----------------------------------------------------- compliance gap ----
  const coverageRatio = model?.requirements.length ? covered.length / model.requirements.length : 0;

  return {
    domainKey,
    domainName: domainName(domainKey),
    docType,
    language,
    statistics: {
      characters: text.length,
      words: text.split(/\s+/).filter(Boolean).length,
      sentences: sentences.length,
      requirementsCovered: covered.length,
      requirementsExpected: model?.requirements.length || 0,
      coverage: Math.round(coverageRatio * 100)
    },
    covered,
    missing,
    metadata: { hasOwner, hasApprover, hasVersion, hasReview, hasClassification, hasEvidence },
    procedureGaps: procedureGaps ? procedureGaps.missing : null,
    findings: findings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
  };
}

function severityRank(s) {
  return { critical: 5, high: 4, medium: 3, low: 2, info: 1 }[s] || 0;
}

/**
 * Split extracted text into candidate document sections so an import can be
 * promoted into the document library with a usable structure.
 */
export function segmentSections(text) {
  const lines = String(text).split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const sections = [];
  let current = { heading: 'Introduction', lines: [] };

  const isHeading = (line) =>
    line.length < 90 &&
    !/[.;]$/.test(line) &&
    (/^\d+(\.\d+)*\.?\s+\S/.test(line) ||
     /^(purpose|scope|objectives?|policy statements?|roles? and responsibilit|governance|compliance|exceptions?|monitoring|review|enforcement|references?|definitions?|introduction|background|requirements?|procedure|process|escalation|records?|evidence|kpis?|appendix)/i.test(line) ||
     (line === line.toUpperCase() && line.length > 4 && /[A-Z]{3}/.test(line)));

  for (const line of lines) {
    if (isHeading(line)) {
      if (current.lines.length) sections.push(current);
      current = { heading: line.replace(/^\d+(\.\d+)*\.?\s*/, '').trim() || line, lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.length) sections.push(current);

  return sections
    .filter((s) => s.lines.join(' ').length > 30)
    .map((s, i) => ({
      key: `imported_${i + 1}`,
      heading: s.heading.slice(0, 120),
      body: sanitiseHtml(s.lines.map((l) => `<p>${l.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</p>`).join('')),
      position: i
    }));
}
