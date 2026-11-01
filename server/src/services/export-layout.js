/**
 * What an exported document carries around its content.
 *
 * The content is the document's own sections. Around it the exporters add a
 * cover, a document control table, the approval record, the version history
 * and a contents list, and number the section headings. An organisation
 * whose house style differs, or a reader who wants only the text, chooses
 * which of these appear: the organisation sets the default, and each export
 * can override it.
 */

import { q } from '../db/index.js';

export const LAYOUT_PARTS = ['cover', 'control', 'approvals', 'versions', 'contents', 'numbering'];

const ALL = Object.fromEntries(LAYOUT_PARTS.map((part) => [part, true]));

/** A layout object with every part stated, from whatever was stored or sent. */
export function normaliseLayout(value) {
  const out = { ...ALL };
  if (value && typeof value === 'object') {
    for (const part of LAYOUT_PARTS) if (typeof value[part] === 'boolean') out[part] = value[part];
  }
  return out;
}

/** The organisation's default layout. */
export function defaultLayout() {
  const row = q.get('SELECT export_layout FROM org_profile WHERE id = 1');
  try { return normaliseLayout(JSON.parse(row?.export_layout || 'null')); } catch { return { ...ALL }; }
}

/**
 * The layout for one export: `?parts=cover,control,...` names the parts to
 * include, and overrides the organisation's default; without it the default
 * applies.
 */
export function layoutFor(req) {
  const asked = req.query?.parts;
  if (typeof asked !== 'string') return defaultLayout();
  const wanted = new Set(asked.split(',').map((s) => s.trim()).filter(Boolean));
  return Object.fromEntries(LAYOUT_PARTS.map((part) => [part, wanted.has(part)]));
}

/**
 * The sections an export carries, with any clause numbers that name a section
 * ("4.2") renumbered to where the section now falls. A section removed or
 * hidden from the file would otherwise leave the Policy's clauses citing a
 * section number the file does not have.
 */
export function sectionsForExport(sections) {
  return sections
    .filter((s) => s.exported !== 0 && s.exported !== false)
    .map((s, i) => ({
      ...s,
      body: String(s.body || '').replace(/(<span class="clause-ref">)\d+((?:\.\d+)+<\/span>)/g, `$1${i + 1}$2`)
    }));
}
