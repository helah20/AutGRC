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

/**
 * Document furniture in both languages.
 *
 * Word does Arabic shaping and bidi reordering itself, so an RTL document from
 * here is a real one rather than a mirrored picture: the reader can edit it,
 * and the text stays joined. That is why Word carries the Arabic export and
 * the PDF path does not.
 */
const FURNITURE = {
  en: {
    documentControl: 'Document Control',
    title: 'Document title',
    reference: 'Document reference',
    docType: 'Document type',
    domain: 'Domain',
    version: 'Version',
    status: 'Status',
    classification: 'Classification',
    owner: 'Document owner',
    approver: 'Approver',
    effective: 'Effective date',
    nextReview: 'Next review date',
    issuer: 'Issuing organisation',
    notAssigned: 'Not assigned',
    onApproval: 'On approval',
    toBeSet: 'To be set',
    approval: 'Approval',
    action: 'Action',
    name: 'Name',
    role: 'Role',
    date: 'Date',
    prepared: 'Prepared',
    reviewed: 'Reviewed',
    approved: 'Approved',
    documentOwner: 'Document Owner',
    approverRole: 'Approver',
    versionHistory: 'Version History',
    author: 'Author',
    change: 'Change',
    generationEngine: 'Generation engine',
    initialIssue: 'Initial issue',
    contents: 'Contents',
    organisation: 'Organisation',
    statusLabel: STATUS_LABEL
  },
  ar: {
    documentControl: 'ضبط الوثيقة',
    title: 'عنوان الوثيقة',
    reference: 'الرقم المرجعي',
    docType: 'نوع الوثيقة',
    domain: 'المجال',
    version: 'الإصدار',
    status: 'الحالة',
    classification: 'التصنيف',
    owner: 'مالك الوثيقة',
    approver: 'المعتمِد',
    effective: 'تاريخ السريان',
    nextReview: 'تاريخ المراجعة القادمة',
    issuer: 'الجهة المُصدِرة',
    notAssigned: 'غير مُسنَد',
    onApproval: 'عند الاعتماد',
    toBeSet: 'يُحدَّد لاحقاً',
    approval: 'الاعتماد',
    action: 'الإجراء',
    name: 'الاسم',
    role: 'الدور',
    date: 'التاريخ',
    prepared: 'أُعدّت',
    reviewed: 'رُوجعت',
    approved: 'اعتُمدت',
    documentOwner: 'مالك الوثيقة',
    approverRole: 'المعتمِد',
    versionHistory: 'سجل الإصدارات',
    author: 'المُعِد',
    change: 'التغيير',
    generationEngine: 'محرّك التوليد',
    initialIssue: 'الإصدار الأول',
    contents: 'المحتويات',
    organisation: 'المنظمة',
    statusLabel: {
      draft: 'مسودة', under_review: 'قيد المراجعة', approved: 'معتمدة',
      published: 'منشورة', under_revision: 'قيد التنقيح', retired: 'مُلغاة'
    }
  }
};

