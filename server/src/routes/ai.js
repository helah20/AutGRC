/** AI-assisted review, rewriting and drafting. */

import express from 'express';
import { z } from 'zod';
import { q, nowIso, toJson, fromJson } from '../db/index.js';
import { id } from '../utils/ids.js';
import { authenticate, requirePermission, audit } from '../middleware/auth.js';
import { asyncHandler, validate, notFound } from '../middleware/errors.js';
import { reviewDocument, reviewDomain, scoreOf } from '../services/review.js';
import { scorecard } from '../services/scorecard.js';
import { aiReview, rewriteText, draftSection, providerInfo } from '../services/ai.js';
import { notifyFindings } from '../services/notify.js';
import { buildParameterSet, domainName } from '../knowledge/index.js';
import { getOrgProfile, enrichDocument } from './_shared.js';

const router = express.Router();
router.use(authenticate);

router.get('/provider', asyncHandler(async (req, res) => res.json(providerInfo())));

/** Persist engine and AI findings so they can be tracked and dispositioned. */
function persistFindings(scopeType, scopeId, findings, actor) {
  const at = nowIso();
  const existing = q.all(
    'SELECT id, category, title, location, status FROM findings WHERE scope_type = ? AND scope_id = ?',
    scopeType, scopeId
  );
  const key = (f) => `${f.category}|${f.title}|${f.location}`;
  const seen = new Map(existing.map((f) => [key(f), f]));
  const kept = new Set();

  for (const f of findings) {
    const k = key(f);
    kept.add(k);
    const prior = seen.get(k);
    if (prior) {
      q.run('UPDATE findings SET severity = ?, detail = ?, recommendation = ?, evidence = ?, updated_at = ? WHERE id = ?',
        f.severity, f.detail, f.recommendation, toJson(f.evidence), at, prior.id);
      continue;
    }
    q.run(
      `INSERT INTO findings (id, scope_type, scope_id, category, severity, title, detail, location, recommendation, evidence, status, source, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id('fnd'), scopeType, scopeId, f.category, f.severity, f.title, f.detail,
      f.location, f.recommendation, toJson(f.evidence), 'open', f.source || 'engine', at, at
    );
  }

  // Findings that no longer reproduce are closed as resolved, not deleted,
  // so the audit trail shows that they were raised and cleared.
  for (const prior of existing) {
    if (!kept.has(key(prior)) && prior.status === 'open') {
      q.run("UPDATE findings SET status = 'resolved', updated_at = ? WHERE id = ?", at, prior.id);
    }
  }

  const stored = q.all(
    "SELECT * FROM findings WHERE scope_type = ? AND scope_id = ? AND status != 'resolved' ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END, created_at DESC",
    scopeType, scopeId
  ).map((f) => ({ ...f, evidence: fromJson(f.evidence, null) }));

  // Notifications are keyed on the finding id, so re-running a review tells
  // nobody about findings they have already been told about.
  notifyFindings({ findings: stored, actor });
  return stored;
}

/** Full quality review of a document: engine checks plus the AI provider's. */
router.post('/review/document/:id', requirePermission('ai:use'), asyncHandler(async (req, res) => {
  const started = Date.now();
  const engine = reviewDocument(req.params.id);
  const sections = q.all('SELECT * FROM document_sections WHERE document_id = ? ORDER BY position', req.params.id)
    .filter((s) => !s.section_key.startsWith('_'));

  const ai = await aiReview({
    document: engine.document, sections, engineFindings: engine.findings, userId: req.user.id
  });

  const all = [...engine.findings, ...ai.findings];
  const stored = persistFindings('document', req.params.id, all, req.user);

  audit(req, {
    action: 'ai:review', entityType: 'document', entityId: req.params.id,
    summary: `Reviewed ${engine.document.reference}: ${all.length} finding(s)`,
    detail: { provider: ai.provider, score: scoreOf(all).score }
  });

  res.json({
    document: enrichDocument(engine.document),
    provider: ai.provider,
    model: ai.model,
    summary: ai.summary,
    score: scoreOf(all),
    // Built from the combined list, not from `engine.scorecard`: the provider's
    // findings are part of the picture the reader is shown, and a profile that
    // silently excluded them would disagree with the score printed beside it.
    scorecard: scorecard(all, { documents: 1 }),
    findings: stored,
    durationMs: Date.now() - started
  });
}));

/** Domain-wide review: the consistency picture across every document. */
router.post('/review/domain/:key', requirePermission('ai:use'), asyncHandler(async (req, res) => {
  const result = reviewDomain(req.params.key);
  const stored = persistFindings('domain', req.params.key, result.findings, req.user);
  audit(req, {
    action: 'ai:review_domain', entityType: 'domain', entityId: req.params.key,
    summary: `Reviewed ${domainName(req.params.key)}: ${result.findings.length} finding(s)`
  });
  res.json({
    domain: { key: req.params.key, name: domainName(req.params.key) },
    documents: result.documents,
    score: result.score,
    scorecard: result.scorecard,
    findings: stored
  });
}));

router.post('/rewrite', requirePermission('ai:use'), validate(z.object({
  text: z.string().min(1).max(60000),
  mode: z.enum(['improve', 'shorten', 'formalise', 'compliance']).default('improve'),
  documentId: z.string().nullable().optional()
})), asyncHandler(async (req, res) => {
  const doc = req.body.documentId ? q.get('SELECT * FROM documents WHERE id = ?', req.body.documentId) : null;
  const context = doc
    ? { domain: domainName(doc.domain_key), docType: doc.doc_type, parameters: fromJson(doc.generation_meta, {})?.parameters || {} }
    : {};
  const result = await rewriteText({
    text: req.body.text, mode: req.body.mode, context,
    userId: req.user.id, scopeId: req.body.documentId || null
  });
  audit(req, {
    action: 'ai:rewrite', entityType: 'document', entityId: req.body.documentId || null,
    summary: `AI rewrite (${req.body.mode}) applied to a passage`, detail: { provider: result.provider, changes: result.changes.length }
  });
  res.json(result);
}));

router.post('/draft', requirePermission('ai:use'), validate(z.object({
  documentId: z.string().min(1),
  sectionKey: z.string().min(1).max(60),
  heading: z.string().min(1).max(200),
  instruction: z.string().max(2000).optional()
})), asyncHandler(async (req, res) => {
  const doc = q.get('SELECT * FROM documents WHERE id = ?', req.body.documentId);
  if (!doc) throw notFound('Document');
  const meta = fromJson(doc.generation_meta, {});
  const params = meta.parameters || buildParameterSet(doc.domain_key, getOrgProfile());
  const result = await draftSection({
    domainKey: doc.domain_key, docType: doc.doc_type, sectionKey: req.body.sectionKey,
    heading: req.body.heading, instruction: req.body.instruction, params,
    userId: req.user.id, scopeId: doc.id
  });
  audit(req, { action: 'ai:draft', entityType: 'document', entityId: doc.id, summary: `AI drafted section "${req.body.heading}"` });
  res.json(result);
}));

router.get('/runs', asyncHandler(async (req, res) => {
  const rows = q.all(
    `SELECT r.id, r.kind, r.provider, r.model, r.scope_type, r.scope_id, r.duration_ms, r.status, r.created_at, u.name AS user_name
       FROM ai_runs r LEFT JOIN users u ON u.id = r.user_id
      ORDER BY r.created_at DESC LIMIT 100`
  );
  res.json(rows);
}));

export default router;
