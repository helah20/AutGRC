/**
 * Language and direction.
 *
 * A small provider rather than a library: the application needs a lookup, a
 * plural rule and a document direction, and Intl already supplies the hard
 * part. Keys are dotted paths into the dictionaries in ./en.js and ./ar.js.
 *
 * Arabic is not a translation layer bolted onto an English product here. The
 * platform is built around Saudi frameworks — NCA ECC, CSCC, DCC, TCC, CCC and
 * SAMA CSF — whose audiences read Arabic, so direction is a first-class part
 * of the layout rather than a mirrored afterthought.
 */

import { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import en from './en.js';
import ar from './ar.js';

const DICTIONARIES = { en, ar };

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', dir: 'ltr' },
  { code: 'ar', label: 'Arabic', native: 'العربية', dir: 'rtl' }
];

const STORAGE_KEY = 'autgrc-language';
const LanguageContext = createContext(null);

function readStored() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && DICTIONARIES[stored]) return stored;
  } catch { /* private mode, or storage disabled */ }
  // Fall back to the browser's preference before defaulting to English.
  const preferred = (navigator.languages || [navigator.language || 'en'])
    .map((tag) => String(tag).slice(0, 2).toLowerCase())
    .find((code) => DICTIONARIES[code]);
  return preferred || 'en';
}

/** Walk a dotted key. Returns undefined rather than throwing on a miss. */
function lookup(dictionary, key) {
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dictionary);
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readStored);
  const dir = LANGUAGES.find((l) => l.code === language)?.dir || 'ltr';

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
    try { localStorage.setItem(STORAGE_KEY, language); } catch { /* nothing to do */ }
  }, [language, dir]);

  const setLanguage = useCallback((code) => {
    if (DICTIONARIES[code]) setLanguageState(code);
  }, []);

  /**
   * Translate. `params` fills {placeholders}; `params.count` also selects a
   * plural form when the entry is an object keyed by Intl plural category.
   *
   * A missing Arabic entry falls back to English rather than rendering a raw
   * key: a half-translated screen is usable, a screen of dotted paths is not.
   */
  const t = useCallback((key, params) => {
    let value = lookup(DICTIONARIES[language], key);
    if (value === undefined && language !== 'en') value = lookup(DICTIONARIES.en, key);
    if (value === undefined) {
      if (import.meta.env?.DEV) console.warn(`[i18n] missing key: ${key}`);
      // The last segment reads better than the whole path when something slips.
      return key.split('.').pop();
    }

    if (value && typeof value === 'object') {
      const count = Number(params?.count);
      const category = Number.isFinite(count)
        ? new Intl.PluralRules(language).select(count)
        : 'other';
      value = value[category] ?? value.other ?? value.one ?? '';
    }

    if (!params) return value;
    return String(value).replace(/\{(\w+)\}/g, (match, name) => (
      params[name] === undefined ? match : String(params[name])
    ));
  }, [language]);

  /** Numbers and dates in the reader's own locale. */
  const locale = language === 'ar' ? 'ar-SA' : 'en-GB';
  const formatNumber = useCallback(
    (value, options) => new Intl.NumberFormat(locale, options).format(Number(value) || 0),
    [locale]
  );

  const value = useMemo(() => ({
    language, dir, locale, setLanguage, t, formatNumber,
    isRtl: dir === 'rtl',
    languages: LANGUAGES
  }), [language, dir, locale, setLanguage, t, formatNumber]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useI18n must be used inside LanguageProvider');
  return ctx;
}

/** Shorthand for the common case of needing only the translate function. */
export function useT() {
  return useI18n().t;
}