const CLASSIFICATION_AR = {
  public: 'عام', internal: 'داخلي', confidential: 'سري',
  secret: 'سري للغاية', top_secret: 'سري للغاية — أعلى تصنيف'
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

/**
 * Table direction for the document being written.
 *
 * The default style carries rightToLeft and bidirectional, which covers every
 * paragraph, but a table's column order is its own property: without
 * `w:bidiVisual` Word right-aligns the cells and still puts the first column on
 * the left, so an Arabic RACI matrix would read its activities from the wrong
 * end. Set for the duration of one build; buildDocx does no I/O between
 * setting it and using it.
 */
let activeRtl = false;

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
    visuallyRightToLeft: activeRtl || undefined,
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
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, visuallyRightToLeft: activeRtl || undefined, rows: trs });
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
        visuallyRightToLeft: activeRtl || undefined,
        rows: [new TableRow({
          children: [new TableCell({
            // The accent rule marks the start of the line, which is the right
            // edge in Arabic.
            borders: activeRtl
              ? { top: thinBorder, bottom: thinBorder, left: thinBorder, right: { style: BorderStyle.SINGLE, size: 18, color: ACCENT } }
              : { top: thinBorder, bottom: thinBorder, right: thinBorder, left: { style: BorderStyle.SINGLE, size: 18, color: ACCENT } },
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

function coverPage({ doc, org, classification, rtl = false, L }) {
  // Letter-spacing an Arabic word breaks the joins between its letters, so the
  // tracking that makes the English cover look considered is dropped in Arabic.
  const tracking = (value) => (rtl ? undefined : value);
  const caps = (text) => (rtl ? text : String(text).toUpperCase());
  const run = (options) => new TextRun({ rightToLeft: rtl, ...options });
  const centred = (children, spacing) => new Paragraph({
    alignment: AlignmentType.CENTER, bidirectional: rtl, spacing, children
  });

  return [
    centred([run({ text: caps(org?.org_name || L.organisation), bold: true, size: 28, color: ACCENT, characterSpacing: tracking(40) })],
      { before: 1800, after: 120 }),
    centred([run({ text: rtl ? 'حوكمة الأمن السيبراني' : 'CYBERSECURITY GOVERNANCE', size: 20, color: '6B7C8F', characterSpacing: tracking(60) })],
      { after: 600 }),
    centred([run({ text: doc.title, bold: true, size: 52, color: BRAND })], { after: 160 }),
    centred([run({
      text: `${doc.reference}  ·  ${L.version} ${doc.version}  ·  ${L.statusLabel[doc.status] || doc.status}`,
      size: 22, color: '6B7C8F'
    })], { after: 1200 }),
    centred([run({ text: `${caps(L.classification)}: ${classification}`, bold: true, size: 20, color: BRAND })], { after: 240 }),
    centred([run({
      text: `${L.effective} ${doc.effective_date || L.onApproval}  ·  ${L.nextReview} ${doc.review_date || L.toBeSet}`,
      size: 18, color: '8A97A6'
    })], { before: 1600 }),
    new Paragraph({ children: [new PageBreak()] })
  ];
}

/**
 * @param {object} data  { document, sections, org, owner, approver, versions, approvals, frameworks }
 * @returns {Promise<Buffer>}
 */
export async function buildDocx(data) {
  const { document: doc, sections, org, owner, approver, versions = [], approvals = [], frameworks = [] } = data;
  // Arabic is a real RTL document, not a mirrored one: Word joins the letters
  // and reorders the line itself, so the reader can edit what they receive.
  const lang = data.lang === 'ar' ? 'ar' : 'en';
  const rtl = lang === 'ar';
  activeRtl = rtl;
  const L = FURNITURE[lang];
  const classification = rtl
    ? (CLASSIFICATION_AR[doc.classification] || CLASSIFICATION_AR.internal)
    : (CLASSIFICATION_LABEL[doc.classification] || 'INTERNAL');

  const body = [
    ...coverPage({ doc, org, classification, rtl, L }),

    new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 200 }, children: [new TextRun({ text: L.documentControl, color: BRAND, rightToLeft: rtl })] }),
    infoTable([
      [L.title, doc.title],
      [L.reference, doc.reference],
      [L.docType, data.docTypeLabel || (doc.doc_type || '').replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())],
      [L.domain, data.domainName || doc.domain_key],
      [L.version, doc.version],
      [L.status, L.statusLabel[doc.status] || doc.status],
      [L.classification, classification],
      [L.owner, owner?.name ? `${owner.name}${owner.job_title ? `, ${owner.job_title}` : ''}` : L.notAssigned],
      [L.approver, approver?.name ? `${approver.name}${approver.job_title ? `, ${approver.job_title}` : ''}` : L.notAssigned],
      [L.effective, doc.effective_date || L.onApproval],
      [L.nextReview, doc.review_date || L.toBeSet],
      [L.issuer, org?.org_name || '—']
    ]),
    new Paragraph({ spacing: { after: 300 }, children: [] }),

    new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 200 }, children: [new TextRun({ text: L.approval, color: BRAND, rightToLeft: rtl })] }),
    gridTable(
      [[[{ text: L.action }], [{ text: L.name }], [{ text: L.role }], [{ text: L.date }]]],
      approvals.length
        ? approvals.map((a) => [a.action, a.actor_name || '—', a.actor_role || '—', (a.created_at || '').slice(0, 10)])
        : [[L.prepared, owner?.name || '—', owner?.job_title || L.documentOwner, (doc.created_at || '').slice(0, 10)],
           [L.reviewed, '', '', ''],
           [L.approved, approver?.name || '', approver?.job_title || L.approverRole, '']]
    ),
    new Paragraph({ spacing: { after: 300 }, children: [] }),

    new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 200 }, children: [new TextRun({ text: L.versionHistory, color: BRAND, rightToLeft: rtl })] }),
    gridTable(
      [[[{ text: L.version }], [{ text: L.date }], [{ text: L.author }], [{ text: L.change }]]],
      versions.length
        ? versions.map((v) => [v.version, (v.created_at || '').slice(0, 10), v.author_name || '—', v.change_note || '—'])
        : [[doc.version, (doc.created_at || '').slice(0, 10), L.generationEngine, L.initialIssue]]
    ),
    new Paragraph({ children: [new PageBreak()] }),

    new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 200 }, children: [new TextRun({ text: L.contents, color: BRAND, rightToLeft: rtl })] }),
    new TableOfContents(L.contents, { hyperlink: true, headingStyleRange: '1-3' }),
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
          // AlignmentType.START already follows the paragraph direction; the
          // indent is physical, so it is stated on the side the text starts.
          { level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START,
            style: { paragraph: { indent: rtl ? { right: 720, hanging: 360 } : { left: 720, hanging: 360 } } } },
          { level: 1, format: 'lowerLetter', text: '%2.', alignment: AlignmentType.START,
            style: { paragraph: { indent: rtl ? { right: 1440, hanging: 360 } : { left: 1440, hanging: 360 } } } },
          { level: 2, format: 'lowerRoman', text: '%3.', alignment: AlignmentType.START,
            style: { paragraph: { indent: rtl ? { right: 2160, hanging: 360 } : { left: 2160, hanging: 360 } } } }
        ]
      }]
    },
    styles: {
      default: {
        document: {
          // Word shapes Arabic and reorders the line from these two flags, so
          // the body inherits direction rather than each paragraph declaring it.
          run: {
            font: rtl ? 'Segoe UI' : 'Calibri',
            size: rtl ? 22 : 21,
            color: '1C2733',
            rightToLeft: rtl
          },
          paragraph: { bidirectional: rtl }
        }
      },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 30, bold: true, color: BRAND, rightToLeft: rtl },
          paragraph: { spacing: { before: 320, after: 160 }, bidirectional: rtl } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, color: BRAND, rightToLeft: rtl },
          paragraph: { spacing: { before: 260, after: 120 }, bidirectional: rtl } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 23, bold: true, color: ACCENT, rightToLeft: rtl },
          paragraph: { spacing: { before: 220, after: 100 }, bidirectional: rtl } }
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
              new TextRun({ text: `${org?.org_name || L.organisation}  |  ${doc.title}`, size: 16, color: '6B7C8F', rightToLeft: rtl }),
              new TextRun({ text: `\t${classification}`, size: 16, bold: true, color: BRAND, rightToLeft: rtl })
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

  // Put the flag back before returning: the buffer is already described by the
  // document object, and leaving it set would give the next English export
  // right-to-left tables.
  activeRtl = false;
  return Packer.toBuffer(document);
}
