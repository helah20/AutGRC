import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import {
  Card, Loading, ErrorNote, Empty, Badge, DataTable, Drawer, Field, Select,
  useToast, Kpi, CoverageBar
} from '../components/ui.jsx';
import { IconTarget, IconDownload, IconChevronRight, IconCheck } from '../components/Icons.jsx';
import { formatDate, titleCase, GAP_TONE, RISK_TONE } from '../lib/format.js';
import { useLabels } from '../i18n/labels.js';

const STATUSES = ['compliant', 'partially_compliant', 'non_compliant', 'not_applicable'];

export default function GapAssessmentDetail() {
  const labels = useLabels();
  const { id } = useParams();
  const toast = useToast();
  const { can } = useAuth();
  const { data, loading, error, reload } = useFetch(`/assessments/${id}`);
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  if (loading) return <Loading label="Loading assessment…" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <Empty title="Assessment not found" />;

  const { assessment, summary, items } = data;
  const filtered = statusFilter ? items.filter((i) => i.status === statusFilter) : items;

  async function save() {
    try {
      await api.patch(`/assessments/${id}/items/${selected.id}`, {
        current_state: selected.current_state, target_state: selected.target_state,
        gap: selected.gap, risk: selected.risk, risk_rating: selected.risk_rating,
        recommendation: selected.recommendation, owner: selected.owner,
        due_date: selected.due_date || null, status: selected.status,
        evidence_ref: selected.evidence_ref
      });
      toast.success('Row updated');
      setSelected(null);
      reload();
    } catch (err) { toast.error('Update failed', err.message); }
  }

  return (
    <>
      <div className="breadcrumb">
        <Link to="/gap-assessment">Gap Assessment</Link><IconChevronRight width={12} height={12} /><span>{assessment.name}</span>
      </div>

      <div className="page-head">
        <div className="page-head-text">
          <div className="row-tight" style={{ marginBottom: 5 }}>
            {assessment.framework_code && <Badge tone="info">{assessment.framework_code}</Badge>}
            <Badge tone={assessment.status === 'completed' ? 'ok' : 'warn'}>{labels.humanise(assessment.status)}</Badge>
            {assessment.due_at && <span className="tiny muted">Due {formatDate(assessment.due_at)}</span>}
          </div>
          <h1 className="page-title">{assessment.name}</h1>
          <p className="page-sub">{assessment.scope}</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => api.download(`/export/gap/${id}.xlsx`, `${assessment.name}.xlsx`)
            .then(() => toast.success('Exported')).catch((e) => toast.error('Export failed', e.message))}>
            <IconDownload />Export
          </button>
        </div>
      </div>

      <div className="grid grid-kpi" style={{ marginBottom: 14 }}>
        <Kpi label="Requirements" value={summary.total} />
        <Kpi label="Compliant" value={summary.byStatus.compliant} tone="ok" />
        <Kpi label="Partially compliant" value={summary.byStatus.partially_compliant} tone="warn" />
        <Kpi label="Non-compliant" value={summary.byStatus.non_compliant} tone="danger" />
        <Kpi label="Not applicable" value={summary.byStatus.not_applicable} />
        <Kpi label="Compliance rate" value={`${summary.complianceRate}%`} progress={summary.complianceRate}
          tone={summary.complianceRate >= 80 ? 'ok' : summary.complianceRate >= 50 ? 'warn' : 'danger'} />
      </div>

      <Card flush>
        <div className="table-toolbar">
          <div className="btn-group">
            <button className={`btn btn-sm ${!statusFilter ? 'active' : ''}`} onClick={() => setStatusFilter('')}>All</button>
            {STATUSES.map((s) => (
              <button key={s} className={`btn btn-sm ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
                {titleCase(s)} ({summary.byStatus[s]})
              </button>
            ))}
          </div>
          <span className="table-count">{filtered.length} rows</span>
        </div>

        <DataTable
          columns={[
            { key: 'requirement_ref', header: 'Requirement', nowrap: true, width: 110, render: (i) => <span className="ref-tag">{i.requirement_ref}</span> },
            { key: 'requirement_txt', header: 'Requirement text', render: (i) => (<><div className="clamp-2">{i.requirement_txt}</div>{i.domain_label && <div className="cell-sub">{labels.domain(i.domain_key, i.domain_label)}</div>}</>) },
            { key: 'current_state', header: 'Current state', render: (i) => <span className="small clamp-2">{i.current_state}</span> },
            { key: 'gap', header: 'Gap', render: (i) => <span className="small clamp-2">{i.gap}</span> },
            { key: 'risk_rating', header: 'Risk', nowrap: true, render: (i) => i.risk_rating ? <Badge tone={RISK_TONE[i.risk_rating]}>{labels.rating(i.risk_rating)}</Badge> : '—' },
            { key: 'owner', header: 'Owner', nowrap: true, render: (i) => <span className="small">{i.owner || '—'}</span> },
            { key: 'due_date', header: 'Due', nowrap: true, render: (i) => i.due_date ? <span className="small">{formatDate(i.due_date)}</span> : '—' },
            { key: 'status', header: 'Status', nowrap: true, render: (i) => <Badge tone={GAP_TONE[i.status]}>{labels.gapStatus(i.status)}</Badge> }
          ]}
          rows={filtered}
          onRowClick={can('gap:write') ? setSelected : undefined}
          empty={<Empty icon={IconTarget} title="No rows match this filter" />}
        />
      </Card>

      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} wide
        title={selected ? `${selected.requirement_ref} — assessment` : ''}
        footer={
          selected && (
            <>
              <button className="btn" onClick={() => setSelected(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}><IconCheck width={13} height={13} />Save row</button>
            </>
          )
        }>
        {selected && (
          <div className="stack">
            <div className="callout">
              <strong>Requirement</strong>
              <p style={{ marginBottom: 0 }}>{selected.requirement_txt}</p>
            </div>
            <div className="field-row">
              <Field label="Status">
                <Select value={selected.status} onChange={(v) => setSelected((s) => ({ ...s, status: v }))}
                  options={STATUSES.map((v) => ({ value: v, label: titleCase(v) }))} />
              </Field>
              <Field label="Risk rating">
                <Select value={selected.risk_rating || ''} onChange={(v) => setSelected((s) => ({ ...s, risk_rating: v }))}
                  placeholder="Not rated" options={['low', 'medium', 'high', 'critical'].map((v) => ({ value: v, label: titleCase(v) }))} />
              </Field>
            </div>
            <Field label="Current state">
              <textarea className="textarea" value={selected.current_state || ''} onChange={(e) => setSelected((s) => ({ ...s, current_state: e.target.value }))} />
            </Field>
            <Field label="Target state">
              <textarea className="textarea" value={selected.target_state || ''} onChange={(e) => setSelected((s) => ({ ...s, target_state: e.target.value }))} />
            </Field>
            <Field label="Gap">
              <textarea className="textarea" value={selected.gap || ''} onChange={(e) => setSelected((s) => ({ ...s, gap: e.target.value }))} />
            </Field>
            <Field label="Risk">
              <textarea className="textarea" value={selected.risk || ''} onChange={(e) => setSelected((s) => ({ ...s, risk: e.target.value }))} />
            </Field>
            <Field label="Recommendation">
              <textarea className="textarea" value={selected.recommendation || ''} onChange={(e) => setSelected((s) => ({ ...s, recommendation: e.target.value }))} />
            </Field>
            <div className="field-row">
              <Field label="Owner">
                <input className="input" value={selected.owner || ''} onChange={(e) => setSelected((s) => ({ ...s, owner: e.target.value }))} />
              </Field>
              <Field label="Due date">
                <input className="input" type="date" value={(selected.due_date || '').slice(0, 10)}
                  onChange={(e) => setSelected((s) => ({ ...s, due_date: e.target.value }))} />
              </Field>
            </div>
            <Field label="Evidence">
              <textarea className="textarea" value={selected.evidence_ref || ''} onChange={(e) => setSelected((s) => ({ ...s, evidence_ref: e.target.value }))} />
            </Field>
            {selected.document_ref && (
              <div className="definition">
                <dt>Related document</dt>
                <dd><Link to={`/documents/${selected.document_id}`}>{selected.document_ref} — {selected.document_title}</Link></dd>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
