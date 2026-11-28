/**
 * Keeping generated documents in step with the platform.
 *
 * A generated document is a projection of the knowledge base: the domain
 * model, the framework catalogue and the document builders. When any of them
 * improves, documents generated earlier would otherwise keep the old text
 * until someone thought to generate them again. This rebuilds them.
 *
 * - A document still being drafted or reviewed (draft, under review, under
 *   revision) is rebuilt in place, automatically, at startup.
 * - A published or approved document is a controlled record: its text never
 *   changes behind its approver's back. It is marked as having an update, and
 *   applying it opens a revision that goes through approval like any other.
 * - A section a person edited or locked is never overwritten.
 *
 * Each rebuild records a version first, so the previous text can be compared
 * and restored.
 */

import { q, nowIso, toJson, fromJson } from '../db/index.js';
import { id } from '../utils/ids.js';
import { DOMAIN_MODELS } from '../knowledge/index.js';
import { previewPackage } from './generator.js';
import { contentRevision } from './content-revision.js';

export { contentRevision };

const EDITABLE = new Set(['draft', 'under_review', 'under_revision']);
const CONTROLLED = new Set(['approved', 'published']);

function orgProfile() {
  const row = q.get('SELECT * FROM org_profile WHERE id = 1') || {};
  return {
    ...row,
    technology_env: fromJson(row.technology_env, []),
    data_classifications: fromJson(row.data_classifications, []),
    cloud_roles: fromJson(row.cloud_roles, []),
    applicable_frameworks: row.applicable_frameworks == null ? null : fromJson(row.applicable_frameworks, [])
  };
}

/** The document as the platform would generate it today, from what it was generated with. */
function rebuild(doc, org) {
  const meta = fromJson(doc.generation_meta, {});
  if (!meta.domain || !DOMAIN_MODELS[meta.domain]) return null;
  // The sources the organisation is subject to now, so adopting a framework
  // reaches documents already generated.
  const frameworkCodes = Array.isArray(org.applicable_frameworks) ? org.applicable_frameworks : (meta.frameworks || []);
  const built = previewPackage({
    domainKey: meta.domain,
    docTypes: [doc.doc_type],
    frameworkCodes,
    org,
    parameterOverrides: meta.parameterOverrides || {},
    language: meta.language || doc.language || 'en'
  }).documents[0];
  return built ? { built, meta, frameworkCodes } : null;
}

function snapshot(doc) {
  return {
    document: doc,
    sections: q.all('SELECT * FROM document_sections WHERE document_id = ? ORDER BY position', doc.id)
      .map((s) => ({ ...s, source_refs: fromJson(s.source_refs, []) }))
  };
}

const humanOwned = (section) => section.locked || section.provenance === 'user_input';

/** Replace a document's generated sections with the rebuilt ones. Returns the count changed. */
function apply(doc, built, meta, frameworkCodes, user) {
  const at = nowIso();
  const existing = q.all('SELECT * FROM document_sections WHERE document_id = ?', doc.id);
  const byKey = new Map(existing.map((s) => [s.section_key, s]));
  const incoming = built.sections.map((s, position) => ({ ...s, position }));
  if (built.flow) incoming.push({ key: '_flow', heading: 'Process Flow (data)', body: toJson(built.flow), provenance: 'procedure', sourceRefs: [], position: 999 });

  const changes = incoming.filter((s) => {
    const old = byKey.get(s.key);
    return !old || (!humanOwned(old) && (old.body !== s.body || old.heading !== s.heading));
  });
  const keys = new Set(incoming.map((s) => s.key));
  const removed = existing.filter((s) => !keys.has(s.section_key) && !humanOwned(s));
  if (!changes.length && !removed.length) return 0;

  q.run(
    `INSERT INTO document_versions (id, document_id, version, snapshot, change_note, change_type, author_id, author_name, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    id('ver'), doc.id, doc.version, toJson(snapshot(doc)),
    'Before updating to the current knowledge base and document builders', 'regenerated',
    user?.id || null, user?.name || 'System', at
  );
  for (const s of changes) {
    const old = byKey.get(s.key);
    if (old) {
      q.run('UPDATE document_sections SET heading = ?, body = ?, provenance = ?, source_refs = ?, position = ?, updated_at = ? WHERE id = ?',
        s.heading, s.body, s.provenance, toJson(s.sourceRefs || []), s.position, at, old.id);
    } else {
      q.run(
        `INSERT INTO document_sections (id, document_id, section_key, heading, body, position, provenance, source_refs, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        id('sec'), doc.id, s.key, s.heading, s.body, s.position, s.provenance, toJson(s.sourceRefs || []), at, at
      );
    }
  }
  for (const s of removed) q.run('DELETE FROM document_sections WHERE id = ?', s.id);

  const nextMeta = { ...meta, frameworks: frameworkCodes, contentRevision: contentRevision(), refreshedAt: at, updateAvailable: false };
  q.run('UPDATE documents SET title = ?, generation_meta = ?, updated_at = ? WHERE id = ?', built.title || doc.title, toJson(nextMeta), at, doc.id);
  return changes.length + removed.length;
}

