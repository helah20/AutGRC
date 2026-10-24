import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../lib/api.js';
import { useFetch, useDebounced } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import {
  Card, Loading, ErrorNote, Empty, Badge, DataTable, Drawer, SearchInput,
  Select, useToast, ProvenanceTag
} from '../components/ui.jsx';
import { IconShield, IconDownload, IconX, IconLink, IconArchive } from '../components/Icons.jsx';
import { titleCase, RISK_TONE, COVERAGE_TONE } from '../lib/format.js';
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
              { key: 'evidence_count', header: t('controlsUi.colEvidence'), align: 'right', render: (c) => c.evidence_count || <span className="muted">0</span> },
              { key: 'mapping_count', header: t('controlsUi.colMappings'), align: 'right', render: (c) => c.mapping_count || <span className="muted">0</span> }
            ]}
            rows={data?.items || []}
            onRowClick={open}
            empty={<Empty icon={IconShield} title={t('controlsUi.emptyTitle')} >{t('controlsUi.emptyBody')}</Empty>}
          />
        )}
      </Card>

      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} wide
        title={selected ? `${selected.control.control_id} — ${selected.control.name}` : ''}>
        {selected && <ControlDetail data={selected} />}
      </Drawer>
    </>
  );
}

function ControlDetail({ data }) {
  const labels = useLabels();
  const { t } = useI18n();
  const c = data.control;
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
                  <div className="tiny muted">{titleCase(e.evidence_type)} · {e.frequency || t('controlsUi.noFrequency')} · {e.owner_role || t('controlsUi.noOwner')}</div>
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
