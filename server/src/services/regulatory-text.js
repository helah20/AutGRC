/**
 * The publisher's own wording of the regulatory controls a Policy cites.
 *
 * A Policy clause states the organisation's position in one sentence and cites
 * the regulator's controls it answers. A reader checking the Policy against the
 * regulation should not have to open the regulation: under each clause the
 * Policy carries every control it cites, in full, down to the subcontrols.
 *
 * The text comes from the catalogue, which holds the full wording only where
 * the organisation has imported its copy of the publication; the shipped rows
 * are identifiers and titles. A cited control without its text is reported, not
 * paraphrased, so the gap is visible rather than covered over.
 *
 * Regulations only. A standard's text (ISO) is licensed, and a framework's
 * guidance is not a legislative or regulatory obligation.
 */

import { q } from '../db/index.js';
import { FRAMEWORKS } from '../knowledge/index.js';

const naturalRef = (a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true });

/**
 * The catalogue rows of the regulations in scope, read once per build.
 * Returns { code: { rows: Map(ref -> row), children: Map(ref -> [row]) } }.
 */
export function loadRegulatoryText(frameworkCodes = []) {
  const codes = FRAMEWORKS
    .filter((f) => f.kind === 'regulation' && (!frameworkCodes.length || frameworkCodes.includes(f.code)))
    .map((f) => f.code);
  const out = {};
  for (const code of codes) {
    const rows = q.all(
      `SELECT r.ref, r.parent_ref, r.title, r.statement, r.statement_ar, r.level, r.source_status
         FROM framework_requirements r JOIN frameworks f ON f.id = r.framework_id
        WHERE f.code = ? AND f.edition_status != 'superseded'`, code);
    if (!rows.length) continue;
    // The shipped rows are reference metadata: a title, or a control's first
    // sentence. Only the publisher's text, imported or verified, is quoted.
    for (const r of rows) r.full = r.source_status !== 'reference' && Boolean(r.statement);
    const byRef = new Map(rows.map((r) => [r.ref, r]));
    const children = new Map();
    for (const r of rows) {
      const parent = r.parent_ref || (r.ref.includes('-') ? r.ref.replace(/-[^-]+$/, '') : null);
      if (!parent || parent === r.ref) continue;
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent).push(r);
    }
    for (const list of children.values()) list.sort(naturalRef);
    out[code] = { rows: byRef, children };
  }
  return out;
}

/**
 * Every control a cited reference stands for, in order: the control and its
 * subcontrols, or, for a subdomain, each control within it.
 */
function expand(catalogue, ref) {
  const row = catalogue.rows.get(ref);
  const kids = catalogue.children.get(ref) || [];
  if (row?.full) return [row, ...kids.flatMap((k) => expandBelow(catalogue, k))];
  if (kids.length) return kids.flatMap((k) => expand(catalogue, k.ref));
  return [{ ref, title: row?.title || null, missing: true }];
}

function expandBelow(catalogue, row) {
  const kids = catalogue.children.get(row.ref) || [];
  return [row, ...kids.flatMap((k) => expandBelow(catalogue, k))];
}

/**
 * The regulatory controls under one Policy clause.
 *
 * `used` is shared across the clauses of one Policy: a control several clauses
 * cite is quoted once, under the first of them.
 */
export function regulatoryClauses(requirement, regulatory, used, language = 'en') {
  const out = [];
  for (const [code, refs] of Object.entries(requirement.refs || {})) {
    const catalogue = regulatory?.[code];
    if (!catalogue) continue;
    for (const cited of refs) {
      for (const row of expand(catalogue, cited)) {
        const key = `${code} ${row.ref}`;
        if (used.has(key)) continue;
        used.add(key);
        if (row.missing || !row.full) {
          out.push({ framework: code, ref: row.ref, missing: true });
          continue;
        }
        const arabic = language === 'ar' ? row.statement_ar : null;
        out.push({
          framework: code,
          ref: row.ref,
          text: arabic || row.statement,
          // An Arabic Policy quoting a control the organisation holds only in
          // English says so, rather than presenting a translation as the text.
          englishOnly: language === 'ar' && !arabic
        });
      }
    }
  }
  return out;
}
