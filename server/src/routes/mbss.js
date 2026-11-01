/** Minimum Baseline Security Standards: the catalogue, and generation into the library. */

import express from 'express';
import { z } from 'zod';
import { q } from '../db/index.js';
import { authenticate, requirePermission, audit } from '../middleware/auth.js';
import { asyncHandler, validate, HttpError } from '../middleware/errors.js';
import { mbssCatalogue, generateMbss } from '../services/mbss.js';
import { matchTechnologies, mbssTechnology, CATEGORIES } from '../knowledge/mbss/index.js';
import { requestLanguage } from '../services/localise.js';
import { getOrgProfile } from './_shared.js';

const router = express.Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const org = getOrgProfile() || {};
  const suggested = matchTechnologies(org.technology_env || []);
  const documents = q.all(
    `SELECT id, reference, title, status, version, language, updated_at,
            json_extract(generation_meta, '$.technology') AS technology
       FROM documents WHERE json_extract(generation_meta, '$.kind') = 'mbss' ORDER BY reference`);
  res.json({ ...mbssCatalogue({ language: requestLanguage(req), suggested }), suggested, documents });
}));

router.post('/generate', requirePermission('generate:run'), validate(z.object({
  technologies: z.array(z.string().max(60)).max(40).default([]),
  custom: z.object({
    name: z.string().min(2).max(120),
    category: z.string().max(30).default('other'),
    benchmark: z.string().max(300).optional()
  }).nullable().optional(),
  language: z.enum(['en', 'ar']).default('en'),
  // 1: level 1 required, level 2 recommended. 2: both required.
  level: z.union([z.literal(1), z.literal(2)]).default(1),
  benchmarkVersions: z.record(z.string().max(120)).default({}),
  ownerId: z.string().nullable().optional(),
  approverId: z.string().nullable().optional(),
  classification: z.enum(['public', 'internal', 'confidential', 'secret', 'top_secret']).default('internal')
})), asyncHandler(async (req, res) => {
  const b = req.body;
  const unknown = b.technologies.filter((key) => !mbssTechnology(key));
  if (unknown.length) throw new HttpError(400, `Unknown technology: ${unknown.join(', ')}`);
  if (!b.technologies.length && !b.custom) throw new HttpError(400, 'Choose at least one technology.');
  if (b.custom && !CATEGORIES[b.custom.category]) throw new HttpError(400, 'Unknown category.');
  const created = generateMbss({
    technologies: b.technologies, custom: b.custom || null, language: b.language, level: b.level,
    benchmarkVersions: b.benchmarkVersions, org: getOrgProfile() || {},
    ownerId: b.ownerId || req.user.id, approverId: b.approverId || null,
    classification: b.classification, userId: req.user.id
  });
  audit(req, {
    action: 'generate:mbss', entityType: 'document',
    summary: `Generated ${created.length} minimum baseline security standard(s): ${created.map((d) => d.reference).join(', ')}`
  });
  res.status(201).json({ documents: created });
}));

export default router;
