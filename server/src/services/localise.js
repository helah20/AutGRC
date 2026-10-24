/**
 * Read-time localisation of API responses.
 *
 * The platform stores what it generates in the language it was generated in,
 * which for most installations is English. A reader of the Arabic interface
 * should still see the knowledge base in Arabic: the domain names, framework
 * names, control wording, evidence items, role descriptions and risk
 * statements all exist in the Arabic model.
 *
 * The rule is exact match. A stored value that is, word for word, the English
 * the knowledge base produced is shown as the Arabic the knowledge base
 * produces for the same item. Anything a person wrote or edited matches
 * nothing and is shown as written, so an edit is never silently replaced by a
 * translation of the text it replaced.
 */

import { q } from '../db/index.js';
import {
  DOMAIN_INDEX, FRAMEWORKS, ROLE_LIBRARY, localisedModel, localisedRole,
  buildParameterSet, resolveText, domainName, arDomainName
} from '../knowledge/index.js';
import { AR_FRAMEWORKS, AR_JURISDICTION } from '../knowledge/ar/ar-frameworks.js';
import { controlText, TESTING_METHOD, DOC_TYPE_LABEL, DOC_TYPE_LABEL_AR } from './generator.js';
import { arabicTitle, DOC_STRINGS_AR } from './doc-strings.js';
import { FINDING_PATTERNS } from './localise-findings.js';
import { UI_PHRASES_AR } from './localise-ui.js';

/** The reader's language for this request: the client sends it on every call. */
export function requestLanguage(req) {
  return req.get('x-language') === 'ar' ? 'ar' : 'en';
}

const TITLE_TYPES = [
  'Policy', 'Standard', 'Procedure', 'Guideline', 'Control Framework', 'Roles and Responsibilities',
  'RACI Matrix', 'Control Matrix', 'Process Flow'
];

/** Pair two values of the same shape, adding each English string with its Arabic. */
function pairAll(add, en, ar) {
  if (typeof en === 'string') { add(en, ar); return; }
  if (Array.isArray(en) && Array.isArray(ar) && en.length === ar.length) {
    en.forEach((item, i) => pairAll(add, item, ar[i]));
    return;
  }
  if (en && ar && typeof en === 'object' && typeof ar === 'object') {
    for (const key of Object.keys(en)) pairAll(add, en[key], ar[key]);
  }
}

function buildPhrases(org) {
  const map = new Map();
  const put = (from, to) => {
    // A lowercase identifier ("high", "draft", "policy") is a value the
    // interface switches on, never prose, so it is never a phrase.
    if (!from || !to || from === to || map.has(from) || !/[A-Za-z]/.test(from) || /^[a-z0-9_]+$/.test(from)) return;
    map.set(from, to);
  };
  // Library text carries {{orgName}}; what is stored has it resolved, or, in
  // older records, not. Either way the reader gets the resolved Arabic.
  const orgParams = { orgName: org.org_name || 'the Organisation' };
  const add = (en, ar) => {
    if (typeof en !== 'string' || typeof ar !== 'string') return;
    const to = resolveText(ar.trim(), { orgName: org.org_name || 'المنظمة' });
    put(en.trim(), to);
    if (en.includes('{{')) put(resolveText(en.trim(), orgParams), to);
  };

  for (const key of Object.keys(DOMAIN_INDEX)) {
    add(domainName(key), arDomainName(key));
    const en = localisedModel(key, 'en');
    const ar = localisedModel(key, 'ar');
    if (!en || !ar || ar.language !== 'ar') continue;
    add(en.description, ar.description);
    pairAll(add, en.objectives, ar.objectives);
    for (const type of TITLE_TYPES) add(`${en.name} ${type}`, arabicTitle(type, ar.name));

    const pe = buildParameterSet(key, org, {}, 'en');
    const pa = buildParameterSet(key, org, {}, 'ar');
    // The agreed values ("quarterly", "30 days") are prose even when they are
    // one lowercase word, and appear on their own in evidence and findings.
    for (const [name, value] of Object.entries(en.parameters || {})) {
      const arabic = ar.parameters?.[name];
      if (typeof value === 'string' && typeof arabic === 'string' && value !== arabic && !map.has(value)) {
        map.set(value.trim(), resolveText(arabic.trim(), { orgName: org.org_name || 'المنظمة' }));
      }
    }
    en.requirements.forEach((req, i) => {
      const arReq = ar.requirements[i];
      if (!arReq || arReq.key !== req.key) return;
      add(req.title, arReq.title);
      // Stored text may be resolved against the organisation or still carry
      // its placeholders (risk statements are stored as written), so both.
      for (const field of ['policy', 'standard', 'guidance', 'kpi', 'risk', 'frequency']) {
        add(req[field], arReq[field]);
        add(resolveText(req[field] || '', pe), resolveText(arReq[field] || '', pa));
      }
      pairAll(add, controlText(en, req, pe, 'en'), controlText(ar, arReq, pa, 'ar'));
    });
    pairAll(add, en.raciActivities?.map((a) => a.activity), ar.raciActivities?.map((a) => a.activity));
    pairAll(add, en.procedure, ar.procedure);
  }

  for (const role of ROLE_LIBRARY) {
    const arabic = localisedRole(role.code, 'ar');
    if (arabic?.language === 'ar') pairAll(add, role, arabic);
  }

  for (const fw of FRAMEWORKS) {
    const arabic = AR_FRAMEWORKS[fw.code];
    if (!arabic) continue;
    add(fw.name, arabic.name);
    add(fw.description, arabic.description);
    add(fw.publisher, arabic.publisher);
  }
  for (const [en, ar] of Object.entries(AR_JURISDICTION)) add(en, ar);
  for (const [type, en] of Object.entries(DOC_TYPE_LABEL)) add(en, DOC_TYPE_LABEL_AR[type]);
  add(TESTING_METHOD.en, TESTING_METHOD.ar);
  // Document headings and the platform's fixed phrases; templates with
  // {placeholders} are sentences, not names, and are left to the generator.
  for (const [en, ar] of Object.entries(UI_PHRASES_AR)) add(en, ar);
  for (const [en, ar] of Object.entries(DOC_STRINGS_AR)) {
    if (typeof ar === 'string' && !en.includes('{')) add(en, ar);
  }
  return map;
}

