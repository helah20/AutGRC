import { useState, useEffect } from 'react';
import { api, qs } from '../lib/api.js';
import { useFetch, useDebounced } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import {
  Card, Loading, ErrorNote, Empty, Badge, DataTable, SearchInput, Select,
  useToast, Modal, Field, Kpi
} from '../components/ui.jsx';
import { IconLayers, IconX, IconCheck, IconAlert, IconDownload } from '../components/Icons.jsx';
import { titleCase } from '../lib/format.js';
import { useLabels } from '../i18n/labels.js';
import { useI18n } from '../i18n/index.jsx';

const IMPLEMENTATION_TONE = {
  implemented: 'ok', partial: 'warn', planned: 'info',
  not_implemented: 'danger', excluded: 'neutral'
};

/**
 * Statement of Applicability. ISO/IEC 27001 requires a reasoned decision for
 * every Annex A control, including the excluded ones.
 *
 * Only the decision is stored. Whether something is implemented is read from
 * the control library, so the SoA cannot claim an implementation the controls
 * do not show.
 */
export default function Soa() {
  const labels = useLabels();
  const { t, formatNumber } = useI18n();
  const toast = useToast();
  const { can } = useAuth();
  const [code, setCode] = useState('ISO-27001');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(null);

  const { data: catalogue } = useFetch('/frameworks');
  const { data, loading, error, reload } = useFetch(`/soa/${encodeURIComponent(code)}`);

  const s = data?.summary;
  const rows = (data?.rows || []).filter((r) => {
    if (filter === 'excluded' && r.applicable) return false;
    if (filter === 'applicable' && !r.applicable) return false;
    if (filter === 'undecided' && r.decision_recorded) return false;
    if (filter === 'not_implemented' && r.implementation !== 'not_implemented') return false;
    if (!debounced) return true;
    const needle = debounced.toLowerCase();
    return r.ref.toLowerCase().includes(needle) || r.title.toLowerCase().includes(needle);
  });

  async function decide(row, applicable, justification) {
    try {
      await api.put(`/soa/${encodeURIComponent(code)}/decisions/${row.requirement_id}`, { applicable, justification });
      toast.success(applicable ? t('soa.recordedApplicable') : t('soa.recordedExcluded'));
      setEditing(null);
      reload();
    } catch (err) { toast.error(t('soa.couldNotRecord'), err.message); }
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">{t('soa.title')}</h1>
          <p className="page-sub">
{t('soa.subtitle')}
          </p>
        </div>
        <div className="page-actions">
          <Select value={code} onChange={setCode}
            options={(catalogue?.items || []).map((f) => ({
              value: f.code,
              label: `${f.code}${f.version ? ` (${f.version})` : ''}${f.edition_status === 'superseded' ? ' — superseded' : ''}`
            }))} />
          <button className="btn" onClick={() => api.download(`/export/soa.xlsx${qs({ framework: code })}`, `Statement of Applicability — ${code}.xlsx`)
            .then(() => toast.success(t('common.exported')))
            .catch((e) => toast.error(t('common.exportFailed'), e.message))}>
            <IconDownload />{t('common.export')}
          </button>
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorNote error={error} onRetry={reload} />}

      {s && (
        <>
          {s.exclusionsWithoutJustification > 0 && (
            <div className="callout" data-callout="danger" style={{ marginBottom: 14 }}>
              <div className="row-tight"><IconAlert width={14} height={14} />
                <strong style={{ margin: 0 }}>{t('soa.unjustified', { count: formatNumber(s.exclusionsWithoutJustification) })}</strong></div>
              <p style={{ marginTop: 4, marginBottom: 0 }}>
{t('soa.unjustifiedBody')}
              </p>
            </div>
          )}

          <div className="grid grid-4" style={{ marginBottom: 14 }}>
            <Kpi label={t('soa.kpiApplicable')} value={formatNumber(s.applicable)} meta={t('soa.kpiApplicableMeta', { total: formatNumber(s.total) })} onClick={() => setFilter('applicable')} />
            <Kpi label={t('soa.kpiImplemented')} value={formatNumber(s.implemented)}
              meta={t('soa.kpiImplementedMeta', { partial: formatNumber(s.partial), planned: formatNumber(s.planned) })} tone={s.implemented ? 'ok' : undefined} />
            <Kpi label={t('soa.kpiNotImplemented')} value={formatNumber(s.notImplemented)} tone={s.notImplemented ? 'danger' : undefined}
              meta={t('soa.kpiNotImplementedMeta')} onClick={() => setFilter('not_implemented')} />
            <Kpi label={t('soa.kpiExcluded')} value={formatNumber(s.excluded)} meta={t('soa.kpiExcludedMeta', { count: formatNumber(s.decisionsRecorded) })}
              onClick={() => setFilter('excluded')} />
          </div>
        </>
      )}

      <Card flush>
        <div className="table-toolbar">
          <div className="search-box"><SearchInput value={search} onChange={setSearch} placeholder={t('soa.searchPlaceholder')} /></div>
          <Select value={filter} onChange={setFilter} placeholder={t('soa.everything')}
            options={[
              { value: 'applicable', label: t('soa.applicableOnly') },
              { value: 'excluded', label: t('soa.excludedOnly') },
              { value: 'undecided', label: t('soa.undecided') },
              { value: 'not_implemented', label: t('soa.notImplementedOnly') }
            ]} />
          {(search || filter) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilter(''); }}>
              <IconX width={13} height={13} />{t('common.clear')}
            </button>
          )}
          <span className="table-count">{data ? `${rows.length} of ${data.rows.length}` : '—'}</span>
        </div>

        {!loading && !error && (
          <DataTable
            columns={[
              { key: 'ref', header: t('soa.columnRef'), nowrap: true, width: 104, render: (r) => <span className="ref-tag">{r.ref}</span> },
              {
                key: 'title', header: t('soa.columnControl'),
                render: (r) => (<>
                  <div className={`${r.level <= 2 ? 'cell-title' : ''} ltr-content`}>{r.title}</div>
                  {r.domain_label && <div className="cell-sub">{labels.domain(r.domain_key, r.domain_label)}</div>}
                </>)
              },
              {
                key: 'applicable', header: t('soa.columnApplicable'), nowrap: true,
                render: (r) => (r.applicable
                  ? <Badge tone="ok">{t('common.yes')}</Badge>
                  : <Badge tone="neutral" title={r.justification || t('soa.justificationError')}>{t('common.no')}</Badge>)
              },
              {
                key: 'implementation', header: t('soa.columnImplementation'), nowrap: true,
                render: (r) => <Badge tone={IMPLEMENTATION_TONE[r.implementation]}>{titleCase(r.implementation.replace(/_/g, ' '))}</Badge>
              },
              {
                key: 'controls', header: t('soa.columnControls'),
                render: (r) => (r.controls.length
                  ? <div className="row-tight">{r.controls.slice(0, 3).map((c) => <span key={c.id} className="pill mono">{c.control_id}</span>)}
                      {r.controls.length > 3 && <span className="tiny muted">+{r.controls.length - 3}</span>}</div>
                  : <span className="muted small">None</span>)
              },
              {
                key: 'justification', header: t('soa.columnDecision'), width: 220,
                render: (r) => (r.decision_recorded
                  ? <span className="small clamp-2" title={r.justification || ''}>{r.justification || <span className="muted">{t('soa.recordedNoNote')}</span>}</span>
                  : <span className="tiny muted">{t('soa.noDecision')}</span>)
              }
            ]}
            rows={rows}
            onRowClick={can('soa:write') ? setEditing : undefined}
            empty={<Empty icon={IconLayers} title={t('soa.emptyTitle')}>{t('soa.emptyBody')}</Empty>}
          />
        )}
      </Card>

      <DecisionModal row={editing} onClose={() => setEditing(null)} onSave={decide} />
    </>
  );
}

