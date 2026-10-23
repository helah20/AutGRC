import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import {
  Card, Loading, ErrorNote, Empty, Badge, Select, useToast, StatusBadge
} from '../components/ui.jsx';
import FindingCard from '../components/FindingCard.jsx';
import { Scorecard } from '../components/Scorecard.jsx';
import { IconLink, IconArrowDown, IconSparkles, IconWand, IconAlert } from '../components/Icons.jsx';
import { titleCase } from '../lib/format.js';
import { useLabels } from '../i18n/labels.js';
import { useT } from '../i18n/index.jsx';

// Built per render so the labels follow the current language. `inline` is
// the form used inside the "missing tiers" sentence; `empty` is the
// placeholder shown when a tier has no documents.
function buildTiers(t) {
  return [
    { key: 'framework', label: t('hierarchyUi.frameworkLabel'), empty: t('hierarchyUi.frameworkEmpty'), types: ['framework'], help: t('hierarchyUi.frameworkHelp') },
    { key: 'policy', label: t('hierarchyUi.policyLabel'), inline: t('hierarchyUi.policyInline'), empty: t('hierarchyUi.policyEmpty'), types: ['policy'], help: t('hierarchyUi.policyHelp') },
    { key: 'standard', label: t('hierarchyUi.standardLabel'), inline: t('hierarchyUi.standardInline'), empty: t('hierarchyUi.standardEmpty'), types: ['standard'], help: t('hierarchyUi.standardHelp') },
    { key: 'procedure', label: t('hierarchyUi.procedureLabel'), inline: t('hierarchyUi.procedureInline'), empty: t('hierarchyUi.procedureEmpty'), types: ['procedure'], help: t('hierarchyUi.procedureHelp') },
    { key: 'work_instruction', label: t('hierarchyUi.workInstructionLabel'), empty: t('hierarchyUi.workInstructionEmpty'), types: ['work_instruction', 'guideline'], help: t('hierarchyUi.workInstructionHelp') },
    { key: 'supporting', label: t('hierarchyUi.supportingLabel'), empty: t('hierarchyUi.supportingEmpty'), types: ['roles', 'raci', 'control_matrix'], help: t('hierarchyUi.supportingHelp') }
  ];
}

