/**
 * Bidirectional layout of one line in a right-to-left paragraph.
 *
 * PDFKit draws text left to right. Its shaper joins and reverses an Arabic
 * word, but it knows nothing of a line that mixes Arabic, English, numbers
 * and brackets: "و(NCA-ECC 2-2)" came out with the English reversed and the
 * brackets facing the wrong way. This is the part of the Unicode
 * Bidirectional Algorithm (UAX #9) such a line needs, for a paragraph whose
 * direction is right to left and which holds no explicit embeddings:
 * weak types W1–W7, neutrals N1–N2 and implicit levels I1–I2.
 *
 * It returns the line cut into runs in logical order, each marked as read
 * right to left or left to right, with its embedding level; `visualOrder`
 * puts them in the order they are drawn from the left (rule L2).
 */

const ARABIC_LETTER = /[؀-ٟٮ-ۯۺ-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const HEBREW = /[֐-׿]/;
const ARABIC_DIGIT = /[٠-٩۰-۹]/;

/** The bidi class of one character, reduced to what a plain line can hold. */
function classOf(ch) {
  if (ARABIC_DIGIT.test(ch)) return 'AN';
  if (ARABIC_LETTER.test(ch)) return 'AL';
  if (HEBREW.test(ch)) return 'R';
  if (/[0-9]/.test(ch)) return 'EN';
  if (/\s/.test(ch)) return 'WS';
  if (/[+\-]/.test(ch)) return 'ES';
  if (/[.,:/،٫٬]/.test(ch)) return 'CS';
  if (/[%#$٪°€£]/.test(ch)) return 'ET';
  if (/\p{L}|\p{M}/u.test(ch)) return 'L';
  return 'ON';
}

const isStrongR = (t) => t === 'R' || t === 'AL';

/**
 * Runs of one line, in logical order: [{ text, rtl }]. `base` is the
 * paragraph's direction: 'rtl' (level 1) or 'ltr' (level 0).
 */
export function bidiRuns(line, base = 'rtl') {
  const e = base === 'ltr' ? 'L' : 'R';
  const chars = [...String(line)];
  const types = chars.map(classOf);
  const n = types.length;

  // W2: a European number after Arabic letters is an Arabic number.
  let lastStrong = e;
  for (let i = 0; i < n; i += 1) {
    const t = types[i];
    if (t === 'L' || t === 'R' || t === 'AL') lastStrong = t;
    else if (t === 'EN' && lastStrong === 'AL') types[i] = 'AN';
  }
  // W3: Arabic letters are right-to-left.
  for (let i = 0; i < n; i += 1) if (types[i] === 'AL') types[i] = 'R';
  // W4: one separator between two numbers of a kind joins them (2-2-3, 1.0).
  // Deliberately wider than the standard, which joins a hyphen only between
  // European numbers: after Arabic text a control number such as 2-2-3-1 is
  // an Arabic number there, and the standard would show it as 1-3-2-2 —
  // the very reversal NCA's Arabic documents are checked for. A number keeps
  // its parts in the order written.
  const numeric = (t) => t === 'EN' || t === 'AN';
  for (let i = 1; i < n - 1; i += 1) {
    const [a, t, b] = [types[i - 1], types[i], types[i + 1]];
    if ((t === 'ES' || t === 'CS') && numeric(a) && a === b) types[i] = a;
  }
  // W5: a percent or currency sign next to a number belongs to it (also
  // widened from European numbers to both kinds, for the same reason).
  for (let i = 0; i < n; i += 1) {
    if (types[i] !== 'ET') continue;
    let j = i;
    while (j < n && types[j] === 'ET') j += 1;
    const kind = i > 0 && numeric(types[i - 1]) ? types[i - 1] : (j < n && numeric(types[j]) ? types[j] : null);
    if (kind) for (let k = i; k < j; k += 1) types[k] = kind;
    i = j - 1;
  }
  // W6: what is left of separators and terminators is neutral.
  for (let i = 0; i < n; i += 1) if (['ES', 'CS', 'ET'].includes(types[i])) types[i] = 'ON';
  // W7: a European number after a Latin word reads left to right with it.
  lastStrong = e;
  for (let i = 0; i < n; i += 1) {
    const t = types[i];
    if (t === 'L' || t === 'R') lastStrong = t;
    else if (t === 'EN' && lastStrong === 'L') types[i] = 'L';
  }
  // N1–N2: neutrals take the direction on both sides when it agrees, numbers
  // counting as right-to-left; otherwise the paragraph's own direction.
  const dir = (t) => (t === 'L' ? 'L' : (t === 'R' || t === 'EN' || t === 'AN') ? 'R' : null);
  for (let i = 0; i < n; i += 1) {
    if (types[i] !== 'WS' && types[i] !== 'ON') continue;
    let j = i;
    while (j < n && (types[j] === 'WS' || types[j] === 'ON')) j += 1;
    const before = i > 0 ? dir(types[i - 1]) : e;
    const after = j < n ? dir(types[j]) : e;
    const resolved = before === after ? before : e;
    for (let k = i; k < j; k += 1) types[k] = resolved;
    i = j - 1;
  }
  // I1–I2: at level 1 R stays and everything else rises to 2; at level 0 L
  // stays, R rises to 1 and numbers to 2. Either way a run is read right to
  // left when it is R, and left to right otherwise.
  const levelOf = (t) => (base === 'ltr' ? (t === 'L' ? 0 : t === 'R' ? 1 : 2) : (t === 'R' ? 1 : 2));
  const runs = [];
  for (let i = 0; i < n; i += 1) {
    const level = levelOf(types[i]);
    const last = runs[runs.length - 1];
    if (last && last.level === level) last.text += chars[i];
    else runs.push({ text: chars[i], rtl: level === 1, level });
  }
  return runs;
}

/**
 * Runs in the order they appear from the left edge (UAX #9 L2): from the
 * highest level down, each stretch of runs at that level or above is
 * reversed.
 */
export function visualOrder(runs) {
  const out = runs.slice();
  const max = Math.max(0, ...out.map((r) => r.level));
  const min = Math.min(...out.map((r) => r.level).filter((l) => l % 2 === 1), max + 1);
  for (let level = max; level >= min; level -= 1) {
    for (let i = 0; i < out.length; i += 1) {
      if (out[i].level < level) continue;
      let j = i;
      while (j + 1 < out.length && out[j + 1].level >= level) j += 1;
      out.splice(i, j - i + 1, ...out.slice(i, j + 1).reverse());
      i = j;
    }
  }
  return out;
}

const MIRROR = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<', '«': '»', '»': '«' };

/** A right-to-left run's brackets drawn as their mirror, as the standard requires (L4). */
export function mirrorBrackets(text) {
  return String(text).replace(/[()[\]{}<>«»]/g, (ch) => MIRROR[ch]);
}

/**
 * The direction a paragraph is read in, from its first letter (UAX #9 P2,
 * as `dir="auto"` does): an English paragraph quoted in an Arabic document
 * reads left to right, an Arabic one right to left. A paragraph that opens
 * with an English term but is mostly Arabic ("Get-ADUser للحسابات …") is an
 * Arabic sentence, and reads right to left. Without a letter, the document's
 * own direction holds.
 */
export function paragraphDirection(text, fallback = 'rtl') {
  let first = null; let latin = 0; let rtl = 0;
  for (const ch of String(text)) {
    const t = classOf(ch);
    if (t === 'L') { latin += 1; first = first || 'ltr'; } else if (t === 'AL' || t === 'R') { rtl += 1; first = first || 'rtl'; }
  }
  if (!first) return fallback;
  return first === 'ltr' && latin >= rtl ? 'ltr' : 'rtl';
}
