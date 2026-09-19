import { useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell
} from 'recharts';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import {
  Card, Loading, ErrorNote, Empty, Badge, CoverageBar, Drawer, useToast, DataTable, Select
} from '../components/ui.jsx';
import TraceChain from '../components/TraceChain.jsx';
import { IconLink, IconDownload, IconArrowRight } from '../components/Icons.jsx';
import { titleCase, TONE_COLORS } from '../lib/format.js';

export default function Mappings() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch('/frameworks/coverage');
  const [domain, setDomain] = useState('');
  const { data: crosswalks } = useFetch(`/frameworks/crosswalks${domain ? `?domain=${domain}` : ''}`);
  const [trace, setTrace] = useState(null);

  if (loading) return <Loading label="Building the coverage picture…" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const chartData = data.frameworks.map((f) => ({ name: f.code, value: f.coverage, mandatory: f.is_mandatory }));

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">Framework Mapping</h1>
          <p className="page-sub">
            Cross-framework coverage and the curated equivalences that let one organisational control
            satisfy several sources at once.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => api.download('/export/mappings.xlsx', 'Framework Mapping.xlsx')
            .then(() => toast.success('Exported')).catch((e) => toast.error('Export failed', e.message))}>
            <IconDownload />Export
          </button>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 14 }}>
        <Card title="Coverage by source" subtitle="Partial mappings count as half. Not-applicable requirements are excluded from the denominator.">
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-faint)" fontSize={10} tickLine={false} axisLine={false}
                  angle={-32} textAnchor="end" height={62} interval={0} />
                <YAxis stroke="var(--text-faint)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, 'Coverage']}
                  contentStyle={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12 }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((e) => (
                    <Cell key={e.name} fill={e.value >= 80 ? TONE_COLORS.ok : e.value >= 50 ? TONE_COLORS.warn : TONE_COLORS.danger} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Coverage by domain" subtitle="How much of each domain's catalogued requirement set has a mapped control." flush>
          <div className="table-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table className="data">
              <thead><tr><th>Domain</th><th className="num">Requirements</th><th className="num">Mapped</th><th style={{ width: 150 }}>Coverage</th></tr></thead>
              <tbody>
                {data.domains.filter((d) => d.requirements > 0).map((d) => (
                  <tr key={d.key}>
                    <td className="cell-title">{d.name}</td>
                    <td className="num">{d.requirements}</td>
                    <td className="num">{d.covered}</td>
                    <td><CoverageBar value={d.coverage} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title="Source coverage detail" flush style={{ marginBottom: 14 }}>
        <DataTable
          columns={[
            { key: 'code', header: 'Source', nowrap: true, render: (f) => (<><span className="ref-tag">{f.code}</span>{f.is_mandatory ? <Badge tone="critical" >Regulatory</Badge> : null}</>) },
            { key: 'name', header: 'Name', render: (f) => <span className="small">{f.name}</span> },
            { key: 'total', header: 'Requirements', align: 'right' },
            { key: 'covered', header: 'Covered', align: 'right' },
            { key: 'partial', header: 'Partial', align: 'right' },
            { key: 'notCovered', header: 'Not covered', align: 'right', render: (f) => f.notCovered > 0 ? <span style={{ color: 'var(--danger)' }}>{f.notCovered}</span> : f.notCovered },
            { key: 'notApplicable', header: 'N/A', align: 'right' },
            { key: 'coverage', header: 'Coverage', render: (f) => <CoverageBar value={f.coverage} /> }
          ]}
          rows={data.frameworks}
          keyOf={(f) => f.code}
        />
      </Card>

      <Card title="Cross-framework equivalences"
        subtitle="Curated relationships between requirements in different sources. One control mapped here contributes to every equivalent requirement."
        flush
        actions={
          <Select value={domain} onChange={setDomain} placeholder="All domains"
            options={data.domains.filter((d) => d.requirements > 0).map((d) => ({ value: d.key, label: d.name }))} />
        }>
        {crosswalks?.items?.length ? (
          <div className="table-wrap" style={{ maxHeight: 520, overflowY: 'auto' }}>
            <table className="data">
              <thead>
                <tr><th>Domain</th><th>Source requirement</th><th style={{ width: 40 }} /><th>Equivalent requirement</th><th>Relation</th></tr>
              </thead>
              <tbody>
                {crosswalks.items.map((cw) => (
                  <tr key={cw.id}>
                    <td className="small nowrap">{cw.domain_label || '—'}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" style={{ padding: 0, height: 'auto' }}
                        onClick={async () => {
                          try { setTrace(await api.get(`/frameworks/requirements/${cw.source_id}/trace`)); }
                          catch (err) { toast.error('Could not load traceability', err.message); }
                        }}>
                        <span className="ref-tag">{cw.source_framework} {cw.source_ref}</span>
                      </button>
                      <div className="cell-sub clamp-2">{cw.source_title}</div>
                    </td>
                    <td className="center"><IconArrowRight width={14} height={14} style={{ color: 'var(--text-faint)' }} /></td>
                    <td>
                      <button className="btn btn-ghost btn-sm" style={{ padding: 0, height: 'auto' }}
                        onClick={async () => {
                          try { setTrace(await api.get(`/frameworks/requirements/${cw.target_id}/trace`)); }
                          catch (err) { toast.error('Could not load traceability', err.message); }
                        }}>
                        <span className="ref-tag">{cw.target_framework} {cw.target_ref}</span>
                      </button>
                      <div className="cell-sub clamp-2">{cw.target_title}</div>
                    </td>
                    <td className="nowrap"><Badge tone={cw.relation === 'equivalent' ? 'ok' : 'neutral'}>{titleCase(cw.relation)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="card-body"><Empty icon={IconLink} title="No equivalences for this domain" /></div>}
      </Card>

      <Drawer open={Boolean(trace)} onClose={() => setTrace(null)} wide
        title={trace ? `${trace.requirement.framework_code} ${trace.requirement.ref}` : ''}>
        {trace && <TraceChain trace={trace} />}
      </Drawer>
    </>
  );
}
