import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import {
  Card, Loading, ErrorNote, Empty, Badge, Select, useToast, StatusBadge
} from '../components/ui.jsx';
import FindingCard from '../components/FindingCard.jsx';
import { IconLink, IconArrowDown, IconSparkles, IconWand, IconAlert } from '../components/Icons.jsx';
import { titleCase } from '../lib/format.js';

const TIERS = [
  { key: 'framework', label: 'Framework / Regulation', types: ['framework'], help: 'The authoritative sources adopted for this domain.' },
  { key: 'policy', label: 'Policy', types: ['policy'], help: 'The mandatory organisational position.' },
  { key: 'standard', label: 'Standard', types: ['standard'], help: 'Measurable requirements implementing the policy.' },
  { key: 'procedure', label: 'Procedure', types: ['procedure'], help: 'How the requirements are carried out.' },
  { key: 'work_instruction', label: 'Work Instruction', types: ['work_instruction', 'guideline'], help: 'Platform-specific execution detail and advisory guidance.' },
  { key: 'supporting', label: 'Supporting', types: ['roles', 'raci', 'control_matrix'], help: 'Accountability and control records supporting the tiers above.' }
];

export default function Hierarchy() {
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
      if (high) toast.warn(`${high} high-severity finding${high === 1 ? '' : 's'}`, 'Inconsistencies between documents in this domain need reconciliation.');
      else toast.success('Domain review complete', `Readiness score ${res.score.score}/100.`);
    } catch (err) {
      toast.error('Review failed', err.message);
    } finally { setBusy(false); }
  }

  if (loading) return <Loading label="Loading the governance hierarchy…" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const missingTiers = TIERS.slice(1, 4).filter((t) => !inDomain.some((d) => t.types.includes(d.doc_type)));

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">Document Hierarchy</h1>
          <p className="page-sub">
            The governance chain for a domain: framework, policy, standard, procedure, work instruction
            and evidence. The quality engine reports where the chain breaks or the tiers disagree.
          </p>
        </div>
        <div className="page-actions">
          <Select value={domain} onChange={setDomain} options={domains} />
          {can('ai:use') && (
            <button className="btn btn-primary" onClick={runReview} disabled={busy}>
              {busy ? <span className="spinner" style={{ width: 13, height: 13 }} /> : <IconSparkles />}
              Check consistency
            </button>
          )}
        </div>
      </div>

      {missingTiers.length > 0 && (
        <div className="callout" data-callout="warning">
          <strong>Incomplete chain</strong>
          <p style={{ marginBottom: 0 }}>
            This domain has no {missingTiers.map((t) => t.label).join(' and no ')}.
            A policy position that is not translated into measurable requirements and operational steps
            cannot be evidenced.
            {can('generate:run') && <> <Link to="/generator">Generate the missing tiers</Link>.</>}
          </p>
        </div>
      )}

      <Card title={`${domains.find((d) => d.value === domain)?.label || domain} governance chain`} style={{ marginTop: 14 }}>
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
                      No {tier.label.toLowerCase()} in this domain
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
              <span>Evidence</span>
              <span className="tier-rule" />
              <span className="tiny" style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                The records that demonstrate the controls operated.
              </span>
            </div>
            <Link to={`/evidence?domain=${domain}`} className="tier-card" style={{ borderColor: 'var(--ok)', background: 'var(--ok-soft)' }}>
              <div className="tier-card-title" style={{ marginBottom: 2 }}>Evidence register</div>
              <div className="tiny muted">View the evidence requirements for this domain</div>
            </Link>
          </div>
        </div>
      </Card>

      {review && (
        <Card title="Consistency findings" style={{ marginTop: 14 }}
          subtitle={`Readiness score ${review.score.score}/100 across ${review.documents} documents in this domain.`}>
          {review.findings.length ? (
            <div className="stack-sm">
              {review.findings.map((f, i) => (
                <FindingCard key={f.id || i} finding={f} canManage={can('finding:write')}
                  onStatusChange={async (finding, status) => {
                    try {
                      await api.patch(`/findings/${finding.id}`, { status });
                      toast.success('Finding updated', titleCase(status));
                      setReview((r) => ({ ...r, findings: r.findings.filter((x) => x.id !== finding.id) }));
                    } catch (err) { toast.error('Update failed', err.message); }
                  }} />
              ))}
            </div>
          ) : (
            <Empty title="No inconsistencies found">
              Every document in this domain states the same commitments, and the chain is complete.
            </Empty>
          )}
        </Card>
      )}
    </>
  );
}
