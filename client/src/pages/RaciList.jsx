import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, Loading, ErrorNote, Empty, Badge, DataTable, Modal, Field, Select, useToast } from '../components/ui.jsx';
import { IconGrid, IconPlus, IconAlert, IconCheck } from '../components/Icons.jsx';
import { titleCase } from '../lib/format.js';
import { useLabels } from '../i18n/labels.js';
import { useT } from '../i18n/index.jsx';

export default function RaciList() {
  const t = useT();
  const labels = useLabels();
  const { data, loading, error, reload } = useFetch('/raci');
  const { data: options } = useFetch('/generator/options');
  const navigate = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', domain_key: '', mode: 'raci', seedFromDomain: true });

  if (loading) return <Loading label="Loading matrices…" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">{t('raci.title')}</h1>
          <p className="page-sub">
            Responsibility assignment per domain. The builder validates that every activity has exactly
            one accountable role and at least one responsible role.
          </p>
        </div>
        {can('raci:write') && (
          <div className="page-actions">
            <button className="btn btn-primary" onClick={() => setOpen(true)}><IconPlus />New matrix</button>
          </div>
        )}
      </div>

      <Card flush>
        <DataTable
          columns={[
            { key: 'name', header: 'Matrix', render: (m) => (<><div className="cell-title">{m.name}</div><div className="cell-sub">{m.description || m.domain_label || 'Cross-domain'}</div></>) },
            { key: 'mode', header: 'Mode', nowrap: true, render: (m) => <Badge tone="neutral">{m.mode.toUpperCase()}</Badge> },
            { key: 'activities', header: 'Activities', align: 'right' },
            { key: 'roles', header: 'Roles', align: 'right' },
            {
              key: 'issues', header: 'Validation', nowrap: true,
              render: (m) => m.issues > 0
                ? <Badge tone="danger"><IconAlert width={11} height={11} />{m.issues} issue{m.issues === 1 ? '' : 's'}</Badge>
                : <Badge tone="ok"><IconCheck width={11} height={11} />Valid</Badge>
            }
          ]}
          rows={data}
          onRowClick={(m) => navigate(`/raci/${m.id}`)}
          empty={<Empty icon={IconGrid} title="No matrices yet" >Generate a governance package, or create a matrix seeded from a domain model.</Empty>}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New RACI matrix"
        footer={
          <>
            <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={!form.name.trim()} onClick={async () => {
              try {
                const res = await api.post('/raci', form);
                toast.success('Matrix created');
                setOpen(false);
                navigate(`/raci/${res.matrix.id}`);
              } catch (err) { toast.error('Could not create matrix', err.message); }
            }}>Create</button>
          </>
        }>
        <Field label="Matrix name" required>
          <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Cloud Security RACI" />
        </Field>
        <div className="field-row">
          <Field label="Domain">
            <Select value={form.domain_key} onChange={(v) => setForm((f) => ({ ...f, domain_key: v }))} placeholder="Cross-domain"
              options={(options?.domains || []).map((d) => ({ value: d.key, label: d.name }))} />
          </Field>
          <Field label="Mode" hint="RASCI adds a Support value.">
            <Select value={form.mode} onChange={(v) => setForm((f) => ({ ...f, mode: v }))}
              options={[{ value: 'raci', label: 'RACI' }, { value: 'rasci', label: 'RASCI' }]} />
          </Field>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={form.seedFromDomain}
            onChange={(e) => setForm((f) => ({ ...f, seedFromDomain: e.target.checked }))} />
          <span className="checkbox-text">
            Seed from the domain requirement model
            <small>Pre-populates the activities, role columns and assignments from the curated model for the selected domain.</small>
          </span>
        </label>
      </Modal>
    </>
  );
}
