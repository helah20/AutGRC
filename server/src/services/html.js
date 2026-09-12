/**
 * HTML construction and sanitisation for document section bodies.
 *
 * Section bodies are rich text authored in the browser editor, so they are
 * sanitised on the way in with a strict allow-list. Anything not explicitly
 * permitted is dropped, including every event handler attribute and every
 * URL scheme other than http, https and mailto.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'code', 'pre',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'hr',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  'a', 'span', 'div', 'section', 'figure', 'figcaption', 'small', 'mark'
]);

const VOID_TAGS = new Set(['br', 'hr', 'col']);

/** Attributes permitted per tag. `*` applies to every allowed tag. */
const ALLOWED_ATTRS = {
  '*': new Set(['class', 'data-callout', 'data-provenance', 'data-ref', 'id']),
  a: new Set(['href', 'title', 'target', 'rel']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
  col: new Set(['span']),
  ol: new Set(['start', 'type'])
};

const SAFE_URL = /^(https?:\/\/|mailto:|#|\/)/i;

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitiseAttributes(tag, raw) {
  const allowed = ALLOWED_ATTRS[tag] || new Set();
  const global = ALLOWED_ATTRS['*'];
  const out = [];
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m;
  while ((m = re.exec(raw))) {
    const name = m[1].toLowerCase();
    const value = m[3] ?? m[4] ?? m[5] ?? '';
    if (name.startsWith('on')) continue;
    if (!allowed.has(name) && !global.has(name)) continue;
    if (name === 'href' && !SAFE_URL.test(value.trim())) continue;
    out.push(`${name}="${escapeHtml(value)}"`);
    if (name === 'target' && value === '_blank') out.push('rel="noopener noreferrer"');
  }
  return out.length ? ' ' + out.join(' ') : '';
}

/**
 * Sanitise an HTML fragment. Disallowed elements are removed together with
 * their content when they can carry executable payloads, and unwrapped
 * otherwise so that text is never silently lost.
 */
export function sanitiseHtml(input) {
  if (!input) return '';
  let html = String(input);

  // Drop dangerous elements together with everything they contain.
  html = html.replace(/<(script|style|iframe|object|embed|form|template|noscript)\b[\s\S]*?<\/\1\s*>/gi, '');
  html = html.replace(/<(script|style|iframe|object|embed|form|template|noscript)\b[^>]*\/?>/gi, '');
  html = html.replace(/<!--[\s\S]*?-->/g, '');

  const openStack = [];
  let out = '';
  const tokenRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^<>"']|"[^"]*"|'[^']*')*)>/g;
  let lastIndex = 0;
  let match;

  while ((match = tokenRe.exec(html))) {
    out += html.slice(lastIndex, match.index);
    lastIndex = tokenRe.lastIndex;

    const [full, rawTag, rawAttrs] = match;
    const tag = rawTag.toLowerCase();
    const isClosing = full.startsWith('</');

    if (!ALLOWED_TAGS.has(tag)) continue; // unwrap: keep inner text, drop tag

    if (isClosing) {
      const idx = openStack.lastIndexOf(tag);
      if (idx === -1) continue; // stray close tag
      // Close any elements left open inside it, then the element itself.
      while (openStack.length > idx) out += `</${openStack.pop()}>`;
      continue;
    }

    const selfClosing = VOID_TAGS.has(tag) || /\/\s*$/.test(rawAttrs);
    out += `<${tag}${sanitiseAttributes(tag, rawAttrs)}>`;
    if (!selfClosing) openStack.push(tag);
    else if (VOID_TAGS.has(tag)) { /* void element needs no close */ }
  }

  out += html.slice(lastIndex);
  while (openStack.length) out += `</${openStack.pop()}>`;
  return out.trim();
}

/** Strip all markup, returning readable plain text. Used for search and diff. */
export function htmlToText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote|section)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<td\b[^>]*>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ------------------------------------------------------------ builders -----
// Small composable helpers so generated sections are built structurally
// rather than by string concatenation at each call site.

export const h = {
  p: (text) => `<p>${escapeHtml(text)}</p>`,
  raw: (html) => html,
  heading: (level, text) => `<h${level}>${escapeHtml(text)}</h${level}>`,
  ul: (items) => (items?.length ? `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>` : ''),
  ol: (items) => (items?.length ? `<ol>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ol>` : ''),
  /** Numbered clause list preserving the clause reference, e.g. "5.2". */
  clauses: (items) =>
    items?.length
      ? `<ol class="clause-list">${items
          .map((i) => `<li><span class="clause-ref">${escapeHtml(i.ref)}</span> ${escapeHtml(i.text)}</li>`)
          .join('')}</ol>`
      : '',
  table: (headers, rows, caption) => {
    if (!rows?.length) return '';
    const head = `<thead><tr>${headers.map((x) => `<th scope="col">${escapeHtml(x)}</th>`).join('')}</tr></thead>`;
    const body = `<tbody>${rows
      .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
      .join('')}</tbody>`;
    return `<table>${caption ? `<caption>${escapeHtml(caption)}</caption>` : ''}${head}${body}</table>`;
  },
  callout: (kind, title, text) =>
    `<div class="callout" data-callout="${escapeHtml(kind)}"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div>`,
  /** Marks a block with its provenance so the UI can label it. */
  provenance: (kind, html) => `<div data-provenance="${escapeHtml(kind)}">${html}</div>`
};

export function joinBlocks(...blocks) {
  return blocks.filter(Boolean).join('\n');
}
