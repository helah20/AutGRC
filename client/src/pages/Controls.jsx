import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../lib/api.js';
import { useFetch, useDebounced } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import {
  Card, Loading, ErrorNote, Empty, Badge, DataTable, Drawer, SearchInput,
  Select, useToast, ProvenanceTag, Field
} from '../components/ui.jsx';
import { IconShield, IconDownload, IconX, IconLink, IconArchive } from '../components/Icons.jsx';
import { titleCase, RISK_TONE, COVERAGE_TONE, formatDate } from '../lib/format.js';
import { useLabels } from '../i18n/labels.js';
import { useI18n } from '../i18n/index.jsx';

/** Control type and nature are fixed enums; translate at render time, fall back to the raw value. */
function controlTypeLabel(t, value) {
  const map = {
    preventive: t('controlsUi.controlType.preventive'),
    detective: t('controlsUi.controlType.detective'),
    corrective: t('controlsUi.controlType.corrective'),
    deterrent: t('controlsUi.controlType.deterrent'),
    compensating: t('controlsUi.controlType.compensating'),
    directive: t('controlsUi.controlType.directive')
  };
  return map[value] || titleCase(value);
}

function controlNatureLabel(t, value) {
  const map = {
    technical: t('controlsUi.controlNature.technical'),
    administrative: t('controlsUi.controlNature.administrative'),
    physical: t('controlsUi.controlNature.physical'),
    hybrid: t('controlsUi.controlNature.hybrid')
  };
  return map[value] || titleCase(value);
}

export default function Controls() {
  const labels = useLabels();
  const { t, formatNumber } = useI18n();
  const toast = useToast();
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [domain, setDomain] = useState('');
  const [type, setType] = useState('');
  const [risk, setRisk] = useState('');
  const [selected, setSelected] = useState(null);

  const { data, loading, error, reload } = useFetch(
    `/controls${qs({ search: debounced, domain, type, risk, limit: 400 })}`
  );

  async function open(control) {
    try {
      const res = await api.get(`/controls/${control.id}`);
      setSelected(res);
    } catch (err) { toast.error(t('controlsUi.loadFailed'), err.message); }
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">{t('controls.title')}</h1>
          <p className="page-sub">{t('controls.subtitle')}</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => api.download(`/export/controls.xlsx${qs({ domain })}`, 'Control Matrix.xlsx')
            .then(() => toast.success(t('common.exported'))).catch((e) => toast.error(t('common.exportFailed'), e.message))}>
            <IconDownload />{t('controlsUi.exportMatrix')}
          </button>
        </div>
      </div>

      <Card flush>
        <div className="table-toolbar">
          <div className="search-box"><SearchInput value={search} onChange={setSearch} placeholder={t('controlsUi.searchPlaceholder')} /></div>
          <Select value={domain} onChange={setDomain} placeholder={t('controlsUi.allDomains')}
            options={(data?.facets?.domains || []).map((d) => ({ value: d.domain_key, label: `${labels.domain(d.domain_key, d.label)} (${d.n})` }))} />
          <Select value={type} onChange={setType} placeholder={t('controlsUi.allTypes')}
            options={(data?.facets?.types || []).map((ft) => ({ value: ft.control_type, label: `${controlTypeLabel(t, ft.control_type)} (${ft.n})` }))} />
          <Select value={risk} onChange={setRisk} placeholder={t('controlsUi.allRiskLevels')}
            options={(data?.facets?.risks || []).map((r) => ({ value: r.risk_rating, label: `${labels.rating(r.risk_rating)} (${r.n})` }))} />
          {(search || domain || type || risk) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setDomain(''); setType(''); setRisk(''); }}>
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
              { key: 'control_id', header: t('controlsUi.colId'), nowrap: true, width: 96, render: (c) => <span className="ref-tag">{c.control_id}</span> },
              { key: 'name', header: t('controlsUi.colControl'), render: (c) => (<><div className="cell-title">{c.name}</div><div className="cell-sub clamp-2">{c.requirement}</div></>) },
              { key: 'domain_label', header: t('controlsUi.colDomain'), nowrap: true, render: (c) => <span className="small">{labels.domain(c.domain_key, c.domain_label)}</span> },
              { key: 'control_type', header: t('controlsUi.colType'), nowrap: true, render: (c) => <Badge tone="neutral">{controlTypeLabel(t, c.control_type)}</Badge> },
              { key: 'risk_rating', header: t('controlsUi.colRisk'), nowrap: true, render: (c) => <Badge tone={RISK_TONE[c.risk_rating] || 'neutral'}>{labels.rating(c.risk_rating)}</Badge> },
              { key: 'responsible_role', header: t('controlsUi.colResponsible'), nowrap: true, render: (c) => <span className="small">{c.responsible_role || '—'}</span> },
              {
                key: 'operating_effectiveness', header: t('controlsUi.colOperating'), nowrap: true,
                render: (c) => <Badge tone={EFFECTIVENESS_TONE[c.operating_effectiveness] || 'neutral'}>{labels.effectiveness(c.operating_effectiveness)}</Badge>
              },
              { key: 'evidence_count', header: t('controlsUi.colEvidence'), align: 'right', render: (c) => (c.evidence_count ? formatNumber(c.evidence_count) : <span className="muted">{formatNumber(0)}</span>) },
              { key: 'mapping_count', header: t('controlsUi.colMappings'), align: 'right', render: (c) => (c.mapping_count ? formatNumber(c.mapping_count) : <span className="muted">{formatNumber(0)}</span>) }
            ]}
            rows={data?.items || []}
            onRowClick={open}
            empty={<Empty icon={IconShield} title={t('controlsUi.emptyTitle')} >{t('controlsUi.emptyBody')}</Empty>}
          />
        )}
      </Card>

      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} wide
        title={selected ? `${selected.control.control_id} — ${selected.control.name}` : ''}>
        {selected && <ControlDetail key={selected.control.id} data={selected} canWrite={can('control:write')} toast={toast}
          onUpdated={async () => { await open(selected.control); reload(); }} />}
      </Drawer>
    </>
  );
}

