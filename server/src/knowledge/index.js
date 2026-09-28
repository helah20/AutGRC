/**
 * Knowledge base entry point.
 *
 * Assembles the domain requirement models from their source modules,
 * normalises the two authoring formats into one shape, and validates
 * referential integrity at load time so that a broken seed fails fast
 * rather than producing a subtly wrong governance document.
 */

import { DOMAIN_META, DOMAIN_INDEX, DOMAIN_CATEGORIES, domainName, domainShort, resolveText, unresolvedPlaceholders } from './domains.js';
import { FRAMEWORKS, REQUIREMENTS, CROSSWALKS, SOURCE_NOTE } from './frameworks.js';
import { ROLE_LIBRARY, ROLE_INDEX, roleName, roleShort, localisedRole, localisedRoles } from './roles.js';
import { buildProcedure, STD_ROLES } from './req-helpers.js';
import { ACCESS_DOMAINS } from './req-access.js';
import { OPERATE_DOMAINS } from './req-operate.js';
import { DATA_DOMAINS } from './req-data.js';
import { GOVERN_DOMAINS } from './req-govern.js';
import { TECH_DOMAINS } from './req-tech.js';
import { RESILIENCE_DOMAINS } from './req-resilience.js';
import {
  AR_DOMAINS, LANGUAGES, isTranslated, translatedDomains,
  arText, arParameters, arObjectives, arDomainName, arFrequency, arParameterLabel, AR_ROLES,
  AR_PROCEDURES, arProcedure
} from './ar/index.js';

const SOURCES = [ACCESS_DOMAINS, OPERATE_DOMAINS, DATA_DOMAINS, GOVERN_DOMAINS, TECH_DOMAINS, RESILIENCE_DOMAINS];

/** Normalise both authoring formats into a single domain-model shape. */
function assemble() {
  const models = {};
  for (const source of SOURCES) {
    for (const [key, raw] of Object.entries(source)) {
      if (models[key]) throw new Error(`Duplicate domain model for "${key}"`);
      const meta = DOMAIN_INDEX[key];
      if (!meta) throw new Error(`Domain model "${key}" has no entry in DOMAIN_META`);

      const procedure = raw.procedure
        ? raw.procedure
        : buildProcedure(meta.name, raw.procedureSeed, raw.requirements);

      // Compact seeds do not list roles explicitly; derive them from the RACI.
      const roles = raw.roles?.length
        ? raw.roles
        : [...new Set(raw.raciActivities.flatMap((a) => Object.keys(a.assign)))];

      models[key] = {
        key,
        name: meta.name,
        short: meta.short,
        category: meta.category,
        description: meta.description,
        objectives: raw.objectives,
        parameters: raw.parameters || {},
        requirements: raw.requirements.map((r, i) => ({ ...r, index: i + 1 })),
        procedure,
        roles,
        raciActivities: raw.raciActivities
      };
    }
  }
  return models;
}

export const DOMAIN_MODELS = assemble();

/** Framework requirement lookup: "ISO-27001::A.8.2" -> requirement tuple. */
const REQ_LOOKUP = new Map();
for (const [code, rows] of Object.entries(REQUIREMENTS)) {
  for (const row of rows) REQ_LOOKUP.set(`${code}::${row[0]}`, row);
}

export function frameworkRequirementExists(code, ref) {
  return REQ_LOOKUP.has(`${code}::${ref}`);
}

export function lookupFrameworkRequirement(code, ref) {
  const row = REQ_LOOKUP.get(`${code}::${ref}`);
  if (!row) return null;
  return { framework: code, ref: row[0], title: row[1], domainKey: row[2], level: row[3], parentRef: row[4] || null };
}

/**
 * Referential integrity check over the seed data. Returns a list of problems;
 * an empty list means the knowledge base is internally consistent.
 */
