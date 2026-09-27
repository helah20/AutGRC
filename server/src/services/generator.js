/**
 * Generation engine.
 *
 * Produces a complete, internally consistent governance package for one
 * domain: policy, standard, procedure, guideline, roles, RACI, control
 * matrix and framework document, together with the control library entries,
 * evidence register, framework mappings and document relationships.
 *
 * All documents in a package derive from one requirement model and one
 * parameter set, so cross-document agreement is structural rather than
 * something the author has to remember.
 */

import { db, q, nowIso, toJson, fromJson } from '../db/index.js';
import { id, padNumber } from '../utils/ids.js';
import {
  DOMAIN_MODELS, localisedModel, FRAMEWORKS, ROLE_LIBRARY, ROLE_INDEX,
  buildParameterSet, resolveText, domainShort, roleName
} from '../knowledge/index.js';
import {
  buildPolicy, buildStandard, buildProcedureDoc, buildGuideline,
  buildRolesDoc, buildRaciDoc, buildControlMatrix, buildFrameworkDoc, withLanguage,
  applicableRefs, defaultResponsible, defaultAccountable, PROVENANCE
} from './doc-builders.js';
import { indexDocument, indexControl, indexRole, indexEvidence, indexRaciActivity } from './search.js';

export const DOC_TYPE_PREFIX = {
  policy: 'POL', standard: 'STD', procedure: 'PRC', guideline: 'GDL',
  framework: 'FRM', roles: 'ROL', raci: 'RAC', control_matrix: 'CTM',
  work_instruction: 'WIN'
};

export const DOC_TYPE_LABEL = {
  policy: 'Policy', standard: 'Standard', procedure: 'Procedure', guideline: 'Guideline',
  framework: 'Framework', roles: 'Roles & Responsibilities', raci: 'RACI / RASCI',
  control_matrix: 'Control Matrix', work_instruction: 'Work Instruction'
};

export const DOC_TYPE_LABEL_AR = {
  policy: 'سياسة', standard: 'معيار', procedure: 'إجراء', guideline: 'دليل إرشادي',
  framework: 'إطار', roles: 'الأدوار والمسؤوليات', raci: 'مصفوفة RACI / RASCI',
  control_matrix: 'مصفوفة ضوابط', work_instruction: 'تعليمات عمل'
};

