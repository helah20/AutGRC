/**
 * Arabic renderings of the canonical requirement model.
 *
 * Kept apart from the English model rather than doubling every field on it:
 * the model stays readable, coverage is measurable, and a domain with no
 * translation is visibly absent instead of half-filled.
 *
 * What is here is the platform's own organisational text — policy positions,
 * standard clauses, procedure guidance, control names. What is deliberately
 * NOT here is framework requirement text: rendering an NCA or ISO control into
 * Arabic and presenting it as the publisher's wording would be writing
 * regulatory text, which docs/GOVERNANCE.md rule 1 forbids in any language.
 *
 * Parameters carry Arabic wording for the same commitment, never a different
 * one. "quarterly" and "ربع سنوي" are one decision expressed twice; if they
 * ever diverge, the two language versions of a policy would commit the
 * organisation to different things, so validateKnowledgeBase checks that every
 * translated domain translates the whole parameter set.
 */

import { AR_ACCESS } from './ar-access.js';
import { AR_OPERATE } from './ar-operate.js';
import { AR_DATA } from './ar-data.js';
import { AR_GOVERN } from './ar-govern.js';

export { AR_FREQUENCY, arFrequency } from './ar-common.js';
export { AR_PARAMETER_LABELS, arParameterLabel } from './ar-common.js';
export { AR_ROLES, arRole } from './ar-roles.js';
export { AR_PROCEDURES, arProcedure } from './ar-procedures.js';

export const AR_DOMAINS = {
  ...AR_GOVERN,
  ...AR_ACCESS,
  ...AR_OPERATE,
  ...AR_DATA
};

/** Languages a document can be generated in. */
export const LANGUAGES = ['en', 'ar'];

export function isTranslated(domainKey) {
  return Boolean(AR_DOMAINS[domainKey]);
}

/** Domains that can be generated in Arabic, for the wizard to offer. */
export function translatedDomains() {
  return Object.keys(AR_DOMAINS);
}

/**
 * The Arabic text for one requirement field, or null when untranslated.
 * Callers fall back to English rather than rendering an empty clause.
 */
export function arText(domainKey, requirementKey, field) {
  return AR_DOMAINS[domainKey]?.requirements?.[requirementKey]?.[field] ?? null;
}

export function arParameters(domainKey) {
  return AR_DOMAINS[domainKey]?.parameters ?? null;
}

export function arObjectives(domainKey) {
  return AR_DOMAINS[domainKey]?.objectives ?? null;
}

export function arDomainName(domainKey) {
  return AR_DOMAINS[domainKey]?.name ?? null;
}