export default function Hierarchy() {
  const t = useT();
  const labels = useLabels();
  const toast = useToast();
  const { can } = useAuth();
  const { data: docs, loading, error, reload } = useFetch('/documents?limit=500');
  const { data: options } = useFetch('/generator/options');
  const [domain, setDomain] = useState('iam');
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState(false);

  const domains = useMemo(() => {
    if (!docs) return [];
    const keys = [...new Set(docs.items.map((d) => d.domain_key))];
    return keys.map((k) => ({
      value: k,
      label: docs.items.find((d) => d.domain_key === k)?.domain_label || k
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [docs]);

  const inDomain = useMemo(
    () => (docs?.items || []).filter((d) => d.domain_key === domain && d.status !== 'retired'),
    [docs, domain]
  );

  const evidenceCount = useMemo(() => {
    const domainInfo = options?.domains?.find((d) => d.key === domain);
    return domainInfo?.requirements || 0;
  }, [options, domain]);

  async function runReview() {
    setBusy(true);
    try {
      const res = await api.post(`/ai/review/domain/${domain}`);
      setReview(res);
      const high = res.findings.filter((f) => ['critical', 'high'].includes(f.severity)).length;
      if (high) toast.warn(t('hierarchyUi.highFindings', { count: high }), t('hierarchyUi.highFindingsBody'));
      else toast.success(t('hierarchyUi.reviewComplete'), t('hierarchyUi.readinessToast', { score: res.score.score }));
    } catch (err) {
      toast.error(t('hierarchyUi.reviewFailed'), err.message);
    } finally { setBusy(false); }
  }

  if (loading) return <Loading label={t('hierarchyUi.loading')} />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  // Named `tier`, not `t`: `t` is the translator in this component now, and a
  // parameter that shadows it is a trap for the next edit.
  const TIERS = buildTiers(t);
  const missingTiers = TIERS.slice(1, 4).filter((tier) => !inDomain.some((d) => tier.types.includes(d.doc_type)));

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">{t('hierarchy.title')}</h1>
          <p className="page-sub">{t('hierarchy.subtitle')}</p>
        </div>
        <div className="page-actions">
          <Select value={domain} onChange={setDomain} options={domains} aria-label={t('common.domain')} />
          {can('ai:use') && (
            <button className="btn btn-primary" onClick={runReview} disabled={busy}>
              {busy ? <span className="spinner" style={{ width: 13, height: 13 }} /> : <IconSparkles />}
              {t('hierarchyUi.checkConsistency')}
            </button>
          )}
        </div>
      </div>

      {missingTiers.length > 0 && (
        <div className="callout" data-callout="warning">
          <strong>{t('hierarchyUi.incompleteChain')}</strong>
          <p style={{ marginBottom: 0 }}>
            {t('hierarchyUi.missingTiers', { tiers: missingTiers.map((tier) => tier.inline).join(t('hierarchyUi.missingTiersJoin')) })}
            {' '}{t('hierarchyUi.missingTiersBody')}
            {can('generate:run') && <> <Link to="/generator">{t('hierarchyUi.generateMissing')}</Link>.</>}
          </p>
        </div>
      )}

      <Card title={t('hierarchyUi.chainTitle', { domain: domains.find((d) => d.value === domain)?.label || domain })} style={{ marginTop: 14 }}>
        <div className="stack">
          {TIERS.map((tier, i) => {
            const items = inDomain.filter((d) => tier.types.includes(d.doc_type));
            return (
              <div key={tier.key}>
                <div className="hierarchy-tier">
                  <div className="tier-head">
                    <span>{tier.label}</span>
                    <span className="tier-rule" />
                    <span className="tiny" style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>{tier.help}</span>
                  </div>
                  {items.length ? (
                    <div className="tier-cards">
                      {items.map((d) => (
                        <Link key={d.id} to={`/documents/${d.id}`} className="tier-card">
                          <div className="tier-card-ref">{d.reference}</div>
                          <div className="tier-card-title">{d.title}</div>
                          <div className="row-tight">
                            <StatusBadge status={d.status} />
                            <span className="tiny muted">v{d.version}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="tier-card" style={{ borderStyle: 'dashed', color: 'var(--text-faint)', textAlign: 'center', padding: 14 }}>
                      {tier.empty}
                    </div>
                  )}
                </div>
                {i < TIERS.length - 1 && (
                  <div className="tier-connector"><IconArrowDown width={16} height={16} /></div>
                )}
              </div>
            );
          })}

          <div className="tier-connector"><IconArrowDown width={16} height={16} /></div>
          <div className="hierarchy-tier">
            <div className="tier-head">
              <span>{t('hierarchyUi.evidenceLabel')}</span>
              <span className="tier-rule" />
              <span className="tiny" style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                {t('hierarchyUi.evidenceHelp')}
              </span>
            </div>
            <Link to={`/evidence?domain=${domain}`} className="tier-card" style={{ borderColor: 'var(--ok)', background: 'var(--ok-soft)' }}>
              <div className="tier-card-title" style={{ marginBottom: 2 }}>{t('hierarchyUi.evidenceRegister')}</div>
              <div className="tiny muted">{t('hierarchyUi.evidenceView')}</div>
            </Link>
          </div>
        </div>
      </Card>

      {review && (
        <Card title={t('hierarchyUi.findingsTitle')} style={{ marginTop: 14 }}
          subtitle={t('hierarchyUi.findingsSubtitle', { score: review.score.score, documents: review.documents })}>
          {review.scorecard && (
            <div style={{ marginBottom: 14 }}>
              <Scorecard scorecard={review.scorecard} />
            </div>
          )}
          {review.findings.length ? (
            <div className="stack-sm">
              {review.findings.map((f, i) => (
                <FindingCard key={f.id || i} finding={f} canManage={can('finding:write')}
                  onStatusChange={async (finding, status) => {
                    try {
                      await api.patch(`/findings/${finding.id}`, { status });
                      toast.success(t('hierarchyUi.findingUpdated'), labels.status(status));
                      setReview((r) => ({ ...r, findings: r.findings.filter((x) => x.id !== finding.id) }));
                    } catch (err) { toast.error(t('hierarchyUi.updateFailed'), err.message); }
                  }} />
              ))}
            </div>
          ) : (
            <Empty title={t('hierarchyUi.noInconsistencies')}>
              {t('hierarchyUi.noInconsistenciesBody')}
            </Empty>
          )}
        </Card>
      )}
    </>
  );
}
