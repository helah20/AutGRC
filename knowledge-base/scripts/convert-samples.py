#!/usr/bin/env python3
"""Convert a local folder of policy samples to Markdown for the knowledge base.

    python3 scripts/convert-samples.py <source-folder> [output-folder]

The output folder defaults to documents/samples, which git ignores: the
samples are licensed or third-party material and stay on this machine.
Then upload them with:

    ./scripts/ingest-folder.sh documents/samples

What is converted: .docx (paragraphs, headings and tables), .xlsx (every
sheet as a table), .pdf (text layer; scanned PDFs are listed as skipped),
.md and .txt as they are. Personal files are skipped by name (invoices,
exam results, certificates, CVs, IDs), and so is anything matching a
pattern in --skip. Every skipped file is listed with its reason, so
nothing is dropped silently.

Needs: pip install python-docx openpyxl pdfplumber
"""
import argparse
import re
import sys
from pathlib import Path

PERSONAL = re.compile(
    r'invoice|receipt|فاتورة|cisa|exam|result|score|certificate|شهادة|\bcv\b|resume|'
    r'passport|iqama|national.?id|هوية|transcript|payslip|salary|راتب', re.I)
MAX_ROWS = 2000  # per sheet; larger sheets are registers, not guidance


def md_cell(v):
    return str(v if v is not None else '').replace('|', '\\|').replace('\n', '<br>').strip()


def md_table(rows):
    rows = [r for r in rows if any(md_cell(c) for c in r)]
    if not rows:
        return ''
    width = max(len(r) for r in rows)
    rows = [list(r) + [''] * (width - len(r)) for r in rows]
    out = ['| ' + ' | '.join(md_cell(c) for c in rows[0]) + ' |', '|' + ' --- |' * width]
    out += ['| ' + ' | '.join(md_cell(c) for c in r) + ' |' for r in rows[1:]]
    return '\n'.join(out)


def from_docx(path):
    import docx
    from docx.table import Table
    from docx.text.paragraph import Paragraph
    d = docx.Document(path)
    out = []
    # Body order matters: a template's tables sit between its headings.
    for el in d.element.body.iterchildren():
        tag = el.tag.rsplit('}', 1)[-1]
        if tag == 'p':
            p = Paragraph(el, d)
            text = p.text.strip()
            if not text:
                continue
            style = (p.style.name or '').lower() if p.style is not None else ''
            m = re.search(r'heading\s*(\d)', style)
            if m:
                out.append('#' * min(int(m.group(1)) + 1, 6) + ' ' + text)
            elif 'list' in style:
                out.append('- ' + text)
            else:
                out.append(text)
        elif tag == 'tbl':
            t = Table(el, d)
            out.append(md_table([[c.text for c in row.cells] for row in t.rows]))
    return '\n\n'.join(x for x in out if x)


def from_xlsx(path):
    import openpyxl
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    out = []
    for ws in wb.worksheets:
        rows = []
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i >= MAX_ROWS:
                rows.append([f'… truncated after {MAX_ROWS} rows'])
                break
            rows.append(row)
        table = md_table(rows)
        if table:
            out.append(f'## {ws.title}\n\n{table}')
    return '\n\n'.join(out)


def from_pdf(path):
    import pdfplumber
    with pdfplumber.open(path) as pdf:
        pages = [(p.extract_text() or '').strip() for p in pdf.pages]
    text = '\n\n'.join(p for p in pages if p)
    if len(text) < 200:
        raise ValueError('no text layer (scanned); OCR it first')
    return text


CONVERT = {'.docx': from_docx, '.xlsx': from_xlsx, '.xlsm': from_xlsx, '.pdf': from_pdf,
           '.md': lambda p: p.read_text(encoding='utf-8', errors='replace'),
           '.txt': lambda p: p.read_text(encoding='utf-8', errors='replace')}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('source', type=Path)
    ap.add_argument('output', type=Path, nargs='?', default=Path(__file__).resolve().parent.parent / 'documents' / 'samples')
    ap.add_argument('--skip', action='append', default=[], help='extra filename pattern to skip (regex, repeatable)')
    args = ap.parse_args()
    extra = [re.compile(s, re.I) for s in args.skip]
    args.output.mkdir(parents=True, exist_ok=True)

    done, skipped = 0, []
    for path in sorted(args.source.rglob('*')):
        if not path.is_file() or path.name.startswith(('.', '~$')):
            continue
        rel = path.relative_to(args.source)
        if PERSONAL.search(path.name) or any(p.search(path.name) for p in extra):
            skipped.append((rel, 'personal or excluded by name'))
            continue
        conv = CONVERT.get(path.suffix.lower())
        if not conv:
            skipped.append((rel, f'{path.suffix or "no extension"} not converted'))
            continue
        try:
            body = conv(path).strip()
        except Exception as e:  # one unreadable file must not stop the batch
            skipped.append((rel, str(e)[:120]))
            continue
        if not body:
            skipped.append((rel, 'empty'))
            continue
        # The folder path is kept in the name: "STANDARD_x" under English and
        # Arabic folders would otherwise overwrite each other.
        name = re.sub(r'[^\w.\-]+', '_', str(rel.with_suffix('')), flags=re.U)[:150] + '.md'
        header = f'---\nsource: {rel}\n---\n\n# {path.stem}\n\n'
        (args.output / name).write_text(header + body + '\n', encoding='utf-8')
        done += 1

    print(f'Converted {done} file(s) to {args.output}')
    if skipped:
        print(f'Skipped {len(skipped)}:')
        for rel, why in skipped:
            print(f'  - {rel}: {why}')


if __name__ == '__main__':
    sys.exit(main())
