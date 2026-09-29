/**
 * Import of a licensed framework publication into the catalogue.
 *
 * The catalogue AutGRC ships with is reference metadata: control identifiers and
 * titles compiled for mapping, stamped `source_status: 'reference'`, and carrying
 * a notice that says so. GOVERNANCE.md rule 1 says authoritative rows are written
 * "only by the seed or by an import the customer performs from their licensed
 * copy", and rule 6 tells an organisation wanting official Arabic framework text
 * to import it. Until this module existed, neither was possible: the promise was
 * documented and the path was not built.
 *
 * This is the path. It reads a spreadsheet of controls and writes them into
 * `framework_requirements` for one framework edition, stamped `user_imported`.
 *
 * Two shapes of file are accepted:
 *
 *  - A **publisher layout**, the natural one for a licensed copy: a reference, a
 *    title, the control statement, and optionally a domain, parent and level.
 *
 *  - The **structured five-field layout** of Alharthi et al., "Automating
 *    Cybersecurity Governance" (Grant CRPG-25-1063), section 5.3.1, page 10:
 *    Policy Statement, Purpose, Relevant Standards, Control Number and
 *    Capability Name. That paper reports normalising the NCA and ISO control
 *    sets into exactly these five columns and publishing the result, and it
 *    identifies the manual work of producing such a file as the constraint on
 *    supporting more frameworks (sections 7.3 and 7.4, pages 33-34). Accepting
 *    the format directly means anyone who has already done that work — including
 *    against that published dataset — does not have to redo it in a different
 *    shape.
 *
 * Two deliberate limits, because this table is source material:
 *
 *  - **Nothing is deleted.** A row already in the catalogue and absent from the
 *    file is reported, not removed. Control mappings, gap items and crosswalks
 *    point at requirement ids, and silently dropping a row would silently drop
 *    the traceability built on it.
 *
 *  - **"Relevant Standards" is not written.** That column names other
 *    frameworks a control relates to. Turning a name in a spreadsheet cell into
 *    a crosswalk row would be asserting an equivalence nobody reviewed, so the
 *    values are returned as candidates for a person to accept through the
 *    existing crosswalk route.
 */

import ExcelJS from 'exceljs';
import { db, q, nowIso } from '../db/index.js';
import { id } from '../utils/ids.js';
import { DOMAIN_META } from '../knowledge/index.js';

// ------------------------------------------------------------- the layouts --

/**
 * Header aliases per target field. Matched after lower-casing and stripping
 * everything but letters, so "Control Number", "control_number" and
 * "ControlNumber" are the same header.
 */
const HEADERS = {
  ref: ['controlnumber', 'control', 'controlid', 'reference', 'ref', 'requirementref', 'clause', 'id'],
  title: ['title', 'controltitle', 'name', 'purpose', 'objective', 'controlobjective'],
  statement: ['statement', 'policystatement', 'requirement', 'controlstatement', 'text', 'description', 'controldescription'],
  domain: ['capabilityname', 'capability', 'domain', 'domainkey', 'area', 'controldomain', 'category'],
  parentRef: ['parentref', 'parent', 'parentcontrol', 'parentnumber'],
  level: ['level', 'depth'],
  relatedStandards: ['relevantstandards', 'relatedstandards', 'standards', 'mappings', 'crossreference', 'crossreferences']
};

function normaliseHeader(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z]/g, '');
}

/** Which column holds which field. First match wins, so order HEADERS well. */
function mapColumns(headerRow) {
  const found = {};
  const byIndex = headerRow.map(normaliseHeader);
  for (const [field, aliases] of Object.entries(HEADERS)) {
    for (const alias of aliases) {
      const at = byIndex.indexOf(alias);
      if (at !== -1 && !Object.values(found).includes(at)) { found[field] = at; break; }
    }
  }
  return found;
}

// ------------------------------------------------------------- the reading --

