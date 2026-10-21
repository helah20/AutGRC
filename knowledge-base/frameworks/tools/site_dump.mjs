import { FRAMEWORKS, REQUIREMENTS, CROSSWALKS } from '../../../server/src/knowledge/frameworks.js';
const out = { frameworks: FRAMEWORKS.map(f => ({ code: f.code, version: f.version, publishedControls: f.publishedControls })),
  requirements: Object.fromEntries(Object.entries(REQUIREMENTS).filter(([k]) => k.startsWith('NCA')).map(([k, v]) => [k, v.map(r => ({ ref: r[0], title: r[1], domain: r[2], level: r[3], parent: r[4] }))])),
  crosswalks: CROSSWALKS.filter(c => c[0].startsWith('NCA') || c[2].startsWith('NCA')) };
console.log(JSON.stringify(out));
