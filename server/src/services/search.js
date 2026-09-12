/**
 * Global search index.
 *
 * A single FTS5 table holds every searchable governance object so that one
 * query returns policies, standards, procedures, roles, controls, framework
 * requirements, evidence and RACI activities together.
 */

import { q } from '../db/index.js';
import { htmlToText } from './html.js';

export const ENTITY_LABELS = {
  document: 'Document',
  control: 'Control',
  role: 'Role',
  framework_requirement: 'Requirement',
  evidence: 'Evidence',
  raci_activity: 'RACI',
  gap_item: 'Gap'
};

export function removeFromIndex(entityType, entityId) {
  q.run('DELETE FROM search_index WHERE entity_type = ? AND entity_id = ?', entityType, entityId);
}

export function indexEntry({ entityType, entityId, title, body, domainKey, badge, url }) {
  removeFromIndex(entityType, entityId);
  q.run(
    'INSERT INTO search_index (entity_type, entity_id, title, body, domain_key, badge, url) VALUES (?,?,?,?,?,?,?)',
    entityType, entityId, title || '', body || '', domainKey || '', badge || '', url || ''
  );
}

export function indexDocument(doc, sections) {
  const body = (sections || [])
    .map((s) => `${s.heading}\n${htmlToText(s.body)}`)
    .join('\n\n');
  indexEntry({
    entityType: 'document',
    entityId: doc.id,
    title: `${doc.reference} ${doc.title}`,
    body: `${doc.summary || ''}\n${body}`,
    domainKey: doc.domain_key,
    badge: doc.doc_type,
    url: `/documents/${doc.id}`
  });
}

export function indexControl(control, evidenceItems = []) {
  indexEntry({
    entityType: 'control',
    entityId: control.id,
    title: `${control.control_id} ${control.name}`,
    body: [control.description, control.requirement, control.implementation, control.kpi, control.risk, evidenceItems.join('; ')]
      .filter(Boolean).join('\n'),
    domainKey: control.domain_key,
    badge: control.control_type,
    url: `/controls/${control.id}`
  });
}

export function indexRole(role, items = []) {
  indexEntry({
    entityType: 'role',
    entityId: role.id,
    title: role.name,
    body: [role.purpose, role.authority, role.reporting_line, ...items.map((i) => i.text)].filter(Boolean).join('\n'),
    domainKey: role.domain_key,
    badge: role.category,
    url: `/roles/${role.id}`
  });
}

export function indexFrameworkRequirement(req, frameworkCode) {
  indexEntry({
    entityType: 'framework_requirement',
    entityId: req.id,
    title: `${frameworkCode} ${req.ref} — ${req.title}`,
    body: req.statement || req.title,
    domainKey: req.domain_key,
    badge: frameworkCode,
    url: `/frameworks?requirement=${req.id}`
  });
}

export function indexEvidence(ev) {
  indexEntry({
    entityType: 'evidence',
    entityId: ev.id,
    title: `${ev.evidence_id} ${ev.name}`,
    body: [ev.description, ev.evidence_type, ev.source_system, ev.owner_role].filter(Boolean).join('\n'),
    domainKey: ev.domain_key,
    badge: ev.status,
    url: `/evidence?id=${ev.id}`
  });
}

export function indexRaciActivity(matrixId, activity, assignmentSummary, domainKey) {
  indexEntry({
    entityType: 'raci_activity',
    entityId: activity.id,
    title: activity.activity,
    body: assignmentSummary,
    domainKey,
    badge: activity.phase || 'RACI',
    url: `/raci/${matrixId}`
  });
}

export function indexGapItem(item) {
  indexEntry({
    entityType: 'gap_item',
    entityId: item.id,
    title: `${item.requirement_ref || 'Gap'} — ${(item.requirement_txt || '').slice(0, 120)}`,
    body: [item.current_state, item.target_state, item.gap, item.recommendation, item.owner].filter(Boolean).join('\n'),
    domainKey: '',
    badge: item.status,
    url: `/gap-assessment/${item.assessment_id}`
  });
}

/** Escape an FTS5 query so user input cannot break the match syntax. */
function toFtsQuery(raw) {
  const terms = String(raw || '')
    .replace(/["^*():]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!terms.length) return null;
  // Quote each term and allow prefix matching on the final one.
  return terms.map((t, i) => (i === terms.length - 1 ? `"${t}"*` : `"${t}"`)).join(' AND ');
}

export function search(rawQuery, { types = [], domain = '', limit = 60 } = {}) {
  const match = toFtsQuery(rawQuery);
  if (!match) return [];
  const filters = [];
  const args = [match];
  if (types.length) {
    filters.push(`entity_type IN (${types.map(() => '?').join(',')})`);
    args.push(...types);
  }
  if (domain) {
    filters.push('domain_key = ?');
    args.push(domain);
  }
  const where = filters.length ? ` AND ${filters.join(' AND ')}` : '';
  args.push(limit);

  try {
    return q.all(
      `SELECT entity_type, entity_id, title, domain_key, badge, url,
              snippet(search_index, 3, '<mark>', '</mark>', '…', 24) AS excerpt,
              bm25(search_index) AS score
         FROM search_index
        WHERE search_index MATCH ?${where}
        ORDER BY score
        LIMIT ?`,
      ...args
    );
  } catch {
    return [];
  }
}

export function rebuildIndexCounts() {
  return q.all('SELECT entity_type, COUNT(*) AS n FROM search_index GROUP BY entity_type');
}
