/**
 * Convert sanitised section HTML into an ordered list of neutral blocks.
 *
 * The Word and PDF exporters both consume this representation, so the two
 * outputs stay structurally identical rather than drifting apart in two
 * separate HTML parsers.
 *
 * Block shapes:
 *   { type:'heading', level, runs }
 *   { type:'paragraph', runs }
 *   { type:'list', ordered, items:[{ runs, level }] }
 *   { type:'table', caption, head:[[runs]], rows:[[runs]] }
 *   { type:'callout', kind, title, runs }
 *   { type:'rule' }
 *
 * A "run" is { text, bold, italic, code } — the smallest unit both exporters
 * can style.
 */

const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' '
};

function decode(text) {
  return String(text || '').replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] || m);
}

/** Split an inline HTML fragment into styled runs. */
function parseRuns(html) {
  const runs = [];
  const stack = [];
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
  let last = 0;
  let m;

  const push = (text) => {
    const decoded = decode(text);
    if (!decoded) return;
    runs.push({
      text: decoded,
      bold: stack.includes('strong') || stack.includes('b') || stack.includes('th'),
      italic: stack.includes('em') || stack.includes('i'),
      code: stack.includes('code')
    });
  };

  while ((m = re.exec(html))) {
    push(html.slice(last, m.index));
    last = re.lastIndex;
    const tag = m[1].toLowerCase();
    if (m[0].startsWith('</')) {
      const idx = stack.lastIndexOf(tag);
      if (idx !== -1) stack.splice(idx, 1);
    } else if (tag === 'br') {
      runs.push({ text: '\n', bold: false, italic: false, code: false });
    } else if (!m[0].endsWith('/>')) {
      stack.push(tag);
    }
  }
  push(html.slice(last));

  // Merge adjacent runs sharing the same style to keep output tidy.
  const merged = [];
  for (const run of runs) {
    const prev = merged[merged.length - 1];
    if (prev && prev.bold === run.bold && prev.italic === run.italic && prev.code === run.code) {
      prev.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  return merged.filter((r) => r.text.trim() || r.text === '\n');
}

function innerHtml(html, tag) {
  const out = [];
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}\\s*>`, 'gi');
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function parseTable(html) {
  const caption = (html.match(/<caption\b[^>]*>([\s\S]*?)<\/caption>/i) || [])[1];
  const headHtml = (html.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i) || [])[1] || '';
  const bodyHtml = (html.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i) || [])[1] || html;

  const rowsOf = (source) =>
    innerHtml(source, 'tr').map((tr) => {
      const cells = [];
      const re = /<(t[hd])\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;
      let m;
      while ((m = re.exec(tr))) cells.push(parseRuns(m[2]));
      return cells;
    });

  const head = rowsOf(headHtml);
  let rows = rowsOf(bodyHtml);
  // When there is no <thead>, treat a leading all-<th> row as the header.
  if (!head.length && /<th\b/i.test(bodyHtml)) {
    const first = innerHtml(bodyHtml, 'tr')[0] || '';
    if (/<th\b/i.test(first)) {
      head.push(rows[0]);
      rows = rows.slice(1);
    }
  }
  return {
    type: 'table',
    caption: caption ? decode(caption.replace(/<[^>]+>/g, '')) : null,
    head,
    rows: rows.filter((r) => r.length)
  };
}

function parseList(html, ordered, level = 0) {
  const items = [];
  // Match top-level <li> only: skip over any nested list inside the item.
  const re = /<li\b[^>]*>([\s\S]*?)<\/li\s*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const content = m[1];
    const nested = content.match(/<(ul|ol)\b[^>]*>[\s\S]*?<\/\1\s*>/i);
    const own = nested ? content.replace(nested[0], '') : content;
    items.push({ runs: parseRuns(own), level });
    if (nested) {
      const sub = parseList(nested[0], nested[1].toLowerCase() === 'ol', level + 1);
      items.push(...sub.items);
    }
  }
  return { type: 'list', ordered, items };
}

const BLOCK_RE = /<(h[1-6]|p|ul|ol|table|blockquote|hr|div)\b([^>]*)>([\s\S]*?)<\/\1\s*>|<hr\s*\/?>/gi;

export function htmlToBlocks(html) {
  if (!html) return [];
  const blocks = [];
  const source = String(html);
  let m;
  let consumedTo = 0;
  const re = new RegExp(BLOCK_RE.source, 'gi');

  while ((m = re.exec(source))) {
    // Loose text between block elements still deserves a paragraph.
    const between = source.slice(consumedTo, m.index).replace(/<[^>]+>/g, '').trim();
    if (between) blocks.push({ type: 'paragraph', runs: parseRuns(between) });
    consumedTo = re.lastIndex;

    if (!m[1]) { blocks.push({ type: 'rule' }); continue; }

    const tag = m[1].toLowerCase();
    const attrs = m[2] || '';
    const inner = m[3] || '';

    if (/^h[1-6]$/.test(tag)) {
      blocks.push({ type: 'heading', level: Number(tag[1]), runs: parseRuns(inner) });
    } else if (tag === 'p') {
      const runs = parseRuns(inner);
      if (runs.length) blocks.push({ type: 'paragraph', runs });
    } else if (tag === 'ul' || tag === 'ol') {
      blocks.push(parseList(inner, tag === 'ol'));
    } else if (tag === 'table') {
      blocks.push(parseTable(inner));
    } else if (tag === 'blockquote') {
      blocks.push({ type: 'callout', kind: 'quote', title: null, runs: parseRuns(inner) });
    } else if (tag === 'hr') {
      blocks.push({ type: 'rule' });
    } else if (tag === 'div') {
      const calloutKind = (attrs.match(/data-callout=["']([^"']+)["']/) || [])[1];
      if (calloutKind) {
        const title = (inner.match(/<strong\b[^>]*>([\s\S]*?)<\/strong>/i) || [])[1];
        const rest = inner.replace(/<strong\b[^>]*>[\s\S]*?<\/strong>/i, '');
        blocks.push({
          type: 'callout',
          kind: calloutKind,
          title: title ? decode(title.replace(/<[^>]+>/g, '')) : null,
          runs: parseRuns(rest)
        });
      } else {
        // Transparent wrapper (e.g. provenance marker): recurse into it.
        blocks.push(...htmlToBlocks(inner));
      }
    }
  }

  const tail = source.slice(consumedTo).replace(/<[^>]+>/g, '').trim();
  if (tail) blocks.push({ type: 'paragraph', runs: parseRuns(tail) });
  return blocks;
}

export function runsToText(runs) {
  return (runs || []).map((r) => r.text).join('').replace(/\s+/g, ' ').trim();
}
