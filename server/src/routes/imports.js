/** Import and analysis of existing governance documents. */

import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import multer from 'multer';
import { z } from 'zod';
import config from '../config.js';
import { db, q, nowIso, toJson, fromJson } from '../db/index.js';
import { id, padNumber } from '../utils/ids.js';
import { authenticate, requirePermission, audit } from '../middleware/auth.js';
import { asyncHandler, validate, notFound, HttpError } from '../middleware/errors.js';
import { extractText, analyseText, detectDomain, detectDocType, segmentSections, sha256File } from '../services/import.js';
import { indexDocument } from '../services/search.js';
import { domainName, domainShort, DOMAIN_META } from '../knowledge/index.js';
import { DOC_TYPE_PREFIX } from '../services/generator.js';
import { getOrgProfile, enrichDocument } from './_shared.js';

const router = express.Router();
router.use(authenticate);

const ALLOWED_EXT = new Set(['docx', 'pdf', 'xlsx', 'xlsm', 'csv', 'txt', 'md', 'html']);
const ALLOWED_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'text/csv', 'text/plain', 'text/markdown', 'text/html', 'application/octet-stream'
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, config.uploadDir),
    // Never trust the client filename on disk; keep it only as metadata.
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 8).replace(/[^.a-z0-9]/g, '');
      cb(null, `${id('upl')}${ext}`);
    }
  }),
  limits: { fileSize: config.security.maxUploadBytes, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new HttpError(400, `Files of type ".${ext}" are not accepted. Supported: ${[...ALLOWED_EXT].join(', ')}.`));
    }
    if (file.mimetype && !ALLOWED_MIME.has(file.mimetype)) {
      return cb(new HttpError(400, `Unexpected content type "${file.mimetype}" for a .${ext} file.`));
    }
    cb(null, true);
  }
});

router.get('/', asyncHandler(async (req, res) => {
  const rows = q.all(
    `SELECT u.id, u.filename, u.mime, u.size_bytes, u.kind, u.domain_key, u.status, u.created_at, us.name AS uploaded_by_name
       FROM uploads u LEFT JOIN users us ON us.id = u.uploaded_by
      ORDER BY u.created_at DESC LIMIT 100`
  );
  res.json(rows.map((r) => ({ ...r, domain_label: r.domain_key ? domainName(r.domain_key) : null })));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const row = q.get('SELECT * FROM uploads WHERE id = ?', req.params.id);
  if (!row) throw notFound('Upload');
  res.json({
    upload: { ...row, extracted_text: undefined, domain_label: row.domain_key ? domainName(row.domain_key) : null },
    analysis: fromJson(row.analysis, null),
    excerpt: (row.extracted_text || '').slice(0, 4000)
  });
}));