/** Next free reference in a series such as POL-IAM-001. */
function nextReference(docType, domainKey) {
  const prefix = `${DOC_TYPE_PREFIX[docType] || 'DOC'}-${domainShort(domainKey)}-`;
  const rows = q.all('SELECT reference FROM documents WHERE reference LIKE ?', `${prefix}%`);
  let max = 0;
  for (const r of rows) {
    const n = Number(String(r.reference).slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${padNumber(max + 1)}`;
}

function nextControlId(domainKey) {
  const prefix = `${domainShort(domainKey)}-`;
  const rows = q.all('SELECT control_id FROM controls WHERE control_id LIKE ?', `${prefix}%`);
  let max = 0;
  for (const r of rows) {
    const n = Number(String(r.control_id).slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return (i) => `${prefix}${padNumber(max + i)}`;
}

function nextEvidenceId(domainKey) {
  const prefix = `EV-${domainShort(domainKey)}-`;
  const rows = q.all('SELECT evidence_id FROM evidence WHERE evidence_id LIKE ?', `${prefix}%`);
  let max = 0;
  for (const r of rows) {
    const n = Number(String(r.evidence_id).slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return (i) => `${prefix}${padNumber(max + i)}`;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * Assumptions are recorded explicitly wherever the organisation profile does
 * not supply an input the generator needed. They are never presented as fact.
 */
function collectAssumptions(org, model, params) {
  const out = [];
  const add = (field, assumption, impact) => out.push({ field, assumption, impact, provenance: PROVENANCE.AI });

  if (!org?.org_type) add('Organisation type', 'Treated as a general commercial organisation.', 'Sector-specific obligations may add requirements not reflected here.');
  if (!org?.industry) add('Industry', 'No sector-specific regulatory overlay applied.', 'Sector regulators may impose additional or stricter requirements.');
  if (!org?.size) add('Organisation size', 'Assumed to have a dedicated cybersecurity function with separate GRC and operations roles.', 'Smaller organisations may need to combine roles, which affects segregation of duties.');
  if (!org?.operating_model) add('Cybersecurity operating model', 'Assumed centralised cybersecurity function with federated system ownership.', 'A devolved or outsourced model changes the RACI assignments materially.');
  if (!org?.risk_appetite) add('Risk appetite', 'Assumed moderate risk appetite; parameter values follow common regulated-sector practice.', 'A lower appetite would tighten frequencies and thresholds in the Standard.');
  if (!Array.isArray(org?.technology_env) || !org.technology_env.length) {
    add('Technology environment', 'Assumed a mixed on-premises and cloud estate.', 'Platform-specific requirements may not apply, or may be missing.');
  }
  out.push({
    field: 'Parameter values',
    assumption: `Numeric commitments (for example ${Object.keys(model.parameters).slice(0, 3).join(', ')}) are set to common regulated-sector practice.`,
    impact: 'These are organisational decisions. Review and adjust them in the Standard before approval.',
    provenance: PROVENANCE.AI
  });
  return out;
}

/**
 * Build and persist a governance package.
 *
 * @param {object} opts
 * @param {string} opts.domainKey
 * @param {string[]} opts.docTypes         Document types to generate.
 * @param {string[]} opts.frameworkCodes   Selected authoritative sources.
 * @param {object}   opts.org              Organisation profile row.
 * @param {object}   opts.parameterOverrides  User-supplied parameter values.
 * @param {string}   opts.userId
 * @param {string}   opts.provider          Label recorded on generation metadata.
 */
export function generatePackage(opts) {
  const {
    domainKey,
    docTypes = ['policy', 'standard', 'procedure', 'roles', 'raci', 'control_matrix'],
    frameworkCodes = [],
    org = {},
    parameterOverrides = {},
    userId = null,
    provider = 'builtin',
    ownerId = null,
    approverId = null,
    classification = 'internal',
    aiSections = null,
    language = 'en',
    translationOf = null
  } = opts;

  // The Arabic model is the same record in Arabic wording; an untranslated
  // domain falls back to English and says so in fullyTranslated, so the
  // document can record what it actually is rather than what was asked for.
  const model = localisedModel(domainKey, language);
  if (!model) throw Object.assign(new Error(`Unknown domain "${domainKey}"`), { status: 400 });
  const documentLanguage = model.language;

  const selectedFrameworks = FRAMEWORKS.filter((f) => frameworkCodes.includes(f.code));
  const params = buildParameterSet(domainKey, org, parameterOverrides, documentLanguage);
  const assumptions = collectAssumptions(org, model, params);
  const packageId = id('pkg');
  const at = nowIso();
  const roles = model.roles.map((c) => ROLE_INDEX[c]).filter(Boolean);

  // ------------------------------------------------ build control records --
  const controlIdFor = nextControlId(domainKey);
  const evidenceIdFor = nextEvidenceId(domainKey);
  let evidenceCounter = 0;

  const controlDrafts = model.requirements.map((req, i) => {
    const mappings = applicableRefs(req, frameworkCodes);
    const responsible = defaultResponsible(model, req);
    const accountable = defaultAccountable(model, req);
    return {
      id: id('ctl'),
      control_id: controlIdFor(i + 1),
      name: req.controlName,
      requirementKey: req.key,
      description: resolveText(req.policy, params),
      requirement: resolveText(req.standard, params),
      control_type: req.controlType,
      control_nature: req.controlNature,
      implementation: resolveText(req.guidance || req.standard, params),
      responsible_role: roleName(responsible),
      accountable_role: roleName(accountable),
      frequency: resolveText(req.frequency, params),
      kpi: resolveText(req.kpi, params),
      risk: resolveText(req.risk, params),
      risk_rating: req.riskRating,
      testing_method: 'Inspection of evidence and sample testing against the stated frequency',
      evidenceItems: req.evidence.map((e) => resolveText(e, params)),
      mappings,
      mappingLabel: mappings.map((m) => `${m.framework} ${m.ref}`).join('; ')
    };
  });

  // ---------------------------------------------------- build documents ----
  const builders = {
    policy: () => buildPolicy({ model, params, org, frameworkCodes, frameworks: selectedFrameworks }),
    standard: () => buildStandard({ model, params, frameworkCodes, frameworks: selectedFrameworks }),
    procedure: () => buildProcedureDoc({ model, params, frameworkCodes }),
    guideline: () => buildGuideline({ model, params }),
    roles: () => buildRolesDoc({ model, params, roles }),
    raci: () => buildRaciDoc({ model, params }),
    control_matrix: () => buildControlMatrix({ model, params, frameworkCodes, controls: controlDrafts }),
    framework: () => buildFrameworkDoc({ model, params, frameworks: selectedFrameworks, frameworkCodes })
  };

  const ordered = ['policy', 'standard', 'procedure', 'guideline', 'framework', 'roles', 'raci', 'control_matrix']
    .filter((t) => docTypes.includes(t));

  // One language is in effect for the whole synchronous build.
  const built = withLanguage(documentLanguage, () => ordered.map((t) => ({ type: t, doc: builders[t]() })));

  // ------------------------------------------------------------- persist --
  const run = db.transaction(() => {
    const created = {};

    for (const { type, doc } of built) {
      const docId = id('doc');
      const reference = nextReference(type, domainKey);
      const genMeta = {
        provider,
        generatedAt: at,
        domain: domainKey,
        language: documentLanguage,
        // False when a domain has no Arabic model and the body fell back to
        // English; the library shows that rather than claiming a translation.
        fullyTranslated: model.fullyTranslated !== false,
        frameworks: frameworkCodes,
        parameters: params,
        assumptions,
        docTypes: ordered
      };

      q.run(
        `INSERT INTO documents
           (id, reference, title, doc_type, domain_key, status, classification, version,
            owner_id, approver_id, effective_date, review_date, summary, package_id,
            generation_meta, provenance, created_by, created_at, updated_at,
            language, translation_of)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        docId, reference, doc.title, type, domainKey, 'draft', classification, '0.1',
        ownerId, approverId, null, addMonths(at, 12),
        documentLanguage === 'ar'
          ? `${model.name} — ${DOC_TYPE_LABEL_AR[type] || DOC_TYPE_LABEL[type]}. مُولَّدة من نموذج متطلبات ${model.name} مقابل ${frameworkCodes.join('، ') || 'لا إطار محدد'}.`
          : `${model.name} — ${DOC_TYPE_LABEL[type]}. Generated from the ${model.name} requirement model against ${frameworkCodes.join(', ') || 'no selected framework'}.`,
        packageId, toJson(genMeta), doc.provenance, userId, at, at,
        documentLanguage, translationOf
      );

      doc.sections.forEach((s, i) => {
        q.run(
          `INSERT INTO document_sections
             (id, document_id, section_key, heading, body, position, provenance, source_refs, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          id('sec'), docId, s.key, s.heading, s.body, i, s.provenance, toJson(s.sourceRefs), at, at
        );
      });

      // Procedure flow and RACI matrix structure ride alongside the sections.
      if (type === 'procedure' && doc.flow) {
        q.run(
          `INSERT INTO document_sections
             (id, document_id, section_key, heading, body, position, provenance, source_refs, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          id('sec'), docId, '_flow', 'Process Flow (data)', toJson(doc.flow), 999, PROVENANCE.PROCEDURE, toJson([]), at, at
        );
      }

      const row = q.get('SELECT * FROM documents WHERE id = ?', docId);
      const sections = q.all('SELECT * FROM document_sections WHERE document_id = ? ORDER BY position', docId);
      indexDocument(row, sections);

      q.run(
        `INSERT INTO document_versions (id, document_id, version, snapshot, change_note, change_type, author_id, author_name, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        id('ver'), docId, '0.1', toJson({ document: row, sections }),
        'Initial generation from the domain requirement model.', 'generated', userId, 'Generation engine', at
      );

      created[type] = { id: docId, reference, title: doc.title, docType: type, built: doc };
    }

    // ------------------------------------------------ document hierarchy ---
    const link = (fromType, toType, linkType, note) => {
      if (!created[fromType] || !created[toType]) return;
      q.run(
        'INSERT OR IGNORE INTO document_links (id, from_id, to_id, link_type, note, created_at) VALUES (?,?,?,?,?,?)',
        id('lnk'), created[fromType].id, created[toType].id, linkType, note, at
      );
    };
    link('standard', 'policy', 'implements', 'The Standard sets measurable requirements implementing the Policy.');
    link('procedure', 'standard', 'implements', 'The Procedure carries out the requirements defined in the Standard.');
    link('guideline', 'standard', 'supports', 'The Guideline offers advisory implementation guidance.');
    link('roles', 'policy', 'supports', 'Role definitions supporting the Policy.');
    link('raci', 'roles', 'derived_from', 'The RACI matrix assigns the roles defined in the Roles document.');
    link('control_matrix', 'standard', 'derived_from', 'Controls implementing the Standard requirements.');
    link('policy', 'framework', 'references', 'The Policy operates within the domain control framework.');

    if (created.policy && created.standard) {
      q.run('UPDATE documents SET parent_id = ? WHERE id = ?', created.policy.id, created.standard.id);
    }
    if (created.standard && created.procedure) {
      q.run('UPDATE documents SET parent_id = ? WHERE id = ?', created.standard.id, created.procedure.id);
    }

    // ------------------------------------------------------- controls -----
    const controlRows = [];
    for (const c of controlDrafts) {
      q.run(
        `INSERT INTO controls
           (id, control_id, name, domain_key, description, requirement, control_type, control_nature,
            implementation, responsible_role, accountable_role, frequency, kpi, risk, risk_rating,
            testing_method, policy_ref, standard_ref, procedure_ref, policy_id, standard_id, procedure_id,
            requirement_key, status, provenance, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        c.id, c.control_id, c.name, domainKey, c.description, c.requirement, c.control_type, c.control_nature,
        c.implementation, c.responsible_role, c.accountable_role, c.frequency, c.kpi, c.risk, c.risk_rating,
        c.testing_method,
        created.policy ? `${created.policy.reference} §5.${model.requirements.findIndex((r) => r.key === c.requirementKey) + 1}` : null,
        created.standard ? `${created.standard.reference} §3.${model.requirements.findIndex((r) => r.key === c.requirementKey) + 1}` : null,
        created.procedure ? `${created.procedure.reference}` : null,
        created.policy?.id || null, created.standard?.id || null, created.procedure?.id || null,
        c.requirementKey, 'proposed', PROVENANCE.STANDARD, at, at
      );

      for (const item of c.evidenceItems) {
        evidenceCounter += 1;
        const evId = id('evd');
        q.run(
          `INSERT INTO evidence
             (id, evidence_id, name, description, evidence_type, domain_key, control_id, frequency,
              owner_role, status, provenance, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          evId, evidenceIdFor(evidenceCounter), item,
          `Evidence demonstrating operation of control ${c.control_id} (${c.name}).`,
          classifyEvidence(item), domainKey, c.id, c.frequency, c.responsible_role, 'required',
          PROVENANCE.STANDARD, at, at
        );
        indexEvidence(q.get('SELECT * FROM evidence WHERE id = ?', evId));
      }

      // Map the control to the authoritative requirements it addresses.
      for (const m of c.mappings) {
        const fw = q.get('SELECT id FROM frameworks WHERE code = ?', m.framework);
        if (!fw) continue;
        const fr = q.get('SELECT id FROM framework_requirements WHERE framework_id = ? AND ref = ?', fw.id, m.ref);
        if (!fr) continue;
        q.run(
          `INSERT OR IGNORE INTO control_mappings
             (id, control_id, requirement_id, coverage, rationale, confidence, mapped_by, provenance, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          id('map'), c.id, fr.id, 'covered',
          `Control ${c.control_id} implements this requirement through the ${model.name} Standard.`,
          'high', 'generator', PROVENANCE.AI, at, at
        );
      }

      const row = q.get('SELECT * FROM controls WHERE id = ?', c.id);
      controlRows.push(row);
      indexControl(row, c.evidenceItems);
    }

    // ---------------------------------------------------------- roles -----
    const roleIds = {};
    for (const role of roles) {
      let existing = q.get('SELECT * FROM roles WHERE code = ?', role.code);
      if (!existing) {
        const rid = id('rol');
        q.run(
          `INSERT INTO roles (id, code, name, short_name, category, purpose, reporting_line, authority,
             domain_key, competencies, interfaces, document_id, provenance, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          rid, role.code, role.name, role.shortName, role.category,
          resolveText(role.purpose, params), resolveText(role.reportingLine, params), resolveText(role.authority, params),
          domainKey, toJson(role.competencies), toJson(role.interfaces),
          created.roles?.id || null, PROVENANCE.POLICY, at, at
        );
        const kinds = [
          ['responsibility', role.responsibilities],
          ['accountability', role.accountabilities],
          ['activity', role.activities],
          ['approval', role.approvals],
          ['escalation', role.escalations]
        ];
        for (const [kind, list] of kinds) {
          list.forEach((text, i) => {
            q.run(
              'INSERT INTO role_items (id, role_id, kind, text, position, domain_key, provenance, created_at) VALUES (?,?,?,?,?,?,?,?)',
              id('rit'), rid, kind, resolveText(text, params), i, domainKey, PROVENANCE.AI, at
            );
          });
        }
        existing = q.get('SELECT * FROM roles WHERE id = ?', rid);
      }
      roleIds[role.code] = existing.id;
      indexRole(existing, q.all('SELECT * FROM role_items WHERE role_id = ?', existing.id));
    }

    // ----------------------------------------------------------- RACI -----
    let matrixId = null;
    if (created.raci) {
      matrixId = id('mtx');
      q.run(
        'INSERT INTO raci_matrices (id, name, domain_key, mode, description, document_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)',
        matrixId, `${model.name} RACI Matrix`, domainKey, 'raci',
        `Responsibility assignment for ${model.name} activities.`, created.raci.id, at, at
      );
      const colIds = {};
      model.roles.forEach((code, i) => {
        const cid = id('rcl');
        q.run('INSERT INTO raci_roles (id, matrix_id, role_id, label, position) VALUES (?,?,?,?,?)',
          cid, matrixId, roleIds[code] || null, ROLE_INDEX[code]?.shortName || code, i);
        colIds[code] = cid;
      });
      model.raciActivities.forEach((a, i) => {
        const aid = id('rac');
        q.run('INSERT INTO raci_activities (id, matrix_id, activity, phase, position) VALUES (?,?,?,?,?)',
          aid, matrixId, a.activity, a.phase || null, i);
        for (const [code, value] of Object.entries(a.assign)) {
          if (!colIds[code]) continue;
          q.run('INSERT INTO raci_assignments (id, matrix_id, activity_id, role_col_id, value) VALUES (?,?,?,?,?)',
            id('ras'), matrixId, aid, colIds[code], value);
        }
        const summary = Object.entries(a.assign)
          .map(([code, v]) => `${v}: ${roleName(code)}`).join('; ');
        indexRaciActivity(matrixId, { id: aid, activity: a.activity, phase: a.phase }, summary, domainKey);
      });
    }

    return {
      packageId,
      domainKey,
      documents: Object.values(created).map(({ id: did, reference, title, docType }) => ({ id: did, reference, title, docType })),
      controls: controlRows.length,
      evidence: evidenceCounter,
      raciMatrixId: matrixId,
      frameworks: frameworkCodes,
      assumptions,
      parameters: params
    };
  });

  return run();
}

/** Rough evidence typing so the register can be filtered meaningfully. */
function classifyEvidence(text) {
  const t = text.toLowerCase();
  if (/(config|configuration|policy setting|baseline|export)/.test(t)) return 'configuration';
  if (/(report|analysis|trend|dashboard)/.test(t)) return 'report';
  if (/(log|audit trail|recording|timestamp)/.test(t)) return 'log';
  if (/(approval|sign-off|authorisation|minutes|acknowledg)/.test(t)) return 'approval';
  if (/(register|inventory|catalogue|list|matrix)/.test(t)) return 'register';
  if (/(certificate|attestation|assurance)/.test(t)) return 'attestation';
  if (/(test|exercise|scan|assessment)/.test(t)) return 'test_result';
  return 'record';
}

/** Preview a package without persisting it — used by the wizard. */
export function previewPackage({
  domainKey, docTypes, frameworkCodes = [], org = {}, parameterOverrides = {}, language = 'en'
}) {
  const model = localisedModel(domainKey, language);
  if (!model) throw Object.assign(new Error(`Unknown domain "${domainKey}"`), { status: 400 });
  const params = buildParameterSet(domainKey, org, parameterOverrides, model.language);
  const selectedFrameworks = FRAMEWORKS.filter((f) => frameworkCodes.includes(f.code));
  const roles = model.roles.map((c) => ROLE_INDEX[c]).filter(Boolean);

  const controlDrafts = model.requirements.map((req, i) => ({
    control_id: `${domainShort(domainKey)}-${padNumber(i + 1)}`,
    name: req.controlName,
    control_type: req.controlType,
    control_nature: req.controlNature,
    frequency: resolveText(req.frequency, params),
    responsible_role: roleName(defaultResponsible(model, req)),
    risk: resolveText(req.risk, params),
    risk_rating: req.riskRating,
    kpi: resolveText(req.kpi, params),
    evidenceItems: req.evidence.map((e) => resolveText(e, params)),
    mappingLabel: applicableRefs(req, frameworkCodes).map((m) => `${m.framework} ${m.ref}`).join('; ')
  }));

  const builders = {
    policy: () => buildPolicy({ model, params, org, frameworkCodes, frameworks: selectedFrameworks }),
    standard: () => buildStandard({ model, params, frameworkCodes, frameworks: selectedFrameworks }),
    procedure: () => buildProcedureDoc({ model, params, frameworkCodes }),
    guideline: () => buildGuideline({ model, params }),
    roles: () => buildRolesDoc({ model, params, roles }),
    raci: () => buildRaciDoc({ model, params }),
    control_matrix: () => buildControlMatrix({ model, params, frameworkCodes, controls: controlDrafts }),
    framework: () => buildFrameworkDoc({ model, params, frameworks: selectedFrameworks, frameworkCodes })
  };

  return {
    domain: { key: domainKey, name: model.name },
    parameters: params,
    assumptions: collectAssumptions(org, model, params),
    controls: controlDrafts,
    language: model.language,
    // False when the domain has no Arabic model: the preview shows English and
    // says so, rather than letting the wizard imply a translation exists.
    fullyTranslated: model.fullyTranslated !== false,
    documents: withLanguage(model.language, () => (docTypes || []).filter((t) => builders[t]).map((t) => {
      const d = builders[t]();
      return {
        docType: t,
        title: d.title,
        reference: `${DOC_TYPE_PREFIX[t]}-${domainShort(domainKey)}-XXX`,
        sections: d.sections.map((s) => ({ key: s.key, heading: s.heading, body: s.body, provenance: s.provenance })),
        flow: d.flow || null
      };
    }))
  };
}
