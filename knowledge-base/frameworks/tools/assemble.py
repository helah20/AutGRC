import csv, json, re, os, sys
from collections import Counter, defaultdict

FW = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
os.makedirs(f'{OUT}/data', exist_ok=True)
os.makedirs(f'{OUT}/import', exist_ok=True)
os.makedirs(f'{OUT}/markdown', exist_ok=True)

DOMAINS4 = {'1': 'Cybersecurity Governance', '2': 'Cybersecurity Defense', '3': 'Cybersecurity Resilience',
            '4': 'Third-Party and Cloud Computing Cybersecurity'}
DOMAINS3 = {'1': 'Cybersecurity Governance', '2': 'Cybersecurity Defense',
            '3': 'Third-Party and Cloud Computing Cybersecurity'}

META = [
    dict(key='ecc', code='NCA-ECC', abbr='ECC', version='ECC-2:2024', name='Essential Cybersecurity Controls',
         file='ECC--2024-EN.pdf', domains=DOMAINS4, stated=dict(subdomains=28, main=108, sub=92),
         site_version='ECC-1:2018'),
    dict(key='ccc', code='NCA-CCC', abbr='CCC', version='CCC-2:2024', name='Cloud Cybersecurity Controls',
         file='CCC-2-2024-EN-.pdf', domains={**DOMAINS4, '4': 'Third-Party Cybersecurity'},
         stated=dict(subdomains=24, main=55, sub=120), site_version='CCC-1:2020',
         note='Each control is addressed to the cloud service provider (P, CSP) or the cloud service tenant (T, CST): 37 + 18 main controls and 94 + 26 subcontrols.'),
    dict(key='cscc', code='NCA-CSCC', abbr='CSCC', version='CSCC-1:2019', name='Critical Systems Cybersecurity Controls',
         file='Critical-Systems-Cybersecurity-Controls.pdf', domains=DOMAINS4,
         stated=dict(subdomains=21, main=32, sub=73), site_version='CSCC-1:2019'),
    dict(key='dcc', code='NCA-DCC', abbr='DCC', version='DCC-1:2022', name='Data Cybersecurity Controls',
         file='Data-Cybersecurity-Controls-.pdf', domains=DOMAINS3, stated=dict(subdomains=11, main=19, sub=47),
         site_version='DCC-1:2022', ocr=True,
         note='Applicability is stated per data classification level: Public, Confidential, Secret, Top Secret.'),
    dict(key='otcc', code='NCA-OTCC', abbr='OTCC', version='OTCC-1:2022', name='Operational Technology Cybersecurity Controls',
         file='otcc_en.pdf', domains={**DOMAINS4, '4': 'Third-Party and Cloud Computing Cybersecurity'},
         stated=dict(subdomains=23, main=47, sub=122, L1=151, L2=117, L3=56), site_version=None,
         note='Applicability is stated per facility level L1 (high criticality) to L3 (low).'),
    dict(key='tcc', code='NCA-TCC', abbr='TCC', version='TCC-1:2021', name='Telework Cybersecurity Controls',
         file='telework_cybersecurity_controls-en.pdf', domains=DOMAINS3,
         stated=dict(subdomains=16, main=21, sub=42), site_version='TCC-1:2021'),
    dict(key='osmacc', code='NCA-OSMACC', abbr='OSMACC', version='OSMACC-1:2021',
         name="Organizations' Social Media Accounts Cybersecurity Controls", file='osmacc-en.pdf', domains=DOMAINS3,
         stated=dict(subdomains=12, main=15, sub=38), site_version=None),
]

# Corrections read off the page images where extraction cannot be trusted.
SUBDOMAIN_FIX = {
    # The OTCC body repeats the 1-7 title for 1-8; the document's own overview figure names it.
    ('otcc', '1-8'): ('Cybersecurity Awareness and Training Program',
                      'The control table heading repeats "Cybersecurity in Human Resources"; title taken from the OTCC overview figure.'),
}
LEVEL_FIX = {
    ('dcc', '1-1-1'): {'Public': 'At least annually', 'Confidential': 'At least annually', 'Secret': 'At least annually', 'Top Secret': 'At least annually'},
    ('dcc', '1-1-2'): {'Public': 'At least every 2 years', 'Confidential': 'At least every 2 years', 'Secret': 'At least annually', 'Top Secret': 'At least annually'},
    ('dcc', '2-1-3'): {'Public': 'At least annually', 'Confidential': 'At least annually', 'Secret': 'At least every 3 months', 'Top Secret': 'At least every 3 months'},
    ('dcc', '2-2-1-1'): {'Public': 'At least every month', 'Confidential': 'At least every month', 'Secret': 'Immediately', 'Top Secret': 'Immediately'},
    ('dcc', '2-2-1-2'): {'Public': 'At least annually', 'Confidential': 'At least annually', 'Secret': 'At least every 6 months', 'Top Secret': 'At least every 6 months'},
    ('dcc', '2-6-2'): {'Public': 'At least annually', 'Confidential': 'At least annually', 'Secret': 'At least every 6 months', 'Top Secret': 'At least every 6 months'},
    ('dcc', '2-7-4'): {'Public': 'At least every 3 years', 'Confidential': 'At least every 3 years', 'Secret': 'At least annually', 'Top Secret': 'At least annually'},
    ('otcc', '2-9-1-3'): {'L1': 'At least every 3 months', 'L2': 'At least every 6 months', 'L3': 'At least every 12 months'},
    ('otcc', '2-10-1-3'): {'L1': 'At least every 3 months', 'L2': 'At least every 6 months', 'L3': 'At least every 12 months'},
}

