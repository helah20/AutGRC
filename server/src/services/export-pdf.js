/**
 * PDF export.
 *
 * Mirrors the Word output: cover page, document control, approval and version
 * tables, contents, body and references, with running headers and footers.
 * Built with PDFKit so no headless browser is required.
 */

import PDFDocument from 'pdfkit';
import { htmlToBlocks, runsToText } from './html-to-blocks.js';

const BRAND = '#1F3A5F';
const ACCENT = '#2E6F9E';
const MUTED = '#6B7C8F';
const LINE = '#C9D4E0';
const LIGHT = '#F2F5F9';

const MARGIN = 56;
const CLASSIFICATION_LABEL = {
  public: 'PUBLIC', internal: 'INTERNAL', confidential: 'CONFIDENTIAL',
  secret: 'SECRET', top_secret: 'TOP SECRET'
};
const STATUS_LABEL = {
  draft: 'Draft', under_review: 'Under Review', approved: 'Approved',
  published: 'Published', under_revision: 'Under Revision', retired: 'Retired'
};

export function buildPdf(data) {
  const { document: doc, sections, org, owner, approver, versions = [], approvals = [], frameworks = [] } = data;
  const classification = CLASSIFICATION_LABEL[doc.classification] || 'INTERNAL';

  const pdf = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN + 26, bottom: MARGIN + 26, left: MARGIN, right: MARGIN },
    bufferPages: true,
    info: { Title: `${doc.reference} — ${doc.title}`, Author: org?.org_name || 'AutGRC', Subject: doc.summary || '' }
  });

  const chunks = [];
  pdf.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => pdf.on('end', () => resolve(Buffer.concat(chunks))));

  const contentWidth = pdf.page.width - MARGIN * 2;
  const bottomLimit = () => pdf.page.height - MARGIN - 26;

  const ensureSpace = (needed) => {
    if (pdf.y + needed > bottomLimit()) pdf.addPage();
  };

  // ------------------------------------------------------------- cover ----
  pdf.moveDown(6);
  pdf.font('Helvetica-Bold').fontSize(13).fillColor(ACCENT)
    .text((org?.org_name || 'Organisation').toUpperCase(), { align: 'center', characterSpacing: 2 });
  pdf.moveDown(0.3);
  pdf.font('Helvetica').fontSize(9).fillColor(MUTED)
    .text('CYBERSECURITY GOVERNANCE', { align: 'center', characterSpacing: 3 });
  pdf.moveDown(3);
  pdf.font('Helvetica-Bold').fontSize(26).fillColor(BRAND).text(doc.title, { align: 'center' });
  pdf.moveDown(0.8);
  pdf.font('Helvetica').fontSize(11).fillColor(MUTED)
    .text(`${doc.reference}   ·   Version ${doc.version}   ·   ${STATUS_LABEL[doc.status] || doc.status}`, { align: 'center' });
  pdf.moveDown(2);
  pdf.font('Helvetica-Bold').fontSize(10).fillColor(BRAND)
    .text(`CLASSIFICATION: ${classification}`, { align: 'center' });
  pdf.moveDown(6);
  pdf.font('Helvetica').fontSize(9).fillColor('#8A97A6')
    .text(`Effective ${doc.effective_date || 'on approval'}   ·   Next review ${doc.review_date || 'to be set'}`, { align: 'center' });

  // --------------------------------------------------- document control ---
  pdf.addPage();
  sectionTitle('Document Control');
  keyValueTable([
    ['Document title', doc.title],
    ['Document reference', doc.reference],
    ['Document type', (doc.doc_type || '').replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())],
    ['Domain', data.domainName || doc.domain_key],
    ['Version', doc.version],
    ['Status', STATUS_LABEL[doc.status] || doc.status],
    ['Classification', classification],
    ['Document owner', owner?.name ? `${owner.name}${owner.job_title ? `, ${owner.job_title}` : ''}` : 'Not assigned'],
    ['Approver', approver?.name ? `${approver.name}${approver.job_title ? `, ${approver.job_title}` : ''}` : 'Not assigned'],
    ['Effective date', doc.effective_date || 'On approval'],
    ['Next review date', doc.review_date || 'To be set'],
    ['Issuing organisation', org?.org_name || '—']
  ]);

  pdf.moveDown(1);
  sectionTitle('Approval');
  dataTable(['Action', 'Name', 'Role', 'Date'],
    approvals.length
      ? approvals.map((a) => [a.action, a.actor_name || '—', a.actor_role || '—', (a.created_at || '').slice(0, 10)])
      : [['Prepared', owner?.name || '—', owner?.job_title || 'Document Owner', (doc.created_at || '').slice(0, 10)],
         ['Reviewed', '', '', ''],
         ['Approved', approver?.name || '', approver?.job_title || 'Approver', '']],
    [0.18, 0.28, 0.34, 0.2]);

  pdf.moveDown(1);
  sectionTitle('Version History');
  dataTable(['Version', 'Date', 'Author', 'Change'],
    versions.length
      ? versions.map((v) => [v.version, (v.created_at || '').slice(0, 10), v.author_name || '—', v.change_note || '—'])
      : [[doc.version, (doc.created_at || '').slice(0, 10), 'Generation engine', 'Initial issue']],
    [0.12, 0.16, 0.24, 0.48]);

  // ------------------------------------------------------------ contents --
  pdf.addPage();
  sectionTitle('Contents');
  pdf.font('Helvetica').fontSize(10).fillColor('#1C2733');
  sections.forEach((s, i) => {
    ensureSpace(18);
    const label = `${i + 1}.  ${s.heading}`;
    pdf.text(label, MARGIN + 6, pdf.y, { continued: false });
    pdf.moveDown(0.35);
  });

  // ---------------------------------------------------------------- body --
  pdf.addPage();
  sections.forEach((s, i) => {
    if (i > 0) { ensureSpace(80); pdf.moveDown(1); }
    sectionTitle(`${i + 1}. ${s.heading}`);
    renderBlocks(htmlToBlocks(s.body));
  });

  if (frameworks.length) {
    pdf.addPage();
    sectionTitle('Authoritative Sources');
    dataTable(['Source', 'Publisher', 'Version', 'Type'],
      frameworks.map((f) => [f.name, f.publisher || '—', f.version || '—', f.kind === 'regulation' ? 'Regulatory' : 'Framework']),
      [0.38, 0.28, 0.16, 0.18]);
    pdf.moveDown(0.8);
    pdf.font('Helvetica-Oblique').fontSize(8).fillColor(MUTED).text(
      'Framework references identify the authoritative requirements this document is designed to address. They are reproduced as reference metadata and must be verified against the official publication before being relied upon for regulatory attestation.',
      { width: contentWidth, align: 'justify' }
    );
  }

  // ------------------------------------------------- headers and footers --
  const range = pdf.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    pdf.switchToPage(i);
    // Writing into the margin areas would otherwise trip PDFKit's automatic
    // page break and append a blank page for every header and footer drawn.
    const savedMargins = { top: pdf.page.margins.top, bottom: pdf.page.margins.bottom };
    pdf.page.margins.top = 0;
    pdf.page.margins.bottom = 0;
    const isCover = i === range.start;
    if (!isCover) {
      pdf.font('Helvetica').fontSize(7.5).fillColor(MUTED);
      pdf.text(`${org?.org_name || 'Organisation'}  |  ${doc.title}`, MARGIN, MARGIN - 12, { width: contentWidth * 0.7, lineBreak: false });
      pdf.font('Helvetica-Bold').fillColor(BRAND)
        .text(classification, MARGIN + contentWidth * 0.7, MARGIN - 12, { width: contentWidth * 0.3, align: 'right', lineBreak: false });
      pdf.moveTo(MARGIN, MARGIN - 2).lineTo(pdf.page.width - MARGIN, MARGIN - 2).strokeColor(LINE).lineWidth(0.5).stroke();
    }
    const footY = pdf.page.height - MARGIN - 8;
    pdf.moveTo(MARGIN, footY - 8).lineTo(pdf.page.width - MARGIN, footY - 8).strokeColor(LINE).lineWidth(0.5).stroke();
    pdf.font('Helvetica').fontSize(7.5).fillColor(MUTED);
    pdf.text(`${doc.reference}  ·  Version ${doc.version}`, MARGIN, footY, { width: contentWidth * 0.7, lineBreak: false });
    pdf.text(`Page ${i - range.start + 1} of ${range.count}`, MARGIN + contentWidth * 0.7, footY, { width: contentWidth * 0.3, align: 'right', lineBreak: false });
    pdf.page.margins.top = savedMargins.top;
    pdf.page.margins.bottom = savedMargins.bottom;
  }

  pdf.end();
  return done;

  // ------------------------------------------------------------ helpers --

  function sectionTitle(text) {
    ensureSpace(48);
    pdf.font('Helvetica-Bold').fontSize(14).fillColor(BRAND).text(text, MARGIN, pdf.y, { width: contentWidth });
    pdf.moveDown(0.2);
    pdf.moveTo(MARGIN, pdf.y).lineTo(MARGIN + contentWidth, pdf.y).strokeColor(ACCENT).lineWidth(1).stroke();
    pdf.moveDown(0.6);
  }

  function keyValueTable(rows) {
    const keyW = contentWidth * 0.32;
    const valW = contentWidth * 0.68;
    for (const [k, v] of rows) {
      const text = String(v ?? '—');
      pdf.font('Helvetica').fontSize(9);
      const hv = pdf.heightOfString(text, { width: valW - 16 });
      const h = Math.max(hv + 10, 22);
      ensureSpace(h);
      const y = pdf.y;
      pdf.rect(MARGIN, y, keyW, h).fillAndStroke(LIGHT, LINE);
      pdf.rect(MARGIN + keyW, y, valW, h).strokeColor(LINE).lineWidth(0.5).stroke();
      pdf.font('Helvetica-Bold').fontSize(9).fillColor(BRAND).text(k, MARGIN + 8, y + 6, { width: keyW - 16 });
      pdf.font('Helvetica').fontSize(9).fillColor('#1C2733').text(text, MARGIN + keyW + 8, y + 6, { width: valW - 16 });
      pdf.y = y + h;
    }
    pdf.moveDown(0.5);
  }

  function dataTable(headers, rows, weights) {
    const w = weights || headers.map(() => 1 / headers.length);
    const widths = w.map((x) => contentWidth * x);

    const drawHeader = () => {
      const h = 22;
      ensureSpace(h + 20);
      const y = pdf.y;
      pdf.rect(MARGIN, y, contentWidth, h).fillAndStroke(LIGHT, LINE);
      let x = MARGIN;
      pdf.font('Helvetica-Bold').fontSize(8.5).fillColor(BRAND);
      headers.forEach((hd, i) => {
        pdf.text(String(hd), x + 6, y + 7, { width: widths[i] - 12, lineBreak: false, ellipsis: true });
        x += widths[i];
      });
      pdf.y = y + h;
    };

    drawHeader();
    for (const row of rows) {
      pdf.font('Helvetica').fontSize(8.5);
      const cellHeights = row.map((c, i) => pdf.heightOfString(String(c ?? ''), { width: widths[i] - 12 }));
      const h = Math.max(...cellHeights, 12) + 10;
      if (pdf.y + h > bottomLimit()) { pdf.addPage(); drawHeader(); }
      const y = pdf.y;
      pdf.rect(MARGIN, y, contentWidth, h).strokeColor(LINE).lineWidth(0.5).stroke();
      let x = MARGIN;
      pdf.fillColor('#1C2733');
      row.forEach((c, i) => {
        pdf.text(String(c ?? ''), x + 6, y + 5, { width: widths[i] - 12 });
        x += widths[i];
      });
      pdf.y = y + h;
    }
    pdf.moveDown(0.6);
  }

  function renderBlocks(blocks) {
    for (const b of blocks) {
      if (b.type === 'heading') {
        ensureSpace(34);
        pdf.moveDown(0.4);
        pdf.font('Helvetica-Bold').fontSize(b.level <= 3 ? 11.5 : 10.5).fillColor(b.level <= 3 ? BRAND : ACCENT)
          .text(runsToText(b.runs), MARGIN, pdf.y, { width: contentWidth });
        pdf.moveDown(0.3);
      } else if (b.type === 'paragraph') {
        renderRuns(b.runs, MARGIN, contentWidth);
        pdf.moveDown(0.45);
      } else if (b.type === 'list') {
        b.items.forEach((item, i) => {
          const indent = 14 + item.level * 14;
          const marker = b.ordered ? `${i + 1}.` : '•';
          const text = runsToText(item.runs);
          pdf.font('Helvetica').fontSize(9.5);
          const h = pdf.heightOfString(text, { width: contentWidth - indent - 16 });
          ensureSpace(h + 6);
          const y = pdf.y;
          pdf.fillColor(ACCENT).text(marker, MARGIN + indent - 12, y, { width: 12, lineBreak: false });
          pdf.fillColor('#1C2733').text(text, MARGIN + indent + 4, y, { width: contentWidth - indent - 16 });
          pdf.moveDown(0.2);
        });
        pdf.moveDown(0.35);
      } else if (b.type === 'table') {
        if (b.caption) {
          pdf.font('Helvetica-Oblique').fontSize(8).fillColor(MUTED).text(b.caption, MARGIN, pdf.y, { width: contentWidth });
          pdf.moveDown(0.2);
        }
        const headers = (b.head[0] || []).map(runsToText);
        const rows = b.rows.map((r) => r.map(runsToText));
        if (headers.length) dataTable(headers, rows);
        else if (rows.length) dataTable(rows[0].map(() => ''), rows);
      } else if (b.type === 'callout') {
        const text = runsToText(b.runs);
        pdf.font('Helvetica').fontSize(9);
        const inner = contentWidth - 28;
        const th = b.title ? 14 : 0;
        const h = pdf.heightOfString(text, { width: inner }) + 16 + th;
        ensureSpace(h + 10);
        const y = pdf.y;
        pdf.rect(MARGIN, y, contentWidth, h).fill(LIGHT);
        pdf.rect(MARGIN, y, 3, h).fill(ACCENT);
        if (b.title) pdf.font('Helvetica-Bold').fontSize(9).fillColor(BRAND).text(b.title, MARGIN + 14, y + 7, { width: inner });
        pdf.font('Helvetica').fontSize(9).fillColor('#1C2733').text(text, MARGIN + 14, y + 7 + th, { width: inner });
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
    const startY = pdf.y;
    pdf.font('Helvetica').fontSize(9.5).fillColor('#1C2733');
    const estimated = pdf.heightOfString(runsToText(runs), { width });
    if (startY + estimated > bottomLimit()) pdf.addPage();
    let first = true;
    runs.forEach((r, i) => {
      const font = r.code ? 'Courier' : r.bold && r.italic ? 'Helvetica-BoldOblique' : r.bold ? 'Helvetica-Bold' : r.italic ? 'Helvetica-Oblique' : 'Helvetica';
      pdf.font(font).fontSize(9.5).fillColor('#1C2733');
      const isLast = i === runs.length - 1;
      pdf.text(r.text, first ? x : undefined, first ? pdf.y : undefined, {
        width, align: 'justify', continued: !isLast
      });
      first = false;
    });
  }
}
