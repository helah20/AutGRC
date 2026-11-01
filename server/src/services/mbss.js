/**
 * Minimum Baseline Security Standards (MBSS): one per technology, generated
 * from the catalogue (knowledge/mbss) into the document library as Standards,
 * so they are reviewed, approved, published and exported like every other
 * document, and checked with a workbook an engineer fills in per asset.
 *
 * A baseline applies to the technology wherever it runs and to every project
 * that introduces it: nothing goes live until the baseline is applied and
 * verified (NCA ECC 1-6, 2-3; ISO/IEC 27001 A.8.9; CIS Controls 4).
 */

import { db, q, nowIso, toJson } from '../db/index.js';
import { id, padNumber } from '../utils/ids.js';
import { buildParameterSet, resolveText, arDomainName, domainName } from '../knowledge/index.js';
import {
  MBSS_TECHNOLOGIES, mbssTechnology, customTechnology, criticality, itemRefs,
  AREAS, AREA_ORDER, CATEGORIES, MBSS_PARAMETER_SOURCES
} from '../knowledge/mbss/index.js';
import { h, joinBlocks } from './html.js';
import { indexDocument } from './search.js';

const P = 'organizational_standard';

const CATEGORY_DOMAIN = {
  os: 'endpoint_security', endpoint: 'endpoint_security', virtualisation: 'endpoint_security',
  network: 'network_security', database: 'database_security', web: 'application_security',
  cloud: 'cloud_security', identity: 'iam', other: 'endpoint_security'
};

