"""DCC-1:2022: the body text uses fonts with no Unicode map, so each table cell
is cropped from a 300 dpi render (cell edges from the PDF's vector rules) and
read with tesseract."""
import json, re, subprocess, sys
import pdfplumber
from PIL import Image

PDF, IMG, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
S = 300 / 72
ID = re.compile(r'\d-\d{1,2}(?:-\d{1,2}){0,2}')
COLS = {'main': (61, 109), 'sub': (110, 152), 'text': (153, 344), 'wide': (110, 344)}


def ocr(img, box, psm=6):
    x0, y0, x1, y1 = box
    crop = img.crop((int(x0 * S) + 3, int(y0 * S) + 3, int(x1 * S) - 3, int(y1 * S) - 3))
    path = f'{IMG}/cell.png'
    crop.save(path)
    out = subprocess.run(['tesseract', path, '-', '-l', 'eng', '--psm', str(psm)],
                         capture_output=True, text=True).stdout
    return ' '.join(out.split())


LEVELS = ['Public', 'Confidential', 'Secret', 'Top Secret']
FREQ = re.compile(r'(?i)(at least|immediately|every|annual|month|year|week|day|hour)')


def level_cells(img, cols, a, b):
    """Per classification column: a frequency text, True for a tick, or None."""
    out = {}
    whole = ocr(img, (cols[0][0], a, cols[-1][1], b))
    if FREQ.search(whole):          # frequency cells are merged across levels
        return {'note': whole}
    for name, (x0, x1) in zip(LEVELS, cols):
        crop = img.crop((int(x0 * S) + 4, int(a * S) + 4, int(x1 * S) - 4, int(b * S) - 4)).convert('L')
        dark = sum(1 for p in crop.tobytes() if p < 110)
        if dark < 25:
            out[name] = None
            continue
        txt = ocr(img, (x0, a, x1, b))
        out[name] = True
    return out


def rule_ys(segs, x0, x1):
    return sorted({round(s['top']) for s in segs if s['x0'] <= x0 + 2 and s['x1'] >= x1 - 2})


def find_id(text, dashes):
    t = text.replace('—', '-').replace('–', '-').replace(' ', '')
    for m in re.finditer(r'\d(?:-?\d{1,2})+', t):
        s = m.group(0)
        if '-' not in s or s.count('-') < dashes:      # OCR dropped hyphens: 3114 -> 3-1-1-4
            s = '-'.join(s.replace('-', ''))
        if s.count('-') == dashes and ID.fullmatch(s):
            return s
    return None


rows, mains, heads = [], [], []
with pdfplumber.open(PDF) as pdf:
    for pg in range(11, 20):
        page = pdf.pages[pg - 1]
        img = Image.open(f'{IMG}/p-{pg:02d}.png')
        segs = [r for r in page.rects + page.lines if (r['bottom'] - r['top']) < 3]
        base = pg * 10_000
        # Column edges move between pages (domain 3 is shifted left), so read them
        # from the rules: main | sub | text, then the classification columns.
        def col(lo0, hi0, lo1, hi1):
            c = [(s['x0'], s['x1']) for s in segs if lo0 <= s['x0'] <= hi0 and lo1 <= s['x1'] <= hi1]
            return (min(a for a, _ in c), max(b for _, b in c)) if c else None
        main = col(53, 63, 102, 112) or (61, 109)
        subc = col(main[1] - 2, main[1] + 3, 144, 156) or (main[1] + 1, 152)
        text = col(subc[1] - 2, subc[1] + 3, 325, 350) or (subc[1] + 1, 336)
        COLS.update(main=main, sub=subc, text=text, wide=(subc[0], text[1]))
        right = text[1]
        ty = rule_ys(segs, text[0] + 6, right - 4)
        lvl_cols = sorted({(s['x0'], s['x1']) for s in segs
                           if s['x0'] >= right - 2 and 30 < s['x1'] - s['x0'] < 70})
        lvl_cols = [c for i, c in enumerate(lvl_cols) if not i or c[0] - lvl_cols[i - 1][0] > 20][:4]
        for a, b in zip(ty, ty[1:]):
            if b - a < 8:
                continue
            main_txt = ocr(img, (COLS['main'][0], a, COLS['main'][1], b))
            low = main_txt.lower()
            sub_id = find_id(ocr(img, (*COLS['sub'][:1], a, COLS['sub'][1], b)), 3)
            wide = ocr(img, (COLS['wide'][0], a, COLS['wide'][1], b))
            sub2 = find_id(main_txt, 1)
            full = lambda: ocr(img, (COLS['wide'][0], a, 540, b))   # headings span the whole table
            if sub2 and len(wide) > 3 and not sub_id:
                heads.append({'y': base + a, 'kind': 'subdomain', 'ref': sub2, 'text': full()})
            elif 'objective' in low or 'objective' in wide.lower()[:12]:
                heads.append({'y': base + a, 'kind': 'objective', 'text': re.sub(r'(?i)^objective\s*', '', full())})
            elif 'classification' in wide.lower() and len(wide) < 80:
                continue
            else:
                text = ocr(img, (COLS['text'][0], a, COLS['text'][1], b)) if sub_id else wide
                row = {'y': base + a, 'yb': base + b, 'ref': sub_id, 'text': text,
                       'levels': level_cells(img, lvl_cols, a, b) if len(lvl_cols) == 4 else {}}
                if not sub_id and len(wide) < 100 and '.' not in wide:
                    row['full'] = full()
                rows.append(row)
        # Main controls: their cell is bounded by rules across the main column.
        my = rule_ys(segs, main[0] + 2, main[1] - 2)
        for a, b in zip(my, my[1:]):
            if b - a < 8:
                continue
            ref = find_id(ocr(img, (COLS['main'][0], a, COLS['main'][1], b)), 2)
            if ref:
                mains.append((base + a, base + b, ref))

