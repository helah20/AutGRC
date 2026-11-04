/**
 * PDF export.
 *
 * Mirrors the Word output: cover page, document control, approval and version
 * tables, contents and body, with running headers and footers. Built with
 * PDFKit so no headless browser is required.
 *
 * Arabic is laid out here rather than left to PDFKit, which shapes Arabic
 * letters correctly (through fontkit) but places the words of a line left to
 * right. Text is wrapped by measured width and each line is drawn from the
 * right edge, word by word, with runs of Latin words and numbers kept in
 * their own order. Tables, lists and boxes are mirrored with it. The Arabic
 * face is IBM Plex Sans Arabic, bundled under the SIL Open Font License, which
 * carries Latin as well so a mixed line reads in one typeface.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { htmlToBlocks, runsToText } from './html-to-blocks.js';
import { exportHeading } from './export-layout.js';
import { lastReviewed, FURNITURE, CLASSIFICATION_AR, CLASSIFICATION_LABEL } from './export-docx.js';
import { bidiRuns, visualOrder, mirrorBrackets, paragraphDirection } from './bidi.js';
import { currentBrand, fitWithin } from './brand.js';
import { arDomainName } from '../knowledge/index.js';

const FONT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../assets/fonts');

// The organisation's colours (services/brand.js), set at the start of each build.
let BRAND = '#1F3A5F';
let ACCENT = '#2E6F9E';
const MUTED = '#6B7C8F';
const INK = '#1C2733';
let LINE = '#C9D4E0';
let LIGHT = '#F2F5F9';

const MARGIN = 56;

const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
const STRONG_LTR = /[A-Za-z0-9]/;

export function buildPdf(data) {
  const { document: doc, sections, org, owner, approver, versions = [], approvals = [] } = data;
  const lang = data.lang === 'ar' ? 'ar' : 'en';
  const rtl = lang === 'ar';
  const L = FURNITURE[lang];
  const brand = data.brand || currentBrand();
  BRAND = `#${brand.primary}`;
  ACCENT = `#${brand.accent}`;
  LINE = `#${brand.border}`;
  LIGHT = `#${brand.light}`;
  const classification = rtl
    ? (CLASSIFICATION_AR[doc.classification] || CLASSIFICATION_AR.internal)
    : (CLASSIFICATION_LABEL[doc.classification] || 'INTERNAL');
  const statusLabel = (s) => L.statusLabel[s] || s;
  const sep = rtl ? '، ' : ', ';

  const pdf = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN + 26, bottom: MARGIN + 26, left: MARGIN, right: MARGIN },
    bufferPages: true,
    info: { Title: `${doc.reference} — ${doc.title}`, Author: org?.org_name || 'AutGRC', Subject: doc.summary || '' }
  });
  if (rtl) {
    pdf.registerFont('ar', path.join(FONT_DIR, 'IBMPlexSansArabic-Regular.ttf'));
    pdf.registerFont('ar-bold', path.join(FONT_DIR, 'IBMPlexSansArabic-Bold.ttf'));
  }
  const FACE = rtl
    ? { regular: 'ar', bold: 'ar-bold', italic: 'ar', code: 'ar' }
    : { regular: 'Helvetica', bold: 'Helvetica-Bold', italic: 'Helvetica-Oblique', code: 'Courier' };

  const chunks = [];
  pdf.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => pdf.on('end', () => resolve(Buffer.concat(chunks))));

  const contentWidth = pdf.page.width - MARGIN * 2;
  const bottomLimit = () => pdf.page.height - MARGIN - 26;
  const ensureSpace = (needed) => { if (pdf.y + needed > bottomLimit()) pdf.addPage(); };

  // ------------------------------------------------------------- writer ---
  // Every piece of text goes through here, so direction is decided once.

  const style = (face = 'regular', size = 9.5, color = INK) => pdf.font(FACE[face]).fontSize(size).fillColor(color);
  const lineHeight = () => pdf.currentLineHeight(true) * (rtl ? 1.45 : 1.15);

  function fitWord(word, width) {
    if (pdf.widthOfString(word) <= width) return [word];
    const pieces = [];
    let piece = '';
    for (const part of word.split(/(?<=-)/)) {
      for (const ch of pdf.widthOfString(part) <= width ? [part] : [...part]) {
        if (piece && pdf.widthOfString(piece + ch) > width) { pieces.push(piece); piece = ch; } else piece += ch;
      }
    }
    if (piece) pieces.push(piece);
    return pieces;
  }

  function wrap(text, width) {
    const lines = [];
    for (const para of String(text ?? '').split('\n')) {
      // A word wider than the box (a long command or path) is broken at its
      // hyphens, then by character, rather than run into the next column.
      const words = para.split(/\s+/).filter(Boolean).flatMap((w) => fitWord(w, width));
      let line = [];
      for (const w of words) {
        if (line.length && pdf.widthOfString([...line, w].join(' ')) > width) { lines.push(line); line = [w]; } else line.push(w);
      }
      lines.push(line);
    }
    return lines;
  }

  /**
   * One line of an Arabic document, laid out by the bidirectional algorithm
   * (services/bidi.js) in the paragraph's direction `base`: runs put in
   * visual order and drawn from the left; a right-to-left run word by word,
   * its brackets mirrored; a left-to-right run (English, numbers) as written.
   * `align` is the layout's: start is the right edge.
   */
  function drawLine(words, x, y, width, align, base = 'rtl') {
    const runs = visualOrder(bidiRuns(words.join(' '), base));
    const widths = runs.map((r) => pdf.widthOfString(r.text));
    const total = widths.reduce((a, b) => a + b, 0);
    let cursor = align === 'center' ? x + (width - total) / 2 : align === 'end' ? x : x + width - total;
    runs.forEach((run, i) => {
      if (run.rtl) {
        // Word by word, the last word leftmost. The shaper reverses a word
        // holding Arabic letters itself; one without (")." after an English
        // term) is reversed here.
        let at = cursor;
        for (const token of mirrorBrackets(run.text).split(/(\s+)/).filter(Boolean).reverse()) {
          const w = pdf.widthOfString(token);
          if (token.trim()) pdf.text(/[\u0590-\u08FF\uFB1D-\uFEFF]/.test(token) ? token : [...token].reverse().join(''), at, y, { lineBreak: false });
          at += w;
        }
      } else if (/[A-Za-z]/.test(run.text)) {
        pdf.text(run.text, cursor, y, { lineBreak: false });
      } else {
        // Digits a character at a time, so no shaper can reverse them.
        let at = cursor;
        for (const ch of run.text) { pdf.text(ch, at, y, { lineBreak: false }); at += pdf.widthOfString(ch); }
      }
      cursor += widths[i];
    });
  }

  /**
   * Write text in a box and return the y below it. `align` is logical: start
   * is the reading start (right in Arabic), end the other side.
   */
  function write(raw, x, y, width, { align = 'start', face, size, color, flow = false, dir } = {}) {
    style(face, size, color);
    // The decision mark ◆ is in neither font: Helvetica's encoding would
    // print it as "%Æ" and the Arabic font as an empty box.
    const text = String(raw ?? '').replace(/\u25C6/g, rtl ? '\u25CA' : '\u2022');
    if (!rtl) {
      const a = align === 'start' ? 'left' : align === 'end' ? 'right' : align;
      pdf.text(String(text ?? ''), x, y, { width, align: a });
      return pdf.y;
    }
    const lh = lineHeight();
    let yy = y;
    // An English paragraph in an Arabic document reads left to right, as Word
    // and the browser read it; its alignment stays the layout's.
    // A line the layout composes (a running header, a reference) can say
    // its direction rather than take it from its first letter.
    const base = dir || paragraphDirection(text);
    for (const line of wrap(text, width)) {
      // Running text may cross a page; text in a table cell is measured first.
      if (flow && yy + lh > bottomLimit()) { pdf.addPage(); yy = pdf.page.margins.top; style(face, size, color); }
      drawLine(line, x, yy, width, align, base);
      yy += lh;
    }
    pdf.y = yy;
    return yy;
  }

  function measure(text, width, { face, size } = {}) {
    style(face, size);
    if (!rtl) return pdf.heightOfString(String(text ?? ''), { width });
    return wrap(text, width).length * lineHeight();
  }

  /** The x of a column, counted from the reading start. */
  const colX = (widths, i) => {
    const before = widths.slice(0, i).reduce((a, b) => a + b, 0);
    return rtl ? MARGIN + contentWidth - before - widths[i] : MARGIN + before;
  };

  // The parts around the content, as the organisation or this export chose
  // them (services/export-layout.js). Every part is on unless turned off.
  const layout = { cover: true, control: true, approvals: true, versions: true, contents: true, numbering: true, ...data.layout };
  const number = (i) => (layout.numbering ? `${i + 1}. ` : '');
  // The first page PDFKit opens is used by whatever comes first.
  let blank = true;
  const startPage = () => { if (!blank) pdf.addPage(); blank = false; };

  // ------------------------------------------------------------- cover ----
  if (layout.cover) {
  blank = false;
  if (brand.logo) {
    const size = fitWithin(brand.logo, 170, 85);
    pdf.image(brand.logo.buffer, (pdf.page.width - size.width) / 2, pdf.y + 20, { width: size.width, height: size.height });
    pdf.y += 20 + size.height;
    pdf.moveDown(2);
  } else {
    pdf.moveDown(6);
  }
  write(rtl ? (org?.org_name || L.organisation) : (org?.org_name || L.organisation).toUpperCase(), MARGIN, pdf.y, contentWidth,
    { align: 'center', face: 'bold', size: 13, color: ACCENT });
  pdf.moveDown(0.3);
  write(rtl ? 'حوكمة الأمن السيبراني' : 'CYBERSECURITY GOVERNANCE', MARGIN, pdf.y, contentWidth, { align: 'center', size: 9, color: MUTED });
  pdf.moveDown(1.2);
  // A short rule in the primary colour between the issuer and the title.
  pdf.moveTo(pdf.page.width / 2 - 40, pdf.y).lineTo(pdf.page.width / 2 + 40, pdf.y).strokeColor(BRAND).lineWidth(2).stroke();
  pdf.moveDown(2);
  write(doc.title, MARGIN, pdf.y, contentWidth, { align: 'center', face: 'bold', size: 26, color: BRAND });
  pdf.moveDown(0.8);
  write(`${doc.reference}   ·   ${L.version} ${doc.version}   ·   ${statusLabel(doc.status)}`, MARGIN, pdf.y, contentWidth,
    { align: 'center', size: 11, color: MUTED, dir: rtl ? 'rtl' : undefined });
  pdf.moveDown(2);
  write(`${rtl ? L.classification : L.classification.toUpperCase()}: ${classification}`, MARGIN, pdf.y, contentWidth,
    { align: 'center', face: 'bold', size: 10, color: BRAND });
  pdf.moveDown(6);
  write(`${L.effective} ${doc.effective_date || L.onApproval}   ·   ${L.nextReview} ${doc.review_date || L.toBeSet}`,
    MARGIN, pdf.y, contentWidth, { align: 'center', size: 9, color: '#8A97A6' });
  }

  // --------------------------------------------------- document control ---
  if (layout.control || layout.approvals || layout.versions) startPage();
  if (layout.control) {
  sectionTitle(L.documentControl);
  keyValueTable([
    [L.title, doc.title],
    [L.reference, doc.reference],
    [L.docType, data.docTypeLabel || L.docTypeLabel?.[doc.doc_type] || (doc.doc_type || '').replace('_', ' ')],
    [L.domain, (rtl && doc.domain_key && arDomainName(doc.domain_key)) || data.domainName || doc.domain_key || '—'],
    [L.version, doc.version],
    [L.status, statusLabel(doc.status)],
    [L.classification, classification],
    [L.owner, owner?.name ? `${owner.name}${owner.job_title ? `${sep}${owner.job_title}` : ''}` : L.notAssigned],
    [L.approver, approver?.name ? `${approver.name}${approver.job_title ? `${sep}${approver.job_title}` : ''}` : L.notAssigned],
    [L.effective, doc.effective_date || L.onApproval],
    // Publication sets the next review a year out (routes/documents.js), so the
    // cycle stated here is the one the platform enforces.
    [L.reviewCycle, L.reviewCycleValue],
    [L.lastReviewed, lastReviewed(approvals) || L.notYetReviewed],
    [L.nextReview, doc.review_date || L.toBeSet],
    [L.issuer, org?.org_name || '—']
  ]);
  pdf.moveDown(1);
  }

  if (layout.approvals) {
  sectionTitle(L.approval);
  dataTable([L.action, L.name, L.role, L.date],
    approvals.length
      ? approvals.map((a) => [L.actionLabel?.[a.action] || a.action, a.actor_name || '—', a.actor_role || '—', (a.created_at || '').slice(0, 10)])
      : [[L.prepared, owner?.name || '—', owner?.job_title || L.documentOwner, (doc.created_at || '').slice(0, 10)],
         [L.reviewed, '', '', ''],
         [L.approved, approver?.name || '', approver?.job_title || L.approverRole, '']],
    [0.18, 0.28, 0.34, 0.2]);
  pdf.moveDown(1);
  }

  if (layout.versions) {
  sectionTitle(L.versionHistory);
  dataTable([L.version, L.date, L.author, L.change],
    versions.length
      ? versions.map((v) => [v.version, (v.created_at || '').slice(0, 10), v.author_name || '—', L.changeLabel[v.change_type] || v.change_note || '—'])
      : [[doc.version, (doc.created_at || '').slice(0, 10), owner?.name || L.documentOwner, L.initialIssue]],
    [0.12, 0.16, 0.24, 0.48]);
  }

  // ------------------------------------------------------------ contents --
  if (layout.contents) {
    startPage();
    sectionTitle(L.contents);
    sections.forEach((s, i) => {
      ensureSpace(18);
      write(`${number(i)}${exportHeading(s.heading, layout.numbering)}`.trim(), MARGIN + 6, pdf.y, contentWidth - 12, { size: 10 });
      pdf.moveDown(0.35);
    });
  }

  // ---------------------------------------------------------------- body --
  startPage();
  sections.forEach((s, i) => {
    if (i > 0) { ensureSpace(80); pdf.moveDown(1); }
    sectionTitle(`${number(i)}${exportHeading(s.heading, layout.numbering)}`);
    renderBlocks(htmlToBlocks(s.body));
  });

  // ------------------------------------------------- headers and footers --
  const range = pdf.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    pdf.switchToPage(i);
    // Writing into the margin areas would otherwise trip PDFKit's automatic
    // page break and append a blank page for every header and footer drawn.
    const savedMargins = { top: pdf.page.margins.top, bottom: pdf.page.margins.bottom };
    pdf.page.margins.top = 0;
    pdf.page.margins.bottom = 0;
    const startX = rtl ? MARGIN + contentWidth * 0.3 : MARGIN;
    const endX = rtl ? MARGIN : MARGIN + contentWidth * 0.7;
    // The cover carries no running header; without a cover every page does.
    if (i !== range.start || !layout.cover) {
      write(`${org?.org_name || L.organisation}  |  ${doc.title}`, startX, MARGIN - 12, contentWidth * 0.7, { size: 7.5, color: MUTED, dir: rtl ? 'rtl' : undefined });
      write(classification, endX, MARGIN - 12, contentWidth * 0.3, { align: 'end', face: 'bold', size: 7.5, color: BRAND });
      pdf.moveTo(MARGIN, MARGIN - 2).lineTo(pdf.page.width - MARGIN, MARGIN - 2).strokeColor(LINE).lineWidth(0.5).stroke();
    }
    const footY = pdf.page.height - MARGIN - 8;
    pdf.moveTo(MARGIN, footY - 8).lineTo(pdf.page.width - MARGIN, footY - 8).strokeColor(LINE).lineWidth(0.5).stroke();
    write(`${doc.reference}  ·  ${L.version} ${doc.version}`, startX, footY, contentWidth * 0.7, { size: 7.5, color: MUTED, dir: rtl ? 'rtl' : undefined });
    write(rtl ? `صفحة ${i - range.start + 1} من ${range.count}` : `Page ${i - range.start + 1} of ${range.count}`,
      endX, footY, contentWidth * 0.3, { align: 'end', size: 7.5, color: MUTED });
    pdf.page.margins.top = savedMargins.top;
    pdf.page.margins.bottom = savedMargins.bottom;
  }

  pdf.end();
  return done;

  // ------------------------------------------------------------ helpers --

  function sectionTitle(text) {
    ensureSpace(48);
    write(text, MARGIN, pdf.y, contentWidth, { face: 'bold', size: 14, color: BRAND });
    pdf.moveDown(0.2);
    pdf.moveTo(MARGIN, pdf.y).lineTo(MARGIN + contentWidth, pdf.y).strokeColor(ACCENT).lineWidth(1).stroke();
    pdf.moveDown(0.6);
  }

  function keyValueTable(rows) {
    const widths = [contentWidth * 0.32, contentWidth * 0.68];
    for (const [k, v] of rows) {
      const text = String(v ?? '—');
      const h = Math.max(measure(text, widths[1] - 16, { size: 9 }) + 10, 22);
      ensureSpace(h);
      const y = pdf.y;
      pdf.rect(colX(widths, 0), y, widths[0], h).fillAndStroke(LIGHT, LINE);
      pdf.rect(colX(widths, 1), y, widths[1], h).strokeColor(LINE).lineWidth(0.5).stroke();
      write(k, colX(widths, 0) + 8, y + 6, widths[0] - 16, { face: 'bold', size: 9, color: BRAND });
      write(text, colX(widths, 1) + 8, y + 6, widths[1] - 16, { size: 9 });
      pdf.y = y + h;
    }
    pdf.moveDown(0.5);
  }

  function dataTable(headers, rows, weights) {
    const w = weights || headers.map(() => 1 / headers.length);
    const widths = w.map((x) => contentWidth * x);

    const drawHeader = () => {
      const h = Math.max(...headers.map((hd, i) => measure(String(hd), widths[i] - 12, { face: 'bold', size: 8.5 })), 12) + 10;
      ensureSpace(h + 20);
      const y = pdf.y;
      pdf.rect(MARGIN, y, contentWidth, h).fillAndStroke(LIGHT, LINE);
      headers.forEach((hd, i) => write(String(hd), colX(widths, i) + 6, y + 5, widths[i] - 12, { face: 'bold', size: 8.5, color: BRAND }));
      pdf.y = y + h;
    };

    drawHeader();
    for (const row of rows) {
      const h = Math.max(...row.map((c, i) => measure(String(c ?? ''), widths[i] - 12, { size: 8.5 })), 12) + 10;
      if (pdf.y + h > bottomLimit()) { pdf.addPage(); drawHeader(); }
      const y = pdf.y;
      pdf.rect(MARGIN, y, contentWidth, h).strokeColor(LINE).lineWidth(0.5).stroke();
      row.forEach((c, i) => write(String(c ?? ''), colX(widths, i) + 6, y + 5, widths[i] - 12, { size: 8.5 }));
      pdf.y = y + h;
    }
    pdf.moveDown(0.6);
  }

  function renderBlocks(blocks) {
    for (const b of blocks) {
      if (b.type === 'heading') {
        ensureSpace(34);
        pdf.moveDown(0.4);
        write(runsToText(b.runs), MARGIN, pdf.y, contentWidth,
          { face: 'bold', size: b.level <= 3 ? 11.5 : 10.5, color: b.level <= 3 ? BRAND : ACCENT });
        pdf.moveDown(0.3);
      } else if (b.type === 'paragraph') {
        renderRuns(b.runs, MARGIN, contentWidth);
        pdf.moveDown(0.45);
      } else if (b.type === 'list') {
        b.items.forEach((item, i) => {
          if (b.plain) {
            // A clause carries its own number; a subclause sits one step in.
            const indent = item.level * 22;
            const text = runsToText(item.runs);
            const width = contentWidth - indent;
            ensureSpace(Math.min(measure(text, width), 120) + 6);
            write(text, rtl ? MARGIN : MARGIN + indent, pdf.y, width, { flow: true });
            pdf.moveDown(0.35);
            return;
          }
          const indent = 14 + item.level * 14;
          const marker = b.ordered ? `${i + 1}.` : '•';
          const text = runsToText(item.runs);
          const width = contentWidth - indent - 16;
          ensureSpace(Math.min(measure(text, width), 120) + 6);
          const y = pdf.y;
          const markerX = rtl ? MARGIN + contentWidth - indent : MARGIN + indent - 12;
          write(marker, markerX, y, 12, { color: ACCENT });
          write(text, rtl ? MARGIN : MARGIN + indent + 4, y, width, { flow: true });
          pdf.moveDown(0.2);
        });
        pdf.moveDown(0.35);
      } else if (b.type === 'table') {
        if (b.caption) {
          write(b.caption, MARGIN, pdf.y, contentWidth, { face: 'italic', size: 8, color: MUTED });
          pdf.moveDown(0.2);
        }
        const headers = (b.head[0] || []).map(runsToText);
        const rows = b.rows.map((r) => r.map(runsToText));
        const weights = b.widths?.length === (headers.length || rows[0]?.length) ? b.widths.map((x) => x / 100) : undefined;
        if (headers.length) dataTable(headers, rows, weights);
        else if (rows.length) dataTable(rows[0].map(() => ''), rows, weights);
      } else if (b.type === 'callout') {
        const text = runsToText(b.runs);
        const inner = contentWidth - 28;
        const th = b.title ? 16 : 0;
        const h = measure(text, inner, { size: 9 }) + 16 + th;
        ensureSpace(h + 10);
        const y = pdf.y;
        pdf.rect(MARGIN, y, contentWidth, h).fill(LIGHT);
        // The accent bar marks the reading start.
        pdf.rect(rtl ? MARGIN + contentWidth - 3 : MARGIN, y, 3, h).fill(ACCENT);
        if (b.title) write(b.title, MARGIN + 14, y + 7, inner, { face: 'bold', size: 9, color: BRAND });
        write(text, MARGIN + 14, y + 7 + th, inner, { size: 9 });
        pdf.y = y + h;
        pdf.moveDown(0.5);
      } else if (b.type === 'rule') {
        ensureSpace(12);
        pdf.moveTo(MARGIN, pdf.y).lineTo(MARGIN + contentWidth, pdf.y).strokeColor(LINE).lineWidth(0.5).stroke();
        pdf.moveDown(0.5);
      }
    }
  }

  function renderRuns(runs, x, width) {
    if (!runs?.length) return;
    // Arabic paragraphs are laid out a line at a time, which cannot change
    // face mid-line; a paragraph that is bold throughout stays bold.
    if (rtl) {
      const allBold = runs.every((r) => r.bold || !r.text.trim());
      write(runsToText(runs), x, pdf.y, width, { face: allBold ? 'bold' : 'regular', flow: true });
      return;
    }
    const estimated = measure(runsToText(runs), width);
    if (pdf.y + estimated > bottomLimit()) pdf.addPage();
    let first = true;
    runs.forEach((r, i) => {
      const font = r.code ? 'Courier' : r.bold && r.italic ? 'Helvetica-BoldOblique' : r.bold ? 'Helvetica-Bold' : r.italic ? 'Helvetica-Oblique' : 'Helvetica';
      pdf.font(font).fontSize(9.5).fillColor(INK);
      pdf.text(r.text, first ? x : undefined, first ? pdf.y : undefined, { width, align: 'justify', continued: i !== runs.length - 1 });
      first = false;
    });
  }
}
