/**
 * Labels for values the API returns as English strings.
 *
 * Fixed values — statuses, types, categories — come from the API as keys,
 * and the client maps each key through the dictionaries, falling back to
 * whatever the server said when there is no entry. A new value therefore
 * appears in English rather than as a missing key. Text from the knowledge
 * base (control wording, role descriptions, domain and framework names) is a
 * different matter: the server sends that in the reader's language itself,
 * see server/src/services/localise.js.
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
    sourceStatus: (key, serverLabel) => label('sourceStatus', key, serverLabel),
    classification: (key, serverLabel) => label('classification', key, serverLabel),
    evidenceType: (key, serverLabel) => label('evidenceType', key, serverLabel),
    roleCategory: (key, serverLabel) => label('roleCategory', key, serverLabel),
    raciPhase: (key, serverLabel) => label('raciPhase', key, serverLabel),
    controlType: (key, serverLabel) => label('controlType', key, serverLabel),
    controlNature: (key, serverLabel) => label('controlNature', key, serverLabel),
    linkType: (key, serverLabel) => label('linkType', key, serverLabel),
    changeType: (key, serverLabel) => label('changeType', key, serverLabel),
    riskCategory: (key, serverLabel) => label('riskCategory', key, serverLabel),
    riskEffect: (key, serverLabel) => label('riskEffect', key, serverLabel),
    findingScope: (key, serverLabel) => label('findingScope', key, serverLabel),
    searchType: (key, serverLabel) => label('searchType', key, serverLabel),
    frameworkKind: (key, serverLabel) => label('frameworkKind', key, serverLabel),
    /**
     * One audit-log entry. The stored summary is an English record of what
     * happened; an Arabic reader gets the action in Arabic, with any document
     * or control references the summary names.
     */
    activity: (entry) => {
      const action = String(entry?.action || '');
      if (language !== 'ar') return entry?.summary || action;
      const key = action.startsWith('denied:') ? 'denied' : action.replace(/:/g, '__');
      const translated = t(`activity.${key}`);
      const phrase = translated !== key ? translated : (entry?.summary || action);
      const refs = String(entry?.summary || '').match(/\b[A-Z]{2,4}-(?:[A-Z]{2,4}-)?\d{3,4}\b/g) || [];
      return refs.length ? `${phrase}: ${[...new Set(refs)].slice(0, 3).join('، ')}` : phrase;
    },
    /**
     * A value whose kind the caller does not know, such as a search result's
     * badge: the first dictionary that has it wins.
     */
    anyValue: (key) => {
      for (const ns of ['docType', 'status', 'controlType', 'controlNature', 'evidenceType', 'evidenceStatus',
        'roleCategory', 'riskCategory', 'riskStatus', 'rating', 'gapStatus', 'actionStatus', 'findingStatus', 'classification']) {
        const translated = t(`${ns}.${key}`);
        if (translated && translated !== String(key)) return translated;
      }
      return humanise(key);
    },
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