let cached = { org: null, map: null };

/** The phrase map for the organisation as it is now; rebuilt when its name changes. */
function phrases() {
  const row = q.get('SELECT org_name FROM org_profile WHERE id = 1');
  const org = { org_name: row?.org_name || undefined };
  if (cached.map && cached.org === org.org_name) return cached.map;
  cached = { org: org.org_name, map: buildPhrases(org) };
  return cached.map;
}

/**
 * Sentences the platform writes around knowledge-base names. The captured
 * names are translated through the phrase map; a name that is not knowledge
 * base text (a control a person renamed) is kept as written inside the
 * Arabic sentence.
 */
const PATTERNS = [
  [/^Treated by control (\S+) \((.+)\)\.$/, (m, t) => `يعالجه الضابط ${m[1]} (${t(m[2])}).`],
  [/^No control is yet recorded against this risk\.$/, () => 'لم يُسجَّل بعد ضابط يعالج هذا الخطر.'],
  [/^Evidence demonstrating operation of control (\S+) \((.+)\)\.$/, (m, t) => `دليل على تشغيل الضابط ${m[1]} (${t(m[2])}).`],
  [/^Responsibility assignment for (.+) activities\.?$/, (m, t) => `توزيع المسؤوليات في أنشطة ${t(m[1])}.`],
  [/^(.+) RACI Matrix$/, (m, t) => `مصفوفة RACI لمجال ${t(m[1])}`],
  // Last: its final entries are generic shapes that would otherwise win.
  ...FINDING_PATTERNS
];

/** Fields that identify rather than describe, and are never translated. */
const KEEP = /(^id$|_id$|Id$|^reference$|^code$|_key$|Key$|^email$|^status$|^type$|_type$|^doc_type$|^language$|^provenance$|^mime$|^filename$|^sha256$|_at$|^at$|_date$|^role$)/;

/**
 * Arabic this server has sent, mapped back to the English it was made from.
 * An edit form sends back every field it loaded, so without this an Arabic
 * reader saving an unchanged form would overwrite the stored English with its
 * translation. Only text this server actually translated is mapped back, so
 * an Arabic document's own Arabic title is never turned into English. The cap
 * keeps a long-running process from growing without bound; the oldest
 * translations go first.
 */
const sent = new Map();
const SENT_LIMIT = 200000;
function remember(english, arabic) {
  if (sent.size >= SENT_LIMIT) sent.delete(sent.keys().next().value);
  sent.set(arabic, english);
}

/** Walk every string in a body that is not an identifier field, replacing it in place. */
function walkStrings(body, replace) {
  const seen = new Set();
  const visit = (node) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      node.forEach((value, i) => {
        if (typeof value === 'string') node[i] = replace(value);
        else visit(value);
      });
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'string') {
        if (!KEEP.test(key)) node[key] = replace(value);
      } else {
        visit(value);
      }
    }
  };
  visit(body);
  return body;
}

/**
 * Localise a response body in place for an Arabic reader. Returns the body.
 * English readers get the body untouched.
 */
export function localise(body, language) {
  if (language !== 'ar' || body === null || typeof body !== 'object') return body;
  const map = phrases();
  const translate = (text, depth = 0) => {
    const trimmed = text.trim();
    const direct = map.get(trimmed);
    if (direct) {
      if (depth === 0) remember(trimmed, direct);
      return direct;
    }
    // Markup (a document section) is a body of text, not a sentence the
    // platform wrote; only an exact match above ever applies to it.
    if (depth > 2 || /<\/?[a-z][^>]*>|&[a-z]+;|&#\d+;/i.test(trimmed)) return text;
    for (const [pattern, render] of PATTERNS) {
      const match = trimmed.match(pattern);
      if (match) {
        const arabic = render(match, (inner) => translate(inner, depth + 1));
        if (depth === 0) remember(trimmed, arabic);
        return arabic;
      }
    }
    return text;
  };
  return walkStrings(body, (value) => translate(value));
}

/**
 * Undo localisation on a request body from an Arabic reader: a value that is
 * exactly Arabic this server produced goes back to the stored English. Text
 * the reader actually changed matches nothing and is saved as typed.
 */
export function unlocalise(body) {
  if (body === null || typeof body !== 'object') return body;
  return walkStrings(body, (value) => sent.get(value.trim()) ?? value);
}

/**
 * Express middleware: localise every JSON response for an Arabic reader, and
 * map Arabic the reader sends back unchanged to the English it came from.
 * Exports and downloads are binary and pass through untouched; they carry
 * their own language choice.
 */
export function localiseResponses(req, res, next) {
  const language = requestLanguage(req);
  req.language = language;
  if (language === 'ar') {
    if (req.body && typeof req.body === 'object' && req.method !== 'GET') unlocalise(req.body);
    const json = res.json.bind(res);
    res.json = (body) => json(localise(body, language));
  }
  next();
}