export function validateKnowledgeBase() {
  const problems = [];
  const frameworkCodes = new Set(FRAMEWORKS.map((f) => f.code));

  for (const code of Object.keys(REQUIREMENTS)) {
    if (!frameworkCodes.has(code)) problems.push(`REQUIREMENTS has entries for unknown framework "${code}"`);
  }

  for (const model of Object.values(DOMAIN_MODELS)) {
    const seenKeys = new Set();
    for (const req of model.requirements) {
      if (seenKeys.has(req.key)) problems.push(`${model.key}: duplicate requirement key "${req.key}"`);
      seenKeys.add(req.key);
      for (const field of ['policy', 'standard', 'controlName', 'risk', 'evidence', 'refs']) {
        if (!req[field]) problems.push(`${model.key}.${req.key}: missing "${field}"`);
      }
      // Every placeholder must resolve against the domain parameter set.
      for (const text of [req.policy, req.standard, req.kpi, req.frequency]) {
        for (const ph of unresolvedPlaceholders(text)) {
          if (ph !== 'orgName' && !(ph in model.parameters)) {
            problems.push(`${model.key}.${req.key}: placeholder {{${ph}}} has no parameter`);
          }
        }
      }
      for (const [code, refs] of Object.entries(req.refs || {})) {
        if (!frameworkCodes.has(code)) {
          problems.push(`${model.key}.${req.key}: unknown framework "${code}"`);
          continue;
        }
        for (const ref of refs) {
          if (!frameworkRequirementExists(code, ref)) {
            problems.push(`${model.key}.${req.key}: ${code} reference "${ref}" not in catalogue`);
          }
        }
      }
    }

    for (const step of model.procedure.steps) {
      for (const ph of unresolvedPlaceholders(`${step.detail} ${step.name} ${step.actor}`)) {
        if (ph !== 'orgName' && !(ph in model.parameters)) {
          problems.push(`${model.key}: procedure step "${step.name}" placeholder {{${ph}}} has no parameter`);
        }
      }
    }

    for (const activity of model.raciActivities) {
      const values = Object.values(activity.assign);
      const accountable = values.filter((v) => v === 'A').length;
      const responsible = values.filter((v) => v === 'R').length;
      if (accountable !== 1) problems.push(`${model.key}: "${activity.activity}" has ${accountable} accountable roles (must be exactly 1)`);
      if (responsible < 1) problems.push(`${model.key}: "${activity.activity}" has no responsible role`);
      for (const code of Object.keys(activity.assign)) {
        if (!ROLE_INDEX[code]) problems.push(`${model.key}: "${activity.activity}" references unknown role "${code}"`);
      }
    }

    for (const code of model.roles) {
      if (!ROLE_INDEX[code]) problems.push(`${model.key}: roles list references unknown role "${code}"`);
    }
  }

  for (const [srcCode, srcRef, tgtCode, tgtRef] of CROSSWALKS) {
    if (!frameworkRequirementExists(srcCode, srcRef)) problems.push(`Crosswalk source ${srcCode} ${srcRef} not in catalogue`);
    if (!frameworkRequirementExists(tgtCode, tgtRef)) problems.push(`Crosswalk target ${tgtCode} ${tgtRef} not in catalogue`);
  }

  // ------------------------------------------------------- translations --
  // A domain that is partly translated is worse than one that is not: the
  // generated document would mix two languages mid-clause, and the wizard
  // would report it as translated. Either all of a domain's text is present
  // or none of it is.
  for (const [domainKey, arModel] of Object.entries(AR_DOMAINS)) {
    const model = DOMAIN_MODELS[domainKey];
    if (!model) {
      problems.push(`Arabic model exists for unknown domain "${domainKey}"`);
      continue;
    }
    if (!arModel.name) problems.push(`${domainKey}: Arabic model has no name`);

    const englishKeys = new Set(model.requirements.map((r) => r.key));
    for (const key of Object.keys(arModel.requirements || {})) {
      if (!englishKeys.has(key)) {
        problems.push(`${domainKey}: Arabic model has requirement "${key}" that does not exist in the English model`);
      }
    }

    for (const requirement of model.requirements) {
      const arabic = arModel.requirements?.[requirement.key];
      if (!arabic) {
        problems.push(`${domainKey}.${requirement.key}: no Arabic rendering`);
        continue;
      }
      for (const field of ['title', 'policy', 'standard', 'guidance', 'controlName', 'kpi', 'risk']) {
        if (requirement[field] && !arabic[field]) {
          problems.push(`${domainKey}.${requirement.key}: Arabic "${field}" is missing`);
        }
      }
      // A placeholder dropped in translation would silently lose the numeric
      // commitment the whole consistency model rests on.
      for (const field of ['policy', 'standard', 'kpi']) {
        if (!requirement[field] || !arabic[field]) continue;
        const english = new Set(unresolvedPlaceholders(requirement[field]));
        const translated = new Set(unresolvedPlaceholders(arabic[field]));
        for (const name of english) {
          if (!translated.has(name)) {
            problems.push(`${domainKey}.${requirement.key}: Arabic "${field}" drops the {{${name}}} placeholder`);
          }
        }
        for (const name of translated) {
          if (!english.has(name)) {
            problems.push(`${domainKey}.${requirement.key}: Arabic "${field}" adds a {{${name}}} placeholder the English does not have`);
          }
        }
      }
    }

    // A domain declared translated must have a translated procedure, or the
    // generated Procedure document comes out in English inside an Arabic
    // package and nothing in the coverage figure says so.
    if (!AR_PROCEDURES[domainKey]) {
      problems.push(`${domainKey}: declared translated but has no Arabic procedure block`);
    }

    // Every parameter must carry Arabic wording: a half-translated set would
    // leave an English value embedded in an Arabic clause.
    for (const name of Object.keys(model.parameters || {})) {
      if (!(arModel.parameters || {})[name]) {
        problems.push(`${domainKey}: Arabic parameter "${name}" is missing`);
      }
    }
    for (const name of Object.keys(arModel.parameters || {})) {
      if (!(model.parameters || {})[name]) {
        problems.push(`${domainKey}: Arabic parameter "${name}" does not exist in the English model`);
      }
    }
  }

  // ------------------------------------------------- translated procedures --
  // Position carries meaning here: the flow diagram numbers the steps, the
  // decisions table pairs a question with its branches, and the RACI matrix
  // pairs an activity name with an assignment row keyed on role codes. A list
  // of the wrong length would shift a name onto the wrong row.
  for (const domainKey of Object.keys(AR_PROCEDURES)) {
    if (!DOMAIN_MODELS[domainKey]) problems.push(`Arabic procedure exists for unknown domain "${domainKey}"`);
  }
  for (const [domainKey, arabic] of Object.entries(AR_PROCEDURES)) {
    const model = DOMAIN_MODELS[domainKey];
    if (!model) continue;
    const proc = model.procedure;
    if (!arabic.purpose) problems.push(`${domainKey}: Arabic procedure has no purpose`);
    for (const field of ['preconditions', 'inputs', 'outputs', 'escalation', 'records', 'kpis', 'steps']) {
      const list = arabic[field];
      if (!Array.isArray(list)) { problems.push(`${domainKey}: Arabic procedure "${field}" is missing`); continue; }
      if (list.length !== proc[field].length) {
        problems.push(`${domainKey}: Arabic procedure "${field}" has ${list.length} entries where the English has ${proc[field].length}`);
      }
    }
    if (!Array.isArray(arabic.raciActivities)) {
      problems.push(`${domainKey}: Arabic RACI activity names are missing`);
    } else if (arabic.raciActivities.length !== model.raciActivities.length) {
      problems.push(`${domainKey}: ${arabic.raciActivities.length} Arabic RACI activity names for ${model.raciActivities.length} activities`);
    }

    const placeholderPairs = [[`${domainKey}: procedure purpose`, arabic.purpose, proc.purpose]];
    for (const field of ['preconditions', 'inputs', 'outputs', 'escalation', 'records']) {
      (arabic[field] || []).forEach((text, i) => {
        if (proc[field][i] !== undefined) placeholderPairs.push([`${domainKey}: procedure ${field} ${i + 1}`, text, proc[field][i]]);
      });
    }
    (arabic.kpis || []).forEach((kpi, i) => {
      const english = proc.kpis[i];
      if (!english) return;
      if (!kpi?.name || !kpi?.target) problems.push(`${domainKey}: Arabic procedure KPI ${i + 1} is incomplete`);
      placeholderPairs.push([`${domainKey}: procedure KPI ${i + 1} target`, kpi?.target, english.target]);
    });
    (arabic.steps || []).forEach((step, i) => {
      const english = proc.steps[i];
      if (!english) return;
      for (const field of ['name', 'actor', 'detail']) {
        if (!step?.[field]) problems.push(`${domainKey}: Arabic procedure step ${i + 1} has no "${field}"`);
      }
      placeholderPairs.push([`${domainKey}: procedure step ${i + 1} detail`, step?.detail, english.detail]);
      if (Boolean(english.decision) !== Boolean(step?.decision)) {
        problems.push(`${domainKey}: Arabic procedure step ${i + 1} ${step?.decision ? 'adds a decision the English does not have' : 'drops the English decision'}`);
      } else if (english.decision && step.decision) {
        for (const field of ['question', 'yes', 'no']) {
          if (!step.decision[field]) problems.push(`${domainKey}: Arabic procedure step ${i + 1} decision has no "${field}"`);
          placeholderPairs.push([`${domainKey}: procedure step ${i + 1} decision ${field}`, step.decision[field], english.decision[field]]);
        }
      }
    });
    for (const [label, translated, english] of placeholderPairs) {
      if (!translated || !english) continue;
      const before = new Set(unresolvedPlaceholders(english));
      const after = new Set(unresolvedPlaceholders(translated));
      for (const name of before) {
        if (!after.has(name)) problems.push(`${label}: Arabic drops the {{${name}}} placeholder`);
      }
      for (const name of after) {
        if (!before.has(name)) problems.push(`${label}: Arabic adds a {{${name}}} placeholder the English does not have`);
      }
    }
    const known = new Set(['purpose', 'preconditions', 'inputs', 'outputs', 'escalation', 'records', 'kpis', 'steps', 'raciActivities']);
    for (const field of Object.keys(arabic)) {
      if (!known.has(field)) problems.push(`${domainKey}: Arabic procedure has unknown field "${field}"`);
    }
  }

  // ------------------------------------------------------ translated roles --
  // The Roles document pairs each list against the role's RACI assignments by
  // position, so a translated list of a different length would misalign the
  // document rather than merely read oddly.
  const ROLE_TEXT = ['name', 'shortName', 'purpose', 'reportingLine', 'authority'];
  const ROLE_LISTS = ['competencies', 'responsibilities', 'accountabilities', 'activities', 'approvals', 'escalations'];
  for (const code of Object.keys(AR_ROLES)) {
    if (!ROLE_INDEX[code]) problems.push(`Arabic role exists for unknown role "${code}"`);
  }
  for (const role of ROLE_LIBRARY) {
    const arabic = AR_ROLES[role.code];
    if (!arabic) continue;
    for (const field of ROLE_TEXT) {
      if (!arabic[field]) problems.push(`role ${role.code}: Arabic "${field}" is missing`);
    }
    for (const field of ROLE_LISTS) {
      const list = arabic[field];
      if (!Array.isArray(list)) { problems.push(`role ${role.code}: Arabic "${field}" is missing`); continue; }
      if (list.length !== role[field].length) {
        problems.push(`role ${role.code}: Arabic "${field}" has ${list.length} entries where the English has ${role[field].length}`);
      }
    }
    if (!Array.isArray(arabic.interfaces)) {
      problems.push(`role ${role.code}: Arabic "interfaces" is missing`);
    } else {
      if (arabic.interfaces.length !== role.interfaces.length) {
        problems.push(`role ${role.code}: Arabic "interfaces" has ${arabic.interfaces.length} entries where the English has ${role.interfaces.length}`);
      }
      for (const [i, entry] of arabic.interfaces.entries()) {
        if (!entry?.role || !entry?.nature) problems.push(`role ${role.code}: Arabic interface ${i + 1} is incomplete`);
      }
    }
    // {{orgName}} is the only placeholder a role carries; dropping it would
    // leave the Arabic role purpose describing no organisation at all.
    for (const field of ['purpose', 'reportingLine', 'authority']) {
      if (!role[field] || !arabic[field]) continue;
      const english = new Set(unresolvedPlaceholders(role[field]));
      const translated = new Set(unresolvedPlaceholders(arabic[field]));
      for (const name of english) {
        if (!translated.has(name)) problems.push(`role ${role.code}: Arabic "${field}" drops the {{${name}}} placeholder`);
      }
      for (const name of translated) {
        if (!english.has(name)) problems.push(`role ${role.code}: Arabic "${field}" adds a {{${name}}} placeholder the English does not have`);
      }
    }
    const known = new Set([...ROLE_TEXT, ...ROLE_LISTS, 'interfaces']);
    for (const field of Object.keys(arabic)) {
      if (!known.has(field)) problems.push(`role ${role.code}: Arabic model has unknown field "${field}"`);
    }
  }

  return problems;
}

