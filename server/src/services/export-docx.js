/**
 * Word export.
 *
 * Produces a corporate-format document: cover page, document control table,
 * approval table, version history, table of contents, headers and footers
 * with page numbering, the document body, and references.
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  Header, Footer, PageNumber, TableOfContents, PageBreak, convertInchesToTwip
} from 'docx';
import { htmlToBlocks, runsToText } from './html-to-blocks.js';

const BRAND = '1F3A5F';
const ACCENT = '2E6F9E';
const LIGHT = 'F2F5F9';
const BORDER = 'C9D4E0';

const CLASSIFICATION_LABEL = {
  public: 'PUBLIC', internal: 'INTERNAL', confidential: 'CONFIDENTIAL',
  secret: 'SECRET', top_secret: 'TOP SECRET'
};

const STATUS_LABEL = {
  draft: 'Draft', under_review: 'Under Review', approved: 'Approved',
  published: 'Published', under_revision: 'Under Revision', retired: 'Retired'
};

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: BORDER };
const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

function textRuns(runs, extra = {}) {
  if (!runs?.length) return [new TextRun({ text: '', ...extra })];
  return runs.flatMap((r) =>
    r.text.split('\n').flatMap((part, i) =>
      i === 0
        ? [new TextRun({ text: part, bold: r.bold, italics: r.italic, font: r.code ? 'Consolas' : undefined, ...extra })]
        : [new TextRun({ text: part, bold: r.bold, italics: r.italic, break: 1, font: r.code ? 'Consolas' : undefined, ...extra })]
    )
  );
}

function cell(content, { header = false, width, bold = false } = {}) {
  return new TableCell({
    borders: cellBorders,
    shading: header ? { type: ShadingType.CLEAR, fill: LIGHT } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    children: [
      new Paragraph({
        spacing: { before: 20, after: 20 },
        children: Array.isArray(content)
          ? textRuns(content, header || bold ? { bold: true, color: header ? BRAND : undefined } : {})
          : [new TextRun({ text: String(content ?? ''), bold: header || bold, color: header ? BRAND : undefined })]
      })
    ]
  });
}

function infoTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([k, v]) =>
      new TableRow({ children: [cell(k, { header: true, width: 30 }), cell(v, { width: 70 })] })
    )
  });
}

function gridTable(head, rows) {
  const colCount = Math.max(head?.[0]?.length || 0, rows[0]?.length || 0) || 1;
  const width = Math.floor(100 / colCount);
  const trs = [];
  for (const hr of head || []) {
    trs.push(new TableRow({ tableHeader: true, children: hr.map((c) => cell(c, { header: true, width })) }));
  }
  for (const r of rows) {
    trs.push(new TableRow({ children: r.map((c) => cell(c, { width })) }));
  }
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: trs });
}

function blocksToDocx(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.type === 'heading') {
      const level = Math.min(Math.max(b.level, 2), 5);
      out.push(new Paragraph({
        heading: { 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3, 4: HeadingLevel.HEADING_4, 5: HeadingLevel.HEADING_5 }[level],
        spacing: { before: 240, after: 120 },
        children: textRuns(b.runs, { color: BRAND })
      }));
    } else if (b.type === 'paragraph') {
      out.push(new Paragraph({ spacing: { after: 120, line: 276 }, alignment: AlignmentType.JUSTIFIED, children: textRuns(b.runs) }));
    } else if (b.type === 'list') {
      for (const item of b.items) {
        out.push(new Paragraph({
          numbering: b.ordered ? { reference: 'ordered-list', level: Math.min(item.level, 2) } : undefined,
          bullet: b.ordered ? undefined : { level: Math.min(item.level, 2) },
          spacing: { after: 80 },
          children: textRuns(item.runs)
        }));
      }
    } else if (b.type === 'table') {
      if (b.caption) out.push(new Paragraph({ spacing: { before: 120, after: 60 }, children: [new TextRun({ text: b.caption, italics: true, size: 18 })] }));
      out.push(gridTable(b.head, b.rows));
      out.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
    } else if (b.type === 'callout') {
      out.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({
          children: [new TableCell({
            borders: { top: thinBorder, bottom: thinBorder, right: thinBorder, left: { style: BorderStyle.SINGLE, size: 18, color: ACCENT } },
            shading: { type: ShadingType.CLEAR, fill: LIGHT },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children: [
              ...(b.title ? [new Paragraph({ children: [new TextRun({ text: b.title, bold: true, color: BRAND })] })] : []),
              new Paragraph({ children: textRuns(b.runs) })
            ]
          })]
        })]
      }));
      out.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
    } else if (b.type === 'rule') {
      out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BORDER } }, spacing: { after: 160 }, children: [] }));
    }
  }
  return out;
}

function coverPage({ doc, org, classification }) {
  return [
    new Paragraph({ spacing: { before: 1800, after: 120 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: (org?.org_name || 'Organisation').toUpperCase(), bold: true, size: 28, color: ACCENT, characterSpacing: 40 })] }),
    new Paragraph({ spacing: { after: 600 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'CYBERSECURITY GOVERNANCE', size: 20, color: '6B7C8F', characterSpacing: 60 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
      children: [new TextRun({ text: doc.title, bold: true, size: 52, color: BRAND })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 1200 },
      children: [new TextRun({ text: `${doc.reference}  ·  Version ${doc.version}  ·  ${STATUS_LABEL[doc.status] || doc.status}`, size: 22, color: '6B7C8F' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
      children: [new TextRun({ text: `CLASSIFICATION: ${classification}`, bold: true, size: 20, color: BRAND })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1600 },
      children: [new TextRun({ text: `Effective ${doc.effective_date || 'on approval'}  ·  Next review ${doc.review_date || 'to be set'}`, size: 18, color: '8A97A6' })] }),
    new Paragraph({ children: [new PageBreak()] })
  ];
}

/**
 * @param {object} data  { document, sections, org, owner, approver, versions, approvals, frameworks }
 * @returns {Promise<Buffer>}
 */