router.post('/', requirePermission('import:write'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'No file was uploaded.');
  const at = nowIso();
  const uploadId = id('upl');

  let extracted;
  try {
    extracted = await extractText(req.file.path, req.file.mimetype, req.file.originalname);
  } catch (err) {
    await fs.unlink(req.file.path).catch(() => {});
    throw new HttpError(422, `The file could not be read: ${err.message}`);
  }

  if (!extracted.text || extracted.text.trim().length < 50) {
    await fs.unlink(req.file.path).catch(() => {});
    throw new HttpError(422, 'No readable text was extracted. If this is a scanned document, apply OCR before uploading.');
  }

  const detected = detectDomain(extracted.text);
  const domainKey = req.body.domainKey && DOMAIN_META.some((d) => d.key === req.body.domainKey)
    ? req.body.domainKey
    : detected.best?.key || 'governance';
  const docType = req.body.docType || detectDocType(extracted.text);
  const analysis = analyseText({ text: extracted.text, domainKey, docType, org: getOrgProfile() });
  analysis.detection = { domain: detected, docType, format: extracted.format };

  q.run(
    `INSERT INTO uploads (id, filename, stored_name, mime, size_bytes, sha256, kind, domain_key, status, extracted_text, analysis, uploaded_by, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    uploadId, req.file.originalname.slice(0, 255), path.basename(req.file.path),
    req.file.mimetype, req.file.size, await sha256File(req.file.path),
    docType, domainKey, 'analyzed', extracted.text.slice(0, 2_000_000), toJson(analysis), req.user.id, at
  );

  audit(req, {
    action: 'import:upload', entityType: 'upload', entityId: uploadId,
    summary: `Uploaded and analysed "${req.file.originalname}"`,
    detail: { domain: domainKey, docType, findings: analysis.findings.length, coverage: analysis.statistics.coverage }
  });

  res.status(201).json({ uploadId, analysis, sections: segmentSections(extracted.text).length });
}));

/** Re-run the analysis against a different domain or document type. */
router.post('/:id/reanalyse', requirePermission('import:write'), validate(z.object({
  domainKey: z.string().min(2), docType: z.string().min(2)
})), asyncHandler(async (req, res) => {
  const row = q.get('SELECT * FROM uploads WHERE id = ?', req.params.id);
  if (!row) throw notFound('Upload');
  const analysis = analyseText({
    text: row.extracted_text, domainKey: req.body.domainKey, docType: req.body.docType, org: getOrgProfile()
  });
  analysis.detection = { docType: req.body.docType };
  q.run('UPDATE uploads SET domain_key = ?, kind = ?, analysis = ? WHERE id = ?',
    req.body.domainKey, req.body.docType, toJson(analysis), row.id);
  res.json({ analysis });
}));

/** Promote an analysed upload into the document library as a draft. */
router.post('/:id/promote', requirePermission('document:create'), validate(z.object({
  title: z.string().min(3).max(250),
  docType: z.enum(['policy', 'standard', 'procedure', 'guideline', 'framework', 'roles', 'raci', 'control_matrix']),
  domainKey: z.string().min(2),
  classification: z.enum(['public', 'internal', 'confidential', 'secret', 'top_secret']).default('internal')
})), asyncHandler(async (req, res) => {
  const row = q.get('SELECT * FROM uploads WHERE id = ?', req.params.id);
  if (!row) throw notFound('Upload');
  if (row.status === 'imported') throw new HttpError(409, 'This upload has already been imported.');

  const sections = segmentSections(row.extracted_text);
  if (!sections.length) throw new HttpError(422, 'No sections could be identified in the uploaded document.');

  const prefix = `${DOC_TYPE_PREFIX[req.body.docType]}-${domainShort(req.body.domainKey)}-`;
  const next = q.all('SELECT reference FROM documents WHERE reference LIKE ?', `${prefix}%`)
    .reduce((m, r) => Math.max(m, Number(String(r.reference).slice(prefix.length)) || 0), 0) + 1;
  const reference = `${prefix}${padNumber(next)}`;
  const docId = id('doc');
  const at = nowIso();
  const analysis = fromJson(row.analysis, {});

  db.transaction(() => {
    q.run(
      `INSERT INTO documents (id, reference, title, doc_type, domain_key, status, classification, version,
         owner_id, summary, review_date, generation_meta, provenance, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      docId, reference, req.body.title, req.body.docType, req.body.domainKey, 'draft',
      req.body.classification, '0.1', req.user.id,
      `Imported from "${row.filename}". Analysis reported ${analysis.findings?.length || 0} finding(s) and ${analysis.statistics?.coverage ?? 0}% requirement coverage.`,
      new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      toJson({ provider: 'import', uploadId: row.id, filename: row.filename, analysedAt: at, frameworks: [] }),
      'uploaded_source', req.user.id, at, at
    );
    sections.forEach((s, i) => {
      q.run(
        `INSERT INTO document_sections (id, document_id, section_key, heading, body, position, provenance, source_refs, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        id('sec'), docId, s.key, s.heading, s.body, i, 'uploaded_source',
        toJson([{ type: 'uploaded_source', uploadId: row.id, filename: row.filename }]), at, at
      );
    });
    q.run(
      `INSERT INTO document_versions (id, document_id, version, snapshot, change_note, change_type, author_id, author_name, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      id('ver'), docId, '0.1', toJson({}), `Imported from "${row.filename}"`, 'imported', req.user.id, req.user.name, at
    );
    // Carry the analysis findings across so they appear in the review queue.
    for (const f of analysis.findings || []) {
      q.run(
        `INSERT INTO findings (id, scope_type, scope_id, category, severity, title, detail, location, recommendation, evidence, status, source, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id('fnd'), 'document', docId, f.category, f.severity, f.title, f.detail,
        reference, f.recommendation || null, toJson(f.evidence || null), 'open', 'engine', at, at
      );
    }
    q.run('UPDATE uploads SET status = ? WHERE id = ?', 'imported', row.id);
  })();

  const doc = q.get('SELECT * FROM documents WHERE id = ?', docId);
  indexDocument(doc, q.all('SELECT * FROM document_sections WHERE document_id = ?', docId));
  audit(req, {
    action: 'import:promote', entityType: 'document', entityId: docId,
    summary: `Imported "${row.filename}" as ${reference}`, detail: { sections: sections.length }
  });
  res.status(201).json({ document: enrichDocument(doc), sections: sections.length });
}));

router.delete('/:id', requirePermission('import:write'), asyncHandler(async (req, res) => {
  const row = q.get('SELECT * FROM uploads WHERE id = ?', req.params.id);
  if (!row) throw notFound('Upload');
  await fs.unlink(path.join(config.uploadDir, row.stored_name)).catch(() => {});
  q.run('DELETE FROM uploads WHERE id = ?', row.id);
  audit(req, { action: 'import:delete', entityType: 'upload', entityId: row.id, summary: `Deleted upload "${row.filename}"` });
  res.json({ ok: true });
}));

export default router;