/** Merge domain parameters with organisation context for text resolution. */
export function buildParameterSet(domainKey, orgProfile = {}, overrides = {}, language = 'en') {
  // The Arabic parameter set is the same commitments in Arabic wording, so it
  // is taken from the localised model rather than merged ad hoc here.
  const model = localisedModel(domainKey, language);
  const base = {
    orgName: orgProfile.org_name || orgProfile.orgName
      || (language === 'ar' ? 'المنظمة' : 'the Organisation'),
    ...(model ? model.parameters : {})
  };
  // Parameters may themselves contain {{orgName}}; resolve one level deep.
  for (const [k, v] of Object.entries(base)) {
    if (typeof v === 'string' && v.includes('{{')) base[k] = resolveText(v, base);
  }
  return { ...base, ...overrides };
}

export {
  DOMAIN_META, DOMAIN_INDEX, DOMAIN_CATEGORIES, domainName, domainShort, resolveText, unresolvedPlaceholders,
  FRAMEWORKS, REQUIREMENTS, CROSSWALKS, SOURCE_NOTE,
  ROLE_LIBRARY, ROLE_INDEX, roleName, roleShort, localisedRole, localisedRoles, STD_ROLES,
  AR_DOMAINS, LANGUAGES, isTranslated, translatedDomains,
  arText, arParameters, arObjectives, arDomainName, arFrequency, arParameterLabel
};