# Platform domain (AutGRC DOMAIN_META name) for each NCA subdomain title.
PLATFORM = [
    (r'strategy|cybersecurity management|policies and procedures|roles and responsibilities|compliance with|review and audit|human resources', 'Governance'),
    (r'risk management', 'Risk Management'),
    (r'project management|change management', 'Change Management'),
    (r'awareness', 'Security Awareness'),
    (r'asset management', 'Asset Management'),
    (r'identity and access', 'Identity & Access Management'),
    (r'processing facilities|system and processing', 'Endpoint Security'),
    (r'email', 'Network Security'),
    (r'network', 'Network Security'),
    (r'mobile', 'Endpoint Security'),
    (r'data and information|data disposal|storage media|printers', 'Data Protection'),
    (r'cryptograph|key management', 'Cryptography'),
    (r'backup', 'Backup & Recovery'),
    (r'vulnerab', 'Vulnerability Management'),
    (r'penetration', 'Vulnerability Management'),
    (r'event logs|monitoring', 'Logging & Monitoring'),
    (r'incident', 'Incident Management'),
    (r'physical', 'Physical Security'),
    (r'web application|application security|system development', 'Application Security'),
    (r'business continuity|resilience', 'Business Continuity'),
    (r'third[- ]party', 'Third-Party Security'),
    (r'cloud', 'Cloud Security'),
]


def platform_domain(title):
    t = title.lower()
    for pat, name in PLATFORM:
        if re.search(pat, t):
            return name
    return ''


def depth(ref):
    return len([p for p in ref.split('-') if p not in ('P', 'T')])


def parent_of(ref):
    parts = ref.split('-')
    parts = parts[:-1]
    if parts and parts[-1] in ('P', 'T'):
        parts = parts[:-1]
    return '-'.join(parts)


REFS = r'(\d+[-.]\d+(?:[-.]\d+){0,2}(?:\s*(?:,|and)\s*\d+[-.]\d+(?:[-.]\d+){0,2})*)'
ECC_REF = re.compile(
    r'ECC(?:[- ]?1: ?2018)?\s+(?:sub-?controls?|controls?|sub-?domains?)(?:\s+within\s+controls?)?\s+' + REFS
    + r'|(?:sub-?controls?|controls?|sub-?domains?)\s+' + REFS + r'\s+in\s+(?:the\s+)?ECC', re.I)