const EFFECTIVENESS_TONE = { effective: 'ok', partially_effective: 'warn', ineffective: 'danger', not_assessed: 'neutral' };
const ASSESSED = ['effective', 'partially_effective', 'ineffective'];

function ControlDetail({ data, canWrite, toast, onUpdated }) {
  const labels = useLabels();
  const { t } = useI18n();
  const c = data.control;
  const { data: directory } = useFetch(canWrite ? '/admin/directory' : null);
  const [form, setForm] = useState({ design_effectiveness: c.design_effectiveness || 'effective', operating_effectiveness: c.operating_effectiveness || 'effective', note: '', next_assessment_date: '' });
  const [busy, setBusy] = useState(false);
  // A control cannot operate better than it is designed.
  const inconsistent = ASSESSED.indexOf(form.operating_effectiveness) < ASSESSED.indexOf(form.design_effectiveness);

  async function setOwner(ownerId) {
    try {
      await api.patch(`/controls/${c.id}`, { owner_id: ownerId || null });
      toast.success(t('controlsUi.ownerSaved'));
      await onUpdated();
    } catch (err) { toast.error(t('common.couldNotSave'), err.message); }
  }

  async function assess() {
    setBusy(true);
    try {
      const res = await api.post(`/controls/${c.id}/assessment`, {
        design_effectiveness: form.design_effectiveness, operating_effectiveness: form.operating_effectiveness,
        note: form.note || undefined, next_assessment_date: form.next_assessment_date || undefined
      });
      toast.success(t('controlsUi.assessmentRecorded'), t('controlsUi.nextAssessmentOn', { date: formatDate(res.control.next_assessment_date) }));
      setForm((f) => ({ ...f, note: '', next_assessment_date: '' }));
      await onUpdated();
    } catch (err) { toast.error(t('common.couldNotSave'), err.message); } finally { setBusy(false); }
  }

  return (
    <div className="stack">
      <div className="row-tight">
        <Badge tone={RISK_TONE[c.risk_rating] || 'neutral'}>{t('controlsUi.riskBadge', { rating: labels.rating(c.risk_rating) })}</Badge>
        <Badge tone="neutral">{controlTypeLabel(t, c.control_type)}</Badge>
        <Badge tone="neutral">{controlNatureLabel(t, c.control_nature)}</Badge>
        <Badge tone="info">{labels.domain(c.domain_key, c.domain_label)}</Badge>
        <ProvenanceTag provenance={c.provenance} />
      </div>

      <section>
        <h4>{t('controlsUi.description')}</h4>
        <p>{c.description}</p>
      </section>

      <section>
        <h4>{t('controlsUi.requirement')}</h4>
        <p>{c.requirement}</p>
      </section>

      {c.implementation && (
        <section>
          <h4>{t('controlsUi.implementation')}</h4>
          <p className="muted">{c.implementation}</p>
        </section>
      )}

      <section>
        <h4>{t('controlsUi.attributes')}</h4>
        <dl className="definition">
          <dt>{t('controlsUi.responsible')}</dt><dd>{c.responsible_role || '—'}</dd>
          <dt>{t('controlsUi.accountable')}</dt><dd>{c.accountable_role || '—'}</dd>
          <dt>{t('controlsUi.frequency')}</dt><dd>{c.frequency || '—'}</dd>
          <dt>{t('controlsUi.indicator')}</dt><dd>{c.kpi || '—'}</dd>
          <dt>{t('controlsUi.testingMethod')}</dt><dd>{c.testing_method || '—'}</dd>
          <dt>{t('controlsUi.status')}</dt><dd><Badge tone={c.status === 'implemented' ? 'ok' : c.status === 'approved' ? 'info' : 'neutral'}>{labels.status(c.status)}</Badge></dd>
        </dl>
      </section>

      <section>
        <h4>{t('controlsUi.ownershipEffectiveness')}</h4>
        <div className="kv-grid small">
          <span className="muted">{t('controlsUi.owner')}</span>
          <span>
            {canWrite ? (
              <Select value={c.owner_id || ''} onChange={setOwner} placeholder={t('controlsUi.noOwnerNamed')}
                options={(directory || []).map((u) => ({ value: u.id, label: `${u.name} — ${u.job_title || labels.role(u.role)}` }))} />
            ) : (data.owner?.name || t('controlsUi.noOwnerNamed'))}
          </span>
          <span className="muted">{t('controlsUi.design')}</span>
          <span><Badge tone={EFFECTIVENESS_TONE[c.design_effectiveness] || 'neutral'}>{labels.effectiveness(c.design_effectiveness)}</Badge></span>
          <span className="muted">{t('controlsUi.operating')}</span>
          <span><Badge tone={EFFECTIVENESS_TONE[c.operating_effectiveness] || 'neutral'}>{labels.effectiveness(c.operating_effectiveness)}</Badge></span>
          <span className="muted">{t('controlsUi.lastAssessed')}</span><span>{c.last_assessed_at ? formatDate(c.last_assessed_at) : t('controlsUi.neverAssessed')}</span>
          <span className="muted">{t('controlsUi.nextAssessment')}</span><span>{c.next_assessment_date ? formatDate(c.next_assessment_date) : '—'}</span>
          {c.assessment_note && <><span className="muted">{t('controlsUi.assessorNote')}</span><span>{c.assessment_note}</span></>}
        </div>
        {canWrite && (
          <div className="card" style={{ padding: 12, marginTop: 10 }}>
            <div className="strong small" style={{ marginBottom: 8 }}>{t('controlsUi.recordAssessment')}</div>
            <div className="field-row">
              <Field label={t('controlsUi.design')}>
                <Select value={form.design_effectiveness} onChange={(v) => setForm((f) => ({ ...f, design_effectiveness: v }))}
                  options={ASSESSED.map((e) => ({ value: e, label: labels.effectiveness(e) }))} />
              </Field>
              <Field label={t('controlsUi.operating')}>
                <Select value={form.operating_effectiveness} onChange={(v) => setForm((f) => ({ ...f, operating_effectiveness: v }))}
                  options={ASSESSED.map((e) => ({ value: e, label: labels.effectiveness(e) }))} />
              </Field>
              <Field label={t('controlsUi.nextAssessment')} hint={t('controlsUi.nextAssessmentHint')}>
                <input className="input" type="date" value={form.next_assessment_date} onChange={(e) => setForm((f) => ({ ...f, next_assessment_date: e.target.value }))} />
              </Field>
            </div>
            <Field label={t('controlsUi.assessorNote')} hint={t('controlsUi.assessorNoteHint')}>
              <textarea className="textarea" rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </Field>
            {inconsistent && <p className="small text-danger" style={{ margin: '0 0 8px' }}>{t('controlsUi.operatingAboveDesign')}</p>}
            <button className="btn btn-primary btn-sm" disabled={busy || inconsistent} onClick={assess}>{t('controlsUi.recordAssessment')}</button>
          </div>
        )}
      </section>

      {data.risks?.length > 0 && (
        <section>
          <h4>{t('controlsUi.relatedRisks')} <span className="muted small">({data.risks.length})</span></h4>
          <div className="stack-sm">
            {data.risks.map((r) => (
              <Link key={r.id} to={`/risks?open=${r.id}`} className="between"
                style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 7, color: 'inherit' }}>
                <span className="row-tight"><span className="ref-tag">{r.risk_id}</span><span className="small">{r.title}</span></span>
                <Badge tone={RISK_TONE[(r.current || r.inherent).rating]}>{labels.rating((r.current || r.inherent).rating)}</Badge>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h4>{t('controlsUi.riskAddressed')}</h4>
        <div className="callout" data-callout="warning" style={{ marginTop: 6 }}>
          <p style={{ marginBottom: 0 }}>{c.risk}</p>
        </div>
      </section>

      <section>
        <h4>{t('controlsUi.evidenceRequirements')} <span className="muted small">({c.evidence.length})</span></h4>
        {c.evidence.length ? (
          <div className="stack-sm">
            {c.evidence.map((e) => (
              <div key={e.id} className="between" style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 7 }}>
                <div style={{ minWidth: 0 }}>
                  <div className="row-tight"><span className="pill mono">{e.evidence_id}</span><span className="small strong">{e.name}</span></div>
                  <div className="tiny muted">{labels.evidenceType(e.evidence_type)} · {e.frequency || t('controlsUi.noFrequency')} · {e.owner_role || t('controlsUi.noOwner')}</div>
                </div>
                <Badge tone={e.status === 'verified' ? 'ok' : e.status === 'missing' ? 'danger' : 'neutral'}>{labels.evidenceStatus(e.status)}</Badge>
              </div>
            ))}
          </div>
        ) : <Empty icon={IconArchive} title={t('controlsUi.noEvidenceTitle')} >{t('controlsUi.noEvidenceBody')}</Empty>}
      </section>

      <section>
        <h4>{t('controlsUi.frameworkMapping')} <span className="muted small">({c.mappings.length})</span></h4>
        {c.mappings.length ? (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>{t('controlsUi.colSource')}</th><th>{t('controlsUi.colRef')}</th><th>{t('controlsUi.colRequirement')}</th><th>{t('controlsUi.colCoverage')}</th></tr></thead>
              <tbody>
                {c.mappings.map((m) => (
                  <tr key={m.id}>
                    <td className="nowrap"><Badge tone="info">{m.framework_code}</Badge></td>
                    <td className="mono nowrap">{m.ref}</td>
                    <td className="small">{m.requirement_title}</td>
                    <td className="nowrap"><Badge tone={COVERAGE_TONE[m.coverage] || 'neutral'}>{labels.coverage(m.coverage)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty icon={IconLink} title={t('controlsUi.notMappedTitle')} >{t('controlsUi.notMappedBody')}</Empty>}
      </section>

      {data.documents?.length > 0 && (
        <section>
          <h4>{t('controlsUi.relatedDocuments')}</h4>
          <div className="stack-sm">
            {data.documents.map((d) => (
              <Link key={d.id} to={`/documents/${d.id}`} className="between"
                style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 7, color: 'inherit' }}>
                <span className="row-tight"><span className="ref-tag">{d.reference}</span><span className="small">{d.title}</span></span>
                <Badge tone="neutral">{labels.docType(d.doc_type)}</Badge>
              </Link>
            ))}
          </div>
          <dl className="definition" style={{ marginTop: 10 }}>
            {c.policy_ref && <><dt>{t('controlsUi.policyClause')}</dt><dd className="mono small">{c.policy_ref}</dd></>}
            {c.standard_ref && <><dt>{t('controlsUi.standardClause')}</dt><dd className="mono small">{c.standard_ref}</dd></>}
            {c.procedure_ref && <><dt>{t('controlsUi.procedure')}</dt><dd className="mono small">{c.procedure_ref}</dd></>}
          </dl>
        </section>
      )}
    </div>
  );
}