/**
 * The canonical model for one domain in one language.
 *
 * Arabic is a rendering of the same model, not a different model: the keys,
 * the structure, the control types and the framework references are shared,
 * and only the wording differs. A field with no translation falls back to the
 * English text rather than rendering empty, and `translated` records which
 * fields actually came from the Arabic model so the generator can mark the
 * document honestly.
 */
export function localisedModel(domainKey, language = 'en') {
  const model = DOMAIN_MODELS[domainKey];
  if (!model) return null;
  if (language !== 'ar' || !isTranslated(domainKey)) {
    return { ...model, language: 'en', fullyTranslated: language === 'en' };
  }

  const TEXT_FIELDS = ['title', 'policy', 'standard', 'guidance', 'controlName', 'kpi', 'risk'];
  let translatedFields = 0;
  let totalFields = 0;

  const requirements = model.requirements.map((requirement) => {
    const out = { ...requirement };
    for (const field of TEXT_FIELDS) {
      if (requirement[field] === undefined) continue;
      totalFields += 1;
      const arabic = arText(domainKey, requirement.key, field);
      if (arabic) { out[field] = arabic; translatedFields += 1; }
    }
    const evidence = arText(domainKey, requirement.key, 'evidence');
    if (Array.isArray(evidence) && evidence.length) out.evidence = evidence;
    // A test frequency comes from a vocabulary shared by every domain, so it
    // is translated centrally rather than restated per requirement. A value
    // that is only a placeholder is already Arabic through its parameter.
    if (requirement.frequency) {
      totalFields += 1;
      const arabic = arFrequency(requirement.frequency);
      if (arabic !== requirement.frequency || !/[A-Za-z]/.test(requirement.frequency.replace(/\{\{\w+\}\}/g, ''))) {
        out.frequency = arabic;
        translatedFields += 1;
      }
    }
    return out;
  });

  // The procedure block and the RACI activity names are the organisation's own
  // process, so they are translated as content. Both are structural: the flow
  // diagram numbers the steps and the RACI matrix pairs each activity name with
  // an assignment row, so a translation of a different length would misalign
  // the document rather than merely read oddly. validateKnowledgeBase enforces
  // the shape; here an incomplete block is simply not used.
  const arabicProcedure = arProcedure(domainKey);
  let procedure = model.procedure;
  let raciActivities = model.raciActivities;
  // Counted whether or not a translation exists. Counting it only when present
  // meant a domain with translated requirements and no translated procedure
  // reported fullyTranslated while generating an English Procedure — precisely
  // the mixed-language document this figure is supposed to expose.
  totalFields += 1;
  if (arabicProcedure) {
    const sameShape =
      arabicProcedure.steps?.length === model.procedure.steps.length &&
      arabicProcedure.raciActivities?.length === model.raciActivities.length;
    if (sameShape) {
      procedure = {
        ...model.procedure,
        purpose: arabicProcedure.purpose || model.procedure.purpose,
        preconditions: arabicProcedure.preconditions || model.procedure.preconditions,
        inputs: arabicProcedure.inputs || model.procedure.inputs,
        outputs: arabicProcedure.outputs || model.procedure.outputs,
        escalation: arabicProcedure.escalation || model.procedure.escalation,
        records: arabicProcedure.records || model.procedure.records,
        kpis: arabicProcedure.kpis || model.procedure.kpis,
        steps: model.procedure.steps.map((step, i) => {
          const arabicStep = arabicProcedure.steps[i];
          if (!arabicStep) return step;
          return {
            ...step,
            name: arabicStep.name || step.name,
            actor: arabicStep.actor || step.actor,
            detail: arabicStep.detail || step.detail,
            ...(step.decision && arabicStep.decision ? { decision: arabicStep.decision } : {})
          };
        })
      };
      // The assignment map is keyed on role codes, so only the name changes.
      raciActivities = model.raciActivities.map((activity, i) => ({
        ...activity,
        activity: arabicProcedure.raciActivities[i] || activity.activity
      }));
      translatedFields += 1;
    }
  }

  return {
    ...model,
    requirements,
    procedure,
    raciActivities,
    // Arabic parameter wording for the same commitment, never a different one.
    parameters: { ...model.parameters, ...(arParameters(domainKey) || {}) },
    objectives: arObjectives(domainKey) || model.objectives,
    name: arDomainName(domainKey) || model.name,
    // The description is rendered inside the generated policy, so it is
    // document content rather than interface chrome.
    description: AR_DOMAINS[domainKey]?.description || model.description,
    language: 'ar',
    fullyTranslated: translatedFields === totalFields,
    translationCoverage: totalFields ? Math.round((translatedFields / totalFields) * 100) : 0
  };
}
