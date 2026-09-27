import { useState, useEffect, useCallback } from 'react';
import { api, qs } from '../lib/api.js';
import { useFetch, useDebounced } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import {
  Card, Loading, ErrorNote, Empty, Badge, DataTable, SearchInput, Select,
  useToast, Drawer, Field, Tabs, Modal
} from '../components/ui.jsx';
import { IconTarget, IconX, IconCheck, IconShield, IconAlert } from '../components/Icons.jsx';
import { titleCase, RISK_TONE, formatDate } from '../lib/format.js';

export default function Risks() {
  const toast = useToast();
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [domain, setDomain] = useState('');
  const [status, setStatus] = useState('');
  const [treatment, setTreatment] = useState('');
  const [unassessed, setUnassessed] = useState(false);
  const [selected, setSelected] = useState(null);
  const [position, setPosition] = useState('residual');

  const { data, loading, error, reload } = useFetch(
    `/risks${qs({ search: debounced, domain, status, treatment, unassessed: unassessed || undefined, limit: 500 })}`
  );

  const summary = data?.summary;

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">Risk Register</h1>
          <p className="page-sub">
            Built from the same canonical requirement model as the policies, so a risk and the controls
            that treat it come from one source rather than two that drift apart.
          </p>
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorNote error={error} onRetry={reload} />}

      {summary && (
        <>
          {summary.unassessed > 0 && (
            <div className="callout" data-callout="warn" style={{ marginBottom: 14 }}>
              <div className="row-tight">
                <IconAlert width={14} height={14} />
                <strong style={{ margin: 0 }}>
                  {summary.unassessed} of {summary.total} risks have no assessed residual position
                </strong>
              </div>
              <p style={{ marginTop: 4, marginBottom: 0 }}>
                Their residual rating still equals the inherent one. That is not a reduction anybody has
                achieved — it is the register saying nobody has worked one out yet. The likelihood and
                impact each started from were derived from the requirement model, not from this
                organisation, so they need reassessing before the register means anything.
              </p>
            </div>
          )}

          <div className="grid grid-2" style={{ marginBottom: 14 }}>
            <Card title="Risk matrix"
              subtitle="Likelihood across, impact up. Counts are risks in that cell."
              actions={
                <Tabs tabs={[{ key: 'residual', label: 'Residual' }, { key: 'inherent', label: 'Inherent' }]}
                  active={position} onChange={setPosition} />
              }>
              <RiskMatrix cells={data.matrix[position]} onPick={(riskId) => {
                const row = data.items.find((r) => r.id === riskId);
                if (row) setSelected(row);
              }} />
            </Card>

            <Card title="Position" subtitle="Inherent is before controls; residual is after the ones actually in place.">
              <div className="stack-sm">
                {['critical', 'high', 'medium', 'low'].map((band) => {
                  const inherent = summary.byInherentRating.find((b) => b.rating === band)?.n || 0;
                  const residual = summary.byResidualRating.find((b) => b.rating === band)?.n || 0;
                  return (
                    <div key={band} className="risk-band">
                      <Badge tone={RISK_TONE[band]}>{titleCase(band)}</Badge>
                      <span className="risk-band-bar">
                        <span className="risk-band-fill" style={{ width: `${(inherent / Math.max(summary.total, 1)) * 100}%` }} />
                      </span>
                      <span className="small mono">{inherent} → {residual}</span>
                    </div>
                  );
                })}
                <div className="divider" />
                <div className="definition">
                  <dt>Residual assessed</dt><dd>{summary.residualAssessed} of {summary.total}</dd>
                  <dt>Formally accepted</dt><dd>{summary.accepted}</dd>
                  {summary.acceptancesExpired > 0 && (
                    <>
                      <dt>Acceptances expired</dt>
                      <dd><Badge tone="danger">{summary.acceptancesExpired}</Badge></dd>
                    </>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      <Card flush>
        <div className="table-toolbar">
          <div className="search-box"><SearchInput value={search} onChange={setSearch} placeholder="Search risks…" /></div>
          <Select value={domain} onChange={setDomain} placeholder="All domains"
            options={(data?.facets?.domains || []).map((d) => ({ value: d.domain_key, label: `${d.label} (${d.n})` }))} />
          <Select value={status} onChange={setStatus} placeholder="All statuses"
            options={(data?.facets?.statuses || []).map((s) => ({ value: s.status, label: `${titleCase(s.status)} (${s.n})` }))} />
          <Select value={treatment} onChange={setTreatment} placeholder="All treatments"
            options={(data?.facets?.treatments || []).map((t) => ({ value: t.treatment, label: `${titleCase(t.treatment)} (${t.n})` }))} />
          <button className={`btn btn-sm ${unassessed ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setUnassessed((v) => !v)}>
            Residual not assessed
          </button>
          {(search || domain || status || treatment || unassessed) && (
            <button className="btn btn-ghost btn-sm" onClick={() => {
              setSearch(''); setDomain(''); setStatus(''); setTreatment(''); setUnassessed(false);
            }}><IconX width={13} height={13} />Clear</button>
          )}
          <span className="table-count">{data ? `${data.items.length} of ${data.total}` : '—'}</span>
        </div>

        {!loading && !error && (
          <DataTable
            columns={[
              { key: 'risk_id', header: 'ID', nowrap: true, width: 122, render: (r) => <span className="ref-tag">{r.risk_id}</span> },
              {
                key: 'title', header: 'Risk',
                render: (r) => (<>
                  <div className="cell-title">{r.title}</div>
                  <div className="cell-sub clamp-2">{r.description}</div>
                </>)
              },
              { key: 'domain_label', header: 'Domain', nowrap: true, render: (r) => <span className="small">{r.domain_label}</span> },
              {
                key: 'inherent', header: 'Inherent', nowrap: true,
                render: (r) => <Badge tone={RISK_TONE[r.inherent.rating]} title={`L${r.inherent.likelihood} x I${r.inherent.impact}`}>{r.inherent.score}</Badge>
              },
              {
                key: 'residual', header: 'Residual', nowrap: true,
                render: (r) => (r.residual_assessed
                  ? <Badge tone={RISK_TONE[r.residual.rating]} title={`L${r.residual.likelihood} x I${r.residual.impact}`}>{r.residual.score}</Badge>
                  : <span className="small muted" title="No residual assessment has been made">Not assessed</span>)
              },
              { key: 'treatment', header: 'Treatment', nowrap: true, render: (r) => <Badge tone="neutral">{titleCase(r.treatment)}</Badge> },
              {
                key: 'status', header: 'Status', nowrap: true,
                render: (r) => (r.acceptanceExpired
                  ? <Badge tone="danger" title="The acceptance has lapsed">Acceptance expired</Badge>
                  : <Badge tone={r.status === 'accepted' ? 'warn' : r.status === 'treated' ? 'ok' : 'neutral'}>{titleCase(r.status)}</Badge>)
              },
              {
                key: 'open_actions', header: 'Actions', nowrap: true, align: 'right',
                render: (r) => (r.open_actions ? <Badge tone="info">{r.open_actions} open</Badge> : <span className="faint">—</span>)
              }
            ]}
            rows={data?.items || []}
            onRowClick={setSelected}
            empty={<Empty icon={IconTarget} title="No risks recorded">The register is built when the database is seeded, from the risk each canonical requirement exists to address.</Empty>}
          />
        )}
      </Card>

      <RiskDrawer risk={selected} onClose={() => setSelected(null)} onChanged={() => { reload(); }}
        canWrite={can('risk:write')} canAccept={can('risk:accept')} toast={toast} />
    </>
  );
}

/* ------------------------------------------------------------- matrix --- */

function RiskMatrix({ cells, onPick }) {
  return (
    <div className="risk-matrix" role="table" aria-label="Risk matrix">
      <div className="risk-matrix-grid">
        {cells.map((cell) => (
          <button key={`${cell.likelihood}-${cell.impact}`} type="button"
            className={`risk-cell tone-${cell.rating} ${cell.count ? 'has-risks' : ''}`}
            disabled={!cell.count}
            title={`Likelihood ${cell.likelihood}, impact ${cell.impact} — ${titleCase(cell.rating)}${cell.count ? `: ${cell.risks.map((r) => r.risk_id).join(', ')}` : ''}`}
            onClick={() => cell.risks[0] && onPick(cell.risks[0].id)}>
            {cell.count || ''}
          </button>
        ))}
      </div>
      <div className="risk-matrix-axes">
        <span className="tiny muted">Likelihood →</span>
        <span className="tiny muted">↑ Impact</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- drawer --- */

function RiskDrawer({ risk, onClose, onChanged, canWrite, canAccept, toast }) {
  const [detail, setDetail] = useState(null);
  const [draft, setDraft] = useState(null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rationale, setRationale] = useState('');
  const [expires, setExpires] = useState('');

  const load = useCallback(async (id) => {
    try {
      const res = await api.get(`/risks/${id}`);
      setDetail(res);
      setDraft({
        residual_likelihood: res.risk.residual.likelihood,
        residual_impact: res.risk.residual.impact,
        treatment: res.risk.treatment,
        treatment_summary: res.risk.treatment_summary || ''
      });
    } catch (err) { toast.error('Could not load the risk', err.message); }
  }, [toast]);

  // Fetch in an effect, not during render: calling load() inline would set
  // state on every render and never settle.
  useEffect(() => {
    if (!risk) { setDetail(null); setDraft(null); return; }
    setDetail(null);
    setDraft(null);
    load(risk.id);
  }, [risk, load]);

  async function save() {
    try {
      await api.patch(`/risks/${risk.id}`, {
        residual_likelihood: draft.residual_likelihood,
        residual_impact: draft.residual_impact,
        treatment: draft.treatment,
        treatment_summary: draft.treatment_summary || null,
        status: 'treated'
      });
      toast.success('Residual position recorded');
      await load(risk.id);
      onChanged();
    } catch (err) { toast.error('Could not save', err.message); }
  }

  async function accept() {
    try {
      await api.post(`/risks/${risk.id}/accept`, { rationale, expires });
      toast.success('Risk accepted', 'Recorded against your name with an expiry.');
      setAcceptOpen(false);
      setRationale('');
      setExpires('');
      await load(risk.id);
      onChanged();
    } catch (err) { toast.error('Could not accept', err.message); }
  }

  async function withdraw() {
    try {
      await api.post(`/risks/${risk.id}/withdraw-acceptance`);
      toast.success('Acceptance withdrawn');
      await load(risk.id);
      onChanged();
    } catch (err) { toast.error('Could not withdraw', err.message); }
  }

  const r = detail?.risk;

  return (
    <>
      <Drawer open={Boolean(risk)} onClose={() => { setDetail(null); onClose(); }} wide
        title={r ? `${r.risk_id} — ${r.title}` : ''}
        footer={r && (
          <>
            <button className="btn" onClick={() => { setDetail(null); onClose(); }}>Close</button>
            {canAccept && !r.accepted && (
              <button className="btn" onClick={() => setAcceptOpen(true)}><IconShield width={13} height={13} />Accept this risk</button>
            )}
            {canAccept && r.accepted && (
              <button className="btn btn-danger-ghost" onClick={withdraw}>Withdraw acceptance</button>
            )}
            {canWrite && !r.accepted && (
              <button className="btn btn-primary" onClick={save}><IconCheck width={13} height={13} />Save assessment</button>
            )}
          </>
        )}>
        {r && draft && (
          <div className="stack">
            <div className="row-tight" style={{ flexWrap: 'wrap' }}>
              <Badge tone="info">{r.domain_label}</Badge>
              <Badge tone="neutral">{titleCase(r.category)}</Badge>
              <Badge tone={r.status === 'accepted' ? 'warn' : 'neutral'}>{titleCase(r.status)}</Badge>
              {r.provenance === 'ai_recommendation' && (
                <Badge tone="warn" title="The starting likelihood and impact were derived from the requirement model, not assessed for this organisation">
                  Starting position
                </Badge>
              )}
            </div>

            <p className="small">{r.description}</p>

            {r.accepted && (
              <div className="callout" data-callout={r.acceptanceExpired ? 'danger' : 'warn'}>
                <div className="row-tight">
                  <IconShield width={14} height={14} />
                  <strong style={{ margin: 0 }}>
                    {r.acceptanceExpired ? 'Acceptance expired' : 'Formally accepted'}
                  </strong>
                </div>
                <p style={{ marginTop: 4, marginBottom: 0 }}>
                  Accepted by {r.accepted_by_name} on {formatDate(r.accepted_at)}, expiring {formatDate(r.acceptance_expires)}.
                </p>
                <p className="small" style={{ marginTop: 6, marginBottom: 0 }}>{r.acceptance_rationale}</p>
              </div>
            )}

            <div className="grid grid-2">
              <div className="position-card">
                <div className="tiny muted">Inherent — before any control</div>
                <div className="position-score">
                  <Badge tone={RISK_TONE[r.inherent.rating]}>{titleCase(r.inherent.rating)}</Badge>
                  <span className="mono">{r.inherent.score}</span>
                </div>
                <div className="tiny muted">{r.inherent.likelihoodLabel} × {r.inherent.impactLabel}</div>
              </div>
              <div className="position-card">
                <div className="tiny muted">Residual — after the controls in place</div>
                <div className="position-score">
                  {r.residual_assessed
                    ? <><Badge tone={RISK_TONE[r.residual.rating]}>{titleCase(r.residual.rating)}</Badge><span className="mono">{r.residual.score}</span></>
                    : <Badge tone="neutral">Not yet assessed</Badge>}
                </div>
                <div className="tiny muted">
                  {r.residual_assessed
                    ? `${r.residual.likelihoodLabel} × ${r.residual.impactLabel}`
                    : 'Shown equal to inherent until somebody assesses it.'}
                </div>
              </div>
            </div>

            {canWrite && !r.accepted && (
              <>
                <h4>Assess the residual position</h4>
                <div className="grid grid-2">
                  <Field label="Residual likelihood">
                    <Select value={String(draft.residual_likelihood)}
                      onChange={(v) => setDraft((d) => ({ ...d, residual_likelihood: Number(v) }))}
                      options={detail.scales.likelihood.map((s) => ({ value: String(s.value), label: `${s.value} — ${s.label}` }))} />
                  </Field>
                  <Field label="Residual impact">
                    <Select value={String(draft.residual_impact)}
                      onChange={(v) => setDraft((d) => ({ ...d, residual_impact: Number(v) }))}
                      options={detail.scales.impact.map((s) => ({ value: String(s.value), label: `${s.value} — ${s.label}` }))} />
                  </Field>
                </div>
                <Field label="Treatment">
                  <Select value={draft.treatment} onChange={(v) => setDraft((d) => ({ ...d, treatment: v }))}
                    options={Object.entries(detail.scales.treatments).map(([value, label]) => ({ value, label: `${titleCase(value)} — ${label}` }))} />
                </Field>
                <Field label="Treatment summary">
                  <textarea className="textarea" value={draft.treatment_summary}
                    onChange={(e) => setDraft((d) => ({ ...d, treatment_summary: e.target.value }))} />
                </Field>
              </>
            )}

            <h4>Controls treating this risk</h4>
            {detail.controls.length ? (
              <ul className="attachment-list">
                {detail.controls.map((c) => (
                  <li key={c.link_id} className="attachment">
                    <div className="attachment-main">
                      <div className="attachment-name"><span className="ref-tag">{c.control_id}</span> {c.name}</div>
                      <div className="attachment-meta">{titleCase(c.effect.replace(/_/g, ' '))} · {titleCase(c.status)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="small muted">No control is recorded against this risk.</p>}

            <h4>Corrective actions</h4>
            {detail.actions.length ? (
              <ul className="attachment-list">
                {detail.actions.map((a) => (
                  <li key={a.id} className="attachment">
                    <div className="attachment-main">
                      <div className="attachment-name"><span className="ref-tag">{a.action_id}</span> {a.title}</div>
                      <div className="attachment-meta">{titleCase(a.status)} · due {formatDate(a.due_date)} · {a.owner_name || 'unassigned'}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="small muted">No corrective action has been raised against this risk.</p>}
          </div>
        )}
      </Drawer>

      <Modal open={acceptOpen} onClose={() => setAcceptOpen(false)} title="Accept this risk"
        footer={
          <>
            <button className="btn" onClick={() => setAcceptOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={rationale.trim().length < 20 || !expires} onClick={accept}>
              <IconShield width={13} height={13} />Accept in my name
            </button>
          </>
        }>
        <p className="small">
          Accepting records your name against the decision to live with this risk. It needs a reason
          somebody else can evaluate, and an expiry — an acceptance with no end date is a decision
          nobody ever revisits.
        </p>
        <Field label="Rationale" hint="At least a sentence. What makes this acceptable, and on what basis?">
          <textarea className="textarea" value={rationale} onChange={(e) => setRationale(e.target.value)} rows={4} />
        </Field>
        <Field label="Acceptance expires" hint="The date this decision must be taken again.">
          <input className="input" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </Field>
      </Modal>
    </>
  );
}