function DecisionModal({ row, onClose, onSave }) {
  const labels = useLabels();
  const { t, formatNumber } = useI18n();
  const [applicable, setApplicable] = useState(true);
  const [justification, setJustification] = useState('');

  // Seed the form from the row when the modal opens for it.
  useEffect(() => {
    if (!row) return;
    setApplicable(row.applicable);
    setJustification(row.justification || '');
  }, [row]);

  const needsJustification = !applicable && !justification.trim();

  return (
    <Modal open={Boolean(row)} onClose={onClose}
      title={row ? `${row.ref} — ${row.title}` : ''}
      footer={
        <>
          <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" disabled={needsJustification}
            onClick={() => onSave(row, applicable, justification.trim() || null)}>
            <IconCheck width={13} height={13} />{t('soa.recordDecision')}
          </button>
        </>
      }>
      {row && (
        <div className="stack">
          {row.statement && <p className="small muted ltr-content">{row.statement}</p>}

          <Field label={t('soa.appliesQuestion')}>
            <div className="checkbox-row">
              <label className={`checkbox-chip ${applicable ? 'on' : ''}`}>
                <input type="radio" name="applicable" checked={applicable} onChange={() => setApplicable(true)} />
                {t('soa.applicable')}
              </label>
              <label className={`checkbox-chip ${!applicable ? 'on' : ''}`}>
                <input type="radio" name="applicable" checked={!applicable} onChange={() => setApplicable(false)} />
                {t('soa.excluded')}
              </label>
            </div>
          </Field>

          <Field label={t('soa.justification')}
            required={!applicable}
            hint={applicable
              ? t('soa.justificationOptional')
              : t('soa.justificationRequired')}
            error={needsJustification ? t('soa.justificationError') : null}>
            <textarea className="textarea" rows={3} value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder={applicable
                ? 'In scope across the corporate estate.'
                : 'The organisation operates no industrial control systems, so this control has no applicable scope.'} />
          </Field>

          {row.controls.length > 0 && (
            <div>
              <h4>{t('soa.mappedControls')}</h4>
              <ul className="attachment-list">
                {row.controls.map((c) => (
                  <li key={c.id} className="attachment">
                    <div className="attachment-main">
                      <div className="attachment-name"><span className="ref-tag">{c.control_id}</span> {c.name}</div>
                      <div className="attachment-meta">{labels.status(c.status)} · coverage {labels.coverage(c.coverage)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
