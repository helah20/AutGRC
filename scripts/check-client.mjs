#!/usr/bin/env node
/**
 * Static checks the bundler will not catch.
 *
 * Vite happily builds a module that references an undefined identifier: the
 * failure only appears when React renders the component. A page that throws in
 * one language and not the other is exactly the kind of regression a build
 * that says "✓ built" hides, so these run alongside it.
 */

import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..', 'client', 'src');
const files = globSync('**/*.{js,jsx}', { cwd: ROOT }).map((f) => path.join(ROOT, f));

const problems = [];

/** Hooks and helpers that must be imported wherever they are called. */
const MUST_IMPORT = [
  { name: 'useT', use: /\buseT\(\)/, imported: /import\s*\{[^}]*\buseT\b[^}]*\}\s*from/ },
  { name: 'useI18n', use: /\buseI18n\(\)/, imported: /import\s*\{[^}]*\buseI18n\b[^}]*\}\s*from/ },
  { name: 'useLabels', use: /\buseLabels\(\)/, imported: /import\s*\{[^}]*\buseLabels\b[^}]*\}\s*from/ },
  { name: 'useAuth', use: /\buseAuth\(\)/, imported: /import\s*\{[^}]*\buseAuth\b[^}]*\}\s*from/ },
  { name: 'useToast', use: /\buseToast\(\)/, imported: /import\s*\{[^}]*\buseToast\b[^}]*\}\s*from/ },
  { name: 'useFetch', use: /\buseFetch\(/, imported: /import\s*\{[^}]*\buseFetch\b[^}]*\}\s*from/ }
];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);

  for (const { use, imported, name } of MUST_IMPORT) {
    // The module that defines a hook naturally uses it without importing it.
    const defines = new RegExp(`export function ${name}\\b`).test(src);
    if (use.test(src) && !imported.test(src) && !defines) {
      problems.push(`${rel}: calls ${name}() without importing it`);
    }
  }

  // A component that uses `labels.` or `t(` must declare the hook itself:
  // a parent's variable is not in scope in a sibling function.
  const parts = src.split(/\n(?=(?:export default )?function [A-Z]\w*\()/);
  for (const part of parts) {
    const name = part.match(/^(?:export default )?function ([A-Z]\w*)\(/m)?.[1];
    if (!name) continue;
    if (/\blabels\.\w/.test(part) && !/const labels = useLabels\(\)/.test(part)) {
      problems.push(`${rel}: ${name}() uses labels.* but never calls useLabels()`);
    }
    if (/[^.\w]t\(['`]/.test(part) && !/const t = useT\(\)/.test(part) && !/\bt\s*[,}]/.test(part.split('\n')[0] || '')
        && !/const \{[^}]*\bt\b[^}]*\} = useI18n\(\)/.test(part) && !/\bt\s*=/.test(part)) {
      problems.push(`${rel}: ${name}() calls t() but never obtains it`);
    }
  }
}

// ------------------------------------------------------ dictionary checks --
//
// A key present in English and missing in Arabic falls back to English at
// runtime, so the page still works and nobody finds out except the reader. A
// key referenced by a page and absent from English renders its last segment,
// which looks enough like a label to survive review. Neither shows up in a
// build, a test, or a screenshot someone glances at.

const load = async (name) =>
  (await import(pathToFileURL(path.join(ROOT, 'i18n', name)).href)).default;
const en = await load('en.js');
const ar = await load('ar.js');

const PLURAL_CATEGORIES = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);

/** Every dotted path to a string, including the plural-form objects' parents. */
function leafKeys(dict, prefix = '') {
  const out = [];
  for (const [key, value] of Object.entries(dict)) {
    const dotted = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') {
      // A plural entry is keyed by Intl category, which is itself the leaf.
      const categories = Object.keys(value);
      const isPlural = categories.every((c) => PLURAL_CATEGORIES.has(c));
      if (isPlural) out.push(dotted);
      else out.push(...leafKeys(value, dotted));
    } else {
      out.push(dotted);
    }
  }
  return out;
}

const enKeys = new Set(leafKeys(en));
const arKeys = new Set(leafKeys(ar));
for (const key of enKeys) {
  if (!arKeys.has(key)) problems.push(`i18n: "${key}" exists in en.js but not ar.js`);
}
for (const key of arKeys) {
  if (!enKeys.has(key)) problems.push(`i18n: "${key}" exists in ar.js but not en.js`);
}

// Literal t('…') keys only. A computed key cannot be checked here, and a
// template literal is deliberately dynamic.
for (const file of files) {
  const rel = path.relative(ROOT, file);
  if (rel.startsWith('i18n' + path.sep)) continue;
  const src = readFileSync(file, 'utf8');
  for (const match of src.matchAll(/[^.\w]t\(\s*'([A-Za-z][\w.]*)'/g)) {
    if (!enKeys.has(match[1])) problems.push(`${rel}: t('${match[1]}') has no entry in en.js`);
  }
}

if (!problems.length) {
  console.log(`Client checks: ${files.length} file(s), ${enKeys.size} translation key(s), no problems.`);
  process.exit(0);
}
console.error(`Client checks: ${problems.length} problem(s).\n`);
for (const p of problems) console.error(`  - ${p}`);
process.exit(1);
