/**
 * Labels for values the API returns as English strings.
 *
 * The server sends `domain_label`, `status_label` and the rest already
 * rendered in English. Rather than adding a locale to every endpoint and
 * sending both, the client maps the underlying key — which the API also sends —
 * through the dictionaries, and falls back to whatever the server said when
 * there is no entry. A new domain therefore appears in English rather than as
 * a missing key.
 */

import { useI18n } from './index.jsx';

/** Title Case for an English fallback, matching the old format.titleCase. */
function humanise(value) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function useLabels() {
  const { t, language } = useI18n();

  /**
   * Look a key up in a namespace; fall back to the server's own string, then
   * to a humanised version of the key itself.
   */
  const label = (namespace, key, serverLabel) => {
    if (key === null || key === undefined || key === '') return serverLabel || '—';
    const path = `${namespace}.${key}`;
    const translated = t(path);
    // t() returns the last path segment when nothing matches, which is the
    // raw key; prefer whatever the server rendered in that case.
    if (translated && translated !== String(key)) return translated;
    return serverLabel || humanise(key);
  };

  return {
    language,
    domain: (key, serverLabel) => label('domain', key, serverLabel),
    domainCategory: (key, serverLabel) => label('domainCategory', key, serverLabel),
    role: (key, serverLabel) => label('role', key, serverLabel),
    status: (key, serverLabel) => label('status', key, serverLabel),
    docType: (key, serverLabel) => label('docType', key, serverLabel),
    coverage: (key, serverLabel) => label('coverage', key, serverLabel),
    implementation: (key, serverLabel) => label('implementation', key, serverLabel),
    evidenceStatus: (key, serverLabel) => label('evidenceStatus', key, serverLabel),
    treatment: (key, serverLabel) => label('treatment', key, serverLabel),
    riskStatus: (key, serverLabel) => label('riskStatus', key, serverLabel),
    actionStatus: (key, serverLabel) => label('actionStatus', key, serverLabel),
    rating: (key, serverLabel) => label('rating', key, serverLabel),
    findingCategory: (key, serverLabel) => label('findingCategory', key, serverLabel),
    findingStatus: (key, serverLabel) => label('findingStatus', key, serverLabel),
    gapStatus: (key, serverLabel) => label('gapStatus', key, serverLabel),
    provenance: (key, serverLabel) => label('provenance', key, serverLabel),
    /** Anything with no dictionary: presentable, but still English. */
    humanise
  };
}

/**
 * Content the platform holds only in English — a framework requirement title
 * from the published catalogue, a generated policy clause — inside an Arabic
 * page. Isolating it keeps the bidi algorithm from moving its punctuation,
 * so "ISO/IEC 27001 A.8.5" does not render as "A.8.5 ISO/IEC 27001".
 */
export function ltrProps(language) {
  return language === 'ar' ? { dir: 'ltr', style: { textAlign: 'start' } } : {};
}
