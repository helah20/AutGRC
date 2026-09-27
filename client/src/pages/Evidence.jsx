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
import { useLabels } from '../i18n/labels.js';
import { useI18n } from '../i18n/index.jsx';

export default function Evidence() {
  const labels = useLabels();
  const { t, formatNumber } = useI18n();
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
      toast.success(t('common.updated'));
      setSelected(null);
      reload();
    } catch (err) { toast.error(t('common.couldNotSave'), err.message); }
  }

  const facets = data?.facets || {};
  const withFiles = facets.attachments?.withFiles ?? 0;
  const totalItems = facets.attachments?.total ?? 0;

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">{t('evidence.title')}</h1>
          <p className="page-sub">
{t('evidence.subtitle')}
          </p>
        </div>
        {totalItems > 0 && (
          <div className="page-actions">
            <Badge tone={withFiles ? 'info' : 'warn'}>
{t('evidence.onFile', { withFiles: formatNumber(withFiles), total: formatNumber(totalItems) })}
            </Badge>
          </div>
        )}
      </div>

      <Card flush>
        <div className="table-toolbar">
          <div className="search-box"><SearchInput value={search} onChange={setSearch} placeholder={t('evidence.searchPlaceholder')} /></div>
          <Select value={domain} onChange={setDomain} placeholder={t('common.domain')}
            options={(facets.domains || []).map((d) => ({ value: d.domain_key, label: `${labels.domain(d.domain_key, d.label)} (${d.n})` }))} />
          <Select value={status} onChange={setStatus} placeholder={t('common.status')}
            options={(facets.statuses || []).map((s) => ({ value: s.status, label: `${labels.evidenceStatus(s.status)} (${s.n})` }))} />
          <Select value={attached} onChange={setAttached} placeholder={t('evidence.attachmentAny')}
            options={[{ value: 'yes', label: t('evidence.hasArtefact') }, { value: 'no', label: t('evidence.nothingAttached') }]} />
          {(search || domain || status || attached) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setDomain(''); setStatus(''); setAttached(''); }}>
              <IconX width={13} height={13} />{t('common.clear')}
            </button>
          )}
          <span className="table-count">{data ? `${formatNumber(data.items.length)} ${t('common.of')} ${formatNumber(data.total)}` : '—'}</span>
        </div>

        {loading && <Loading />}
        {error && <div className="card-body"><ErrorNote error={error} onRetry={reload} /></div>}
        {!loading && !error && (
          <DataTable
            columns={[
              { key: 'evidence_id', header: t('evidence.columnId'), nowrap: true, width: 118, render: (e) => <span className="ref-tag">{e.evidence_id}</span> },
              { key: 'name', header: t('evidence.columnRequired'), render: (e) => (<><div className="cell-title">{e.name}</div><div className="cell-sub">{e.control_ref ? `${t('evidence.control')} ${e.control_ref} — ${e.control_name}` : t('evidence.notLinked')}</div></>) },
              { key: 'evidence_type', header: t('common.type'), nowrap: true, render: (e) => <Badge tone="neutral">{labels.humanise(e.evidence_type)}</Badge> },
              { key: 'domain_label', header: t('common.domain'), nowrap: true, render: (e) => <span className="small">{labels.domain(e.domain_key, e.domain_label)}</span> },
              { key: 'frequency', header: t('evidence.columnFrequency'), render: (e) => <span className="small">{e.frequency || '—'}</span> },
              {
                key: 'file_count', header: t('evidence.columnArtefacts'), nowrap: true, width: 96,
                render: (e) => (e.file_count
                  ? <Badge tone="ok" title={`Most recent ${formatDate(e.latest_file_at)}`}>{t('evidence.artefactCount', { count: formatNumber(e.file_count) })}</Badge>
                  : <span className="small muted">{t('evidence.noArtefacts')}</span>)
              },
              { key: 'status', header: t('common.status'), nowrap: true, render: (e) => <Badge tone={EVIDENCE_TONE[e.status] || 'neutral'}>{labels.evidenceStatus(e.status)}</Badge> }
            ]}
            rows={data?.items || []}
            onRowClick={setSelected}
            empty={<Empty icon={IconArchive} title={t('evidence.emptyTitle')} >{t('evidence.emptyBody')}</Empty>}
          />
        )}
      </Card>

      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.name || ''} wide
        footer={
          selected && (
            <>
              <button className="btn" onClick={() => setSelected(null)}>{t('common.close')}</button>
              {can('evidence:write') && (
                <button className="btn btn-primary" onClick={() => update(selected.id, {
                  status: selected.status, source_system: selected.source_system,
                  retention: selected.retention, owner_role: selected.owner_role,
                  last_collected: selected.last_collected || null
                })}><IconCheck width={13} height={13} />{t('common.save')}</button>
              )}
            </>
          )
        }>
        {selected && (
          <div className="stack">
            <div className="row-tight">
              <span className="ref-tag">{selected.evidence_id}</span>
              <Badge tone="neutral">{labels.humanise(selected.evidence_type)}</Badge>
              <Badge tone="info">{labels.domain(selected.domain_key, selected.domain_label)}</Badge>
              <Badge tone={EVIDENCE_TONE[selected.status] || 'neutral'}>{labels.evidenceStatus(selected.status)}</Badge>
            </div>
            <p className="muted small">{selected.description}</p>
            <div className="definition">
              <dt>{t('evidence.control')}</dt><dd>{selected.control_ref ? `${selected.control_ref} — ${selected.control_name}` : '—'}</dd>
              <dt>{t('evidence.columnFrequency')}</dt><dd>{selected.frequency || '—'}</dd>
              <dt>{t('evidence.retention')}</dt><dd>{selected.retention || '—'}</dd>
            </div>

            <Attachments evidenceId={selected.id} onRegisterChange={reload} />

            {can('evidence:write') && (
              <>
                <h4>{t('evidence.registerEntry')}</h4>
                <Field label={t('common.status')}>
                  <Select value={selected.status} onChange={(v) => setSelected((s) => ({ ...s, status: v }))}
                    options={['required', 'collected', 'verified', 'missing', 'expired'].map((v) => ({ value: v, label: titleCase(v) }))} />
                </Field>
                <Field label={t('evidence.ownerRole')}>
                  <input className="input" value={selected.owner_role || ''} onChange={(e) => setSelected((s) => ({ ...s, owner_role: e.target.value }))} />
                </Field>
                <Field label={t('evidence.sourceSystem')} hint={t('evidence.sourceSystemHint')}>
                  <input className="input" value={selected.source_system || ''} onChange={(e) => setSelected((s) => ({ ...s, source_system: e.target.value }))} />
                </Field>
                <Field label={t('evidence.retention')}>
                  <input className="input" value={selected.retention || ''} onChange={(e) => setSelected((s) => ({ ...s, retention: e.target.value }))} />
                </Field>
                <Field label={t('evidence.lastCollected')}>
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
  const { t, formatNumber } = useI18n();
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
      toast.success(t('evidence.attached'), t('evidence.attachedBody', { name: file.name }));
      onRegisterChange?.();
    } catch (err) {
      toast.error(t('common.couldNotSave'), err.message);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function download(file) {
    try {
      await api.download(`/evidence/${evidenceId}/files/${file.id}`, file.filename);
    } catch (err) { toast.error(t('common.exportFailed'), err.message); }
  }

  async function verify(file) {
    try {
      const res = await api.post(`/evidence/${evidenceId}/files/${file.id}/verify`);
      setFiles(res.files || []);
      toast.success(t('evidence.verifiedToast'));
      onRegisterChange?.();
    } catch (err) { toast.error('Verification failed', err.message); }
  }

  async function remove(file) {
    try {
      const res = await api.del(`/evidence/${evidenceId}/files/${file.id}`);
      setFiles(res.files || []);
      toast.success(t('evidence.removed'));
      onRegisterChange?.();
    } catch (err) { toast.error('Could not remove', err.message); }
  }

  return (
    <div className="stack-sm">
      <h4>
        {t('evidence.collected')} {files?.length ? <span className="muted">({formatNumber(files.length)})</span> : null}
      </h4>

      {error && <ErrorNote error={error} onRetry={load} />}
      {files === null && !error && <Loading label={t('evidence.loadingArtefacts')} />}

      {files !== null && !files.length && (
        <p className="small muted">
{t('evidence.noneCollected')}
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
                    {formatBytes(file.size_bytes)} · {formatDate(file.collected_at)}
                    {file.period ? ` · ${file.period}` : ''}
                    {file.uploaded_by_name ? ` · by ${file.uploaded_by_name}` : ''}
                  </div>
                  {file.note && <div className="attachment-note">{file.note}</div>}
                  <div className="attachment-meta tiny mono" title="SHA-256">
                    {(file.sha256 || '').slice(0, 16)}…
                  </div>
                </div>
                <div className="attachment-actions">
                  {file.verified_at
                    ? <Badge tone="ok" dot title={`${file.verified_by_name || ''} · ${formatDate(file.verified_at)}`}>{t('evidence.verified')}</Badge>
                    : <Badge tone="warn">{t('evidence.unverified')}</Badge>}
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => download(file)} title={t('common.download')} aria-label={`${t('common.download')} ${file.filename}`}>
                    <IconDownload width={13} height={13} />
                  </button>
                  {!file.verified_at && can('evidence:verify') && (
                    mine
                      ? <span className="btn btn-ghost btn-sm btn-icon" title={t('evidence.cannotVerifyOwn')} aria-hidden="true"><IconLock width={13} height={13} /></span>
                      : <button className="btn btn-ghost btn-sm btn-icon" onClick={() => verify(file)} title={t('myWork.verify')} aria-label={`${t('myWork.verify')} ${file.filename}`}><IconCheck width={13} height={13} /></button>
                  )}
                  {!file.verified_at && can('evidence:write') && (
                    <button className="btn btn-ghost btn-sm btn-icon btn-danger-ghost" onClick={() => remove(file)} title={t('common.remove')} aria-label={`${t('common.remove')} ${file.filename}`}>
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
            <Field label={t('evidence.periodCovered')} hint={t('evidence.periodHint')}>
              <input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Q3 2026" />
            </Field>
            <Field label={t('evidence.dateCollected')}>
              <input className="input" type="date" value={collectedAt} onChange={(e) => setCollectedAt(e.target.value)} />
            </Field>
          </div>
          <Field label={t('evidence.note')} hint={t('evidence.noteHint')}>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Export from the identity provider, all privileged accounts" />
          </Field>
          <input ref={fileInput} type="file" onChange={attach} disabled={busy} style={{ display: 'none' }} />
          <button className="btn btn-primary btn-sm" onClick={() => fileInput.current?.click()} disabled={busy}>
            {busy ? <span className="spinner" /> : <IconUpload width={13} height={13} />}
            {busy ? t('evidence.uploading') : t('evidence.attach')}
          </button>
          <p className="tiny muted">
{t('evidence.uploadHint')}
          </p>
        </div>
      )}
    </div>
  );
}
