/**
 * An imported document cut into the sections of a draft.
 *
 * A customer's policy arrives with its own structure: numbered headings
 * ("1. الغرض", "3.1 المتطلبات العامة"), Word's automatic lists, typed lists
 * ("1. يجب …"), tables. The draft keeps that structure rather than a page of
 * loose lines:
 *
 * - a top-level heading opens a section, its number dropped, since the
 *   export numbers sections itself and "1. 1. الغرض" would follow;
 * - a subheading stays inside its section as a subheading, numbered under
 *   the section's place in the draft;
 * - a list stays a list, a typed one made a numbered list without the
 *   typed numbers, so the numbers are not shown twice;
 * - no text is dropped: a line that is not a heading is part of the section
 *   it falls under, and a heading with nothing under it is still a section.
 *
 * Word files are read as HTML (headings, lists and tables survive); PDF and
 * plain text are read line by line.
 */

import { sanitiseHtml } from './html.js';

const DIGIT = '[0-9٠-٩۰-۹]';
/** "1." "1)" "1 -" "2.1" "٢.١" at the start of a line. */
const NUMBER_RE = new RegExp(`^\\s*(${DIGIT}+(?:[.٫]${DIGIT}+)*)\\s*[.)\\-–:]?\\s+`);
const toLatin = (s) => String(s).replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x0660).replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x06F0);

const HEADING_WORDS = /^(purpose|scope|objectives?|policy statements?|roles? and responsibilit|governance|compliance|exceptions?|monitoring|review|enforcement|references?|definitions?|introduction|background|requirements?|procedures?|process|escalation|records?|evidence|kpis?|appendix|الغرض|الهدف|الأهداف|النطاق|نطاق العمل|المقدمة|مقدمة|التعريفات|المصطلحات|بنود السياسة|عناصر السياسة|المتطلبات|الأدوار والمسؤوليات|الأدوار|المسؤوليات|الحوكمة|الالتزام|الالتزام بالسياسة|الاستثناءات|المراقبة|المراجعة|مراجعة السياسة|التحديث والمراجعة|المراجع|الوثائق المرجعية|الإجراءات|الإجراء|السجلات|الأدلة|مؤشرات الأداء|الملاحق|ملحق)\b/i;

const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const plain = (html) => String(html).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

/** A line's leading number as parts, "3.1" → [3, 1]; null when it has none. */
function leadingNumber(text) {
  const m = String(text).match(NUMBER_RE);
  if (!m) return null;
  return toLatin(m[1]).split(/[.٫]/).map(Number);
}
const stripNumber = (text) => String(text).replace(NUMBER_RE, '').trim();

/** A short line, not a sentence, that reads as a heading. */
function looksLikeHeading(text) {
  const t = String(text).trim();
  if (!t || t.length > 90 || /[.;،:؛]$/.test(t)) return false;
  if (leadingNumber(t)) return stripNumber(t).length >= 2;
  if (HEADING_WORDS.test(t)) return true;
  // An English heading in capitals; Arabic has no capitals, so not for it.
  return !/[؀-ۿ]/.test(t) && t === t.toUpperCase() && /[A-Z]{3}/.test(t) && t.length > 4;
}

// ------------------------------------------------------------------ html ---

/** The top-level elements of an HTML fragment, nesting respected. */
function topLevelBlocks(html) {
  const blocks = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
  let depth = 0; let start = -1; let tag = null; let m;
  while ((m = re.exec(html))) {
    const [, closing, name, self] = m;
    const lower = name.toLowerCase();
    if (self || ['br', 'img', 'hr', 'col'].includes(lower)) continue;
    if (!closing) {
      if (depth === 0) { start = m.index; tag = lower; }
      depth += 1;
    } else {
      depth -= 1;
      if (depth === 0 && tag) {
        blocks.push({ tag, html: html.slice(start, re.lastIndex) });
        tag = null;
      }
      if (depth < 0) depth = 0;
    }
  }
  return blocks;
}

/** The inner HTML of an element. */
const inner = (html) => html.replace(/^<[^>]+>/, '').replace(/<\/[^>]+>$/, '');

/**
 * Units read from Word HTML: { kind: 'heading', depth, text } or
 * { kind: 'body', html, text }.
 */
function unitsFromHtml(html) {
  const blocks = topLevelBlocks(String(html).replace(/<img\b[^>]*>/gi, ''));
  const hLevels = blocks.filter((b) => /^h[1-6]$/.test(b.tag)).map((b) => Number(b.tag[1]));
  const minH = hLevels.length ? Math.min(...hLevels) : 1;
  const units = [];
  for (const b of blocks) {
    const text = plain(b.html);
    if (!text && b.tag !== 'table') continue;
    if (/^h[1-6]$/.test(b.tag)) {
      const num = leadingNumber(text);
      units.push({ kind: 'heading', depth: num ? num.length : Number(b.tag[1]) - minH + 1, text });
    } else if (b.tag === 'p' && looksLikeHeading(text) && (leadingNumber(text) || /^<p>\s*<strong>[\s\S]*<\/strong>\s*<\/p>$/.test(b.html) || HEADING_WORDS.test(text))) {
      const num = leadingNumber(text);
      units.push({ kind: 'heading', depth: num ? num.length : 1, text, weak: true });
    } else if (b.tag === 'p') {
      units.push({ kind: 'body', html: `<p>${inner(b.html)}</p>`, text });
    } else {
      units.push({ kind: 'body', html: b.html, text });
    }
  }
  return units;
}

