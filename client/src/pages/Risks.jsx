import { useState, useEffect, useCallback } from 'react';
import { api, qs } from '../lib/api.js';
import { useFetch, useDebounced } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import {
  Card, Loading, ErrorNote, Empty, Badge, DataTable, SearchInput, Select,
  useToast, Drawer, Field, Tabs, Modal
} from '../components/ui.jsx';
import { IconTarget, IconX, IconCheck, IconShield, IconAlert, IconPlus } from '../components/Icons.jsx';
import { RISK_TONE, formatDate } from '../lib/format.js';
import { useLabels } from '../i18n/labels.js';
import { useI18n } from '../i18n/index.jsx';

export default function Risks() {
  const labels = useLabels();
  const { t, formatNumber } = useI18n();
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
  const [addOpen, setAddOpen] = useState(false);

  const { data, loading, error, reload } = useFetch(
    `/risks${qs({ search: debounced, domain, status, treatment, unassessed: unassessed || undefined, limit: 500 })}`
  );

  const summary = data?.summary;

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">{t('risks.title')}</h1>
          <p className="page-sub">
{t('risks.subtitle')}
          </p>
        </div>
        {can('risk:write') && (
          <div className="page-actions">
            <button className="btn btn-primary" onClick={() => setAddOpen(true)}><IconPlus />{t('risks.add')}</button>
          </div>
        )}
      </div>

      <AddRisk open={addOpen} onClose={() => setAddOpen(false)} toast={toast}
        onCreated={(risk) => { reload(); setSelected(risk); }} />

      {loading && <Loading />}
      {error && <ErrorNote error={error} onRetry={reload} />}

      {summary && (
        <>
          {summary.unassessed > 0 && (
            <div className="callout" data-callout="warn" style={{ marginBottom: 14 }}>
              <div className="row-tight">
                <IconAlert width={14} height={14} />
                <strong style={{ margin: 0 }}>
{t('risks.unassessedWarning', { count: formatNumber(summary.unassessed), total: formatNumber(summary.total) })}
                </strong>
              </div>
              <p style={{ marginTop: 4, marginBottom: 0 }}>
{t('risks.unassessedBody')}
              </p>
            </div>
          )}

          <div className="grid grid-2" style={{ marginBottom: 14 }}>
            <Card title={t('risks.matrix')}
              subtitle={t('risks.matrixSubtitle')}
              actions={
                <Tabs tabs={[{ key: 'residual', label: t('risks.residual') }, { key: 'inherent', label: t('risks.inherent') }]}
                  active={position} onChange={setPosition} />
              }>
              <RiskMatrix cells={data.matrix[position]} onPick={(riskId) => {
                const row = data.items.find((r) => r.id === riskId);
                if (row) setSelected(row);
              }} />
            </Card>

            <Card title={t('risks.position')} subtitle={t('risks.positionSubtitle')}>
              <div className="stack-sm">
                {['critical', 'high', 'medium', 'low'].map((band) => {
                  const inherent = summary.byInherentRating.find((b) => b.rating === band)?.n || 0;
                  const residual = summary.byResidualRating.find((b) => b.rating === band)?.n || 0;
                  return (
                    <div key={band} className="risk-band">
                      <Badge tone={RISK_TONE[band]}>{labels.rating(band)}</Badge>
                      <span className="risk-band-bar">
                        <span className="risk-band-fill" style={{ width: `${(inherent / Math.max(summary.total, 1)) * 100}%` }} />
                      </span>
                      <span className="small mono">{inherent} → {residual}</span>
                    </div>
                  );
                })}
                <div className="divider" />
                <dl className="definition">
                  <dt>{t('risks.residualAssessed')}</dt><dd>{formatNumber(summary.residualAssessed)} {t('common.of')} {formatNumber(summary.total)}</dd>
                  <dt>{t('risks.formallyAccepted')}</dt><dd>{formatNumber(summary.accepted)}</dd>
                  {summary.acceptancesExpired > 0 && (
                    <>
                      <dt>{t('risks.acceptancesExpired')}</dt>
                      <dd><Badge tone="danger">{summary.acceptancesExpired}</Badge></dd>
                    </>
                  )}
                </dl>
              </div>
            </Card>
          </div>
        </>
      )}

      <Card flush>
        <div className="table-toolbar">
          <div className="search-box"><SearchInput value={search} onChange={setSearch} placeholder={t('risks.searchPlaceholder')} /></div>
          <Select value={domain} onChange={setDomain} placeholder={t('common.all')}
            options={(data?.facets?.domains || []).map((d) => ({ value: d.domain_key, label: `${labels.domain(d.domain_key, d.label)} (${d.n})` }))} />
          <Select value={status} onChange={setStatus} placeholder={t('common.status')}
            options={(data?.facets?.statuses || []).map((s) => ({ value: s.status, label: `${labels.riskStatus(s.status)} (${s.n})` }))} />
          <Select value={treatment} onChange={setTreatment} placeholder={t('risks.treatment')}
            options={(data?.facets?.treatments || []).map((t) => ({ value: t.treatment, label: `${labels.treatment(t.treatment)} (${t.n})` }))} />
          <button className={`btn btn-sm ${unassessed ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setUnassessed((v) => !v)}>
            {t('risks.residualNotAssessed')}
          </button>
          {(search || domain || status || treatment || unassessed) && (
            <button className="btn btn-ghost btn-sm" onClick={() => {
              setSearch(''); setDomain(''); setStatus(''); setTreatment(''); setUnassessed(false);
            }}><IconX width={13} height={13} />{t('common.clear')}</button>
          )}
          <span className="table-count">{data ? `${formatNumber(data.items.length)} ${t('common.of')} ${formatNumber(data.total)}` : '—'}</span>
        </div>

        {!loading && !error && (
          <DataTable
            columns={[
              { key: 'risk_id', header: t('evidence.columnId'), nowrap: true, width: 122, render: (r) => <span className="ref-tag">{r.risk_id}</span> },
              {
                key: 'title', header: t('nav.risk'),
                render: (r) => (<>
                  <div className="cell-title">{r.title}</div>
                  <div className="cell-sub clamp-2">{r.description}</div>
                </>)
              },
              { key: 'domain_label', header: t('common.domain'), nowrap: true, render: (r) => <span className="small">{labels.domain(r.domain_key, r.domain_label)}</span> },
              {
                key: 'inherent', header: t('risks.inherent'), nowrap: true,
                render: (r) => <Badge tone={RISK_TONE[r.inherent.rating]} title={t('risksUi.scoreTitle', { likelihood: r.inherent.likelihood, impact: r.inherent.impact })}>{r.inherent.score}</Badge>
              },
              {
                key: 'residual', header: t('risks.residual'), nowrap: true,
                render: (r) => (r.residual_assessed
                  ? <Badge tone={RISK_TONE[r.residual.rating]} title={t('risksUi.scoreTitle', { likelihood: r.residual.likelihood, impact: r.residual.impact })}>{r.residual.score}</Badge>
                  : <span className="small muted" title={t('risks.notAssessedTitle')}>{t('risks.notAssessed')}</span>)
              },
              { key: 'treatment', header: t('risks.treatment'), nowrap: true, render: (r) => <Badge tone="neutral">{labels.treatment(r.treatment)}</Badge> },
              {
                key: 'status', header: t('common.status'), nowrap: true,
                render: (r) => (r.acceptanceExpired
                  ? <Badge tone="danger" title={t('risks.expiredBanner')}>{t('risks.expiredBanner')}</Badge>
                  : <Badge tone={r.status === 'accepted' ? 'warn' : r.status === 'treated' ? 'ok' : 'neutral'}>{labels.riskStatus(r.status)}</Badge>)
              },
              {
                key: 'open_actions', header: t('nav.actions'), nowrap: true, align: 'right',
                render: (r) => (r.open_actions ? <Badge tone="info">{t('risks.openActions', { count: formatNumber(r.open_actions) })}</Badge> : <span className="faint">—</span>)
              }
            ]}
            rows={data?.items || []}
            onRowClick={setSelected}
            empty={<Empty icon={IconTarget} title={t('risks.emptyTitle')}>{t('risks.emptyBody')}</Empty>}
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
  const labels = useLabels();
  const { t, formatNumber } = useI18n();
  return (
    <div className="risk-matrix" role="group" aria-label={t('risks.matrix')}>
      <div className="risk-matrix-grid">
        {cells.map((cell) => (
          <button key={`${cell.likelihood}-${cell.impact}`} type="button"
            className={`risk-cell tone-${cell.rating} ${cell.count ? 'has-risks' : ''}`}
            disabled={!cell.count}
            title={`${t('risksUi.cellTitle', { likelihood: cell.likelihood, impact: cell.impact, rating: labels.rating(cell.rating) })}${cell.count ? `: ${cell.risks.map((r) => r.risk_id).join(', ')}` : ''}`}
            onClick={() => cell.risks[0] && onPick(cell.risks[0].id)}>
            {cell.count || ''}
          </button>
        ))}
      </div>
      <div className="risk-matrix-axes">
        <span className="tiny muted">{t('risks.likelihoodAxis')}</span>
        <span className="tiny muted">{t('risks.impactAxis')}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- drawer --- */

function RiskDrawer({ risk, onClose, onChanged, canWrite, canAccept, toast }) {
  const { t: tr } = useI18n();
  // The scale words in the reader's language; the server's English if missing.
  const scaleWord = (kind, value, fallback) => {
    const key = `riskScale.${kind}.${value}`;
    const word = tr(key);
    return word && word !== key && !word.endsWith(`.${value}`) ? word : fallback;
  };
  const labels = useLabels();
  const { t, formatNumber } = useI18n();
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
    } catch (err) { toast.error(t('risksUi.couldNotLoad'), err.message); }
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
      toast.success(t('risks.assessmentRecorded'));
      await load(risk.id);
      onChanged();
    } catch (err) { toast.error(t('common.couldNotSave'), err.message); }
  }

  async function accept() {
    try {
      await api.post(`/risks/${risk.id}/accept`, { rationale, expires });
      toast.success(t('risks.acceptedToast'), t('risks.acceptedToastBody'));
      setAcceptOpen(false);
      setRationale('');
      setExpires('');
      await load(risk.id);
      onChanged();
    } catch (err) { toast.error(t('risksUi.couldNotAccept'), err.message); }
  }

  async function withdraw() {
    try {
      await api.post(`/risks/${risk.id}/withdraw-acceptance`);
      toast.success(t('risks.withdrawnToast'));
      await load(risk.id);
      onChanged();
    } catch (err) { toast.error(t('risksUi.couldNotWithdraw'), err.message); }
  }

  const r = detail?.risk;

  return (
    <>
      <Drawer open={Boolean(risk)} onClose={() => { setDetail(null); onClose(); }} wide
        title={r ? `${r.risk_id} — ${r.title}` : ''}
        footer={r && (
          <>
            <button className="btn" onClick={() => { setDetail(null); onClose(); }}>{t('common.close')}</button>
            {canAccept && !r.accepted && (
              <button className="btn" onClick={() => setAcceptOpen(true)}><IconShield width={13} height={13} />{t('risks.accept')}</button>
            )}
            {canAccept && r.accepted && (
              <button className="btn btn-danger-ghost" onClick={withdraw}>{t('risks.withdrawAcceptance')}</button>
            )}
            {canWrite && !r.accepted && (
              <button className="btn btn-primary" onClick={save}><IconCheck width={13} height={13} />{t('risks.saveAssessment')}</button>
            )}
          </>
        )}>
        {r && draft && (
          <div className="stack">
            <div className="row-tight" style={{ flexWrap: 'wrap' }}>
              <Badge tone="info">{labels.domain(r.domain_key, r.domain_label)}</Badge>
              <Badge tone="neutral">{labels.riskCategory(r.category)}</Badge>
              <Badge tone={r.status === 'accepted' ? 'warn' : 'neutral'}>{labels.riskStatus(r.status)}</Badge>
              {r.provenance === 'ai_recommendation' && (
                <Badge tone="warn" title={t('risks.startingPositionTitle')}>
                  {t('risks.startingPosition')}
                </Badge>
              )}
            </div>

            <p className="small">{r.description}</p>

            {r.accepted && (
              <div className="callout" data-callout={r.acceptanceExpired ? 'danger' : 'warn'}>
                <div className="row-tight">
                  <IconShield width={14} height={14} />
                  <strong style={{ margin: 0 }}>
                    {r.acceptanceExpired ? t('risks.expiredBanner') : t('risks.acceptedBanner')}
                  </strong>
                </div>
                <p style={{ marginTop: 4, marginBottom: 0 }}>
{t('risks.acceptedBy', { name: r.accepted_by_name, date: formatDate(r.accepted_at), expires: formatDate(r.acceptance_expires) })}
                </p>
                <p className="small" style={{ marginTop: 6, marginBottom: 0 }}>{r.acceptance_rationale}</p>
              </div>
            )}

            <div className="grid grid-2">
              <div className="position-card">
                <div className="tiny muted">{t('risks.inherentLabel')}</div>
                <div className="position-score">
                  <Badge tone={RISK_TONE[r.inherent.rating]}>{labels.rating(r.inherent.rating)}</Badge>
                  <span className="mono">{r.inherent.score}</span>
                </div>
                <div className="tiny muted">{scaleWord('likelihood', r.inherent.likelihood, r.inherent.likelihoodLabel)} × {scaleWord('impact', r.inherent.impact, r.inherent.impactLabel)}</div>
              </div>
              <div className="position-card">
                <div className="tiny muted">{t('risks.residualLabel')}</div>
                <div className="position-score">
                  {r.residual_assessed
                    ? <><Badge tone={RISK_TONE[r.residual.rating]}>{labels.rating(r.residual.rating)}</Badge><span className="mono">{r.residual.score}</span></>
                    : <Badge tone="neutral">{t('risks.notYetAssessed')}</Badge>}
                </div>
                <div className="tiny muted">
                  {r.residual_assessed
                    ? `${scaleWord('likelihood', r.residual.likelihood, r.residual.likelihoodLabel)} × ${scaleWord('impact', r.residual.impact, r.residual.impactLabel)}`
                    : t('risks.shownEqual')}
                </div>
              </div>
            </div>

            {canWrite && !r.accepted && (
              <>
                <h4>{t('risks.assessResidual')}</h4>
                <div className="grid grid-2">
                  <Field label={t('risks.residualLikelihood')}>
                    <Select value={String(draft.residual_likelihood)}
                      onChange={(v) => setDraft((d) => ({ ...d, residual_likelihood: Number(v) }))}
                      options={detail.scales.likelihood.map((s) => ({ value: String(s.value), label: `${s.value} — ${scaleWord('likelihood', s.value, s.label)}` }))} />
                  </Field>
                  <Field label={t('risks.residualImpact')}>
                    <Select value={String(draft.residual_impact)}
                      onChange={(v) => setDraft((d) => ({ ...d, residual_impact: Number(v) }))}
                      options={detail.scales.impact.map((s) => ({ value: String(s.value), label: `${s.value} — ${scaleWord('impact', s.value, s.label)}` }))} />
                  </Field>
                </div>
                <Field label={t('risks.treatment')}>
                  <Select value={draft.treatment} onChange={(v) => setDraft((d) => ({ ...d, treatment: v }))}
                    options={Object.entries(detail.scales.treatments).map(([value, label]) => ({ value, label: `${labels.treatment(value)} — ${scaleWord('treatmentHelp', value, label)}` }))} />
                </Field>
                <Field label={t('risks.treatmentSummary')}>
                  <textarea className="textarea" value={draft.treatment_summary}
                    onChange={(e) => setDraft((d) => ({ ...d, treatment_summary: e.target.value }))} />
                </Field>
              </>
            )}

            <h4>{t('risks.treatingControls')}</h4>
            {detail.controls.length ? (
              <ul className="attachment-list">
                {detail.controls.map((c) => (
                  <li key={c.link_id} className="attachment">
                    <div className="attachment-main">
                      <div className="attachment-name"><span className="ref-tag">{c.control_id}</span> {c.name}</div>
                      <div className="attachment-meta">{labels.riskEffect(c.effect)} · {labels.status(c.status)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="small muted">{t('risks.noTreatingControls')}</p>}

            <h4>{t('risks.correctiveActions')}</h4>
            {detail.actions.length ? (
              <ul className="attachment-list">
                {detail.actions.map((a) => (
                  <li key={a.id} className="attachment">
                    <div className="attachment-main">
                      <div className="attachment-name"><span className="ref-tag">{a.action_id}</span> {a.title}</div>
                      <div className="attachment-meta">{labels.actionStatus(a.status)} · {t('risksUi.dueOn', { date: formatDate(a.due_date) })} · {a.owner_name || t('risksUi.unassigned')}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="small muted">{t('risks.noActions')}</p>}
          </div>
        )}
      </Drawer>

      <Modal open={acceptOpen} onClose={() => setAcceptOpen(false)} title={t('risks.accept')}
        footer={
          <>
            <button className="btn" onClick={() => setAcceptOpen(false)}>{t('common.cancel')}</button>
            <button className="btn btn-primary" disabled={rationale.trim().length < 20 || !expires} onClick={accept}>
              <IconShield width={13} height={13} />{t('risks.acceptInMyName')}
            </button>
          </>
        }>
        <p className="small">
{t('risks.acceptBody')}
        </p>
        <Field label={t('risks.rationale')} hint={t('risks.rationaleHint')}>
          <textarea className="textarea" value={rationale} onChange={(e) => setRationale(e.target.value)} rows={4} />
        </Field>
        <Field label={t('risks.expires')} hint={t('risks.expiresHint')}>
          <input className="input" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </Field>
      </Modal>
    </>
  );
}

const CATEGORIES = ['confidentiality', 'integrity', 'availability', 'compliance', 'operational', 'third_party', 'financial', 'reputational'];
const TREATMENTS = ['mitigate', 'accept', 'transfer', 'avoid'];

/**
 * A risk the organisation identifies itself. The register is seeded from the
 * requirement model, but the risks that matter most are often the ones only
 * the organisation knows about (ISO/IEC 27005 risk identification).
 */
function AddRisk({ open, onClose, onCreated, toast }) {
  const labels = useLabels();
  const { t } = useI18n();
  const { data: options } = useFetch(open ? '/generator/options' : null);
  const { data: directory } = useFetch(open ? '/admin/directory' : null);
  const blank = {
    title: '', description: '', domain_key: '', category: 'operational', threat: '', vulnerability: '',
    affected_asset: '', inherent_likelihood: 3, inherent_impact: 3, treatment: 'mitigate', treatment_summary: '', owner_id: ''
  };
  const [form, setForm] = useState(blank);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const ready = form.title.trim().length >= 5 && form.domain_key;
  const score = form.inherent_likelihood * form.inherent_impact;

  async function create() {
    try {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v]));
      const res = await api.post('/risks', body);
      toast.success(t('risks.addedToast'), res.risk.risk_id);
      setForm(blank);
      onClose();
      onCreated(res.risk);
    } catch (err) { toast.error(t('risks.addFailed'), err.message); }
  }

  const scale = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }));
  return (
    <Modal open={open} onClose={onClose} title={t('risks.addTitle')} size="modal-lg"
      footer={
        <>
          <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" disabled={!ready} onClick={create}>
            <IconPlus width={13} height={13} />{t('risks.addIt')}
          </button>
        </>
      }>
      <Field label={t('risks.fieldTitle')} hint={t('risks.fieldTitleHint')} required>
        <input className="input" value={form.title} onChange={(e) => set('title')(e.target.value)} />
      </Field>
      <div className="field-row">
        <Field label={t('common.domain')} required>
          <Select value={form.domain_key} onChange={set('domain_key')} placeholder={t('common.domain')}
            options={(options?.domains || []).map((d) => ({ value: d.key, label: labels.domain(d.key, d.name) }))} />
        </Field>
        <Field label={t('risks.category')}>
          <Select value={form.category} onChange={set('category')}
            options={CATEGORIES.map((c) => ({ value: c, label: labels.riskCategory ? labels.riskCategory(c) : c }))} />
        </Field>
      </div>
      <div className="field-row">
        <Field label={t('risks.threat')}>
          <input className="input" value={form.threat} onChange={(e) => set('threat')(e.target.value)} />
        </Field>
        <Field label={t('risks.vulnerability')}>
          <input className="input" value={form.vulnerability} onChange={(e) => set('vulnerability')(e.target.value)} />
        </Field>
        <Field label={t('risks.asset')}>
          <input className="input" value={form.affected_asset} onChange={(e) => set('affected_asset')(e.target.value)} />
        </Field>
      </div>
      <Field label={t('risks.description')}>
        <textarea className="textarea" value={form.description} onChange={(e) => set('description')(e.target.value)} />
      </Field>
      <div className="field-row">
        <Field label={t('risks.likelihood')} hint={t('risks.scaleHint')}>
          <Select value={form.inherent_likelihood} onChange={(v) => set('inherent_likelihood')(Number(v))} options={scale} />
        </Field>
        <Field label={t('risks.impact')} hint={t('risks.scaleHint')}>
          <Select value={form.inherent_impact} onChange={(v) => set('inherent_impact')(Number(v))} options={scale} />
        </Field>
        <Field label={t('risks.inherentScore')}>
          <div className="input" style={{ display: 'flex', alignItems: 'center' }}><strong>{score}</strong></div>
        </Field>
      </div>
      <div className="field-row">
        <Field label={t('risks.treatment')}>
          <Select value={form.treatment} onChange={set('treatment')}
            options={TREATMENTS.map((v) => ({ value: v, label: labels.treatment(v) }))} />
        </Field>
        <Field label={t('common.owner')}>
          <Select value={form.owner_id} onChange={set('owner_id')} placeholder={t('common.owner')}
            options={(directory || []).map((u) => ({ value: u.id, label: `${u.name} — ${u.job_title || labels.role(u.role)}` }))} />
        </Field>
      </div>
      <Field label={t('risks.treatmentSummary')}>
        <textarea className="textarea" value={form.treatment_summary} onChange={(e) => set('treatment_summary')(e.target.value)} />
      </Field>
    </Modal>
  );
}