# Each main control is the first row of its cell that is not a subcontrol.
for a, b, ref in mains:
    inside = [r for r in rows if a - 2 <= r['y'] < b - 2]
    intro = next((r for r in inside if r['ref'] is None), None)
    if intro is not None:
        intro['ref'] = ref
    else:
        rows.append({'y': a, 'yb': b, 'ref': ref, 'text': ''})

controls, sub, objectives, cur, cur_sub = [], {}, {}, None, None
ordered = sorted(rows + heads, key=lambda r: r['y'])
for i, r in enumerate(ordered):
    kind = r.get('kind', 'row')
    # A heading whose reference OCR could not read: a short unreferenced row
    # with no sentence punctuation, directly above an Objective row.
    nxt = ordered[i + 1] if i + 1 < len(ordered) else {}
    if (kind == 'row' and not r['ref'] and nxt.get('kind') == 'objective' and len(r['text']) < 100
            and '.' not in r['text'] and cur_sub):
        major, minor = cur_sub.split('-')
        r = {'kind': 'subdomain', 'ref': f'{major}-{int(minor) + 1}', 'text': r.get('full') or r['text']}
        kind = 'subdomain'
    if kind == 'subdomain':
        cur_sub, cur = r['ref'], None
        sub[cur_sub] = r['text'].strip('| ')
    elif kind == 'objective':
        objectives[cur_sub] = (objectives.get(cur_sub, '') + ' ' + r['text']).strip()
    elif r['ref']:
        cur = {'ref': r['ref'], 'text': r['text'],
               'levels': {k: v for k, v in (r.get('levels') or {}).items() if v}}
        controls.append(cur)
    elif cur is not None:
        cur['text'] += ' ' + r['text']

fix = lambda t: re.sub(r'\s+', ' ', re.sub(r'(\w)- (\w)', lambda m: m.group(1) + m.group(2)
                                            if m.group(2).islower() else m.group(0), t)).strip()
refs = {c['ref'] for c in controls}
for c in controls:
    # Main controls with subcontrols carry the repeated level header, not ticks.
    if any(r.startswith(c['ref'] + '-') for r in refs) and c['ref'].count('-') == 2:
        c['levels'] = {}
    c['text'] = fix(c['text']).replace(' |', '').replace('| ', '').strip('| ')
json.dump({'controls': controls, 'subdomains': sub, 'objectives': {k: fix(v) for k, v in objectives.items()},
           'domains': {}}, open(OUT, 'w'), ensure_ascii=False, indent=1)
print(len(controls), 'controls', len(sub), 'subdomains')
