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

  if (loading) return <Loading label="Loading findings…" />;
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
        <Kpi label="Critical" value={bySeverity.critical || 0} tone="danger" />
        <Kpi label="High" value={bySeverity.high || 0} tone="danger" />
        <Kpi label="Medium" value={bySeverity.medium || 0} tone="warn" />
        <Kpi label="Low" value={bySeverity.low || 0} />
        <Kpi label="Informational" value={bySeverity.info || 0} />
      </div>

      <Card flush>
        <div className="table-toolbar">
          <Select value={status} onChange={setStatus}
            options={[
              { value: 'open,acknowledged', label: 'Open and acknowledged' },
              { value: 'open', label: 'Open only' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'accepted_risk', label: 'Risk accepted' },
              { value: 'false_positive', label: 'False positives' },
              { value: '', label: 'All statuses' }
            ]} />
          <Select value={severity} onChange={setSeverity} placeholder="All severities"
            options={['critical', 'high', 'medium', 'low', 'info'].map((v) => ({ value: v, label: titleCase(v) }))} />
          <Select value={category} onChange={setCategory} placeholder="All categories"
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
                        toast.success('Finding updated', titleCase(next));
                        reload();
                      } catch (err) { toast.error('Update failed', err.message); }
                    }} />
                </div>
              ))}
            </div>
          ) : (
            <Empty icon={IconCheck} title="No findings match">
              Either the governance library is clean, or the filters are too narrow.
            </Empty>
          )}
        </div>
      </Card>
    </>
  );
}
