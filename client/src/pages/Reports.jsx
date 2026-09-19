import { useState } from 'react';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import { Card, Loading, ErrorNote, Empty, useToast, Badge } from '../components/ui.jsx';
import { IconChart, IconDownload, IconChevronRight, IconX } from '../components/Icons.jsx';

export default function Reports() {
  const toast = useToast();
  const { data: reports, loading, error, reload } = useFetch('/reports');
  const [active, setActive] = useState(null);
  const { data: report, loading: reportLoading } = useFetch(active ? `/reports/${active}` : null);

  async function download(key, format) {
    try {
      const name = await api.download(`/reports/${key}/export.${format}`);
      toast.success('Export ready', name);
    } catch (err) { toast.error('Export failed', err.message); }
  }

  if (loading) return <Loading label="Loading reports…" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">Reports</h1>
          <p className="page-sub">
            Management and audit reporting drawn from the live data set. Every report exports to Excel,
            and to PDF for circulation.
          </p>
        </div>
      </div>

      {!active ? (
        <div className="grid grid-3">
          {reports.map((r) => (
            <Card key={r.key}>
              <div className="between" style={{ alignItems: 'flex-start', marginBottom: 8 }}>
                <IconChart width={20} height={20} style={{ color: 'var(--accent)' }} />
              </div>
              <h3 style={{ marginBottom: 4 }}>{r.name}</h3>
              <p className="small muted" style={{ minHeight: 40 }}>{r.description}</p>
              <div className="row-tight">
                <button className="btn btn-sm btn-primary" onClick={() => setActive(r.key)}>
                  View<IconChevronRight width={12} height={12} />
                </button>
                <button className="btn btn-sm" onClick={() => download(r.key, 'xlsx')}><IconDownload width={13} height={13} />Excel</button>
                <button className="btn btn-sm" onClick={() => download(r.key, 'pdf')}>PDF</button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card flush>
          <div className="table-toolbar">
            <button className="btn btn-sm" onClick={() => setActive(null)}><IconX width={13} height={13} />All reports</button>
            <div style={{ minWidth: 0 }}>
              <span className="strong">{report?.name || ''}</span>
              {report?.description && <div className="tiny muted">{report.description}</div>}
            </div>
            <div className="row-tight" style={{ marginLeft: 'auto' }}>
              <button className="btn btn-sm" onClick={() => download(active, 'xlsx')}><IconDownload width={13} height={13} />Excel</button>
              <button className="btn btn-sm" onClick={() => download(active, 'pdf')}>PDF</button>
              {report && <span className="table-count">{report.rows.length} rows</span>}
            </div>
          </div>

          {reportLoading && <Loading />}
          {report && (
            report.rows.length ? (
              <div className="table-wrap" style={{ maxHeight: '68vh', overflow: 'auto' }}>
                <table className="data">
                  <thead><tr>{report.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {report.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} className={typeof cell === 'number' ? 'num' : ''}>
                            {formatCell(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="card-body"><Empty icon={IconChart} title="No data for this report" /></div>
          )}
        </Card>
      )}
    </>
  );
}

const TONE_BY_VALUE = {
  Compliant: 'ok', 'Partially compliant': 'warn', 'Non compliant': 'danger',
  Ready: 'ok', Partial: 'warn', 'Not ready': 'danger', 'Not started': 'neutral',
  Complete: 'ok', Yes: 'ok', No: 'danger', Overdue: 'danger', 'Due soon': 'warn', 'On track': 'ok',
  covered: 'ok', partial: 'warn', not_covered: 'danger', not_applicable: 'neutral',
  compliant: 'ok', partially_compliant: 'warn', non_compliant: 'danger'
};

function formatCell(cell) {
  const value = String(cell ?? '');
  if (TONE_BY_VALUE[value]) {
    return <Badge tone={TONE_BY_VALUE[value]}>{value.replace(/_/g, ' ')}</Badge>;
  }
  if (/^\d+%$/.test(value)) {
    const n = Number(value.slice(0, -1));
    return <Badge tone={n >= 80 ? 'ok' : n >= 50 ? 'warn' : 'danger'}>{value}</Badge>;
  }
  if (value.length > 160) return <span className="clamp-3" title={value}>{value}</span>;
  return value || <span className="muted">—</span>;
}
