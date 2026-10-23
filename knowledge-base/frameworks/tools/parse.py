"""Extract the control catalogue from an NCA controls PDF.

Layout shared by the NCA publications: a left column carries subdomain
references, the "Objective"/"Controls" labels and main-control references
(vertically centred against their cell); the body column carries the text, with
sub-control references inline at the start of their first line.
"""
import json, re, sys
from statistics import median
import pdfplumber

ID = re.compile(r'^\d{1,2}[-.]\d{1,2}([-.](?:[PT]|\d{1,2})){0,3}$')
BOILER = re.compile(
    r'(Sharing (Indicator|Notice)|Document [Cc]lassification|TLP: ?White|^Essential Cybersecurity Controls$|'
    r'^Cloud Cybersecurity Controls$|^Critical Systems Cybersecurity Controls|^Operational Technology Cybersecurity Controls|'
    r'^Telework Cybersecurity Controls|Social Media Accounts Cybersecurity Controls|^Data Cybersecurity Controls|'
    r'^Control level$|^L1 L2 L3$|^L[123]( L[123])*$|^\d{1,3}$)')
DOMAIN_HEAD = re.compile(
    r'(\d\s*[-.]?\s*)?(Cybersecurity Governance|Cybersecurity Defen[cs]e|Cybersecurity Resilience|'
    r'Third[- ]Party and Cloud Computing Cybersecurity|Third[- ]Party Cybersecurity|'
    r'Industrial Control Systems \(ICS\) Cybersecurity|ICS Cybersecurity)(\s*\d)?')
ARABIC = re.compile(r'[؀-ۿﭐ-﻿]')


def norm(ref):
    return ref.replace('.', '-').strip('-')


