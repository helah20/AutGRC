import { useState } from 'react';
import { api, qs } from '../lib/api.js';
import { useFetch, useDebounced } from '../lib/useApi.js';
import {
  Card, Loading, ErrorNote, Empty, Badge, Drawer, SearchInput, Select,
  CoverageBar, useToast, DataTable
} from '../components/ui.jsx';
import TraceChain from '../components/TraceChain.jsx';
import { IconLayers, IconDownload, IconX, IconInfo } from '../components/Icons.jsx';
import { titleCase, COVERAGE_TONE } from '../lib/format.js';

export default function Frameworks() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch('/frameworks');
  const [active, setActive] = useState(null);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [domain, setDomain] = useState('');
  const [trace, setTrace] = useState(null);

  const { data: detail, loading: detailLoading } = useFetch(
    active ? `/frameworks/${active}/requirements${qs({ search: debounced, domain })}` : null
  );

  if (loading) return <Loading label="Loading framework catalogue…" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">Frameworks and Regulations</h1>
          <p className="page-sub">
            The authoritative sources adopted by the organisation, with requirement coverage by
            organisational control.
          </p>
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
                <div className="row-tight" style={{ marginBottom: 6 }}>
                  <span className="ref-tag">{f.code}</span>
                  {f.is_mandatory ? <Badge tone="critical">Regulatory</Badge> : <Badge tone="neutral">Framework</Badge>}
                </div>
                <div className="strong" style={{ marginBottom: 3 }}>{f.name}</div>
                <div className="tiny muted" style={{ marginBottom: 10 }}>
                  {f.publisher}{f.version ? ` · ${f.version}` : ''}{f.jurisdiction ? ` · ${f.jurisdiction}` : ''}
                </div>
                <p className="small muted clamp-3" style={{ marginBottom: 12 }}>{f.description}</p>
                <CoverageBar value={f.coverage} label={`${f.mapped_count} of ${f.requirement_count} mapped`} />
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
            <span className="table-count">{detail ? `${detail.requirements.length} requirements` : '—'}</span>
          </div>

          {detailLoading && <Loading />}
          {detail && (
            <DataTable
              columns={[
                { key: 'ref', header: 'Ref', nowrap: true, width: 110, render: (r) => <span className="ref-tag">{r.ref}</span> },
                {
                  key: 'title', header: 'Requirement',
                  render: (r) => (
                    <div style={{ paddingLeft: (r.level - 1) * 14 }}>
                      <div className={r.level <= 2 ? 'cell-title' : ''}>{r.title}</div>
                      {r.domain_label && <div className="cell-sub">{r.domain_label}</div>}
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

      <Drawer open={Boolean(trace)} onClose={() => setTrace(null)} wide
        title={trace ? `${trace.requirement.framework_code} ${trace.requirement.ref}` : ''}>
        {trace && <TraceChain trace={trace} />}
      </Drawer>
    </>
  );
}