function cellText(value) {
  if (value == null) return '';
  // ExcelJS returns objects for rich text, formulas and hyperlinks.
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((r) => r.text).join('');
    if (value.text != null) return String(value.text);
    if (value.result != null) return String(value.result);
    if (value.hyperlink) return String(value.hyperlink);
    return '';
  }
  return String(value);
}

function tidy(value) {
  return cellText(value).replace(/\s+/g, ' ').trim();
}

async function readRows(filePath, originalName = '') {
  const ext = (originalName.split('.').pop() || '').toLowerCase();
  const workbook = new ExcelJS.Workbook();
  if (ext === 'csv') await workbook.csv.readFile(filePath);
  else await workbook.xlsx.readFile(filePath);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('The file contains no worksheet.');

  const rows = [];
  sheet.eachRow((row) => {
    const values = [];
    // row.values is 1-based with a leading hole; normalise to a dense array.
    for (let i = 1; i <= sheet.columnCount; i += 1) values.push(row.getCell(i).value);
    rows.push(values);
  });
  // Skip leading blank rows so a title row above the header does not defeat
  // header detection on its own.
  while (rows.length && rows[0].every((v) => tidy(v) === '')) rows.shift();
  return rows;
}

// --------------------------------------------------------- domain matching --

const DOMAIN_BY_NAME = new Map();
for (const d of DOMAIN_META) {
  DOMAIN_BY_NAME.set(d.key, d.key);
  DOMAIN_BY_NAME.set(normaliseHeader(d.name), d.key);
  DOMAIN_BY_NAME.set(normaliseHeader(d.short), d.key);
}

/**
 * A capability name to a platform domain key, or null.
 *
 * Exact matches only, plus a containment pass. A fuzzy match here would file a
 * control under the wrong domain, and a control filed under the wrong domain is
 * worse than one filed under none: the first is wrong and looks right.
 */
export function matchDomain(value) {
  const key = normaliseHeader(value);
  if (!key) return null;
  if (DOMAIN_BY_NAME.has(key)) return DOMAIN_BY_NAME.get(key);
  const hits = [...DOMAIN_BY_NAME.entries()]
    .filter(([name]) => name.length >= 5 && (key.includes(name) || name.includes(key)))
    .map(([, domainKey]) => domainKey);
  return new Set(hits).size === 1 ? hits[0] : null;
}

// ------------------------------------------------------------ the analysis --

/** Depth from the reference when the file does not state it: 2-2-3-1 is level 4. */
function levelFromRef(ref) {
  const parts = String(ref).split(/[-.\s]+/).filter((p) => /[0-9A-Za-z]/.test(p));
  return Math.max(1, Math.min(6, parts.length));
}

/**
 * Parse and validate a catalogue file without writing anything.
 *
 * Returns the rows that would be written, the rows that were rejected and why,
 * the catalogue rows the file does not cover, and the crosswalk candidates found
 * in a "Relevant Standards" column.
 */
