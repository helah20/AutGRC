import { useState } from 'react';
import { api, qs } from '../lib/api.js';
import { useFetch, useDebounced } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import {
  Card, Loading, ErrorNote, Empty, Badge, DataTable, SearchInput, Select, useToast, Drawer, Field
} from '../components/ui.jsx';
import { IconArchive, IconX, IconCheck } from '../components/Icons.jsx';
import { titleCase, EVIDENCE_TONE, formatDate } from '../lib/format.js';

export default function Evidence() {
  const toast = useToast();
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [domain, setDomain] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);

  const { data, loading, error, reload } = useFetch(`/evidence${qs({ search: debounced, domain, status, limit: 500 })}`);

  async function update(id, patch) {
    try {
      await api.patch(`/evidence/${id}`, patch);
      toast.success('Evidence updated');
      setSelected(null);
      reload();
    } catch (err) { toast.error('Update failed', err.message); }
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">Evidence Register</h1>
          <p className="page-sub">
            The artefacts that demonstrate each control operated. A control without evidence cannot be
            tested or audited.
          </p>
        </div>
      </div>

      <Card flush>
        <div className="table-toolbar">
          <div className="search-box"><SearchInput value={search} onChange={setSearch} placeholder="Search evidence…" /></div>
          <Select value={domain} onChange={setDomain} placeholder="All domains"
            options={(data?.facets?.domains || []).map((d) => ({ value: d.domain_key, label: `${d.label} (${d.n})` }))} />
          <Select value={status} onChange={setStatus} placeholder="All statuses"
            options={(data?.facets?.statuses || []).map((s) => ({ value: s.status, label: `${titleCase(s.status)} (${s.n})` }))} />
          {(search || domain || status) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setDomain(''); setStatus(''); }}>
              <IconX width={13} height={13} />Clear
            </button>
          )}
          <span className="table-count">{data ? `${data.items.length} of ${data.total}` : '—'}</span>
        </div>

        {loading && <Loading />}
        {error && <div className="card-body"><ErrorNote error={error} onRetry={reload} /></div>}
        {!loading && !error && (
          <DataTable
            columns={[
              { key: 'evidence_id', header: 'ID', nowrap: true, width: 118, render: (e) => <span className="ref-tag">{e.evidence_id}</span> },
              { key: 'name', header: 'Evidence required', render: (e) => (<><div className="cell-title">{e.name}</div><div className="cell-sub">{e.control_ref ? `Control ${e.control_ref} — ${e.control_name}` : 'Not linked to a control'}</div></>) },
              { key: 'evidence_type', header: 'Type', nowrap: true, render: (e) => <Badge tone="neutral">{titleCase(e.evidence_type)}</Badge> },
              { key: 'domain_label', header: 'Domain', nowrap: true, render: (e) => <span className="small">{e.domain_label}</span> },
              { key: 'frequency', header: 'Frequency', render: (e) => <span className="small">{e.frequency || '—'}</span> },
              { key: 'owner_role', header: 'Owner', nowrap: true, render: (e) => <span className="small">{e.owner_role || '—'}</span> },
              { key: 'status', header: 'Status', nowrap: true, render: (e) => <Badge tone={EVIDENCE_TONE[e.status] || 'neutral'}>{titleCase(e.status)}</Badge> }
            ]}
            rows={data?.items || []}
            onRowClick={can('evidence:write') ? setSelected : undefined}
            empty={<Empty icon={IconArchive} title="No evidence requirements" >Evidence is defined automatically when a Standard or Control Matrix is generated.</Empty>}
          />
        )}
      </Card>

      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.name || ''}
        footer={
          selected && (
            <>
              <button className="btn" onClick={() => setSelected(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => update(selected.id, {
                status: selected.status, source_system: selected.source_system,
                retention: selected.retention, owner_role: selected.owner_role,
                last_collected: selected.last_collected || null
              })}><IconCheck width={13} height={13} />Save</button>
            </>
          )
        }>
        {selected && (
          <div className="stack">
            <div className="row-tight">
              <span className="ref-tag">{selected.evidence_id}</span>
              <Badge tone="neutral">{titleCase(selected.evidence_type)}</Badge>
              <Badge tone="info">{selected.domain_label}</Badge>
            </div>
            <p className="muted small">{selected.description}</p>
            <div className="definition">
              <dt>Control</dt><dd>{selected.control_ref ? `${selected.control_ref} — ${selected.control_name}` : '—'}</dd>
              <dt>Frequency</dt><dd>{selected.frequency || '—'}</dd>
            </div>
            <Field label="Status">
              <Select value={selected.status} onChange={(v) => setSelected((s) => ({ ...s, status: v }))}
                options={['required', 'collected', 'verified', 'missing', 'expired'].map((v) => ({ value: v, label: titleCase(v) }))} />
            </Field>
            <Field label="Owner role">
              <input className="input" value={selected.owner_role || ''} onChange={(e) => setSelected((s) => ({ ...s, owner_role: e.target.value }))} />
            </Field>
            <Field label="Source system" hint="Where the evidence is produced or retrieved from.">
              <input className="input" value={selected.source_system || ''} onChange={(e) => setSelected((s) => ({ ...s, source_system: e.target.value }))} />
            </Field>
            <Field label="Retention period">
              <input className="input" value={selected.retention || ''} onChange={(e) => setSelected((s) => ({ ...s, retention: e.target.value }))} />
            </Field>
            <Field label="Last collected">
              <input className="input" type="date" value={(selected.last_collected || '').slice(0, 10)}
                onChange={(e) => setSelected((s) => ({ ...s, last_collected: e.target.value }))} />
            </Field>
          </div>
        )}
      </Drawer>
    </>
  );
}