const CRITICALITY = {
  en: { high: 'High', medium: 'Medium', low: 'Low' },
  ar: { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' }
};

/** The agreed values a baseline cites, in the document's language, from the Standards that own them. */
export function mbssParameters(org = {}, language = 'en') {
  const out = { orgName: org.org_name || (language === 'ar' ? 'المنظمة' : 'the Organisation') };
  for (const [domain, names] of Object.entries(MBSS_PARAMETER_SOURCES)) {
    const set = buildParameterSet(domain, org, {}, language);
    for (const n of names) if (set[n] !== undefined) out[n] = set[n];
  }
  return out;
}

/** The catalogue as the screen shows it. */
export function mbssCatalogue({ language = 'en', suggested = [] } = {}) {
  const existing = q.all(
    "SELECT json_extract(generation_meta, '$.technology') AS tech, COUNT(*) AS n FROM documents WHERE json_extract(generation_meta, '$.kind') = 'mbss' GROUP BY tech"
  );
  const count = Object.fromEntries(existing.map((r) => [r.tech, r.n]));
  return {
    categories: Object.entries(CATEGORIES).map(([key, v]) => ({ key, name: language === 'ar' ? v.ar : v.en })),
    technologies: MBSS_TECHNOLOGIES.map((t) => ({
      key: t.key, name: language === 'ar' ? t.nameAr : t.name, category: t.category,
      benchmark: t.benchmark, items: t.items.length,
      level2: t.items.filter((i) => i.level === 2).length,
      organisational: t.items.filter((i) => i.source === 'org').length,
      inEnvironment: suggested.includes(t.key),
      existing: count[t.key] || 0
    }))
  };
}

/**
 * The document for one technology.
 *
 * `level` 1 makes level 1 items required and lists level 2 ones as
 * recommended; level 2 requires both.
 */
export function buildMbss({ tech, language = 'en', org = {}, level = 1, benchmarkVersion = '' }) {
  const ar = language === 'ar';
  const tx = (en, arabic) => (ar ? arabic : en);
  const params = mbssParameters(org, language);
  const name = ar ? tech.nameAr : tech.name;
  const R = (text) => resolveText(text, params);
  const version = benchmarkVersion
    || tx('to be recorded on approval, with the recommendation numbers verified against it',
      'يُسجَّل عند الاعتماد، مع التحقق من أرقام التوصيات مقابله');
  const domain = tech.domain || CATEGORY_DOMAIN[tech.category] || 'endpoint_security';
  const section = (key, heading, body) => ({ key, heading, body, provenance: P, sourceRefs: [] });

  const sections = [
    section('purpose', tx('Purpose', 'الغرض'), joinBlocks(
      h.p(tx(
        `This Standard sets the minimum security configuration for ${name} at ${params.orgName}. It is the hardening baseline every instance is built to and checked against.`,
        `يحدد هذا المعيار الحد الأدنى من إعدادات الأمان لـ ${name} في ${params.orgName}، وهو خط أساس التقوية الذي تُبنى عليه كل نسخة وتُقيَّم مقابله.`)),
      h.p(tx(
        'It implements the configuration baseline requirement of the domain Standard and of NCA ECC 2-3, and its values are those the organisation agreed in its Standards.',
        'وهو ينفّذ متطلب خطوط أساس الإعدادات في معيار المجال وفي المجال الفرعي 2-3 من الضوابط الأساسية للأمن السيبراني، وقيمه هي القيم التي اعتمدتها المنشأة في معاييرها.'))
    )),

    section('scope', tx('Scope and applicability', 'النطاق والانطباق'), joinBlocks(
      h.p(tx(
        `It applies to every instance of ${name} in production, disaster recovery, test and development, whoever operates it, including services run by third parties for ${params.orgName}.`,
        `ينطبق على كل نسخة من ${name} في بيئات الإنتاج والتعافي من الكوارث والاختبار والتطوير، أياً كان من يشغّلها، بما في ذلك الخدمات التي تشغّلها أطراف خارجية لصالح ${params.orgName}.`)),
      h.ul([
        tx('New systems and projects: the baseline is applied and verified before the system goes live (NCA ECC 1-6).',
          'الأنظمة والمشاريع الجديدة: يُطبَّق خط الأساس ويُتحقق منه قبل تشغيل النظام (الضوابط الأساسية للأمن السيبراني 1-6).'),
        tx('Existing systems: brought to the baseline, with any item not yet met recorded as an exception and a remediation date.',
          'الأنظمة القائمة: تُرفع إلى خط الأساس، ويُسجَّل كل بند لم يُستوفَ بعد كاستثناء بتاريخ معالجة.'),
        tx('After a major upgrade or a change to the baseline: verified again.', 'بعد ترقية كبيرة أو تغيير في خط الأساس: يُعاد التحقق.')
      ])
    )),

    section('sources', tx('Sources', 'المصادر'), joinBlocks(
      h.table([tx('Source', 'المصدر'), tx('Use', 'الاستخدام')], [
        [tech.benchmark, tx(`Primary source of the settings. Version applied: ${version}.`, `المصدر الأساسي للإعدادات. الإصدار المطبق: ${version}.`)],
        [tx('Vendor security and hardening guidance', 'إرشادات الأمان والتقوية لدى المورّد'), tx('Where the benchmark is silent.', 'حيث لا يغطي المعيار المرجعي.')],
        [tx('NCA Essential Cybersecurity Controls 1-6, 2-2, 2-3, 2-5, 2-8, 2-10, 2-12', 'الضوابط الأساسية للأمن السيبراني 1-6 و2-2 و2-3 و2-5 و2-8 و2-10 و2-12'), tx('What must be hardened, and the additions marked "Organisation".', 'ما يجب تقويته، والإضافات المعلَّمة «المنشأة».')],
        ['ISO/IEC 27001:2022 A.8.9; CIS Controls v8 4', tx('Configuration management.', 'إدارة الإعدادات.')]
      ]),
      h.callout('note', tx('Attribution', 'الإسناد'), tx(
        `Settings marked "CIS" are based on the ${tech.benchmark}, © Center for Internet Security, licensed under CC BY-NC-SA 4.0 (creativecommons.org/licenses/by-nc-sa/4.0). They are stated here in the organisation's own words and values; the benchmark itself is the authority for each recommendation.`,
        `البنود المعلَّمة «CIS» مبنية على ${tech.benchmark}، © Center for Internet Security، بترخيص CC BY-NC-SA 4.0 (creativecommons.org/licenses/by-nc-sa/4.0). وهي مصاغة هنا بلغة المنشأة وقيمها، والمعيار المرجعي نفسه هو المرجع لكل توصية.`))
    )),

    section('roles', tx('Roles and responsibilities', 'الأدوار والمسؤوليات'), h.table(
      [tx('Role', 'الدور'), tx('Responsibility', 'المسؤولية')],
      [
        [tx('System owner', 'مالك النظام'), tx('Accountable for the system meeting this baseline and for its exceptions.', 'مساءل عن استيفاء النظام لخط الأساس وعن استثناءاته.')],
        [tx('IT operations', 'عمليات تقنية المعلومات'), tx('Applies the baseline through images, policies and configuration management, and remediates drift.', 'يطبّق خط الأساس عبر الصور والسياسات وإدارة الإعدادات، ويعالج الانحراف.')],
        [tx('Cybersecurity', 'الأمن السيبراني'), tx('Owns the baseline, verifies compliance and reviews exceptions; the CISO approves them.', 'يملك خط الأساس، ويتحقق من الالتزام ويراجع الاستثناءات، ويعتمدها رئيس الأمن السيبراني.')],
        [tx('Internal audit', 'التدقيق الداخلي'), tx('Tests compliance independently.', 'يختبر الالتزام باستقلالية.')]
      ]
    ))
  ];

  // The baseline, one section per area.
  for (const area of AREA_ORDER) {
    const items = tech.items.filter((i) => i.area === area);
    if (!items.length) continue;
    const refs = AREAS[area].refs;
    sections.push(section(`baseline_${area}`, ar ? AREAS[area].ar : AREAS[area].en, joinBlocks(
      h.table(
        [tx('ID', 'الرقم'), tx('Requirement', 'المتطلب'), tx('Verification', 'التحقق'), tx('Profile', 'المستوى'), tx('Criticality', 'الأهمية'), tx('Source', 'المصدر')],
        items.map((i) => [
          i.id,
          R(ar ? i.ar : i.en),
          R(ar ? i.checkAr : i.checkEn),
          i.level === 1 ? 'L1' : (level >= 2 ? 'L2' : tx('L2 (recommended)', 'L2 (موصى به)')),
          CRITICALITY[language][criticality(i)],
          i.source === 'cis' ? 'CIS' : tx('Organisation', 'المنشأة')
        ]),
        null,
        // The requirement and its check carry the text; the rest are short.
        [10, 36, 30, 8, 8, 8]
      ),
      h.p(tx(
        `Answers: NCA ECC ${refs['NCA-ECC'].join(', ')}; CIS Controls ${refs['CIS-V8'].join(', ')}; ISO/IEC 27001 ${refs['ISO-27001'].join(', ')}.`,
        `يعالج: الضوابط الأساسية للأمن السيبراني ${refs['NCA-ECC'].join('، ')}؛ ضوابط CIS ${refs['CIS-V8'].join('، ')}؛ ISO/IEC 27001 ${refs['ISO-27001'].join('، ')}.`))
    )));
  }

  sections.push(
    section('golive', tx('Before go-live', 'قبل التشغيل'), joinBlocks(
      h.p(tx('A new system, or a system after a major change, goes live only when:', 'لا يُشغَّل نظام جديد، أو نظام بعد تغيير كبير، إلا بعد:')),
      h.ul([
        tx('every level 1 item is met or covered by an approved exception;', 'استيفاء كل بنود المستوى الأول أو تغطيتها باستثناء معتمد؛'),
        tx('the verification workbook is completed and kept as evidence;', 'إكمال كشف التحقق وحفظه كدليل؛'),
        tx('a vulnerability scan shows no open critical or high finding;', 'خلو فحص الثغرات من ملاحظات حرجة أو عالية مفتوحة؛'),
        tx('the system sends its logs to the SIEM and is in the asset inventory with a named owner.', 'إرسال النظام سجلاته إلى نظام SIEM، وتسجيله في جرد الأصول بمالك مسمّى.')
      ])
    )),
    section('verification', tx('Compliance verification', 'التحقق من الالتزام'), joinBlocks(
      h.p(R(tx(
        'Compliance is measured {{configReviewFrequency}}, before go-live and after every major change, with automated assessment where available (CIS-CAT, the vulnerability scanner\'s compliance policies, Microsoft Policy Analyzer, OpenSCAP) and the verification column of this Standard where not.',
        'يُقاس الالتزام {{configReviewFrequency}}، وقبل التشغيل، وبعد كل تغيير كبير، بالتقييم الآلي حيث يتاح (CIS-CAT، وسياسات الالتزام في أداة فحص الثغرات، وMicrosoft Policy Analyzer، وOpenSCAP)، وبعمود التحقق في هذا المعيار حيث لا يتاح.'))),
      h.p(tx(
        'Drift from the baseline is treated as an unauthorised change: corrected, or approved as an exception.',
        'يُعامَل الانحراف عن خط الأساس كتغيير غير مصرّح به: يُصحَّح، أو يُعتمد كاستثناء.'))
    )),
    section('exceptions', tx('Exceptions', 'الاستثناءات'), h.ul([
      tx('An item that cannot be applied is recorded with the item ID, the reason, the compensating control, the residual risk and its owner.', 'يُسجَّل كل بند لا يمكن تطبيقه برقمه وسببه والضابط التعويضي والخطر المتبقي ومالكه.'),
      tx('The CISO approves each exception, for no longer than 12 months.', 'يعتمد رئيس الأمن السيبراني كل استثناء لمدة لا تتجاوز 12 شهراً.'),
      tx('A value weaker than the benchmark\'s is an exception, never a silent change to the baseline.', 'القيمة الأضعف من المعيار المرجعي استثناء، ولا تكون تغييراً صامتاً لخط الأساس.')
    ])),
    section('review', tx('Review', 'المراجعة'), h.p(R(tx(
      'This Standard is reviewed {{baselineReviewFrequency}}, when a new version of the benchmark is published, and when the technology is upgraded to a new major version.',
      'يُراجَع هذا المعيار {{baselineReviewFrequency}}، وعند صدور إصدار جديد من المعيار المرجعي، وعند ترقية التقنية إلى إصدار رئيسي جديد.'))))
  );

  return {
    title: tx(`Minimum Baseline Security Standard — ${name}`, `معيار الحد الأدنى للأمان — ${name}`),
    domain,
    sections,
    params
  };
}

/** The next free reference for a technology's baseline: MBS-WSR-001. */
function nextReference(prefix) {
  const base = `MBS-${prefix}-`;
  const highest = q.all('SELECT reference FROM documents WHERE reference LIKE ?', `${base}%`)
    .reduce((max, r) => Math.max(max, Number(r.reference.slice(base.length)) || 0), 0);
  return `${base}${padNumber(highest + 1)}`;
}

/**
 * Generate baselines into the library as draft Standards, one per technology.
 * Returns the documents created.
 */
export function generateMbss({
  technologies = [], custom = null, language = 'en', level = 1, benchmarkVersions = {},
  org = {}, ownerId = null, approverId = null, classification = 'internal', userId = null
}) {
  const techs = technologies.map((key) => mbssTechnology(key)).filter(Boolean);
  if (custom?.name) {
    techs.push(customTechnology({ ...custom, domain: CATEGORY_DOMAIN[custom.category] || 'endpoint_security' }));
  }
  const at = nowIso();
  const created = [];

  db.transaction(() => {
    for (const tech of techs) {
      const built = buildMbss({ tech, language, org, level, benchmarkVersion: benchmarkVersions[tech.key] || '' });
      const docId = id('doc');
      const reference = nextReference(tech.prefix);
      const name = language === 'ar' ? tech.nameAr : tech.name;
      const meta = {
        kind: 'mbss', technology: tech.key, custom: tech.custom ? { name: tech.name, category: tech.category, benchmark: tech.benchmark } : null,
        level, benchmark: tech.benchmark, benchmarkVersion: benchmarkVersions[tech.key] || null,
        language, generatedAt: at, parameters: built.params, items: tech.items.length
      };
      q.run(
        `INSERT INTO documents
           (id, reference, title, doc_type, domain_key, status, classification, version,
            owner_id, approver_id, review_date, summary, generation_meta, provenance, created_by, created_at, updated_at, language)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        docId, reference, built.title, 'standard', built.domain, 'draft', classification, '0.1',
        ownerId, approverId, new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
        language === 'ar'
          ? `خط أساس التقوية لـ ${name}: ${tech.items.length} بنداً مبنية على ${tech.benchmark}.`
          : `Hardening baseline for ${name}: ${tech.items.length} items based on the ${tech.benchmark}.`,
        toJson(meta), P, userId, at, at, language
      );
      built.sections.forEach((s, i) => {
        q.run(
          `INSERT INTO document_sections (id, document_id, section_key, heading, body, position, provenance, source_refs, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          id('sec'), docId, s.key, s.heading, s.body, i, s.provenance, toJson(s.sourceRefs), at, at
        );
      });
      const row = q.get('SELECT * FROM documents WHERE id = ?', docId);
      const sections = q.all('SELECT * FROM document_sections WHERE document_id = ? ORDER BY position', docId);
      q.run(
        `INSERT INTO document_versions (id, document_id, version, snapshot, change_note, change_type, author_id, author_name, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        id('ver'), docId, '0.1', toJson({ document: row, sections }),
        'Generated from the MBSS catalogue.', 'generated', userId, 'Generation engine', at
      );
      // The baseline implements its domain's Standard, where one exists.
      const standard = q.get(
        `SELECT id FROM documents WHERE domain_key = ? AND doc_type = 'standard' AND language = ?
           AND COALESCE(json_extract(generation_meta, '$.kind'), '') != 'mbss' ORDER BY created_at DESC LIMIT 1`,
        built.domain, language);
      if (standard) {
        q.run('INSERT OR IGNORE INTO document_links (id, from_id, to_id, link_type, note, created_at) VALUES (?,?,?,?,?,?)',
          id('lnk'), docId, standard.id, 'implements', 'The baseline sets the configuration the domain Standard requires.', at);
      }
      indexDocument(row, sections);
      created.push({ id: docId, reference, title: built.title, technology: tech.key });
    }
  })();
  return created;
}

/** The rows of a baseline's verification workbook, in the document's language. */
export function mbssChecklist(document) {
  const meta = typeof document.generation_meta === 'string' ? JSON.parse(document.generation_meta || '{}') : (document.generation_meta || {});
  if (meta.kind !== 'mbss') return null;
  const tech = meta.custom
    ? customTechnology({ ...meta.custom, domain: CATEGORY_DOMAIN[meta.custom.category] || 'endpoint_security' })
    : mbssTechnology(meta.technology);
  if (!tech) return null;
  const language = document.language === 'ar' ? 'ar' : 'en';
  const params = meta.parameters || mbssParameters({}, language);
  const ar = language === 'ar';
  return {
    tech, meta, language,
    rows: tech.items.map((i) => {
      const refs = itemRefs(i);
      return {
        id: i.id,
        area: ar ? AREAS[i.area].ar : AREAS[i.area].en,
        requirement: resolveText(ar ? i.ar : i.en, params),
        verification: resolveText(ar ? i.checkAr : i.checkEn, params),
        profile: i.level === 1 ? 'L1' : 'L2',
        criticality: CRITICALITY[language][criticality(i)],
        source: i.source === 'cis' ? 'CIS' : (ar ? 'المنشأة' : 'Organisation'),
        ecc: refs['NCA-ECC'].join(', '),
        iso: refs['ISO-27001'].join(', '),
        cis: refs['CIS-V8'].join(', ')
      };
    }),
    domainName: ar ? arDomainName(tech.domain) : domainName(tech.domain)
  };
}