def lines_of(page, body_x, right_max):
    words = [w for w in page.dedupe_chars().extract_words(extra_attrs=['size']) if not ARABIC.search(w['text'])]
    rows = []
    for w in sorted(words, key=lambda w: (w['top'], w['x0'])):
        if rows and abs(rows[-1]['top'] - w['top']) <= 3:
            rows[-1]['words'].append(w)
        else:
            rows.append({'top': w['top'], 'words': [w]})
    # The text column moves between facing pages, so find its left edge here:
    # the x most lines' text starts at, near the configured position.
    from collections import Counter
    starts = Counter()
    for r in rows:
        for w in sorted(r['words'], key=lambda w: w['x0']):
            if body_x - 25 <= w['x0'] <= body_x + 20 and not ID.match(w['text']):
                starts[round(w['x0'])] += 1
                break
    if starts:
        top = starts.most_common(1)[0][1]
        edge = min(x for x, n in starts.items() if n >= max(1, top // 3))
        body_x = edge + 2
    out = []
    for r in rows:
        ws = sorted(r['words'], key=lambda w: w['x0'])
        # Column labels sit left of the text even where the column edge moves.
        label = lambda w: w['text'] in ('Objective', 'objective', 'Controls') and w['x0'] < body_x - 2
        left = [w for w in ws if w['x1'] <= body_x - 4 or label(w)]
        body = [w for w in ws if w['x1'] > body_x - 4 and w['x0'] < right_max and not label(w)]
        lt = ' '.join(w['text'] for w in left)
        bt = ' '.join(w['text'] for w in body)
        if BOILER.search((lt + ' ' + bt).strip()):
            continue
        if not lt and not bt:
            continue
        out.append({'top': r['top'], 'left': lt, 'body': bt,
                    'size': max(w['size'] for w in ws)})
    return out


def parse(pdf_path, body_x, right_max=10_000, first_page=1, last_page=None, gap_factor=1.25, level_cols=None):
    items = []       # body items in reading order
    titles = {}      # subdomain anchor y -> wrapped title lines
    ticks = []       # (global_y, level) for tick marks drawn as vector curves
    anchors = []     # (global_y, kind, value)
    with pdfplumber.open(pdf_path) as pdf:
        pages = pdf.pages[first_page - 1:last_page]
        for pi, page in enumerate(pages):
            base = pi * 10_000
            ls = lines_of(page, body_x, right_max)
            if level_cols:
                # Tick marks are small vector curves in three columns whose x
                # alternates between facing pages, so find the columns per page.
                marks = [c for c in page.curves if c['x0'] > level_cols and c['width'] < 20]
                xs = sorted({round(c['x0']) for c in marks})
                cols = []
                for x in xs:
                    if not cols or x - cols[-1] > 8:
                        cols.append(x)
                if marks:
                    # With fewer than three columns ticked on a page, fall back to
                    # the two known layouts and take the one the marks sit on.
                    if len(cols) != 3:
                        layouts = [(423, 450, 477), (437, 464, 491)]
                        cols = min(layouts, key=lambda L: sum(min(abs(c['x0'] - x) for x in L) for c in marks))
                    for c in marks:
                        i = min(range(3), key=lambda k: abs(c['x0'] - cols[k]))
                        ticks.append((base + (c['top'] + c['bottom']) / 2, f'L{i + 1}'))
            # Horizontal table rules: a rule between two lines is a cell boundary.
            rules = sorted({round(r['top']) for r in page.rects + page.lines
                            if r['width'] > 150 and (r['bottom'] - r['top']) < 4})
            # Line spacing from body text only: reference lines in the left column
            # sit between text lines and would halve the estimate.
            bl = [l for l in ls if l['body'].strip()]
            spacings = [b['top'] - a['top'] for a, b in zip(bl, bl[1:]) if 0 < b['top'] - a['top'] < 30]
            step = median(spacings) if spacings else 15
            prev = None
            heads = [ln['top'] for ln in ls
                     if ln['left'].strip() and ID.match(ln['left'].split()[0])
                     and norm(ln['left'].split()[0]).count('-') == 1]
            for ln in ls:
                y = base + ln['top']
                left = ln['left'].strip()
                # A wrapped subdomain title sits on the lines either side of its reference.
                if (not left and ln['body'] and any(abs(ln['top'] - h) <= 10 for h in heads)
                        and not ID.match(ln['body'].split()[0])):
                    h = min(heads, key=lambda h: abs(ln['top'] - h))
                    titles.setdefault(base + h, []).append((ln['top'], ln['body']))
                    prev = None
                    continue
                if left:
                    first = left.split()[0]
                    if ID.match(first):
                        anchors.append((y, 'id', norm(first), ln['body'] if norm(first).count('-') == 1 else ''))
                        if norm(first).count('-') == 1:      # subdomain heading: title on same line
                            prev = None
                            continue
                    elif first.startswith('Objective'):
                        anchors.append((y, 'objective', None, None))
                    elif first.startswith('Control'):
                        anchors.append((y, 'controls', None, None))
                        prev = None
                    elif re.match(r'^\d$', first) and ln['size'] >= 14:
                        anchors.append((y, 'domain', first, (' '.join(left.split()[1:]) + ' ' + ln['body']).strip()))
                        prev = None
                        continue
                body = ln['body'].strip()
                if not body or re.fullmatch(r'[-\s]*(Cybersecurity Controls)?[-\s]*', body):
                    continue
                # Main-domain headings, which otherwise trail the last control of a page.
                if DOMAIN_HEAD.fullmatch((left + ' ' + body).strip()):
                    prev = None
                    continue
                bw = body.split()
                # A reference alone on its line is centred against a multi-line
                # cell, not the start of one: anchor it like a left-column one.
                if len(bw) == 1 and ID.match(bw[0]) and norm(bw[0]).count('-') >= 2:
                    anchors.append((y, 'id', norm(bw[0]), ''))
                    continue
                inline = norm(bw[0]) if ID.match(bw[0]) and norm(bw[0]).count('-') >= 2 else None
                if inline:
                    body = ' '.join(bw[1:])
                ruled = prev is not None and any(prev['last'] + 2 < r < ln['top'] - 1 for r in rules)
                new = (prev is None or inline or ruled or (ln['top'] - prev['last']) > step * gap_factor
                       or prev['page'] != pi)
                if new:
                    prev = {'page': pi, 'top': y, 'bottom': y, 'last': ln['top'], 'id': inline,
                            'lines': [body]}
                    items.append(prev)
                else:
                    prev['lines'].append(body)
                    prev['bottom'] = y
                    prev['last'] = ln['top']
    fixed = []
    for a in anchors:
        if a[1] == 'id' and a[2].count('-') == 1 and a[0] in titles:
            parts = sorted(titles[a[0]] + [(a[0] % 10_000, a[3])])
            a = (a[0], a[1], a[2], ' '.join(p for _, p in parts if p).strip())
        fixed.append(a)
    fixed += [(y, 'tick', name, None) for y, name in ticks]
    return items, fixed


def build(items, anchors):
    def item_at(y):
        best, dist = None, 1e9
        for it in items:
            if it['top'] - 4 <= y <= it['bottom'] + 4:
                return it
            d = min(abs(y - it['top']), abs(y - it['bottom']))
            if d < dist:
                best, dist = it, d
        return best if dist < 40 else None

    for a in anchors:
        y, kind, val, extra = a
        if kind == 'objective':
            it = item_at(y)
            if it and not it['id']:
                it['role'] = 'objective'
        elif kind == 'id' and val.count('-') >= 2 and val.count('-') <= 3 and not any(i['id'] == val for i in items):
            it = item_at(y)
            if it is None:
                continue
            idx = items.index(it)
            # Walk back over this control's own subcontrols to reach its intro.
            while it['id'] and it['id'].startswith(val + '-') and idx > 0:
                idx -= 1
                it = items[idx]
            if it['id'] is None and it.get('role') != 'objective':
                it['id'] = val
            else:
                items.insert(idx + 1, {'page': it['page'], 'top': y, 'bottom': y, 'id': val, 'lines': []})

    # Ticks: the referenced item whose span holds the mark, else the nearest.
    for y, kind, name, _ in anchors:
        if kind != 'tick':
            continue
        cands = [it for it in items if it['id'] and it['lines']]
        inside = [it for it in cands if it['top'] - 6 <= y <= it['bottom'] + 14]
        pool = inside or [it for it in cands if abs(y - (it['top'] + it['bottom']) / 2) < 40]
        if pool:
            hit = min(pool, key=lambda it: abs(y - (it['top'] + it['bottom'] + 10) / 2))
            hit.setdefault('levels', set()).add(name)

    controls, current = [], None
    sub = {a[2]: a[3] for a in anchors if a[1] == 'id' and a[2].count('-') == 1}
    doms = {a[2]: a[3] for a in anchors if a[1] == 'domain'}
    objectives = {}
    order = sorted([(a[0], 'anchor', a) for a in anchors if a[1] == 'id' and a[2].count('-') == 1]
                   + [(i['top'], 'item', i) for i in items], key=lambda t: t[0])
    cur_sub = None
    for _, kind, obj in order:
        if kind == 'anchor':
            cur_sub = obj[2]
            current = None
            continue
        it = obj
        text = ' '.join(it['lines']).strip()
        if it.get('role') == 'objective':
            if cur_sub:
                objectives[cur_sub] = (objectives.get(cur_sub, '') + ' ' + text).strip()
            continue
        if it['id']:
            current = {'ref': it['id'], 'text': text}
            if it.get('levels'):
                current['levels'] = sorted(it['levels'])
            controls.append(current)
        elif current is not None:
            current['text'] = (current['text'] + ' ' + text).strip()
        elif cur_sub and text:
            objectives[cur_sub] = (objectives.get(cur_sub, '') + ' ' + text).strip()
    # A parent row's cell holds no ticks of its own: marks that landed on it
    # belong to its first subcontrol, which sits directly beneath the intro.
    refs = [c['ref'] for c in controls]
    for c in controls:
        kids = [k for k in controls if k['ref'].startswith(c['ref'] + '-') and k['ref'].count('-') == c['ref'].count('-') + 1]
        if kids and c.get('levels'):
            first = kids[0]
            first['levels'] = sorted(set(first.get('levels', [])) | set(c.pop('levels')))

    def clean(t):
        t = re.sub(r'(\w)- (\w)', lambda m: m.group(1) + m.group(2) if m.group(2).islower() else m.group(0), t)
        return re.sub(r'\s+', ' ', t).strip()
    for c in controls:
        c['text'] = clean(c['text'])
    objectives = {k: clean(re.sub(r'\s*Controls\s*$', '', v)) for k, v in objectives.items()}
    return controls, sub, objectives, doms


if __name__ == '__main__':
    cfg = json.loads(sys.argv[1])
    items, anchors = parse(**cfg['parse'])
    controls, sub, objectives, doms = build(items, anchors)
    json.dump({'controls': controls, 'subdomains': sub, 'objectives': objectives, 'domains': doms},
              open(cfg['out'], 'w'), ensure_ascii=False, indent=1)
    print(cfg['out'], len(controls), 'controls', len(sub), 'subdomains')