catalogue = []
for m in META:
    d = json.load(open(f'{FW}/out/{m["key"]}.json'))
    subs = {}
    for ref, title in d['subdomains'].items():
        note = None
        if (m['key'], ref) in SUBDOMAIN_FIX:
            title, note = SUBDOMAIN_FIX[(m['key'], ref)]
        subs[ref] = {'ref': ref, 'title': title.strip(), 'objective': d['objectives'].get(ref, ''),
                     'domain': ref.split('-')[0], 'note': note}
    controls = []
    for c in d['controls']:
        ref = c['ref']
        # References broken across lines: "ECC control 1- 9-3" -> "1-9-3".
        c['text'] = re.sub(r'(\d)-\s+(\d)', r'\1-\2', c['text'])
        # A reference running into the next word: "4-1-2 and 4-1cybersecurity".
        c['text'] = re.sub(r'(\d)([a-z]{3,})', r'\1 \2', c['text'])
        sd = '-'.join(ref.split('-')[:2])
        levels = c.get('levels')
        if isinstance(levels, list):
            levels = {l: True for l in levels}
        if (m['key'], ref) in LEVEL_FIX:
            levels = LEVEL_FIX[(m['key'], ref)]
        if levels and 'note' in levels:
            levels = None
        ecc_refs = []
        if m['key'] != 'ecc':
            for m_ in ECC_REF.finditer(c['text']):
                grp = m_.group(1) or m_.group(2)
                ecc_refs += [r.replace('.', '-') for r in re.findall(r'\d+[-.]\d+(?:[-.]\d+){0,2}', grp)]
        audience = {'P': 'CSP', 'T': 'CST'}.get(ref.split('-')[2] if m['key'] == 'ccc' and len(ref.split('-')) > 2 else '', None)
        controls.append({'ref': ref, 'kind': 'main' if depth(ref) == 3 else 'sub', 'parent': parent_of(ref),
                         'subdomain': sd, 'domain': ref.split('-')[0], 'text': c['text'],
                         **({'applicability': levels} if levels else {}),
                         **({'audience': audience} if audience else {}),
                         **({'ecc_refs': sorted(set(ecc_refs))} if ecc_refs else {})})
    mains = sum(1 for c in controls if c['kind'] == 'main')
    catalogue.append({**{k: v for k, v in m.items() if k not in ('key', 'domains')}, 'id': m['key'],
                      'domains': {k: v for k, v in m['domains'].items() if any(s['domain'] == k for s in subs.values())},
                      'extracted': dict(subdomains=len(subs), main=mains, sub=len(controls) - mains),
                      'subdomains': list(subs.values()), 'controls': controls})

updates = json.load(open(f'{FW}/out/ecc_updates.json'))
json.dump({'source': 'NCA publications in the "Frameworks" Google Drive folder, extracted with pdfplumber (DCC by OCR).',
           'frameworks': catalogue, 'ecc_2018_to_2024_updates': updates},
          open(f'{OUT}/data/nca-frameworks.json', 'w'), ensure_ascii=False, indent=1)

