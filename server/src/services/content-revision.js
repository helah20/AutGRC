/**
 * A fingerprint of everything a generated document is built from: every file
 * of the knowledge base (the domain models in both languages, the framework
 * catalogue, the roles) and the document builders. Two documents generated
 * against the same fingerprint read the same; improving any of them changes it,
 * which is how services/refresh.js knows a document is out of date.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE = path.join(HERE, '..', 'knowledge');
const BUILDERS = ['doc-builders.js', 'doc-strings.js', 'regulatory-text.js', 'applicability.js', 'html.js', 'swimlane.js', 'generator.js'];

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? filesUnder(path.join(dir, e.name)) : [path.join(dir, e.name)]))
    .filter((f) => f.endsWith('.js'))
    .sort();
}

let cached = null;

export function contentRevision() {
  if (cached) return cached;
  const hash = crypto.createHash('sha256');
  for (const file of [...filesUnder(KNOWLEDGE), ...BUILDERS.map((f) => path.join(HERE, f))]) {
    try { hash.update(path.basename(file)); hash.update(fs.readFileSync(file)); } catch { /* absent file, nothing to hash */ }
  }
  cached = hash.digest('hex').slice(0, 16);
  return cached;
}
