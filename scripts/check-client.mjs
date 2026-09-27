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

if (!problems.length) {
  console.log(`Client checks: ${files.length} file(s), no problems.`);
  process.exit(0);
}
console.error(`Client checks: ${problems.length} problem(s).\n`);
for (const p of problems) console.error(`  - ${p}`);
process.exit(1);
