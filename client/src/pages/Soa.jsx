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
      toast.success(applicable ? 'Recorded as applicable' : 'Recorded as excluded');
      setEditing(null);
      reload();
    } catch (err) { toast.error('Could not record the decision', err.message); }
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">Statement of Applicability</h1>
          <p className="page-sub">
            A reasoned decision for every control, including the ones you exclude. Implementation status
            is read from the control library rather than stated here, so the two cannot disagree.
          </p>
        </div>
        <div className="page-actions">
          <Select value={code} onChange={setCode}
            options={(catalogue?.items || []).map((f) => ({
              value: f.code,
              label: `${f.code}${f.version ? ` (${f.version})` : ''}${f.edition_status === 'superseded' ? ' — superseded' : ''}`
            }))} />
          <button className="btn" onClick={() => api.download(`/export/soa.xlsx${qs({ framework: code })}`, `Statement of Applicability — ${code}.xlsx`)
            .then(() => toast.success('Exported'))
            .catch((e) => toast.error('Export failed', e.message))}>
            <IconDownload />Export
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
                <strong style={{ margin: 0 }}>{s.exclusionsWithoutJustification} exclusion(s) with no justification</strong></div>
              <p style={{ marginTop: 4, marginBottom: 0 }}>
                An unjustified exclusion is the first thing an auditor writes up. Record why each one
                does not apply.
              </p>
            </div>
          )}

          <div className="grid grid-4" style={{ marginBottom: 14 }}>
            <Kpi label="Applicable" value={s.applicable} meta={`of ${s.total} controls`} onClick={() => setFilter('applicable')} />
            <Kpi label="Implemented" value={s.implemented}
              meta={`${s.partial} partial, ${s.planned} planned`} tone={s.implemented ? 'ok' : undefined} />
            <Kpi label="Not implemented" value={s.notImplemented} tone={s.notImplemented ? 'danger' : undefined}
              meta="Applicable, nothing mapped" onClick={() => setFilter('not_implemented')} />
            <Kpi label="Excluded" value={s.excluded} meta={`${s.decisionsRecorded} decisions recorded`}
              onClick={() => setFilter('excluded')} />
          </div>
        </>
      )}

      <Card flush>
        <div className="table-toolbar">
          <div className="search-box"><SearchInput value={search} onChange={setSearch} placeholder="Search by reference or title…" /></div>
          <Select value={filter} onChange={setFilter} placeholder="Everything"
            options={[
              { value: 'applicable', label: 'Applicable only' },
              { value: 'excluded', label: 'Excluded only' },
              { value: 'undecided', label: 'No decision recorded' },
              { value: 'not_implemented', label: 'Not implemented' }
            ]} />
          {(search || filter) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilter(''); }}>
              <IconX width={13} height={13} />Clear
            </button>
          )}
          <span className="table-count">{data ? `${rows.length} of ${data.rows.length}` : '—'}</span>
        </div>

        {!loading && !error && (
          <DataTable
            columns={[
              { key: 'ref', header: 'Ref', nowrap: true, width: 104, render: (r) => <span className="ref-tag">{r.ref}</span> },
              {
                key: 'title', header: 'Control',
                render: (r) => (<>
                  <div className={r.level <= 2 ? 'cell-title' : ''}>{r.title}</div>
                  {r.domain_label && <div className="cell-sub">{r.domain_label}</div>}
                </>)
              },
              {
                key: 'applicable', header: 'Applicable', nowrap: true,
                render: (r) => (r.applicable
                  ? <Badge tone="ok">Yes</Badge>
                  : <Badge tone="neutral" title={r.justification || 'No justification recorded'}>No</Badge>)
              },
              {
                key: 'implementation', header: 'Implementation', nowrap: true,
                render: (r) => <Badge tone={IMPLEMENTATION_TONE[r.implementation]}>{titleCase(r.implementation.replace(/_/g, ' '))}</Badge>
              },
              {
                key: 'controls', header: 'Controls',
                render: (r) => (r.controls.length
                  ? <div className="row-tight">{r.controls.slice(0, 3).map((c) => <span key={c.id} className="pill mono">{c.control_id}</span>)}
                      {r.controls.length > 3 && <span className="tiny muted">+{r.controls.length - 3}</span>}</div>
                  : <span className="muted small">None</span>)
              },
              {
                key: 'justification', header: 'Decision', width: 220,
                render: (r) => (r.decision_recorded
                  ? <span className="small clamp-2" title={r.justification || ''}>{r.justification || <span className="muted">Recorded, no note</span>}</span>
                  : <span className="tiny muted">Applicable by default — no decision recorded</span>)
              }
            ]}
            rows={rows}
            onRowClick={can('soa:write') ? setEditing : undefined}
            empty={<Empty icon={IconLayers} title="Nothing to show">No requirement matches the current filter.</Empty>}
          />
        )}
      </Card>

      <DecisionModal row={editing} onClose={() => setEditing(null)} onSave={decide} />
    </>
  );
}

function DecisionModal({ row, onClose, onSave }) {
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
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={needsJustification}
            onClick={() => onSave(row, applicable, justification.trim() || null)}>
            <IconCheck width={13} height={13} />Record the decision
          </button>
        </>
      }>
      {row && (
        <div className="stack">
          {row.statement && <p className="small muted">{row.statement}</p>}

          <Field label="Does this control apply to your organisation?">
            <div className="checkbox-row">
              <label className={`checkbox-chip ${applicable ? 'on' : ''}`}>
                <input type="radio" name="applicable" checked={applicable} onChange={() => setApplicable(true)} />
                Applicable
              </label>
              <label className={`checkbox-chip ${!applicable ? 'on' : ''}`}>
                <input type="radio" name="applicable" checked={!applicable} onChange={() => setApplicable(false)} />
                Excluded
              </label>
            </div>
          </Field>

          <Field label="Justification"
            required={!applicable}
            hint={applicable
              ? 'Optional for an applicable control, but it helps the next reader.'
              : 'Required. ISO/IEC 27001 asks for the reason behind every exclusion.'}
            error={needsJustification ? 'An excluded control needs a reason.' : null}>
            <textarea className="textarea" rows={3} value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder={applicable
                ? 'In scope across the corporate estate.'
                : 'The organisation operates no industrial control systems, so this control has no applicable scope.'} />
          </Field>

          {row.controls.length > 0 && (
            <div>
              <h4>Controls mapped to this requirement</h4>
              <ul className="attachment-list">
                {row.controls.map((c) => (
                  <li key={c.id} className="attachment">
                    <div className="attachment-main">
                      <div className="attachment-name"><span className="ref-tag">{c.control_id}</span> {c.name}</div>
                      <div className="attachment-meta">{titleCase(c.status)} · coverage {titleCase(c.coverage)}</div>
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