export async function buildDocx(data) {
  const { document: doc, sections, org, owner, approver, versions = [], approvals = [], frameworks = [] } = data;
  const classification = CLASSIFICATION_LABEL[doc.classification] || 'INTERNAL';

  const body = [
    ...coverPage({ doc, org, classification }),

    new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 200 }, children: [new TextRun({ text: 'Document Control', color: BRAND })] }),
    infoTable([
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
    ]),
    new Paragraph({ spacing: { after: 300 }, children: [] }),

    new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 200 }, children: [new TextRun({ text: 'Approval', color: BRAND })] }),
    gridTable(
      [[[{ text: 'Action' }], [{ text: 'Name' }], [{ text: 'Role' }], [{ text: 'Date' }]]],
      approvals.length
        ? approvals.map((a) => [a.action, a.actor_name || '—', a.actor_role || '—', (a.created_at || '').slice(0, 10)])
        : [['Prepared', owner?.name || '—', owner?.job_title || 'Document Owner', (doc.created_at || '').slice(0, 10)],
           ['Reviewed', '', '', ''],
           ['Approved', approver?.name || '', approver?.job_title || 'Approver', '']]
    ),
    new Paragraph({ spacing: { after: 300 }, children: [] }),

    new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 200 }, children: [new TextRun({ text: 'Version History', color: BRAND })] }),
    gridTable(
      [[[{ text: 'Version' }], [{ text: 'Date' }], [{ text: 'Author' }], [{ text: 'Change' }]]],
      versions.length
        ? versions.map((v) => [v.version, (v.created_at || '').slice(0, 10), v.author_name || '—', v.change_note || '—'])
        : [[doc.version, (doc.created_at || '').slice(0, 10), 'Generation engine', 'Initial issue']]
    ),
    new Paragraph({ children: [new PageBreak()] }),

    new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 200 }, children: [new TextRun({ text: 'Table of Contents', color: BRAND })] }),
    new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-3' }),
    new Paragraph({ children: [new PageBreak()] })
  ];

  sections.forEach((s, i) => {
    body.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: i === 0 ? 0 : 360, after: 160 },
      children: [new TextRun({ text: `${i + 1}. ${s.heading}`, color: BRAND })]
    }));
    body.push(...blocksToDocx(htmlToBlocks(s.body)));
  });

  if (frameworks.length) {
    body.push(new Paragraph({ children: [new PageBreak()] }));
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 160 }, children: [new TextRun({ text: 'Authoritative Sources', color: BRAND })] }));
    body.push(gridTable(
      [[[{ text: 'Source' }], [{ text: 'Publisher' }], [{ text: 'Version' }], [{ text: 'Type' }]]],
      frameworks.map((f) => [f.name, f.publisher || '—', f.version || '—', f.kind === 'regulation' ? 'Regulatory' : 'Framework'])
    ));
    body.push(new Paragraph({ spacing: { before: 200 }, children: [new TextRun({
      text: 'Framework references identify the authoritative requirements this document is designed to address. They are reproduced as reference metadata and must be verified against the official publication before being relied upon for regulatory attestation.',
      italics: true, size: 18, color: '6B7C8F'
    })] }));
  }

  const document = new Document({
    creator: org?.org_name || 'AutGRC',
    title: `${doc.reference} — ${doc.title}`,
    description: doc.summary || '',
    numbering: {
      config: [{
        reference: 'ordered-list',
        levels: [
          { level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: 'lowerLetter', text: '%2.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
          { level: 2, format: 'lowerRoman', text: '%3.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 2160, hanging: 360 } } } }
        ]
      }]
    },
    styles: {
      default: { document: { run: { font: 'Calibri', size: 21, color: '1C2733' } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 30, bold: true, color: BRAND }, paragraph: { spacing: { before: 320, after: 160 } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, color: BRAND }, paragraph: { spacing: { before: 260, after: 120 } } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 23, bold: true, color: ACCENT }, paragraph: { spacing: { before: 220, after: 100 } } }
      ]
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1), bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1), right: convertInchesToTwip(1)
          }
        }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BORDER } },
            tabStops: [{ type: 'right', position: 9360 }],
            children: [
              new TextRun({ text: `${org?.org_name || 'Organisation'}  |  ${doc.title}`, size: 16, color: '6B7C8F' }),
              new TextRun({ text: `\t${classification}`, size: 16, bold: true, color: BRAND })
            ]
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 6, color: BORDER } },
            tabStops: [{ type: 'right', position: 9360 }],
            children: [
              new TextRun({ text: `${doc.reference}  ·  Version ${doc.version}`, size: 16, color: '6B7C8F' }),
              new TextRun({ text: '\tPage ', size: 16, color: '6B7C8F' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '6B7C8F' }),
              new TextRun({ text: ' of ', size: 16, color: '6B7C8F' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '6B7C8F' })
            ]
          })]
        })
      },
      children: body
    }]
  });

  return Packer.toBuffer(document);
}
