/** Evidence register, and the artefacts collected against it. */

import express from 'express';
import path from 'node:path';
import fsp from 'node:fs/promises';
import multer from 'multer';
import { z } from 'zod';
import config from '../config.js';
import { q, nowIso } from '../db/index.js';
import { id } from '../utils/ids.js';
import { authenticate, requirePermission, audit } from '../middleware/auth.js';
import { asyncHandler, validate, notFound, HttpError } from '../middleware/errors.js';
import { indexEvidence, removeFromIndex } from '../services/search.js';
import { sha256File } from '../services/import.js';
import { domainName } from '../knowledge/index.js';
import { listParam, paginate } from './_shared.js';

const router = express.Router();
router.use(authenticate);

/**
 * Evidence is whatever an auditor will accept: a screenshot of a console, an
 * exported access review, a signed minute, a log bundle. SVG is excluded
 * deliberately — it is a script-bearing document dressed as a picture.
 */
const ALLOWED_EXT = new Set([
  'pdf', 'docx', 'xlsx', 'xlsm', 'csv', 'txt', 'log', 'json', 'md',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'zip', 'eml', 'msg'
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, config.evidenceDir),
    // The client filename is metadata only; never a path on disk.
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 8).replace(/[^.a-z0-9]/g, '');
      cb(null, `${id('evf')}${ext}`);
    }
  }),
  limits: { fileSize: config.security.maxUploadBytes, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new HttpError(400, `Files of type ".${ext}" are not accepted as evidence. Supported: ${[...ALLOWED_EXT].join(', ')}.`));
    }
    cb(null, true);
  }
});

function findEvidence(ref) {
  return q.get('SELECT * FROM evidence WHERE id = ? OR evidence_id = ?', ref, ref);
}

function filesFor(evidenceRowId) {
  return q.all(
    `SELECT f.id, f.filename, f.mime, f.size_bytes, f.sha256, f.note, f.period,
            f.collected_at, f.verified_at,
            up.name AS uploaded_by_name, vr.name AS verified_by_name
       FROM evidence_files f
       LEFT JOIN users up ON up.id = f.uploaded_by
       LEFT JOIN users vr ON vr.id = f.verified_by
      WHERE f.evidence_id = ?
      ORDER BY f.collected_at DESC`,
    evidenceRowId
  );
}

// -------------------------------------------------------------- register ---

router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset } = paginate(req, 200, 2000);
  const filters = [];
  const args = [];
  for (const [column, values] of [
    ['e.domain_key', listParam(req.query.domain)],
    ['e.status', listParam(req.query.status)],
    ['e.evidence_type', listParam(req.query.type)]
  ]) {
    if (values.length) { filters.push(`${column} IN (${values.map(() => '?').join(',')})`); args.push(...values); }
  }
  if (req.query.search) {
    filters.push('(e.name LIKE ? OR e.evidence_id LIKE ? OR e.description LIKE ?)');
    const like = `%${req.query.search}%`;
    args.push(like, like, like);
  }
  if (req.query.attached === 'yes') filters.push('EXISTS (SELECT 1 FROM evidence_files f WHERE f.evidence_id = e.id)');
  if (req.query.attached === 'no') filters.push('NOT EXISTS (SELECT 1 FROM evidence_files f WHERE f.evidence_id = e.id)');
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const total = q.get(`SELECT COUNT(*) AS n FROM evidence e ${where}`, ...args).n;
  const rows = q.all(
    `SELECT e.*, c.control_id AS control_ref, c.name AS control_name,
            (SELECT COUNT(*) FROM evidence_files f WHERE f.evidence_id = e.id) AS file_count,
            (SELECT MAX(f.collected_at) FROM evidence_files f WHERE f.evidence_id = e.id) AS latest_file_at
       FROM evidence e LEFT JOIN controls c ON c.id = e.control_id
       ${where} ORDER BY e.evidence_id LIMIT ? OFFSET ?`, ...args, limit, offset
  );
  res.json({
    total, limit, offset,
    items: rows.map((e) => ({ ...e, domain_label: e.domain_key ? domainName(e.domain_key) : null })),
    facets: {
      statuses: q.all('SELECT status, COUNT(*) AS n FROM evidence GROUP BY status'),
      types: q.all('SELECT evidence_type, COUNT(*) AS n FROM evidence GROUP BY evidence_type'),
      domains: q.all('SELECT domain_key, COUNT(*) AS n FROM evidence GROUP BY domain_key').map((r) => ({ ...r, label: domainName(r.domain_key) })),
      attachments: {
        withFiles: q.get('SELECT COUNT(DISTINCT evidence_id) AS n FROM evidence_files').n,
        total: q.get('SELECT COUNT(*) AS n FROM evidence').n
      }
    }
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const row = findEvidence(req.params.id);
  if (!row) throw notFound('Evidence');
  const control = row.control_id ? q.get('SELECT id, control_id, name, domain_key FROM controls WHERE id = ?', row.control_id) : null;
  res.json({
    evidence: { ...row, domain_label: row.domain_key ? domainName(row.domain_key) : null },
    control,
    files: filesFor(row.id)
  });
}));