# ---- site import files (publisher layout read by server/src/services/import-framework.js)
for fw in catalogue:
    subs = {s['ref']: s for s in fw['subdomains']}
    with open(f'{OUT}/import/{fw["code"]}_{fw["version"].replace(":", "_")}.csv', 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        w.writerow(['Reference', 'Title', 'Statement', 'Domain', 'Parent', 'Level', 'NCA Domain', 'Applicability'])
        for dn, dname in fw['domains'].items():
            w.writerow([dn, dname, '', '', '', 1, dname, ''])
        for s in fw['subdomains']:
            w.writerow([s['ref'], s['title'], s['objective'], platform_domain(s['title']), s['domain'], 2,
                        fw['domains'].get(s['domain'], ''), ''])
        for c in fw['controls']:
            app = c.get('applicability') or {}
            app_txt = '; '.join(k if v is True else f'{k}: {v}' for k, v in app.items())
            if c.get('audience'):
                app_txt = (c['audience'] + ('; ' + app_txt if app_txt else ''))
            st = subs.get(c['subdomain'], {}).get('title', '')
            w.writerow([c['ref'], '', c['text'], platform_domain(st), c['parent'], 3 if c['kind'] == 'main' else 4,
                        fw['domains'].get(c['domain'], ''), app_txt])

# ---- markdown for the n8n knowledge base: one file per framework, one section per subdomain
for fw in catalogue:
    L = [f'# {fw["name"]} ({fw["version"]})', '',
         f'Publisher: National Cybersecurity Authority (NCA), Saudi Arabia. Source file: {fw["file"]}.', '']
    if fw.get('note'):
        L += [fw['note'], '']
    for dn, dname in fw['domains'].items():
        L += [f'## {fw["abbr"]} domain {dn}: {dname}', '']
        for s in [s for s in fw['subdomains'] if s['domain'] == dn]:
            L += [f'### {fw["abbr"]} {s["ref"]} {s["title"]}', '']
            if s['objective']:
                L += [f'Objective: {s["objective"]}', '']
            for c in [c for c in fw['controls'] if c['subdomain'] == s['ref']]:
                extra = []
                if c.get('audience'):
                    extra.append('applies to ' + c['audience'])
                if c.get('applicability'):
                    extra.append('applicability: ' + ', '.join(k if v is True else f'{k} ({v})' for k, v in c['applicability'].items()))
                tail = f' [{"; ".join(extra)}]' if extra else ''
                indent = '' if c['kind'] == 'main' else '  '
                L.append(f'{indent}- **{fw["abbr"]} {c["ref"]}**: {c["text"]}{tail}')
            L.append('')
    open(f'{OUT}/markdown/{fw["id"]}.md', 'w').write('\n'.join(L))

U = ['# ECC: changes from ECC-1:2018 to ECC-2:2024', '',
     'Source: Appendix (C) "List of Updates" of ECC-2:2024.', '',
     '| Type | Section | Previous text (2018) | Updated text (2024) | Rationale |', '|---|---|---|---|---|']
for u in updates:
    U.append('| ' + ' | '.join((u[k] or '—').replace('|', '/') for k in ('type', 'section', 'previous', 'updated', 'rationale')) + ' |')
open(f'{OUT}/markdown/ecc-2018-to-2024-changes.md', 'w').write('\n'.join(U) + '\n')

# ---- comparison with the site's catalogue
site = json.load(open(f'{FW}/out/site.json'))
site_refs = json.load(open(f'{FW}/out/site_reqrefs.json'))
by_code = {fw['code']: fw for fw in catalogue}
report = {'per_framework': {}, 'site_model_refs': {}, 'cross_refs': []}
for fw in catalogue:
    real = {c['ref'] for c in fw['controls']} | {s['ref'] for s in fw['subdomains']} | set(fw['domains'])
    srows = site['requirements'].get(fw['code'], [])
    sref = {r['ref'] for r in srows}
    title_mismatch = []
    realsub = {s['ref']: s['title'] for s in fw['subdomains']}
    for r in srows:
        if r['level'] == 2 and r['ref'] in realsub:
            a = re.sub(r'[^a-z]', '', r['title'].lower()); b = re.sub(r'[^a-z]', '', realsub[r['ref']].lower())
            if a != b and a not in b and b not in a:
                title_mismatch.append((r['ref'], r['title'], realsub[r['ref']]))
    report['per_framework'][fw['code']] = {
        'site_version': next((f['version'] for f in site['frameworks'] if f['code'] == fw['code']), None),
        'file_version': fw['version'],
        'site_rows': len(srows), 'real_rows': len(real),
        'site_controls': sum(1 for r in srows if r['level'] >= 3),
        'real_controls': len(fw['controls']),
        'site_refs_not_in_publication': sorted(sref - real, key=lambda x: [int(p) if p.isdigit() else 0 for p in x.split('-')]),
        'subdomain_title_mismatch': title_mismatch}
    used = [x for x in site_refs if x['fw'] == fw['code']]
    bad = sorted({x['ref'] for x in used if x['ref'] not in real})
    report['site_model_refs'][fw['code']] = {'refs_used': len(used), 'distinct': len({x['ref'] for x in used}),
                                             'not_in_publication': bad,
                                             'requirements_affected': sorted({f"{x['domain']}/{x['req']}" for x in used if x['ref'] in bad})}

ecc_real = {c['ref'] for c in by_code['NCA-ECC']['controls']} | {s['ref'] for s in by_code['NCA-ECC']['subdomains']}
changed = {}
for u in updates:
    m = re.search(r'(\d+-\d+(?:-\d+){0,2})', u['section'])
    if m:
        changed[m.group(1)] = 'Objective' if u['section'].startswith('Objective') else u['type']
for fw in catalogue:
    for c in fw['controls']:
        for r in c.get('ecc_refs', []):
            status = 'deleted in ECC-2:2024' if changed.get(r) == 'Deletion' else (
                'objective modified in ECC-2:2024' if changed.get(r) == 'Objective' else
                'modified in ECC-2:2024' if changed.get(r) == 'Modification' else (
                    'not in ECC-2:2024' if r not in ecc_real else 'unchanged'))
            if r.startswith('5-'):
                status = 'domain 5 moved to OTCC'
            report['cross_refs'].append({'framework': fw['abbr'], 'control': c['ref'], 'ecc_ref': r, 'status': status})
# Site requirements that cite ECC refs touched by the 2024 update.
eu = [x for x in site_refs if x['fw'] == 'NCA-ECC' and (x['ref'] in changed or x['ref'].startswith('5'))]
report['site_ecc_refs_touched_by_2024'] = sorted({(x['ref'], changed.get(x['ref'], 'Deletion (domain 5)'), f"{x['domain']}/{x['req']}") for x in eu})
json.dump(report, open(f'{FW}/out/report.json', 'w'), ensure_ascii=False, indent=1, default=list)

for fw in catalogue:
    print(f"{fw['abbr']:7} stated {fw['stated']}  extracted {fw['extracted']}")
print(json.dumps({k: {kk: (vv if not isinstance(vv, list) or len(vv) < 12 else vv[:12] + ['…']) for kk, vv in v.items()} for k, v in report['per_framework'].items()}, ensure_ascii=False, indent=1))
print(json.dumps(report['site_model_refs'], ensure_ascii=False, indent=1))
print(Counter(x['status'] for x in report['cross_refs']))
print([x for x in report['cross_refs'] if x['status'] != 'unchanged'])
print(report['site_ecc_refs_touched_by_2024'])
