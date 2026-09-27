/**
 * Knowledge-base integrity check.
 *
 * Every generated document is a projection of the canonical requirement model,
 * so a defect in the model — a RACI activity with no Accountable role, a
 * control citing a framework reference that does not exist — reaches every
 * document generated from it. This runs the same validator the server runs at
 * boot, but exits non-zero so CI fails on it.
 */

import { validateKnowledgeBase } from '../src/knowledge/index.js';

const problems = validateKnowledgeBase();

if (!problems.length) {
  console.log('Knowledge base: no integrity problems.');
  process.exit(0);
}

console.error(`Knowledge base: ${problems.length} integrity problem(s).\n`);
for (const problem of problems) console.error(`  - ${problem}`);
process.exit(1);
