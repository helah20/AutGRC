/** Dashboard KPIs, charts and activity feeds. */

import express from 'express';
import { q } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errors.js';
import { domainName, DOMAIN_META, DOMAIN_CATEGORIES } from '../knowledge/index.js';
import { buildMyWork, enrichDocuments, STATUS_LABEL, getOrgProfile } from './_shared.js';
import { DOC_TYPE_LABEL } from '../services/generator.js';

const router = express.Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const count = (sql, ...args) => q.get(sql, ...args).n;

  const totalDocs = count('SELECT COUNT(*) AS n FROM documents WHERE translation_of IS NULL');
  const published = count("SELECT COUNT(*) AS n FROM documents WHERE translation_of IS NULL AND status = 'published'");
  const underReview = count("SELECT COUNT(*) AS n FROM documents WHERE translation_of IS NULL AND status IN ('under_review','under_revision')");
  const draft = count("SELECT COUNT(*) AS n FROM documents WHERE translation_of IS NULL AND status = 'draft'");

  const reviewDue = q.all(
    `SELECT * FROM documents
      WHERE translation_of IS NULL AND review_date IS NOT NULL AND status != 'retired' AND review_date <= date('now','+90 day')
      ORDER BY review_date LIMIT 25`
  );
  const overdue = reviewDue.filter((d) => d.review_date < new Date().toISOString().slice(0, 10));

  // Coverage across the frameworks the organisation is subject to, weighting
  // partial mappings at half. The catalogue holds sources an organisation has
  // not adopted — operational technology controls for a bank with no plant —
  // and averaging them in reported a gap in obligations it does not have.
  // Before the applicable set is chosen, every framework counts.
  const applicable = getOrgProfile().applicable_frameworks;
  const frameworks = q.all('SELECT * FROM frameworks ORDER BY kind DESC, code')
    .filter((f) => !applicable || applicable.includes(f.code));
  const coverage = frameworks.map((f) => {
    const total = count('SELECT COUNT(*) AS n FROM framework_requirements WHERE framework_id = ?', f.id);
    const mapped = q.all(
      `SELECT DISTINCT cm.requirement_id, cm.coverage FROM control_mappings cm
         JOIN framework_requirements fr ON fr.id = cm.requirement_id
        WHERE fr.framework_id = ?`, f.id
    );
    const covered = mapped.filter((m) => m.coverage === 'covered').length;
    const partial = mapped.filter((m) => m.coverage === 'partial').length;
    const na = mapped.filter((m) => m.coverage === 'not_applicable').length;
    const assessable = Math.max(total - na, 0);
    return {
      code: f.code, name: f.name, kind: f.kind, is_mandatory: f.is_mandatory,
      total, covered, partial, notCovered: Math.max(assessable - covered - partial, 0),
      coverage: assessable ? Math.round(((covered + partial * 0.5) / assessable) * 100) : 0
    };
  });

  const mandatory = coverage.filter((c) => c.is_mandatory);
  const overallCoverage = mandatory.length
    ? Math.round(mandatory.reduce((a, c) => a + c.coverage, 0) / mandatory.length)
    : coverage.length ? Math.round(coverage.reduce((a, c) => a + c.coverage, 0) / coverage.length) : 0;

  const byDomain = DOMAIN_META.map((d) => ({
    key: d.key, name: d.name, short: d.short, category: d.category,
    categoryLabel: DOMAIN_CATEGORIES[d.category],
    documents: count('SELECT COUNT(*) AS n FROM documents WHERE translation_of IS NULL AND domain_key = ?', d.key),
    controls: count('SELECT COUNT(*) AS n FROM controls WHERE domain_key = ?', d.key),
    evidence: count('SELECT COUNT(*) AS n FROM evidence WHERE domain_key = ?', d.key),
    published: count("SELECT COUNT(*) AS n FROM documents WHERE translation_of IS NULL AND domain_key = ? AND status = 'published'", d.key)
  })).filter((d) => d.documents > 0 || d.controls > 0);

  const findingsBySeverity = q.all(
    "SELECT severity, COUNT(*) AS n FROM findings WHERE status IN ('open','acknowledged') GROUP BY severity"
  );
  const findingsByCategory = q.all(
    "SELECT category, COUNT(*) AS n FROM findings WHERE status IN ('open','acknowledged') GROUP BY category"
  );

  res.json({
    kpis: {
      totalDocuments: totalDocs,
      policies: count("SELECT COUNT(*) AS n FROM documents WHERE translation_of IS NULL AND doc_type = 'policy'"),
      procedures: count("SELECT COUNT(*) AS n FROM documents WHERE translation_of IS NULL AND doc_type = 'procedure'"),
      standards: count("SELECT COUNT(*) AS n FROM documents WHERE translation_of IS NULL AND doc_type = 'standard'"),
      guidelines: count("SELECT COUNT(*) AS n FROM documents WHERE translation_of IS NULL AND doc_type = 'guideline'"),
      frameworks: count('SELECT COUNT(*) AS n FROM frameworks'),
      frameworkRequirements: count('SELECT COUNT(*) AS n FROM framework_requirements'),
      roles: count('SELECT COUNT(*) AS n FROM roles'),
      controls: count('SELECT COUNT(*) AS n FROM controls'),
      evidence: count('SELECT COUNT(*) AS n FROM evidence'),
      raciMatrices: count('SELECT COUNT(*) AS n FROM raci_matrices'),
      complianceCoverage: overallCoverage,
      underReview,
      draft,
      published,
      reviewDue: reviewDue.length,
      overdue: overdue.length,
      openFindings: count("SELECT COUNT(*) AS n FROM findings WHERE status IN ('open','acknowledged')"),
      // Severe findings nobody has yet taken on: one with a corrective action
      // raised against it is being dealt with, and is followed on the actions page.
      criticalFindings: count(`SELECT COUNT(*) AS n FROM findings f WHERE f.status IN ('open','acknowledged') AND f.severity IN ('critical','high')
        AND NOT EXISTS (SELECT 1 FROM corrective_actions a WHERE a.source_type = 'finding' AND a.source_id = f.id AND a.status != 'cancelled')`),
      // Personal to the requesting user, so the sidebar badge reflects their
      // own queue rather than the organisation's backlog.
      myWork: buildMyWork(req.user).total,
      risks: count('SELECT COUNT(*) AS n FROM risks'),
      risksUnassessed: count('SELECT COUNT(*) AS n FROM risks WHERE residual_assessed = 0'),
      openActions: count("SELECT COUNT(*) AS n FROM corrective_actions WHERE status IN ('open','in_progress','blocked')"),
      overdueActions: count("SELECT COUNT(*) AS n FROM corrective_actions WHERE status IN ('open','in_progress','blocked') AND due_date < date('now')")
    },
    charts: {
      byStatus: q.all('SELECT status, COUNT(*) AS n FROM documents WHERE translation_of IS NULL GROUP BY status')
        .map((r) => ({ name: STATUS_LABEL[r.status] || r.status, value: r.n, key: r.status })),
      byType: q.all('SELECT doc_type, COUNT(*) AS n FROM documents WHERE translation_of IS NULL GROUP BY doc_type')
        .map((r) => ({ name: DOC_TYPE_LABEL[r.doc_type] || r.doc_type, value: r.n, key: r.doc_type })),
      byDomain,
      coverage,
      controlsByRisk: q.all('SELECT risk_rating, COUNT(*) AS n FROM controls GROUP BY risk_rating')
        .map((r) => ({ name: r.risk_rating, value: r.n })),
      controlsByType: q.all('SELECT control_type, COUNT(*) AS n FROM controls GROUP BY control_type')
        .map((r) => ({ name: r.control_type, value: r.n })),
      evidenceByStatus: q.all('SELECT status, COUNT(*) AS n FROM evidence GROUP BY status')
        .map((r) => ({ name: r.status, value: r.n })),
      findingsBySeverity: findingsBySeverity.map((r) => ({ name: r.severity, value: r.n })),
      findingsByCategory: findingsByCategory.map((r) => ({ name: r.category, value: r.n })),
      activityTrend: q.all(
        `SELECT date(created_at) AS day, COUNT(*) AS n FROM documents
          WHERE translation_of IS NULL AND created_at >= date('now','-30 day') GROUP BY day ORDER BY day`
      )
    },
    recentlyUpdated: enrichDocuments(q.all('SELECT * FROM documents ORDER BY updated_at DESC LIMIT 8')),
    reviewDue: enrichDocuments(reviewDue).map((d) => ({
      ...d,
      daysRemaining: Math.ceil((new Date(d.review_date) - new Date()) / 86400000)
    })),
    pendingApproval: enrichDocuments(q.all("SELECT * FROM documents WHERE status IN ('under_review','approved') ORDER BY updated_at DESC LIMIT 8")),
    topFindings: q.all(
      `SELECT * FROM findings WHERE status IN ('open','acknowledged')
        ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at DESC LIMIT 8`
    ),
    recentActivity: q.all(
      `SELECT at, user_email, action, summary, entity_type, entity_id, outcome
         FROM audit_log ORDER BY at DESC LIMIT 12`
    )
  });
}));

export default router;
