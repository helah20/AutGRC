import { useState, useEffect, useCallback, useRef } from 'react';
import { api, qs } from '../lib/api.js';
import { useFetch, useDebounced } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import {
  Card, Loading, ErrorNote, Empty, Badge, DataTable, SearchInput, Select, useToast, Drawer, Field
} from '../components/ui.jsx';
import {
  IconArchive, IconX, IconCheck, IconUpload, IconDownload, IconTrash, IconLock
} from '../components/Icons.jsx';
import { titleCase, EVIDENCE_TONE, formatDate, formatBytes } from '../lib/format.js';

export default function Evidence() {
  const toast = useToast();
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [domain, setDomain] = useState('');
  const [status, setStatus] = useState('');
  const [attached, setAttached] = useState('');
  const [selected, setSelected] = useState(null);

  const { data, loading, error, reload } = useFetch(
    `/evidence${qs({ search: debounced, domain, status, attached, limit: 500 })}`
  );

  async function update(id, patch) {
    try {
      await api.patch(`/evidence/${id}`, patch);
      toast.success('Evidence updated');
      setSelected(null);
      reload();
    } catch (err) { toast.error('Update failed', err.message); }
  }

  const facets = data?.facets || {};
  const withFiles = facets.attachments?.withFiles ?? 0;
  const totalItems = facets.attachments?.total ?? 0;

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
        {totalItems > 0 && (
          <div className="page-actions">
            <Badge tone={withFiles ? 'info' : 'warn'}>
              {withFiles} of {totalItems} have an artefact on file
            </Badge>
          </div>
        )}
      </div>

      <Card flush>
        <div className="table-toolbar">
          <div className="search-box"><SearchInput value={search} onChange={setSearch} placeholder="Search evidence…" /></div>
          <Select value={domain} onChange={setDomain} placeholder="All domains"
            options={(facets.domains || []).map((d) => ({ value: d.domain_key, label: `${d.label} (${d.n})` }))} />
          <Select value={status} onChange={setStatus} placeholder="All statuses"
            options={(facets.statuses || []).map((s) => ({ value: s.status, label: `${titleCase(s.status)} (${s.n})` }))} />
          <Select value={attached} onChange={setAttached} placeholder="Attachment: any"
            options={[{ value: 'yes', label: 'Has an artefact' }, { value: 'no', label: 'Nothing attached' }]} />
          {(search || domain || status || attached) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setDomain(''); setStatus(''); setAttached(''); }}>
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
              {
                key: 'file_count', header: 'Artefacts', nowrap: true, width: 96,
                render: (e) => (e.file_count
                  ? <Badge tone="ok" title={`Most recent ${formatDate(e.latest_file_at)}`}>{e.file_count} on file</Badge>
                  : <span className="small muted">None</span>)
              },
              { key: 'status', header: 'Status', nowrap: true, render: (e) => <Badge tone={EVIDENCE_TONE[e.status] || 'neutral'}>{titleCase(e.status)}</Badge> }
            ]}
            rows={data?.items || []}
            onRowClick={setSelected}
            empty={<Empty icon={IconArchive} title="No evidence requirements" >Evidence is defined automatically when a Standard or Control Matrix is generated.</Empty>}
          />
        )}
      </Card>

      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.name || ''} wide
        footer={
          selected && (
            <>
              <button className="btn" onClick={() => setSelected(null)}>Close</button>
              {can('evidence:write') && (
                <button className="btn btn-primary" onClick={() => update(selected.id, {
                  status: selected.status, source_system: selected.source_system,
                  retention: selected.retention, owner_role: selected.owner_role,
                  last_collected: selected.last_collected || null
                })}><IconCheck width={13} height={13} />Save</button>
              )}
            </>
          )
        }>
        {selected && (
          <div className="stack">
            <div className="row-tight">
              <span className="ref-tag">{selected.evidence_id}</span>
              <Badge tone="neutral">{titleCase(selected.evidence_type)}</Badge>
              <Badge tone="info">{selected.domain_label}</Badge>
              <Badge tone={EVIDENCE_TONE[selected.status] || 'neutral'}>{titleCase(selected.status)}</Badge>
            </div>
            <p className="muted small">{selected.description}</p>
            <div className="definition">
              <dt>Control</dt><dd>{selected.control_ref ? `${selected.control_ref} — ${selected.control_name}` : '—'}</dd>
              <dt>Frequency</dt><dd>{selected.frequency || '—'}</dd>
              <dt>Retention</dt><dd>{selected.retention || '—'}</dd>
            </div>

            <Attachments evidenceId={selected.id} onRegisterChange={reload} />

            {can('evidence:write') && (
              <>
                <h4>Register entry</h4>
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
              </>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}

/* ------------------------------------------------------------ attachments -- */

/**
 * The collection history for one evidence item. Each upload is a separate
 * record rather than a replacement, because a quarterly review produces a
 * quarterly artefact and an auditor asks to see the series.
 */
function Attachments({ evidenceId, onRegisterChange }) {
  const toast = useToast();
  const { can, user } = useAuth();
  const fileInput = useRef(null);
  const [files, setFiles] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState('');
  const [note, setNote] = useState('');
  const [collectedAt, setCollectedAt] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get(`/evidence/${evidenceId}`);
      setFiles(res.files || []);
    } catch (err) { setError(err); }
  }, [evidenceId]);

  useEffect(() => { setFiles(null); load(); }, [load]);

  async function attach(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    if (period.trim()) form.append('period', period.trim());
    if (note.trim()) form.append('note', note.trim());
    form.append('collectedAt', collectedAt);

    setBusy(true);
    try {
      const res = await api.upload(`/evidence/${evidenceId}/files`, form);
      setFiles(res.files || []);
      setPeriod('');
      setNote('');
      toast.success('Artefact attached', `${file.name} is now on file.`);
      onRegisterChange?.();
    } catch (err) {
      toast.error('Attachment failed', err.message);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function download(file) {
    try {
      await api.download(`/evidence/${evidenceId}/files/${file.id}`, file.filename);
    } catch (err) { toast.error('Download failed', err.message); }
  }

  async function verify(file) {
    try {
      const res = await api.post(`/evidence/${evidenceId}/files/${file.id}/verify`);
      setFiles(res.files || []);
      toast.success('Artefact verified');
      onRegisterChange?.();
    } catch (err) { toast.error('Verification failed', err.message); }
  }

  async function remove(file) {
    try {
      const res = await api.del(`/evidence/${evidenceId}/files/${file.id}`);
      setFiles(res.files || []);
      toast.success('Artefact removed');
      onRegisterChange?.();
    } catch (err) { toast.error('Could not remove', err.message); }
  }

  return (
    <div className="stack-sm">
      <h4>
        Collected artefacts {files?.length ? <span className="muted">({files.length})</span> : null}
      </h4>

      {error && <ErrorNote error={error} onRetry={load} />}
      {files === null && !error && <Loading label="Loading artefacts…" />}

      {files !== null && !files.length && (
        <p className="small muted">
          Nothing has been collected against this evidence requirement yet.
        </p>
      )}

      {files?.length > 0 && (
        <ul className="attachment-list">
          {files.map((file) => {
            const mine = file.uploaded_by_name === user?.name;
            return (
              <li key={file.id} className="attachment">
                <div className="attachment-main">
                  <div className="attachment-name">{file.filename}</div>
                  <div className="attachment-meta">
                    {formatBytes(file.size_bytes)} · collected {formatDate(file.collected_at)}
                    {file.period ? ` · ${file.period}` : ''}
                    {file.uploaded_by_name ? ` · by ${file.uploaded_by_name}` : ''}
                  </div>
                  {file.note && <div className="attachment-note">{file.note}</div>}
                  <div className="attachment-meta tiny mono" title="SHA-256 of the stored file">
                    {(file.sha256 || '').slice(0, 16)}…
                  </div>
                </div>
                <div className="attachment-actions">
                  {file.verified_at
                    ? <Badge tone="ok" dot title={`Verified by ${file.verified_by_name || 'unknown'} on ${formatDate(file.verified_at)}`}>Verified</Badge>
                    : <Badge tone="warn">Unverified</Badge>}
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => download(file)} title="Download" aria-label={`Download ${file.filename}`}>
                    <IconDownload width={13} height={13} />
                  </button>
                  {!file.verified_at && can('evidence:verify') && (
                    mine
                      ? <span className="btn btn-ghost btn-sm btn-icon" title="You collected this artefact, so you cannot verify it" aria-hidden="true"><IconLock width={13} height={13} /></span>
                      : <button className="btn btn-ghost btn-sm btn-icon" onClick={() => verify(file)} title="Verify this artefact" aria-label={`Verify ${file.filename}`}><IconCheck width={13} height={13} /></button>
                  )}
                  {!file.verified_at && can('evidence:write') && (
                    <button className="btn btn-ghost btn-sm btn-icon btn-danger-ghost" onClick={() => remove(file)} title="Remove" aria-label={`Remove ${file.filename}`}>
                      <IconTrash width={13} height={13} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {can('evidence:write') && (
        <div className="attachment-upload">
          <div className="grid grid-2">
            <Field label="Period covered" hint="For example Q3 2026, or September 2026.">
              <input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Q3 2026" />
            </Field>
            <Field label="Date collected">
              <input className="input" type="date" value={collectedAt} onChange={(e) => setCollectedAt(e.target.value)} />
            </Field>
          </div>
          <Field label="Note" hint="What the artefact shows, and anything an auditor would need to read it.">
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Export from the identity provider, all privileged accounts" />
          </Field>
          <input ref={fileInput} type="file" onChange={attach} disabled={busy} style={{ display: 'none' }} />
          <button className="btn btn-primary btn-sm" onClick={() => fileInput.current?.click()} disabled={busy}>
            {busy ? <span className="spinner" /> : <IconUpload width={13} height={13} />}
            {busy ? 'Uploading…' : 'Attach an artefact'}
          </button>
          <p className="tiny muted">
            PDF, Word, Excel, CSV, text, log, JSON, images and zip archives, up to 15 MB. Whoever attaches an
            artefact cannot be the one who verifies it.
          </p>
        </div>
      )}
    </div>
  );
}