router.patch('/:id', requirePermission('evidence:write'), validate(z.object({
  name: z.string().min(3).max(400).optional(),
  description: z.string().max(2000).nullable().optional(),
  evidence_type: z.string().max(60).optional(),
  frequency: z.string().max(160).nullable().optional(),
  owner_role: z.string().max(160).nullable().optional(),
  source_system: z.string().max(160).nullable().optional(),
  retention: z.string().max(160).nullable().optional(),
  status: z.enum(['required', 'collected', 'verified', 'missing', 'expired']).optional(),
  last_collected: z.string().nullable().optional()
})), asyncHandler(async (req, res) => {
  const row = findEvidence(req.params.id);
  if (!row) throw notFound('Evidence');
  const entries = Object.entries(req.body).filter(([, v]) => v !== undefined);
  if (entries.length) {
    q.run(`UPDATE evidence SET ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
      ...entries.map(([, v]) => v), nowIso(), row.id);
  }
  const updated = q.get('SELECT * FROM evidence WHERE id = ?', row.id);
  indexEvidence(updated);
  audit(req, { action: 'evidence:update', entityType: 'evidence', entityId: row.id, summary: `Updated evidence ${row.evidence_id}`, detail: Object.fromEntries(entries) });
  res.json({ evidence: updated });
}));

router.delete('/:id', requirePermission('evidence:write'), asyncHandler(async (req, res) => {
  const row = findEvidence(req.params.id);
  if (!row) throw notFound('Evidence');
  // The cascade removes the rows; the bytes on disk have to go too.
  const stored = q.all('SELECT stored_name FROM evidence_files WHERE evidence_id = ?', row.id);
  q.run('DELETE FROM evidence WHERE id = ?', row.id);
  for (const f of stored) await fsp.unlink(path.join(config.evidenceDir, f.stored_name)).catch(() => {});
  removeFromIndex('evidence', row.id);
  audit(req, {
    action: 'evidence:delete', entityType: 'evidence', entityId: row.id,
    summary: `Deleted evidence ${row.evidence_id}`,
    detail: { artefactsRemoved: stored.length }
  });
  res.json({ ok: true });
}));

// ------------------------------------------------------------- artefacts ---

router.post('/:id/files', requirePermission('evidence:write'), upload.single('file'),
  asyncHandler(async (req, res) => {
    const row = findEvidence(req.params.id);
    if (!row) {
      if (req.file) await fsp.unlink(req.file.path).catch(() => {});
      throw notFound('Evidence');
    }
    if (!req.file) throw new HttpError(400, 'No file was uploaded.');

    const at = nowIso();
    const fileId = id('evf');
    const note = String(req.body.note || '').slice(0, 1000) || null;
    const period = String(req.body.period || '').slice(0, 80) || null;
    const collectedAt = /^\d{4}-\d{2}-\d{2}/.test(req.body.collectedAt || '') ? req.body.collectedAt : at;

    q.run(
      `INSERT INTO evidence_files
         (id, evidence_id, filename, stored_name, mime, size_bytes, sha256, note, period, collected_at, uploaded_by, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      fileId, row.id, req.file.originalname.slice(0, 255), path.basename(req.file.path),
      req.file.mimetype, req.file.size, await sha256File(req.file.path),
      note, period, collectedAt, req.user.id, at
    );

    // An artefact is now on file, so the register says collected rather than
    // required. Verification is a separate act by a separate person, and it
    // does not carry over: an item whose previous collection was verified
    // drops back to collected once a newer, unchecked artefact arrives, because
    // the register has to describe the latest evidence rather than the best.
    q.run(
      'UPDATE evidence SET status = ?, last_collected = ?, file_id = ?, updated_at = ? WHERE id = ?',
      'collected', collectedAt, fileId, at, row.id
    );

    const updated = q.get('SELECT * FROM evidence WHERE id = ?', row.id);
    indexEvidence(updated);
    audit(req, {
      action: 'evidence:attach', entityType: 'evidence', entityId: row.id,
      summary: `Attached "${req.file.originalname}" to evidence ${row.evidence_id}`,
      detail: { fileId, bytes: req.file.size, period }
    });

    res.status(201).json({ evidence: updated, files: filesFor(row.id) });
  })
);

router.get('/:id/files/:fileId', asyncHandler(async (req, res) => {
  const row = findEvidence(req.params.id);
  if (!row) throw notFound('Evidence');
  const file = q.get('SELECT * FROM evidence_files WHERE id = ? AND evidence_id = ?', req.params.fileId, row.id);
  if (!file) throw notFound('Evidence artefact');

  const onDisk = path.join(config.evidenceDir, path.basename(file.stored_name));
  try {
    await fsp.access(onDisk);
  } catch {
    throw new HttpError(410, 'The stored file is no longer present on disk.');
  }

  audit(req, {
    action: 'evidence:download', entityType: 'evidence', entityId: row.id,
    summary: `Downloaded "${file.filename}" from evidence ${row.evidence_id}`
  });

  // Always an attachment, and never the stored content type: an evidence
  // artefact is a record to keep, not a page to render in the app's origin.
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename.replace(/["\\\r\n]/g, '_')}"`);
  res.sendFile(onDisk);
}));

router.post('/:id/files/:fileId/verify', requirePermission('evidence:verify'),
  asyncHandler(async (req, res) => {
    const row = findEvidence(req.params.id);
    if (!row) throw notFound('Evidence');
    const file = q.get('SELECT * FROM evidence_files WHERE id = ? AND evidence_id = ?', req.params.fileId, row.id);
    if (!file) throw notFound('Evidence artefact');
    if (file.verified_at) throw new HttpError(409, 'This artefact has already been verified.');
    // The same segregation the platform applies to document approval: the
    // person who produced the evidence cannot be the one who attests to it.
    if (file.uploaded_by === req.user.id) {
      audit(req, {
        action: 'evidence:verify', entityType: 'evidence', entityId: row.id,
        summary: `Verification refused: ${req.user.email} collected this artefact`, outcome: 'denied'
      });
      throw new HttpError(403, 'Evidence cannot be verified by the person who collected it.');
    }

    const at = nowIso();
    q.run('UPDATE evidence_files SET verified_by = ?, verified_at = ? WHERE id = ?', req.user.id, at, file.id);
    q.run('UPDATE evidence SET status = ?, updated_at = ? WHERE id = ?', 'verified', at, row.id);
    const updated = q.get('SELECT * FROM evidence WHERE id = ?', row.id);
    indexEvidence(updated);
    audit(req, {
      action: 'evidence:verify', entityType: 'evidence', entityId: row.id,
      summary: `Verified "${file.filename}" for evidence ${row.evidence_id}`
    });
    res.json({ evidence: updated, files: filesFor(row.id) });
  })
);

router.delete('/:id/files/:fileId', requirePermission('evidence:write'), asyncHandler(async (req, res) => {
  const row = findEvidence(req.params.id);
  if (!row) throw notFound('Evidence');
  const file = q.get('SELECT * FROM evidence_files WHERE id = ? AND evidence_id = ?', req.params.fileId, row.id);
  if (!file) throw notFound('Evidence artefact');
  if (file.verified_at) {
    throw new HttpError(409, 'A verified artefact cannot be deleted. Attach a superseding collection instead.');
  }

  q.run('DELETE FROM evidence_files WHERE id = ?', file.id);
  await fsp.unlink(path.join(config.evidenceDir, path.basename(file.stored_name))).catch(() => {});

  // Fall back to whatever collection is now the most recent.
  const latest = q.get('SELECT id, collected_at FROM evidence_files WHERE evidence_id = ? ORDER BY collected_at DESC LIMIT 1', row.id);
  q.run(
    'UPDATE evidence SET file_id = ?, last_collected = ?, status = ?, updated_at = ? WHERE id = ?',
    latest?.id || null, latest?.collected_at || null,
    latest ? 'collected' : 'required', nowIso(), row.id
  );

  audit(req, {
    action: 'evidence:detach', entityType: 'evidence', entityId: row.id,
    summary: `Removed "${file.filename}" from evidence ${row.evidence_id}`
  });
  res.json({ evidence: q.get('SELECT * FROM evidence WHERE id = ?', row.id), files: filesFor(row.id) });
}));

export default router;
