import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import {
  Card, Loading, ErrorNote, Empty, Badge, DataTable, Drawer, Field, Select,
  useToast, Kpi, CoverageBar
} from '../components/ui.jsx';
import { IconTarget, IconDownload, IconChevronRight, IconCheck } from '../components/Icons.jsx';
import { formatDate, GAP_TONE, RISK_TONE } from '../lib/format.js';
import { useLabels } from '../i18n/labels.js';
import { useI18n } from '../i18n/index.jsx';

const STATUSES = ['compliant', 'partially_compliant', 'non_compliant', 'not_applicable'];

/** Assessment lifecycle status, translated at render time; unknown values fall back to `fallback`. */
function assessmentStatusLabel(t, value, fallback) {
  const map = {
    planned: t('gapDetailUi.assessmentStatus.planned'),
    in_progress: t('gapDetailUi.assessmentStatus.in_progress'),
    completed: t('gapDetailUi.assessmentStatus.completed'),
    archived: t('gapDetailUi.assessmentStatus.archived')
  };
  return map[value] || fallback(value);
}

export default function GapAssessmentDetail() {
  const labels = useLabels();
  const { t, formatNumber } = useI18n();
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();
  const { can } = useAuth();
  const { data, loading, error, reload } = useFetch(`/assessments/${id}`);
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  if (loading) return <Loading label={t('gapDetailUi.loading')} />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <Empty title={t('gapDetailUi.notFound')} />;

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
      toast.success(t('gapDetailUi.rowUpdated'));
      setSelected(null);
      reload();
    } catch (err) { toast.error(t('gapDetailUi.updateFailed'), err.message); }
  }

  return (
    <>
      <div className="breadcrumb">
        <Link to="/gap-assessment">{t('gap.title')}</Link><IconChevronRight width={12} height={12} /><span>{assessment.name}</span>
      </div>

      <div className="page-head">
        <div className="page-head-text">
          <div className="row-tight" style={{ marginBottom: 5 }}>
            {assessment.framework_code && <Badge tone="info">{assessment.framework_code}</Badge>}
            <Badge tone={assessment.status === 'completed' ? 'ok' : 'warn'}>{assessmentStatusLabel(t, assessment.status, labels.humanise)}</Badge>
            {assessment.due_at && <span className="tiny muted">{t('gapDetailUi.due', { date: formatDate(assessment.due_at) })}</span>}
          </div>
          <h1 className="page-title">{assessment.name}</h1>
          <p className="page-sub">{assessment.scope}</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => api.download(`/export/gap/${id}.xlsx`, `${assessment.name}.xlsx`)
            .then(() => toast.success(t('common.exported'))).catch((e) => toast.error(t('common.exportFailed'), e.message))}>
            <IconDownload />{t('common.export')}
          </button>
          <button className="btn" onClick={() => api.download(`/export/audit-report/${id}.docx`, `Internal Audit Report — ${assessment.name}.docx`)
            .then(() => toast.success(t('common.exported'))).catch((e) => toast.error(t('common.exportFailed'), e.message))}>
            <IconDownload />{t('gap.auditReport')}
          </button>
        </div>
      </div>

      <div className="grid grid-kpi" style={{ marginBottom: 14 }}>
        <Kpi label={t('gapDetailUi.kpiRequirements')} value={summary.total} />
        <Kpi label={t('gapDetailUi.kpiCompliant')} value={summary.byStatus.compliant} tone="ok" />
        <Kpi label={t('gapDetailUi.kpiPartial')} value={summary.byStatus.partially_compliant} tone="warn" />
        <Kpi label={t('gapDetailUi.kpiNonCompliant')} value={summary.byStatus.non_compliant} tone="danger" />
        <Kpi label={t('gapDetailUi.kpiNotApplicable')} value={summary.byStatus.not_applicable} />
        <Kpi label={t('gapDetailUi.kpiComplianceRate')} value={`${summary.complianceRate}%`} progress={summary.complianceRate}
          tone={summary.complianceRate >= 80 ? 'ok' : summary.complianceRate >= 50 ? 'warn' : 'danger'} />
      </div>

      <Card flush>
        <div className="table-toolbar">
          <div className="btn-group">
            <button className={`btn btn-sm ${!statusFilter ? 'active' : ''}`} onClick={() => setStatusFilter('')}>{t('common.all')}</button>
            {STATUSES.map((s) => (
              <button key={s} className={`btn btn-sm ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
                {labels.gapStatus(s)} ({summary.byStatus[s]})
              </button>
            ))}
          </div>
          <span className="table-count">{t('counts.rows', { count: formatNumber(filtered.length) })}</span>
        </div>

        <DataTable
          columns={[
            { key: 'requirement_ref', header: t('gapDetailUi.colRequirement'), nowrap: true, width: 110, render: (i) => <span className="ref-tag">{i.requirement_ref}</span> },
            { key: 'requirement_txt', header: t('gapDetailUi.colRequirementText'), render: (i) => (<><div className="clamp-2">{i.requirement_txt}</div>{i.domain_label && <div className="cell-sub">{labels.domain(i.domain_key, i.domain_label)}</div>}</>) },
            { key: 'current_state', header: t('gapDetailUi.colCurrentState'), render: (i) => <span className="small clamp-2">{i.current_state}</span> },
            { key: 'gap', header: t('gapDetailUi.colGap'), render: (i) => <span className="small clamp-2">{i.gap}</span> },
            { key: 'risk_rating', header: t('gapDetailUi.colRisk'), nowrap: true, render: (i) => i.risk_rating ? <Badge tone={RISK_TONE[i.risk_rating]}>{labels.rating(i.risk_rating)}</Badge> : '—' },
            { key: 'owner', header: t('gapDetailUi.colOwner'), nowrap: true, render: (i) => <span className="small">{i.owner || '—'}</span> },
            { key: 'due_date', header: t('gapDetailUi.colDue'), nowrap: true, render: (i) => i.due_date ? <span className="small">{formatDate(i.due_date)}</span> : '—' },
            { key: 'status', header: t('gapDetailUi.colStatus'), nowrap: true, render: (i) => <Badge tone={GAP_TONE[i.status]}>{labels.gapStatus(i.status)}</Badge> }
          ]}
          rows={filtered}
          onRowClick={can('gap:write') ? setSelected : undefined}
          empty={<Empty icon={IconTarget} title={t('gapDetailUi.emptyFilter')} />}
        />
      </Card>

      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} wide
        title={selected ? t('gapDetailUi.drawerTitle', { ref: selected.requirement_ref }) : ''}
        footer={
          selected && (
            <>
              <button className="btn" onClick={() => setSelected(null)}>{t('common.cancel')}</button>
              {/* A nonconformity is closed by an action (ISO/IEC 27001 10.2). */}
              {can('action:write') && ['non_compliant', 'partially_compliant'].includes(selected.status) && (
                <button className="btn" onClick={() => navigate(`/actions?${new URLSearchParams({
                  raise: 'gap_item', source: selected.id,
                  title: `${selected.requirement_ref}: ${selected.recommendation || selected.gap || ''}`.slice(0, 200),
                  label: `${selected.requirement_ref} — ${selected.gap || selected.requirement_txt || ''}`.slice(0, 160)
                })}`)}>{t('risks.raiseAction')}</button>
              )}
              <button className="btn btn-primary" onClick={save}><IconCheck width={13} height={13} />{t('gapDetailUi.saveRow')}</button>
            </>
          )
        }>
        {selected && (
          <div className="stack">
            <div className="callout">
              <strong>{t('gapDetailUi.requirement')}</strong>
              <p style={{ marginBottom: 0 }}>{selected.requirement_txt}</p>
            </div>
            <div className="field-row">
              <Field label={t('gapDetailUi.status')}>
                <Select value={selected.status} onChange={(v) => setSelected((s) => ({ ...s, status: v }))}
                  options={STATUSES.map((v) => ({ value: v, label: labels.gapStatus(v) }))} />
              </Field>
              <Field label={t('gapDetailUi.riskRating')}>
                <Select value={selected.risk_rating || ''} onChange={(v) => setSelected((s) => ({ ...s, risk_rating: v }))}
                  placeholder={t('gapDetailUi.notRated')} options={['low', 'medium', 'high', 'critical'].map((v) => ({ value: v, label: labels.rating(v) }))} />
              </Field>
            </div>
            <Field label={t('gapDetailUi.currentState')}>
              <textarea className="textarea" value={selected.current_state || ''} onChange={(e) => setSelected((s) => ({ ...s, current_state: e.target.value }))} />
            </Field>
            <Field label={t('gapDetailUi.targetState')}>
              <textarea className="textarea" value={selected.target_state || ''} onChange={(e) => setSelected((s) => ({ ...s, target_state: e.target.value }))} />
            </Field>
            <Field label={t('gapDetailUi.gap')}>
              <textarea className="textarea" value={selected.gap || ''} onChange={(e) => setSelected((s) => ({ ...s, gap: e.target.value }))} />
            </Field>
            <Field label={t('gapDetailUi.risk')}>
              <textarea className="textarea" value={selected.risk || ''} onChange={(e) => setSelected((s) => ({ ...s, risk: e.target.value }))} />
            </Field>
            <Field label={t('gapDetailUi.recommendation')}>
              <textarea className="textarea" value={selected.recommendation || ''} onChange={(e) => setSelected((s) => ({ ...s, recommendation: e.target.value }))} />
            </Field>
            <div className="field-row">
              <Field label={t('gapDetailUi.owner')}>
                <input className="input" value={selected.owner || ''} onChange={(e) => setSelected((s) => ({ ...s, owner: e.target.value }))} />
              </Field>
              <Field label={t('gapDetailUi.dueDate')}>
                <input className="input" type="date" value={(selected.due_date || '').slice(0, 10)}
                  onChange={(e) => setSelected((s) => ({ ...s, due_date: e.target.value }))} />
              </Field>
            </div>
            <Field label={t('gapDetailUi.evidence')}>
              <textarea className="textarea" value={selected.evidence_ref || ''} onChange={(e) => setSelected((s) => ({ ...s, evidence_ref: e.target.value }))} />
            </Field>
            {selected.document_ref && (
              <dl className="definition">
                <dt>{t('gapDetailUi.relatedDocument')}</dt>
                <dd><Link to={`/documents/${selected.document_id}`}>{selected.document_ref} — {selected.document_title}</Link></dd>
              </dl>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
