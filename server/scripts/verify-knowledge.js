/**
 * Knowledge-base integrity check.
 *
 * Every generated document is a projection of the canonical requirement model,
 * so a defect in the model — a RACI activity with no Accountable role, a
 * control citing a framework reference that does not exist — reaches every
 * document generated from it. This runs the same validator the server runs at
 * boot, but exits non-zero so CI fails on it.
 */

import { validateKnowledgeBase, frameworkCoverage } from '../src/knowledge/index.js';

const problems = validateKnowledgeBase();

// Catalogue completeness is reported, not failed. The catalogue holds
// identifiers compiled for mapping rather than the publications themselves, so
// being short of a published control set is an expected state that the
// organisation resolves by importing its licensed copy — but it has to be able
// to see it, because a Policy citing a subdomain reads exactly like one citing
// the control inside it.
const partial = frameworkCoverage().filter((f) => (f.completeness !== null && f.completeness < 100) || f.groupsWithoutDetail.length);
if (partial.length) {
  console.log('Reference catalogue coverage:\n');
  for (const f of partial) {
    const share = f.completeness === null ? '' : ` — ${f.controls} of ${f.publishedControls} published controls (${f.completeness}%)`;
    console.log(`  ${f.code}${share}`);
    if (f.groupsWithoutDetail.length) {
      console.log(`    ${f.groupsWithoutDetail.length} subdomain(s) carried at heading level only, so a mapping to them cites the heading:`);
      for (const g of f.groupsWithoutDetail) console.log(`      ${g.ref}  ${g.title}`);
    }
  }
  console.log('\n  Import a licensed copy to map at control level (POST /api/frameworks/:code/catalogue).\n');
}

if (!problems.length) {
  console.log('Knowledge base: no integrity problems.');
  process.exit(0);
}

console.error(`Knowledge base: ${problems.length} integrity problem(s).\n`);
for (const problem of problems) console.error(`  - ${problem}`);
process.exit(1);
