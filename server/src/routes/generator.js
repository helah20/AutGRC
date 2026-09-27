/** Document generation wizard: domains, frameworks, preview and generate. */

import express from 'express';
import { z } from 'zod';
import { q } from '../db/index.js';
import { authenticate, requirePermission, audit } from '../middleware/auth.js';
import { asyncHandler, validate, HttpError } from '../middleware/errors.js';
import { generatePackage, previewPackage, DOC_TYPE_LABEL } from '../services/generator.js';
import { DOMAIN_META, DOMAIN_MODELS, FRAMEWORKS, buildParameterSet, ROLE_LIBRARY } from '../knowledge/index.js';
import { providerInfo } from '../services/ai.js';
import { getOrgProfile, enrichDocuments } from './_shared.js';

const router = express.Router();
router.use(authenticate);

router.get('/options', asyncHandler(async (req, res) => {
  const org = getOrgProfile();
  res.json({
    documentTypes: Object.entries(DOC_TYPE_LABEL).map(([value, label]) => ({
      value, label,
      description: {
        policy: 'The mandatory organisational position. States what must be achieved.',
        standard: 'Measurable requirements implementing the policy. States the agreed values.',
        procedure: 'Step-by-step execution with decision points and a process flow.',
        guideline: 'Advisory implementation guidance. Creates no obligation.',
        framework: 'How the domain control framework maps to adopted sources.',
        roles: 'Role purpose, authority, responsibilities, approvals and escalations.',
        raci: 'Responsibility assignment matrix with validation.',
        control_matrix: 'Controls, evidence, indicators and framework mapping.',
        work_instruction: 'Platform-specific execution detail beneath a procedure.'
      }[value] || ''
    })).filter((t) => t.value !== 'work_instruction'),
    domains: DOMAIN_META.map((d) => ({
      ...d,
      requirements: DOMAIN_MODELS[d.key]?.requirements.length || 0,
      activities: DOMAIN_MODELS[d.key]?.raciActivities.length || 0,
      existingDocuments: q.get('SELECT COUNT(*) AS n FROM documents WHERE domain_key = ?', d.key).n
    })),
    frameworks: q.all('SELECT id, code, name, publisher, version, kind, jurisdiction, is_mandatory, description FROM frameworks ORDER BY kind, code'),
    roles: ROLE_LIBRARY.map((r) => ({ code: r.code, name: r.name, shortName: r.shortName, category: r.category })),
    org,
    ai: providerInfo(),
    users: q.all("SELECT id, name, email, role, job_title FROM users WHERE status = 'active' ORDER BY name")
  });
}));

router.get('/domains/:key', asyncHandler(async (req, res) => {
  const model = DOMAIN_MODELS[req.params.key];
  if (!model) throw new HttpError(404, 'Unknown domain');
  const params = buildParameterSet(req.params.key, getOrgProfile());
  res.json({
    key: model.key, name: model.name, description: model.description, category: model.category,
    objectives: model.objectives,
    parameters: Object.entries(model.parameters).map(([name, value]) => ({
      name,
      label: name.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim(),
      value: params[name] ?? value
    })),
    requirements: model.requirements.map((r) => ({
      key: r.key, title: r.title, controlName: r.controlName, controlType: r.controlType,
      riskRating: r.riskRating, evidence: r.evidence, refs: r.refs
    })),
    procedureSteps: model.procedure.steps.map((s) => ({ name: s.name, actor: s.actor, hasDecision: Boolean(s.decision) })),
    roles: model.roles,
    raciActivities: model.raciActivities.length
  });
}));

const generateSchema = z.object({
  domainKey: z.string().min(2),
  docTypes: z.array(z.enum(['policy', 'standard', 'procedure', 'guideline', 'framework', 'roles', 'raci', 'control_matrix'])).min(1),
  frameworkCodes: z.array(z.string()).default([]),
  parameterOverrides: z.record(z.string()).default({}),
  classification: z.enum(['public', 'internal', 'confidential', 'secret', 'top_secret']).default('internal'),
  ownerId: z.string().nullable().optional(),
  approverId: z.string().nullable().optional(),
  language: z.enum(['en', 'ar']).default('en'),
  // Set when generating the other language version of an existing package, so
  // the two are linked rather than looking like unrelated documents.
  translationOf: z.string().nullable().optional()
});

router.post('/preview', requirePermission('generate:run'), validate(generateSchema), asyncHandler(async (req, res) => {
  const preview = previewPackage({
    domainKey: req.body.domainKey,
    docTypes: req.body.docTypes,
    frameworkCodes: req.body.frameworkCodes,
    org: getOrgProfile(),
    parameterOverrides: req.body.parameterOverrides,
    language: req.body.language
  });
  res.json({ ...preview, ai: providerInfo() });
}));

router.post('/generate', requirePermission('generate:run'), validate(generateSchema), asyncHandler(async (req, res) => {
  const org = getOrgProfile();
  const result = generatePackage({
    domainKey: req.body.domainKey,
    docTypes: req.body.docTypes,
    frameworkCodes: req.body.frameworkCodes,
    org,
    parameterOverrides: req.body.parameterOverrides,
    userId: req.user.id,
    ownerId: req.body.ownerId || req.user.id,
    approverId: req.body.approverId || null,
    classification: req.body.classification,
    provider: providerInfo().provider,
    language: req.body.language,
    translationOf: req.body.translationOf || null
  });

  audit(req, {
    action: 'generate:package', entityType: 'package', entityId: result.packageId,
    summary: `Generated ${result.documents.length} ${req.body.language === 'ar' ? 'Arabic ' : ''}document(s) for ${req.body.domainKey}`,
    detail: {
      domain: req.body.domainKey, docTypes: req.body.docTypes, frameworks: req.body.frameworkCodes,
      controls: result.controls, language: req.body.language
    }
  });

  const rows = q.all('SELECT * FROM documents WHERE package_id = ? ORDER BY created_at', result.packageId);
  res.status(201).json({ ...result, documents: enrichDocuments(rows) });
}));

router.get('/packages', asyncHandler(async (req, res) => {
  const rows = q.all(
    `SELECT package_id, domain_key, MIN(created_at) AS created_at, COUNT(*) AS documents
       FROM documents WHERE package_id IS NOT NULL
      GROUP BY package_id ORDER BY created_at DESC LIMIT 60`
  );
  res.json(rows.map((r) => ({
    ...r,
    domain_label: DOMAIN_META.find((d) => d.key === r.domain_key)?.name || r.domain_key,
    items: enrichDocuments(q.all('SELECT * FROM documents WHERE package_id = ?', r.package_id))
  })));
}));

export default router;