export async function analyseCatalogue({ filePath, originalName, existing = [] }) {
  const rows = await readRows(filePath, originalName);
  if (rows.length < 2) throw new Error('The file has no data rows beneath its header.');

  const columns = mapColumns(rows[0]);
  if (columns.ref === undefined) {
    throw new Error(
      'No control reference column was found. Expected a header such as "Control Number", '
      + '"Reference" or "Clause".'
    );
  }
  if (columns.title === undefined && columns.statement === undefined) {
    throw new Error(
      'No control text column was found. Expected a header such as "Title", "Statement", '
      + '"Policy Statement" or "Requirement".'
    );
  }

  const layout = normaliseHeader(rows[0][columns.statement] || '') === 'policystatement'
    && normaliseHeader(rows[0][columns.title] || '') === 'purpose'
    ? 'structured_five_field'
    : 'publisher';

  const at = (row, field) => (columns[field] === undefined ? '' : tidy(row[columns[field]]));
  const byRef = new Map(existing.map((r) => [r.ref, r]));

  const accepted = [];
  const rejected = [];
  const candidates = [];
  const seen = new Set();
  const unmatchedDomains = new Map();

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const line = i + 1;
    if (row.every((v) => tidy(v) === '')) continue;

    const ref = at(row, 'ref');
    const statement = at(row, 'statement');
    const title = at(row, 'title');

    if (!ref) { rejected.push({ line, reason: 'No control reference.' }); continue; }
    if (!statement && !title) { rejected.push({ line, ref, reason: 'No title and no statement.' }); continue; }
    if (seen.has(ref)) { rejected.push({ line, ref, reason: 'The reference appears more than once in this file.' }); continue; }
    seen.add(ref);

    const capability = at(row, 'domain');
    const domainKey = matchDomain(capability);
    if (capability && !domainKey) {
      unmatchedDomains.set(capability, (unmatchedDomains.get(capability) || 0) + 1);
    }

    const levelCell = at(row, 'level');
    const related = at(row, 'relatedStandards');
    if (related) candidates.push({ ref, related });

    accepted.push({
      ref,
      // With no separate title column the statement's opening clause is the only
      // title available. Truncated on a sentence or clause boundary rather than
      // mid-word, and never fabricated.
      title: title || statement.split(/(?<=[.;:])\s|\s—\s/)[0].slice(0, 200),
      statement: statement || null,
      domainKey,
      capability: capability || null,
      parentRef: at(row, 'parentRef') || null,
      level: /^[1-6]$/.test(levelCell) ? Number(levelCell) : levelFromRef(ref),
      action: byRef.has(ref) ? 'update' : 'insert'
    });
  }

  return {
    layout,
    columns: Object.fromEntries(
      Object.entries(columns).map(([field, index]) => [field, tidy(rows[0][index])])
    ),
    dataRows: rows.length - 1,
    accepted,
    rejected,
    inserts: accepted.filter((a) => a.action === 'insert').length,
    updates: accepted.filter((a) => a.action === 'update').length,
    // Left in the catalogue, never deleted: mappings and gap items point at
    // these ids. Reported so the reader knows the import is partial.
    notCovered: existing.filter((r) => !seen.has(r.ref)).map((r) => ({ ref: r.ref, title: r.title })),
    unmatchedCapabilities: [...unmatchedDomains.entries()]
      .map(([capability, count]) => ({ capability, rows: count })),
    crosswalkCandidates: candidates
  };
}

// ------------------------------------------------------------- the writing --

/**
 * Write an analysed catalogue into one framework edition.
 *
 * Existing rows are updated in place by reference, keeping their ids so every
 * control mapping, gap item and crosswalk built on them survives. New rows are
 * inserted. Nothing is deleted.
 *
 * `provenance` follows the framework's own kind — a regulator's controls are
 * `regulatory_requirement`, a standard's are `framework_guidance` — and is left
 * alone on an update, because the import is replacing the *text* with the
 * licensed wording, not reclassifying what the document is.
 */
export function applyCatalogue({ framework, accepted }) {
  const at = nowIso();
  const provenance = framework.kind === 'regulation' ? 'regulatory_requirement' : 'framework_guidance';
  const result = { inserted: 0, updated: 0 };

  db.transaction(() => {
    for (const row of accepted) {
      const existing = q.get(
        'SELECT id FROM framework_requirements WHERE framework_id = ? AND ref = ?',
        framework.id, row.ref
      );
      if (existing) {
        q.run(
          `UPDATE framework_requirements
              SET title = ?, statement = ?, domain_key = ?, parent_ref = ?, level = ?,
                  source_status = 'user_imported'
            WHERE id = ?`,
          row.title, row.statement, row.domainKey, row.parentRef, row.level, existing.id
        );
        result.updated += 1;
      } else {
        q.run(
          `INSERT INTO framework_requirements
             (id, framework_id, ref, parent_ref, title, statement, domain_key, level,
              provenance, source_status, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,'user_imported',?)`,
          id('fwr'), framework.id, row.ref, row.parentRef, row.title, row.statement,
          row.domainKey, row.level, provenance, at
        );
        result.inserted += 1;
      }
    }
  })();

  return result;
}
