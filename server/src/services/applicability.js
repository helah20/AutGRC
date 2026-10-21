/**
 * Who a published control applies to, as the publication states it.
 *
 * Three NCA publications scope individual controls rather than the whole
 * document: DCC by data classification level (sometimes with a different
 * frequency per level), OTCC by facility level L1 to L3, and CCC by whether
 * the obligation falls on the cloud service provider or the tenant. That
 * scoping arrives with the licensed catalogue, in an "Applicability" column,
 * and is evaluated here against the organisation profile.
 *
 * The result is advice for the Statement of Applicability, never a decision:
 * excluding a control stays a deliberate act with a recorded justification.
 * Where the profile does not say enough to decide, the answer is "unknown"
 * with the reason, rather than a guess in either direction.
 */

const BASES = {
  data_classification: ['Public', 'Confidential', 'Secret', 'Top Secret'],
  facility_level: ['L1', 'L2', 'L3'],
  cloud_role: ['CSP', 'CST']
};

const BASIS_OF = new Map();
for (const [basis, levels] of Object.entries(BASES)) {
  for (const level of levels) BASIS_OF.set(level.toLowerCase(), [basis, level]);
}

/**
 * Read an Applicability cell: entries separated by ";", each a level name,
 * optionally followed by ": " and the frequency the publication sets for it.
 *
 *   "Secret; Top Secret"
 *   "Public: At least annually; Secret: At least every 6 months"
 *   "L1; L2"        "CSP"
 *
 * Returns null for an empty cell, `{ basis, levels }` for a valid one, and
 * `{ error }` when the cell names an unknown level or mixes bases.
 */
export function parseApplicability(cell) {
  const text = String(cell ?? '').trim();
  if (!text) return null;
  let basis = null;
  const levels = {};
  for (const part of text.split(';').map((p) => p.trim()).filter(Boolean)) {
    const at = part.indexOf(':');
    const name = (at === -1 ? part : part.slice(0, at)).trim();
    const frequency = at === -1 ? '' : part.slice(at + 1).trim();
    const known = BASIS_OF.get(name.toLowerCase());
    if (!known) {
      return { error: `"${name}" is not a level this platform recognises (${Object.values(BASES).flat().join(', ')}).` };
    }
    if (basis && basis !== known[0]) {
      return { error: `"${text}" mixes ${basis.replace('_', ' ')} with ${known[0].replace('_', ' ')}.` };
    }
    basis = known[0];
    levels[known[1]] = frequency || true;
  }
  return basis ? { basis, levels } : null;
}

const norm = (s) => String(s).trim().toLowerCase();

/** What the organisation profile says about one basis, as a list of level names. */
function profileLevels(basis, org) {
  if (basis === 'data_classification') {
    // The profile holds the organisation's own scheme, which may include
    // levels the publication does not use ("Internal"). Only the shared names
    // can be compared.
    const own = new Set((org?.data_classifications || []).map(norm));
    return BASES.data_classification.filter((l) => own.has(norm(l)));
  }
  if (basis === 'facility_level') return org?.ot_facility_level ? [org.ot_facility_level] : [];
  if (basis === 'cloud_role') return (org?.cloud_roles || []).filter((r) => BASES.cloud_role.includes(r));
  return [];
}

const UNKNOWN_REASON = {
  data_classification: 'The organisation profile lists none of the publication\'s classification levels (Public, Confidential, Secret, Top Secret), so this cannot be evaluated.',
  facility_level: 'The organisation profile does not state an operational technology facility level (L1, L2 or L3).',
  cloud_role: 'The organisation profile does not state whether it provides cloud services, consumes them, or both.'
};

/**
 * Evaluate a stored applicability against the organisation profile.
 *
 * Returns null when the publication scopes nothing (the control applies to
 * everyone the framework applies to), otherwise:
 *   { basis, levels, applies: true|false|null, matched, frequency, reason }
 */
export function evaluateApplicability(stored, org) {
  const app = typeof stored === 'string' ? safeParse(stored) : stored;
  if (!app || !app.basis || !app.levels) return null;
  const named = Object.keys(app.levels);
  const own = profileLevels(app.basis, org);
  const base = { basis: app.basis, levels: app.levels };

  if (!own.length) return { ...base, applies: null, matched: [], frequency: null, reason: UNKNOWN_REASON[app.basis] };

  const matched = named.filter((l) => own.includes(l));
  const frequencies = matched.filter((l) => typeof app.levels[l] === 'string');
  const distinct = [...new Set(frequencies.map((l) => app.levels[l]))];
  const frequency = !frequencies.length ? null
    : distinct.length === 1 ? distinct[0]
      : frequencies.map((l) => `${l}: ${app.levels[l]}`).join('; ');

  return matched.length
    ? { ...base, applies: true, matched, frequency, reason: `Applies to ${matched.join(', ')}, which the organisation profile includes.` }
    : { ...base, applies: false, matched, frequency: null,
        reason: `The publication applies this to ${named.join(', ')}; the organisation profile states ${own.join(', ')}.` };
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

export const APPLICABILITY_BASES = BASES;
