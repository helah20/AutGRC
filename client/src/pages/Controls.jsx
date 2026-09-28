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
    } catch (err) { toast.error('Could not load the control', err.message); }
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
            .then(() => toast.success('Exported')).catch((e) => toast.error('Export failed', e.message))}>
            <IconDownload />Export matrix
          </button>
        </div>
      </div>

      <Card flush>
        <div className="table-toolbar">
          <div className="search-box"><SearchInput value={search} onChange={setSearch} placeholder="Search controls…" /></div>
          <Select value={domain} onChange={setDomain} placeholder="All domains"
            options={(data?.facets?.domains || []).map((d) => ({ value: d.domain_key, label: `${labels.domain(d.domain_key, d.label)} (${d.n})` }))} />
          <Select value={type} onChange={setType} placeholder="All types"
            options={(data?.facets?.types || []).map((t) => ({ value: t.control_type, label: `${titleCase(t.control_type)} (${t.n})` }))} />
          <Select value={risk} onChange={setRisk} placeholder="All risk levels"
            options={(data?.facets?.risks || []).map((r) => ({ value: r.risk_rating, label: `${titleCase(r.risk_rating)} (${r.n})` }))} />
          {(search || domain || type || risk) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setDomain(''); setType(''); setRisk(''); }}>
              <IconX width={13} height={13} />Clear
            </button>
          )}
          <span className="table-count">{data ? `${formatNumber(data.items.length)} ${t('common.of')} ${formatNumber(data.total)}` : '—'}</span>
        </div>

        {loading && <Loading />}
        {error && <div className="card-body"><ErrorNote error={error} onRetry={reload} /></div>}
        {!loading && !error && (
          <DataTable
            columns={[
              { key: 'control_id', header: 'ID', nowrap: true, width: 96, render: (c) => <span className="ref-tag">{c.control_id}</span> },
              { key: 'name', header: 'Control', render: (c) => (<><div className="cell-title">{c.name}</div><div className="cell-sub clamp-2">{c.requirement}</div></>) },
              { key: 'domain_label', header: 'Domain', nowrap: true, render: (c) => <span className="small">{labels.domain(c.domain_key, c.domain_label)}</span> },
              { key: 'control_type', header: 'Type', nowrap: true, render: (c) => <Badge tone="neutral">{titleCase(c.control_type)}</Badge> },
              { key: 'risk_rating', header: 'Risk', nowrap: true, render: (c) => <Badge tone={RISK_TONE[c.risk_rating] || 'neutral'}>{labels.rating(c.risk_rating)}</Badge> },
              { key: 'responsible_role', header: 'Responsible', nowrap: true, render: (c) => <span className="small">{c.responsible_role || '—'}</span> },
              { key: 'evidence_count', header: 'Evidence', align: 'right', render: (c) => c.evidence_count || <span className="muted">0</span> },
              { key: 'mapping_count', header: 'Mappings', align: 'right', render: (c) => c.mapping_count || <span className="muted">0</span> }
            ]}
            rows={data?.items || []}
            onRowClick={open}
            empty={<Empty icon={IconShield} title="No controls match" >Controls are created when you generate a Standard or Control Matrix.</Empty>}
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
  const c = data.control;
  return (
    <div className="stack">
      <div className="row-tight">
        <Badge tone={RISK_TONE[c.risk_rating] || 'neutral'}>{labels.rating(c.risk_rating)} risk</Badge>
        <Badge tone="neutral">{titleCase(c.control_type)}</Badge>
        <Badge tone="neutral">{titleCase(c.control_nature)}</Badge>
        <Badge tone="info">{labels.domain(c.domain_key, c.domain_label)}</Badge>
        <ProvenanceTag provenance={c.provenance} />
      </div>

      <section>
        <h4>Control description</h4>
        <p>{c.description}</p>
      </section>

      <section>
        <h4>Requirement</h4>
        <p>{c.requirement}</p>
      </section>

      {c.implementation && (
        <section>
          <h4>Implementation guidance</h4>
          <p className="muted">{c.implementation}</p>
        </section>
      )}

      <section>
        <h4>Attributes</h4>
        <div className="definition">
          <dt>Responsible</dt><dd>{c.responsible_role || '—'}</dd>
          <dt>Accountable</dt><dd>{c.accountable_role || '—'}</dd>
          <dt>Frequency</dt><dd>{c.frequency || '—'}</dd>
          <dt>Indicator</dt><dd>{c.kpi || '—'}</dd>
          <dt>Testing method</dt><dd>{c.testing_method || '—'}</dd>
          <dt>Status</dt><dd><Badge tone={c.status === 'implemented' ? 'ok' : c.status === 'approved' ? 'info' : 'neutral'}>{labels.status(c.status)}</Badge></dd>
        </div>
      </section>

      <section>
        <h4>Risk addressed</h4>
        <div className="callout" data-callout="warning" style={{ marginTop: 6 }}>
          <p style={{ marginBottom: 0 }}>{c.risk}</p>
        </div>
      </section>

      <section>
        <h4>Evidence requirements <span className="muted small">({c.evidence.length})</span></h4>
        {c.evidence.length ? (
          <div className="stack-sm">
            {c.evidence.map((e) => (
              <div key={e.id} className="between" style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 7 }}>
                <div style={{ minWidth: 0 }}>
                  <div className="row-tight"><span className="pill mono">{e.evidence_id}</span><span className="small strong">{e.name}</span></div>
                  <div className="tiny muted">{titleCase(e.evidence_type)} · {e.frequency || 'No frequency set'} · {e.owner_role || 'No owner'}</div>
                </div>
                <Badge tone={e.status === 'verified' ? 'ok' : e.status === 'missing' ? 'danger' : 'neutral'}>{titleCase(e.status)}</Badge>
              </div>
            ))}
          </div>
        ) : <Empty icon={IconArchive} title="No evidence defined" >A control without evidence cannot be tested or audited.</Empty>}
      </section>

      <section>
        <h4>Framework mapping <span className="muted small">({c.mappings.length})</span></h4>
        {c.mappings.length ? (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Source</th><th>Ref</th><th>Requirement</th><th>Coverage</th></tr></thead>
              <tbody>
                {c.mappings.map((m) => (
                  <tr key={m.id}>
                    <td className="nowrap"><Badge tone="info">{m.framework_code}</Badge></td>
                    <td className="mono nowrap">{m.ref}</td>
                    <td className="small">{m.requirement_title}</td>
                    <td className="nowrap"><Badge tone={COVERAGE_TONE[m.coverage] || 'neutral'}>{titleCase(m.coverage)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty icon={IconLink} title="Not mapped" >This control is not linked to any framework requirement.</Empty>}
      </section>

      {data.documents?.length > 0 && (
        <section>
          <h4>Related documents</h4>
          <div className="stack-sm">
            {data.documents.map((d) => (
              <Link key={d.id} to={`/documents/${d.id}`} className="between"
                style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 7, color: 'inherit' }}>
                <span className="row-tight"><span className="ref-tag">{d.reference}</span><span className="small">{d.title}</span></span>
                <Badge tone="neutral">{titleCase(d.doc_type)}</Badge>
              </Link>
            ))}
          </div>
          <div className="definition" style={{ marginTop: 10 }}>
            {c.policy_ref && <><dt>Policy clause</dt><dd className="mono small">{c.policy_ref}</dd></>}
            {c.standard_ref && <><dt>Standard clause</dt><dd className="mono small">{c.standard_ref}</dd></>}
            {c.procedure_ref && <><dt>Procedure</dt><dd className="mono small">{c.procedure_ref}</dd></>}
          </div>
        </section>
      )}
    </div>
  );
}
