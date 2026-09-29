import { useRef, useState } from 'react';
import { api, qs } from '../lib/api.js';
import { useFetch, useDebounced } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import {
  Card, Loading, ErrorNote, Empty, Badge, Drawer, Modal, SearchInput, Select,
  CoverageBar, useToast, DataTable
} from '../components/ui.jsx';
import TraceChain from '../components/TraceChain.jsx';
import { IconLayers, IconDownload, IconX, IconInfo, IconUpload, IconCheck, IconAlert } from '../components/Icons.jsx';
import { titleCase, COVERAGE_TONE } from '../lib/format.js';
import { useLabels } from '../i18n/labels.js';
import { useI18n } from '../i18n/index.jsx';

export default function Frameworks() {
  const labels = useLabels();
  const { t, formatNumber } = useI18n();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch('/frameworks');
  const [active, setActive] = useState(null);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [domain, setDomain] = useState('');
  const [trace, setTrace] = useState(null);
  const { can } = useAuth();
  const [importOpen, setImportOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const fileRef = useRef(null);

  const { data: detail, loading: detailLoading } = useFetch(
    active ? `/frameworks/${active}/requirements${qs({ search: debounced, domain })}` : null
  );

  const activeFramework = data?.items?.find((f) => f.code === active);
  const canImport = Boolean(activeFramework)
    && can('settings:write')
    && activeFramework.edition_status !== 'superseded';

  /** Upload for analysis only. Nothing is written until the reader confirms. */
  async function analyse(file) {
    setImportBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const analysis = await api.upload(`/frameworks/${active}/catalogue`, form);
      // The file is kept alongside the analysis so the confirming request sends
      // the same bytes that were analysed, rather than re-reading a file the
      // reader may have changed in between.
      setPreview({ ...analysis, file });
    } catch (err) {
      toast.error('The file could not be read', err.message);
      setPreview(null);
    } finally {
      setImportBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function applyImport() {
    setImportBusy(true);
    try {
      const form = new FormData();
      form.append('file', preview.file);
      form.append('confirm', 'true');
      const res = await api.upload(`/frameworks/${active}/catalogue`, form);
      toast.success('Catalogue imported', res.note);
      setImportOpen(false);
      setPreview(null);
      reload();
    } catch (err) {
      toast.error('The import failed', err.message);
    } finally { setImportBusy(false); }
  }

  if (loading) return <Loading label="Loading framework catalogue…" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">{t('frameworks.title')}</h1>
          <p className="page-sub">{t('frameworks.subtitle')}</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => api.download('/export/mappings.xlsx', 'Framework Mapping.xlsx')
            .then(() => toast.success('Exported')).catch((e) => toast.error('Export failed', e.message))}>
            <IconDownload />Export mapping
          </button>
        </div>
      </div>

      <div className="callout">
        <strong>Source status</strong>
        <p style={{ marginBottom: 0 }}>{data.sourceNote}</p>
      </div>

      {!active ? (
        <div className="grid grid-3" style={{ marginTop: 14 }}>
          {data.items.map((f) => (
            <button key={f.id} type="button" className="card" onClick={() => setActive(f.code)}
              style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', padding: 0, border: '1px solid var(--border)' }}>
              <div className="card-body">
                <div className="row-tight" style={{ marginBottom: 6, flexWrap: 'wrap' }}>
                  <span className="ref-tag">{f.code}</span>
                  {f.is_mandatory ? <Badge tone="critical">Regulatory</Badge> : <Badge tone="neutral">Framework</Badge>}
                  {f.edition_status === 'superseded' && (
                    <Badge tone="warn" title={f.superseded_by?.length
                      ? `Replaced by ${f.superseded_by.map((e) => e.code).join(', ')}`
                      : 'No longer the current edition'}>Superseded</Badge>
                  )}
                  {f.edition_status === 'draft' && <Badge tone="neutral">Draft edition</Badge>}
                </div>
                <div className="strong" style={{ marginBottom: 3 }}>{f.name}</div>
                <div className="tiny muted" style={{ marginBottom: 10 }}>
                  {f.publisher}{f.version ? ` · ${f.version}` : ''}{f.jurisdiction ? ` · ${f.jurisdiction}` : ''}
                  {f.supersedes?.code && <><br />Supersedes {f.supersedes.code}</>}
                  {f.retires_on && <><br />Retires {f.retires_on}</>}
                </div>
                <p className="small muted clamp-3" style={{ marginBottom: 12 }}>{f.description}</p>
                <CoverageBar value={f.coverage} label={t('counts.mapped', { mapped: formatNumber(f.mapped_count), total: formatNumber(f.requirement_count) })} />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Card flush style={{ marginTop: 14 }}>
          <div className="table-toolbar">
            <button className="btn btn-sm" onClick={() => { setActive(null); setSearch(''); setDomain(''); }}>
              <IconX width={13} height={13} />All frameworks
            </button>
            <span className="strong">{detail?.framework?.name || active}</span>
            <div className="search-box"><SearchInput value={search} onChange={setSearch} placeholder="Search requirements…" /></div>
            <Select value={domain} onChange={setDomain} placeholder="All domains"
              options={(detail?.domains || []).map((d) => ({ value: d.key, label: d.name }))} />
            <span className="table-count">{detail ? t('counts.requirements', { count: formatNumber(detail.requirements.length) }) : '—'}</span>
            {canImport && (
              <button className="btn btn-sm" onClick={() => { setPreview(null); setImportOpen(true); }}>
                <IconUpload width={13} height={13} />{t('frameworks.importCatalogue')}
              </button>
            )}
          </div>

          {detailLoading && <Loading />}
          {detail && (
            <DataTable
              columns={[
                {
                  key: 'ref', header: 'Ref', nowrap: true, width: 130,
                  render: (r) => (
                    <div className="stack-tiny">
                      <span className="ref-tag">{r.ref}</span>
                      {r.source_status !== 'reference' && (
                        <span className="tiny muted">{labels.sourceStatus
                          ? labels.sourceStatus(r.source_status)
                          : r.source_status.replace('_', ' ')}</span>
                      )}
                    </div>
                  )
                },
                {
                  key: 'title', header: 'Requirement',
                  render: (r) => (
                    <div style={{ paddingLeft: (r.level - 1) * 14 }}>
                      <div className={`${r.level <= 2 ? 'cell-title' : ''} ltr-content`}>{r.title}</div>
                      {r.domain_label && <div className="cell-sub">{labels.domain(r.domain_key, r.domain_label)}</div>}
                    </div>
                  )
                },
                {
                  key: 'coverage', header: 'Coverage', nowrap: true,
                  render: (r) => <Badge tone={COVERAGE_TONE[r.coverage] || 'neutral'}>{titleCase(r.coverage)}</Badge>
                },
                {
                  key: 'controls', header: 'Mapped controls',
                  render: (r) => r.controls.length
                    ? <div className="row-tight">{r.controls.slice(0, 4).map((c) => <span key={c.control_id} className="pill mono">{c.control_id}</span>)}
                        {r.controls.length > 4 && <span className="tiny muted">+{r.controls.length - 4}</span>}</div>
                    : <span className="muted small">None</span>
                }
              ]}
              rows={detail.requirements}
              onRowClick={async (r) => {
                try { setTrace(await api.get(`/frameworks/requirements/${r.id}/trace`)); }
                catch (err) { toast.error('Could not load traceability', err.message); }
              }}
              empty={<Empty icon={IconLayers} title="No requirements match" />}
            />
          )}
        </Card>
      )}

      <Modal open={importOpen} onClose={() => { setImportOpen(false); setPreview(null); }} size="modal-lg"
        title={`${t('frameworks.importCatalogue')} — ${activeFramework?.name || active}`}
        footer={
          <>
            <button className="btn" onClick={() => { setImportOpen(false); setPreview(null); }}>
              {t('common.cancel')}
            </button>
            {preview && (
              <button className="btn btn-primary" onClick={applyImport} disabled={importBusy}>
                {importBusy ? <span className="spinner" style={{ width: 13, height: 13 }} /> : <IconCheck />}
                {t('frameworks.importApply', {
                  inserts: formatNumber(preview.inserts), updates: formatNumber(preview.updates)
                })}
              </button>
            )}
          </>
        }>
        <div className="stack-sm">
          <p className="small muted" style={{ marginBottom: 0 }}>{t('frameworks.importIntro')}</p>
          <div className="callout">
            <strong>{t('frameworks.importSchemaTitle')}</strong>
            <p style={{ marginBottom: 0 }}>{t('frameworks.importSchemaBody')}</p>
          </div>

          <input ref={fileRef} type="file" className="input" accept=".xlsx,.xlsm,.csv"
            disabled={importBusy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) analyse(file);
            }} />

          {importBusy && !preview && <Loading label={t('frameworks.importReading')} />}

          {preview && (
            <>
              <div className="grid grid-3">
                <div className="kpi"><div className="kpi-label">{t('frameworks.importNew')}</div><div className="kpi-value">{formatNumber(preview.inserts)}</div></div>
                <div className="kpi"><div className="kpi-label">{t('frameworks.importReplaced')}</div><div className="kpi-value">{formatNumber(preview.updates)}</div></div>
                <div className="kpi"><div className="kpi-label">{t('frameworks.importRejected')}</div><div className="kpi-value">{formatNumber(preview.rejected.length)}</div></div>
              </div>

              <p className="tiny muted" style={{ marginBottom: 0 }}>
                {t('frameworks.importLayout')}: <span className="mono">{preview.layout}</span> · {Object.entries(preview.columns).map(([f, header]) => `${f} ← ${header}`).join(' · ')}
              </p>

              {preview.notCovered.length > 0 && (
                <div className="callout">
                  <strong>{t('frameworks.importNotCovered', { count: formatNumber(preview.notCovered.length) })}</strong>
                  <p style={{ marginBottom: 0 }}>{t('frameworks.importNotCoveredBody')}</p>
                </div>
              )}

              {preview.rejected.length > 0 && (
                <div className="callout" data-callout="warning">
                  <strong>{t('frameworks.importRejectedTitle')}</strong>
                  <ul style={{ marginBottom: 0 }}>
                    {preview.rejected.slice(0, 8).map((r) => (
                      <li key={`${r.line}-${r.ref || ''}`} className="small">
                        {t('frameworks.importRow')} {formatNumber(r.line)}{r.ref ? ` (${r.ref})` : ''}: {r.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.unmatchedCapabilities.length > 0 && (
                <div className="callout" data-callout="warning">
                  <strong>{t('frameworks.importUnmatched')}</strong>
                  <p style={{ marginBottom: 0 }}>
                    {preview.unmatchedCapabilities.map((u) => `${u.capability} (${u.rows})`).join(', ')} — {t('frameworks.importUnmatchedBody')}
                  </p>
                </div>
              )}

              {preview.crosswalkCandidates.length > 0 && (
                <div className="callout">
                  <strong>{t('frameworks.importCandidates', { count: formatNumber(preview.crosswalkCandidates.length) })}</strong>
                  <p style={{ marginBottom: 0 }}>{t('frameworks.importCandidatesBody')}</p>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      <Drawer open={Boolean(trace)} onClose={() => setTrace(null)} wide
        title={trace ? `${trace.requirement.framework_code} ${trace.requirement.ref}` : ''}>
        {trace && <TraceChain trace={trace} />}
      </Drawer>
    </>
  );
}
