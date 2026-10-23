import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import {
  Card, Loading, ErrorNote, Empty, Badge, DataTable, Modal, Field, Select, useToast, CoverageBar
} from '../components/ui.jsx';
import { IconTarget, IconPlus } from '../components/Icons.jsx';
import { formatDate, titleCase } from '../lib/format.js';
import { useLabels } from '../i18n/labels.js';
import { useT } from '../i18n/index.jsx';

/** Assessment lifecycle status, translated at render time; unknown values fall back to `fallback`. */
function assessmentStatusLabel(t, value, fallback) {
  const map = {
    planned: t('gapListUi.assessmentStatus.planned'),
    in_progress: t('gapListUi.assessmentStatus.in_progress'),
    completed: t('gapListUi.assessmentStatus.completed'),
    archived: t('gapListUi.assessmentStatus.archived')
  };
  return map[value] || fallback(value);
}

export default function GapAssessments() {
  const t = useT();
  const labels = useLabels();
  const { data, loading, error, reload } = useFetch('/assessments');
  const { data: frameworks } = useFetch('/frameworks');
  const navigate = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', framework_id: '', scope: '', due_at: '', seedFromFramework: true });

  if (loading) return <Loading label={t('gapListUi.loading')} />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">{t('gap.title')}</h1>
          <p className="page-sub">{t('gap.subtitle')}</p>
        </div>
        {can('gap:write') && (
          <div className="page-actions">
            <button className="btn btn-primary" onClick={() => setOpen(true)}><IconPlus />{t('gapListUi.newAssessment')}</button>
          </div>
        )}
      </div>

      <Card flush>
        <DataTable
          columns={[
            { key: 'name', header: t('gapListUi.colAssessment'), render: (a) => (<><div className="cell-title">{a.name}</div><div className="cell-sub clamp-2">{a.scope || t('gapListUi.noScope')}</div></>) },
            { key: 'framework_code', header: t('gapListUi.colFramework'), nowrap: true, render: (a) => a.framework_code ? <Badge tone="info">{a.framework_code}</Badge> : <span className="muted">—</span> },
            { key: 'status', header: t('gapListUi.colStatus'), nowrap: true, render: (a) => <Badge tone={a.status === 'completed' ? 'ok' : a.status === 'in_progress' ? 'warn' : 'neutral'}>{assessmentStatusLabel(t, a.status, labels.humanise)}</Badge> },
            { key: 'items', header: t('gapListUi.colItems'), align: 'right', render: (a) => a.summary.total },
            { key: 'compliant', header: t('gapListUi.colCompliant'), align: 'right', render: (a) => a.summary.byStatus.compliant },
            { key: 'non', header: t('gapListUi.colNonCompliant'), align: 'right', render: (a) => a.summary.byStatus.non_compliant > 0 ? <span style={{ color: 'var(--danger)' }}>{a.summary.byStatus.non_compliant}</span> : 0 },
            { key: 'rate', header: t('gapListUi.colCompliance'), render: (a) => <CoverageBar value={a.summary.complianceRate} /> },
            { key: 'due_at', header: t('gapListUi.colDue'), nowrap: true, render: (a) => a.due_at ? formatDate(a.due_at) : <span className="muted">—</span> }
          ]}
          rows={data}
          onRowClick={(a) => navigate(`/gap-assessment/${a.id}`)}
          empty={
            <Empty icon={IconTarget} title={t('gapListUi.emptyTitle')}
              action={can('gap:write') ? <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><IconPlus />{t('gapListUi.startAssessment')}</button> : null}>
              {t('gapListUi.emptyBody')}
            </Empty>
          }
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={t('gapListUi.modalTitle')}
        footer={
          <>
            <button className="btn" onClick={() => setOpen(false)} disabled={busy}>{t('common.cancel')}</button>
            <button className="btn btn-primary" disabled={!form.name.trim() || busy} onClick={async () => {
              setBusy(true);
              try {
                const res = await api.post('/assessments', { ...form, framework_id: form.framework_id || null, due_at: form.due_at || null });
                toast.success(t('gapListUi.created'), t('gapListUi.createdBody', { count: res.summary.total }));
                setOpen(false);
                navigate(`/gap-assessment/${res.assessment.id}`);
              } catch (err) { toast.error(t('gapListUi.createFailed'), err.message); }
              finally { setBusy(false); }
            }}>{busy ? <span className="spinner" style={{ width: 13, height: 13 }} /> : null}{t('gapListUi.create')}</button>
          </>
        }>
        <Field label={t('gapListUi.nameLabel')} required>
          <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t('gapListUi.namePlaceholder')} />
        </Field>
        <div className="field-row">
          <Field label={t('gapListUi.framework')}>
            <Select value={form.framework_id} onChange={(v) => setForm((f) => ({ ...f, framework_id: v }))} placeholder={t('gapListUi.noFramework')}
              options={(frameworks?.items || []).map((f) => ({ value: f.id, label: `${f.code} — ${f.name}` }))} />
          </Field>
          <Field label={t('gapListUi.dueDate')}>
            <input className="input" type="date" value={form.due_at} onChange={(e) => setForm((f) => ({ ...f, due_at: e.target.value }))} />
          </Field>
        </div>
        <Field label={t('gapListUi.scope')}>
          <textarea className="textarea" value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}
            placeholder={t('gapListUi.scopePlaceholder')} />
        </Field>
        <label className="checkbox">
          <input type="checkbox" checked={form.seedFromFramework}
            onChange={(e) => setForm((f) => ({ ...f, seedFromFramework: e.target.checked }))} />
          <span className="checkbox-text">
            {t('gapListUi.seedLabel')}
            <small>{t('gapListUi.seedHint')}</small>
          </span>
        </label>
      </Modal>
    </>
  );
}