// ------------------------------------------------------------------ text ---

function unitsFromText(text) {
  const lines = String(text).split(/\r?\n+/).map((l) => l.trim()).filter(Boolean);
  return lines.map((line) => (looksLikeHeading(line)
    ? { kind: 'heading', depth: leadingNumber(line)?.length || 1, text: line, weak: true }
    : { kind: 'body', html: `<p>${esc(line)}</p>`, text: line }));
}

// ------------------------------------------------------------- structure ---

/**
 * A run of numbered lines one after another (1, 2, 3 …) with nothing
 * between is a list or a table of contents, not a row of headings.
 */
function demoteNumberedRuns(units) {
  const numberOf = (u) => (u.kind === 'heading' && u.weak ? leadingNumber(u.text) : null);
  for (let i = 0; i < units.length; i += 1) {
    const first = numberOf(units[i]);
    if (!first) continue;
    let j = i;
    // The next line carries the next number at the same depth: 1, 2, 3 or 2.1, 2.2.
    const follows = (a, b) => a.length === b.length && a.slice(0, -1).join('.') === b.slice(0, -1).join('.') && b[b.length - 1] === a[a.length - 1] + 1;
    while (j + 1 < units.length && numberOf(units[j + 1]) && follows(numberOf(units[j]), numberOf(units[j + 1]))) j += 1;
    if (j > i) {
      for (let k = i; k <= j; k += 1) units[k] = { kind: 'body', html: `<p>${esc(units[k].text)}</p>`, text: units[k].text };
    }
    i = j;
  }
  return units;
}

/**
 * Typed numbered paragraphs one after another become one numbered list
 * without the typed numbers, so the export does not number them twice.
 */
function listsFromTypedNumbers(parts) {
  const out = [];
  let run = [];
  const flush = () => {
    if (run.length >= 2) out.push(`<ol>${run.map((t) => `<li>${esc(stripNumber(t))}</li>`).join('')}</ol>`);
    else out.push(...run.map((t) => `<p>${esc(t)}</p>`));
    run = [];
  };
  for (const p of parts) {
    const text = p.startsWith('<p>') ? plain(p) : null;
    const num = text != null ? leadingNumber(text) : null;
    if (num && num.length === 1 && num[0] === run.length + 1) { run.push(text); continue; }
    flush();
    if (num && num.length === 1 && num[0] === 1) { run.push(text); continue; }
    out.push(p);
  }
  flush();
  return out.join('');
}

/**
 * The sections of an imported document: [{ key, heading, body, position }].
 * `html` is the Word file read as HTML; without it the plain text is used.
 */
export function segmentImported({ text = '', html = '', language = 'en' } = {}) {
  const units = demoteNumberedRuns(html ? unitsFromHtml(html) : unitsFromText(text));
  const headingDepths = units.filter((u) => u.kind === 'heading').map((u) => u.depth);
  const top = headingDepths.length ? Math.min(...headingDepths) : 1;

  const sections = [];
  let current = null;
  const preamble = { heading: language === 'ar' ? 'مقدمة' : 'Introduction', parts: [] };
  for (const u of units) {
    if (u.kind === 'heading' && u.depth === top) {
      current = { heading: stripNumber(u.text) || u.text, parts: [] };
      sections.push(current);
    } else if (u.kind === 'heading') {
      (current || preamble).parts.push({ sub: u.depth - top, text: stripNumber(u.text) || u.text });
    } else {
      (current || preamble).parts.push(u.html);
    }
  }
  // What comes before the first heading is the title and cover lines unless
  // there is real text there; then it is the document's introduction.
  const preambleText = preamble.parts.map((p) => (typeof p === 'string' ? plain(p) : p.text)).join(' ');
  if (!sections.length || preambleText.length > 200 || preamble.parts.length > 3) sections.unshift(preamble);

  return sections
    .map((s, i) => {
      // Subheadings numbered under the section's place in the draft.
      const counters = [];
      const parts = s.parts.map((p) => {
        if (typeof p === 'string') return p;
        const level = Math.min(Math.max(p.sub, 1), 3);
        counters.length = level;
        counters[level - 1] = (counters[level - 1] || 0) + 1;
        for (let k = 0; k < level - 1; k += 1) counters[k] = counters[k] || 1;
        // The number is a clause reference: an export renumbers it with its section.
        return `<h${level + 2}><span class="clause-ref">${[i + 1, ...counters].join('.')}</span> ${esc(p.text)}</h${level + 2}>`;
      });
      return {
        key: `imported_${i + 1}`,
        heading: s.heading.slice(0, 120),
        body: sanitiseHtml(listsFromTypedNumbers(parts)),
        position: i
      };
    });
}
