/**
 * The Minimum Baseline Security Standard (MBSS) catalogue: one baseline per
 * technology, each item numbered, classified and mapped.
 *
 * The items are the organisation's wording of the CIS Benchmark settings for
 * the technology, plus the additions a regulator expects that a benchmark
 * does not hold. They are reference content: the benchmark version actually
 * applied is recorded when a baseline is generated, and the recommendation
 * numbers are verified against it before approval.
 */

import { AREAS, AREA_ORDER, CATEGORIES } from './items.js';
import { SYSTEMS } from './systems.js';
import { NETWORK } from './network.js';
import { DATA_TIER } from './data-tier.js';
import { PLATFORMS, GENERIC_ITEMS } from './platforms.js';

export { AREAS, AREA_ORDER, CATEGORIES };

const pad = (n) => String(n).padStart(3, '0');

/** Items numbered in area order, so a baseline reads by subject. */
function numbered(prefix, items) {
  return AREA_ORDER
    .flatMap((area) => items.filter((i) => i.area === area))
    .map((item, i) => ({ ...item, id: `${prefix}-${pad(i + 1)}` }));
}

export const MBSS_TECHNOLOGIES = [...SYSTEMS, ...NETWORK, ...DATA_TIER, ...PLATFORMS]
  .map((t) => ({ ...t, items: numbered(t.prefix, t.items) }));

const BY_KEY = new Map(MBSS_TECHNOLOGIES.map((t) => [t.key, t]));

export function mbssTechnology(key) {
  return BY_KEY.get(key) || null;
}

/**
 * A technology the catalogue does not name: a new product in a project, an
 * appliance, a security tool. It takes the generic baseline, numbered under
 * a prefix made from its name.
 */
export function customTechnology({ name, category = 'other', benchmark, domain = 'endpoint_security' }) {
  const prefix = (String(name).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'GEN').padEnd(3, 'X');
  return {
    key: `custom:${name}`, prefix, category: CATEGORIES[category] ? category : 'other', domain,
    name, nameAr: name, custom: true,
    benchmark: benchmark || 'CIS Benchmark for the product where published; otherwise the vendor hardening guide',
    aliases: [], items: numbered(prefix, GENERIC_ITEMS)
  };
}

/**
 * How much an item matters when it is missing: authentication, remote access,
 * logging and encryption are high; a level 2 item is one step lower.
 */
export function criticality(item) {
  const base = ['accounts', 'network', 'crypto', 'logging'].includes(item.area) ? 'high'
    : ['patching', 'protection'].includes(item.area) ? 'high' : 'medium';
  if (item.level === 2) return base === 'high' ? 'medium' : 'low';
  return base;
}

/** The requirements an item answers: its area's, plus the baseline's own. */
export function itemRefs(item) {
  const refs = structuredClone(AREAS[item.area]?.refs || {});
  // Every baseline item is secure configuration (CIS Control 4, ISO A.8.9).
  refs['CIS-V8'] = [...new Set([...(refs['CIS-V8'] || []), '4'])];
  refs['ISO-27001'] = [...new Set([...(refs['ISO-27001'] || []), 'A.8.9'])];
  return refs;
}

/**
 * The organisation's technologies that the catalogue covers, read from the
 * technology environment in its profile ("Oracle Database", "Palo Alto
 * firewalls"). A match is a suggestion, not a decision.
 */
export function matchTechnologies(technologyEnv = []) {
  const env = (Array.isArray(technologyEnv) ? technologyEnv : []).map((e) => String(e).toLowerCase());
  return MBSS_TECHNOLOGIES
    .filter((t) => env.some((e) => t.aliases.some((a) => e.includes(a))))
    .map((t) => t.key);
}

/** The agreed values a baseline uses, taken from the domain Standards that own them. */
export const MBSS_PARAMETER_SOURCES = {
  iam: ['passwordMinLength', 'passwordHistory', 'accountLockoutThreshold', 'accountLockoutDuration',
    'sessionIdleTimeout', 'dormantAccountThreshold', 'mfaMethods'],
  logging_monitoring: ['logRetention', 'timeSyncSource'],
  vulnerability_management: ['criticalRemediationSla'],
  endpoint_security: ['patchDeploymentSla', 'baselineReviewFrequency'],
  change_management: ['configReviewFrequency']
};