function markUpdate(doc, meta, available) {
  q.run('UPDATE documents SET generation_meta = ? WHERE id = ?',
    toJson({ ...meta, updateAvailable: available, ...(available ? {} : { contentRevision: contentRevision() }) }), doc.id);
}

/**
 * Bring every generated document up to date. Drafts are rebuilt; controlled
 * documents are marked. Returns counts for the startup log.
 */
export function refreshGeneratedDocuments({ user = null } = {}) {
  const revision = contentRevision();
  const org = orgProfile();
  const result = { updated: 0, unchanged: 0, flagged: 0 };
  for (const doc of q.all("SELECT * FROM documents WHERE generation_meta IS NOT NULL AND status != 'retired'")) {
    const meta = fromJson(doc.generation_meta, {});
    if (meta.contentRevision === revision || !meta.domain) continue;
    let rebuilt;
    try { rebuilt = rebuild(doc, org); } catch { continue; }
    if (!rebuilt) continue;
    if (EDITABLE.has(doc.status)) {
      const changed = apply(doc, rebuilt.built, rebuilt.meta, rebuilt.frameworkCodes, user);
      if (changed) result.updated += 1;
      else { result.unchanged += 1; markUpdate(doc, meta, false); }
    } else if (CONTROLLED.has(doc.status)) {
      // Only flag a controlled document whose text would actually change.
      const sections = q.all('SELECT * FROM document_sections WHERE document_id = ?', doc.id);
      const byKey = new Map(sections.map((s) => [s.section_key, s]));
      const differs = rebuilt.built.sections.some((s) => {
        const old = byKey.get(s.key);
        return !old || (!humanOwned(old) && old.body !== s.body);
      });
      if (differs) { result.flagged += 1; markUpdate(doc, meta, true); } else { markUpdate(doc, meta, false); }
    }
  }
  return result;
}

/**
 * Apply the update to one document on request. A published document moves to
 * Under Revision first, so the updated text is approved before it is live.
 */
export function refreshDocument(documentId, user) {
  const doc = q.get('SELECT * FROM documents WHERE id = ?', documentId);
  if (!doc) return { error: 'not_found' };
  if (doc.status === 'retired') return { error: 'retired' };
  if (doc.status === 'approved') return { error: 'approved' };
  const rebuilt = rebuild(doc, orgProfile());
  if (!rebuilt) return { error: 'not_generated' };
  let current = doc;
  if (doc.status === 'published') {
    q.run("UPDATE documents SET status = 'under_revision', updated_at = ? WHERE id = ?", nowIso(), doc.id);
    current = q.get('SELECT * FROM documents WHERE id = ?', doc.id);
  }
  const changed = apply(current, rebuilt.built, rebuilt.meta, rebuilt.frameworkCodes, user);
  if (!changed) markUpdate(current, rebuilt.meta, false);
  return { changed, status: current.status };
}
