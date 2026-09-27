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

export default function GapAssessments() {
  const labels = useLabels();
  const { data, loading, error, reload } = useFetch('/assessments');
  const { data: frameworks } = useFetch('/frameworks');
  const navigate = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', framework_id: '', scope: '', due_at: '', seedFromFramework: true });

  if (loading) return <Loading label="Loading assessments…" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">Gap Assessment</h1>
          <p className="page-sub">
            Assess the organisation against a framework. New assessments start from the platform's real
            coverage position rather than a blank sheet.
          </p>
        </div>
        {can('gap:write') && (
          <div className="page-actions">
            <button className="btn btn-primary" onClick={() => setOpen(true)}><IconPlus />New assessment</button>
          </div>
        )}
      </div>

      <Card flush>
        <DataTable
          columns={[
            { key: 'name', header: 'Assessment', render: (a) => (<><div className="cell-title">{a.name}</div><div className="cell-sub clamp-2">{a.scope || 'No scope recorded'}</div></>) },
            { key: 'framework_code', header: 'Framework', nowrap: true, render: (a) => a.framework_code ? <Badge tone="info">{a.framework_code}</Badge> : <span className="muted">—</span> },
            { key: 'status', header: 'Status', nowrap: true, render: (a) => <Badge tone={a.status === 'completed' ? 'ok' : a.status === 'in_progress' ? 'warn' : 'neutral'}>{labels.humanise(a.status)}</Badge> },
            { key: 'items', header: 'Items', align: 'right', render: (a) => a.summary.total },
            { key: 'compliant', header: 'Compliant', align: 'right', render: (a) => a.summary.byStatus.compliant },
            { key: 'non', header: 'Non-compliant', align: 'right', render: (a) => a.summary.byStatus.non_compliant > 0 ? <span style={{ color: 'var(--danger)' }}>{a.summary.byStatus.non_compliant}</span> : 0 },
            { key: 'rate', header: 'Compliance', render: (a) => <CoverageBar value={a.summary.complianceRate} /> },
            { key: 'due_at', header: 'Due', nowrap: true, render: (a) => a.due_at ? formatDate(a.due_at) : <span className="muted">—</span> }
          ]}
          rows={data}
          onRowClick={(a) => navigate(`/gap-assessment/${a.id}`)}
          empty={
            <Empty icon={IconTarget} title="No assessments yet"
              action={can('gap:write') ? <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><IconPlus />Start an assessment</button> : null}>
              A gap assessment records the current state, target state, gap, risk, recommendation, owner
              and evidence for every requirement.
            </Empty>
          }
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New gap assessment"
        footer={
          <>
            <button className="btn" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" disabled={!form.name.trim() || busy} onClick={async () => {
              setBusy(true);
              try {
                const res = await api.post('/assessments', { ...form, framework_id: form.framework_id || null, due_at: form.due_at || null });
                toast.success('Assessment created', `${res.summary.total} requirements pre-populated from the current coverage position.`);
                setOpen(false);
                navigate(`/gap-assessment/${res.assessment.id}`);
              } catch (err) { toast.error('Could not create assessment', err.message); }
              finally { setBusy(false); }
            }}>{busy ? <span className="spinner" style={{ width: 13, height: 13 }} /> : null}Create</button>
          </>
        }>
        <Field label="Assessment name" required>
          <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. NCA ECC Annual Compliance Assessment" />
        </Field>
        <div className="field-row">
          <Field label="Framework">
            <Select value={form.framework_id} onChange={(v) => setForm((f) => ({ ...f, framework_id: v }))} placeholder="No framework"
              options={(frameworks?.items || []).map((f) => ({ value: f.id, label: `${f.code} — ${f.name}` }))} />
          </Field>
          <Field label="Due date">
            <input className="input" type="date" value={form.due_at} onChange={(e) => setForm((f) => ({ ...f, due_at: e.target.value }))} />
          </Field>
        </div>
        <Field label="Scope">
          <textarea className="textarea" value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}
            placeholder="Which entities, locations and systems does this assessment cover?" />
        </Field>
        <label className="checkbox">
          <input type="checkbox" checked={form.seedFromFramework}
            onChange={(e) => setForm((f) => ({ ...f, seedFromFramework: e.target.checked }))} />
          <span className="checkbox-text">
            Pre-populate from the current coverage position
            <small>Each requirement arrives with its mapped controls, current state and a recommendation already filled in, so the assessment starts from what the platform already knows.</small>
          </span>
        </label>
      </Modal>
    </>
  );
}
