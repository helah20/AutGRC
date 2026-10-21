"""Expand the third-party ISO 27001 -> NCA mapping workbook into reference pairs and
check each against the parsed publications (data/nca-frameworks.json) and the site
catalogue. Run from the repository root. Prints refs the publications do not contain."""
import openpyxl, json, re, sys, subprocess
xl, data, out = sys.argv[1:4]
ws = openpyxl.load_workbook(xl, data_only=True).active
nca = {f['code']: f for f in json.load(open(data))['frameworks']}
pub = {}
for code, f in nca.items():
    pub[code] = {s['ref'] for s in f['subdomains']} | {c['ref'] for c in f['controls']} | set(f['domains'])
site = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
  "import {REQUIREMENTS,CROSSWALKS} from './server/src/knowledge/frameworks.js';console.log(JSON.stringify({R:Object.fromEntries(Object.entries(REQUIREMENTS).map(([k,v])=>[k,v.map(r=>[r[0],r[1]])])),X:CROSSWALKS}))"]))
COLS = {2: 'NCA-ECC', 3: 'NCA-CSCC', 4: 'NCA-CCC', 5: 'NCA-TCC', 6: 'NCA-OSMACC', 7: 'NCA-DCC'}

def expand(cell):
    s = str(cell or '').replace('\n', ',').replace('\t', ' ').replace('*', '')
    if s.strip() in ('NA', 'None', ''): return []
    refs = []
    for tok in re.findall(r'\d+(?:-[\dT]+)+(?:\s*\|\s*,?\s*\d+)?', s):
        tok = re.sub(r'\s|,', '', tok)
        if '|' in tok:
            base, hi = tok.split('|')
            head, lo = base.rsplit('-', 1)
            refs += [f'{head}-{i}' for i in range(int(lo), int(hi) + 1)]
        else:
            refs.append(tok.rstrip('-'))
    return refs

def ancestor(code, ref):
    have = {r[0] for r in site['R'].get(code, [])}
    parts = ref.split('-')
    while parts:
        r = '-'.join(parts)
        if r in have: return r
        parts = parts[:-1]
    return None

rows, bad = [], []
for r in ws.iter_rows(min_row=2, values_only=True):
    if r[1] is None: continue
    iso = str(r[1]).strip()
    iso = iso if iso.startswith('A.') else iso
    for col, code in COLS.items():
        for ref in expand(r[col]):
            ok = ref in pub[code]
            if not ok: bad.append((iso, code, ref))
            rows.append({'iso': iso, 'code': code, 'ref': ref, 'published': ok, 'site': ancestor(code, ref)})
json.dump({'rows': rows, 'bad': bad}, open(out, 'w'), indent=1)
print(len(rows), 'pairs;', len(bad), 'refs not in the publication')
for b in bad: print('  ', b)
