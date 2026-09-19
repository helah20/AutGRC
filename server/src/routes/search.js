/** Global search across every governance object. */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errors.js';
import { search, ENTITY_LABELS, rebuildIndexCounts } from '../services/search.js';
import { domainName } from '../knowledge/index.js';
import { listParam } from './_shared.js';

const router = express.Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const term = String(req.query.q || '').trim();
  if (!term) {
    return res.json({ query: '', total: 0, groups: [], counts: rebuildIndexCounts(), entityLabels: ENTITY_LABELS });
  }

  const results = search(term, {
    types: listParam(req.query.types),
    domain: req.query.domain || '',
    limit: Math.min(Number(req.query.limit) || 80, 200)
  });

  const groups = {};
  for (const r of results) {
    groups[r.entity_type] = groups[r.entity_type] || { type: r.entity_type, label: ENTITY_LABELS[r.entity_type] || r.entity_type, items: [] };
    groups[r.entity_type].items.push({
      id: r.entity_id, title: r.title, excerpt: r.excerpt, badge: r.badge,
      url: r.url, domain: r.domain_key, domainLabel: r.domain_key ? domainName(r.domain_key) : null
    });
  }

  const order = ['document', 'control', 'framework_requirement', 'role', 'evidence', 'raci_activity', 'gap_item'];
  res.json({
    query: term,
    total: results.length,
    groups: Object.values(groups).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type)),
    entityLabels: ENTITY_LABELS
  });
}));

export default router;
