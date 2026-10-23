import { useState } from 'react';
import { api, qs } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, Loading, ErrorNote, Empty, Badge, Select, useToast, Kpi } from '../components/ui.jsx';
import FindingCard from '../components/FindingCard.jsx';
import { IconAlert, IconCheck } from '../components/Icons.jsx';
import { titleCase } from '../lib/format.js';
import { useLabels } from '../i18n/labels.js';
import { useI18n } from '../i18n/index.jsx';

export default function Findings() {
  const labels = useLabels();
  const { t, formatNumber } = useI18n();
  const toast = useToast();
  const { can } = useAuth();
  const [severity, setSeverity] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('open,acknowledged');
  const { data, loading, error, reload } = useFetch(`/findings${qs({ severity, category, status })}`);

  if (loading) return <Loading label={t('findingsUi.loading')} />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const bySeverity = Object.fromEntries((data.facets.bySeverity || []).map((r) => [r.severity, r.n]));

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">{t('findings.title')}</h1>
          <p className="page-sub">{t('findings.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-kpi" style={{ marginBottom: 14 }}>
        <Kpi label={labels.rating('critical')} value={bySeverity.critical || 0} tone="danger" />
        <Kpi label={labels.rating('high')} value={bySeverity.high || 0} tone="danger" />
        <Kpi label={labels.rating('medium')} value={bySeverity.medium || 0} tone="warn" />
        <Kpi label={labels.rating('low')} value={bySeverity.low || 0} />
        <Kpi label={t('findingsUi.informational')} value={bySeverity.info || 0} />
      </div>

      <Card flush>
        <div className="table-toolbar">
          <Select value={status} onChange={setStatus} aria-label={t('common.status')}
            options={[
              { value: 'open,acknowledged', label: t('findingsUi.filterOpenAcknowledged') },
              { value: 'open', label: t('findingsUi.filterOpenOnly') },
              { value: 'resolved', label: t('findingsUi.filterResolved') },
              { value: 'accepted_risk', label: t('findingsUi.filterRiskAccepted') },
              { value: 'false_positive', label: t('findingsUi.filterFalsePositives') },
              { value: '', label: t('findingsUi.filterAllStatuses') }
            ]} />
          <Select value={severity} onChange={setSeverity} placeholder={t('findingsUi.allSeverities')}
            options={['critical', 'high', 'medium', 'low', 'info'].map((v) => ({ value: v, label: labels.rating(v) }))} />
          <Select value={category} onChange={setCategory} placeholder={t('findingsUi.allCategories')}
            options={(data.facets.byCategory || []).map((c) => ({ value: c.category, label: `${labels.findingCategory(c.category)} (${c.n})` }))} />
          <span className="table-count">{t('counts.findings', { count: formatNumber(data.items.length) })}</span>
        </div>

        <div className="card-body">
          {data.items.length ? (
            <div className="stack-sm">
              {data.items.map((f) => (
                <div key={f.id}>
                  <div className="tiny muted mono" style={{ marginBottom: 3 }}>
                    {titleCase(f.scope_type)} · {f.scope_label}
                  </div>
                  <FindingCard finding={f} canManage={can('finding:write')}
                    onStatusChange={async (finding, next) => {
                      try {
                        await api.patch(`/findings/${finding.id}`, { status: next });
                        toast.success(t('findingsUi.updated'), labels.findingStatus(next));
                        reload();
                      } catch (err) { toast.error(t('findingsUi.updateFailed'), err.message); }
                    }} />
                </div>
              ))}
            </div>
          ) : (
            <Empty icon={IconCheck} title={t('findingsUi.emptyTitle')}>
              {t('findingsUi.emptyBody')}
            </Empty>
          )}
        </div>
      </Card>
    </>
  );
}
