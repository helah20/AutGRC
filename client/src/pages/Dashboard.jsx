import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { useFetch } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, Kpi, Loading, ErrorNote, Empty, StatusBadge, SeverityBadge, CoverageBar, Badge } from '../components/ui.jsx';
import { formatDate, relativeTime, titleCase, CHART_COLORS, TONE_COLORS } from '../lib/format.js';
import { IconWand, IconAlert, IconClock, IconDocument, IconChart, IconArrowRight } from '../components/Icons.jsx';

const chartAxis = { stroke: 'var(--text-faint)', fontSize: 11 };

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 7,
      padding: '8px 10px', boxShadow: 'var(--shadow)', fontSize: 12
    }}>
      {label && <div className="strong" style={{ marginBottom: 3 }}>{label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey || p.name} className="row-tight">
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.fill }} />
          <span className="muted">{p.name}:</span><span className="strong">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { data, loading, error, reload } = useFetch('/dashboard');
  const { user, org, can } = useAuth();

  if (loading) return <Loading label="Loading the governance position…" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const k = data.kpis;
  const c = data.charts;

  const coverageTone = k.complianceCoverage >= 80 ? 'ok' : k.complianceCoverage >= 50 ? 'warn' : 'danger';
  // The headline averages every mandatory source, including catalogued
  // regulations the organisation has not yet mapped any control to. Naming
  // the denominator stops the figure reading as a single framework's score.
  const mandatoryCount = c.coverage.filter((f) => f.is_mandatory).length;

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">Governance Dashboard</h1>
          <p className="page-sub">
            {org?.org_name} — the current position across {k.totalDocuments} governance documents,
            {' '}{k.controls} controls and {k.frameworkRequirements} catalogued framework requirements.
          </p>
        </div>
        <div className="page-actions">
          <Link className="btn" to="/reports"><IconChart />Reports</Link>
          {can('generate:run') && <Link className="btn btn-primary" to="/generator"><IconWand />Generate documents</Link>}
        </div>
      </div>

      {(k.overdue > 0 || k.criticalFindings > 0) && (
        <div className="grid grid-2" style={{ marginBottom: 14 }}>
          {k.overdue > 0 && (
            <div className="callout" data-callout="warning" style={{ margin: 0 }}>
              <strong>{k.overdue} document{k.overdue === 1 ? '' : 's'} overdue for review</strong>
              <p style={{ marginBottom: 0 }}>
                Published documents past their review date remain in force but can no longer be relied upon as current.{' '}
                <Link to="/documents?reviewDue=true">Review them now</Link>.
              </p>
            </div>
          )}
          {k.criticalFindings > 0 && (
            <div className="callout" data-callout="danger" style={{ margin: 0 }}>
              <strong>{k.criticalFindings} high or critical finding{k.criticalFindings === 1 ? '' : 's'} open</strong>
              <p style={{ marginBottom: 0 }}>
                The quality engine has raised issues that would attract an audit observation.{' '}
                <Link to="/findings">Open the findings register</Link>.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-kpi" style={{ marginBottom: 16 }}>
        <Kpi label="Total documents" value={k.totalDocuments} meta={`${k.published} published · ${k.draft} draft`} />
        <Kpi label="Policies" value={k.policies} meta="Mandatory positions" />
        <Kpi label="Standards" value={k.standards} meta="Measurable requirements" />
        <Kpi label="Procedures" value={k.procedures} meta="Operational steps" />
        <Kpi label="Controls" value={k.controls} meta={`${k.evidence} evidence requirements`} />
        <Kpi label="Roles defined" value={k.roles} meta={`${k.raciMatrices} RACI matrices`} />
        <Kpi label="Compliance coverage" value={`${k.complianceCoverage}%`} tone={coverageTone}
          progress={k.complianceCoverage}
          meta={`Mean across ${mandatoryCount} mandatory source${mandatoryCount === 1 ? '' : 's'}`} />
        <Kpi label="Under review" value={k.underReview} tone={k.underReview ? 'warn' : undefined} meta="Awaiting decision" />
        <Kpi label="Review due" value={k.reviewDue} tone={k.overdue ? 'danger' : 'warn'} meta={`${k.overdue} already overdue`} />
        <Kpi label="Open findings" value={k.openFindings} tone={k.criticalFindings ? 'danger' : undefined}
          meta={`${k.criticalFindings} high or critical`} />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 14 }}>
        <Card title="Framework coverage" subtitle="Requirements with a mapped organisational control, partial mappings weighted at half.">
          {c.coverage.length ? (
            <div className="stack-sm">
              {c.coverage.map((f) => (
                <div key={f.code} className="between" style={{ gap: 14 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="row-tight">
                      <span className="strong small">{f.code}</span>
                      {f.is_mandatory ? <Badge tone="critical">Mandatory</Badge> : <Badge tone="neutral">Adopted</Badge>}
                    </div>
                    <div className="tiny muted truncate">{f.covered} covered · {f.partial} partial · {f.notCovered} not covered of {f.total}</div>
                  </div>
                  <CoverageBar value={f.coverage} />
                </div>
              ))}
            </div>
          ) : <Empty title="No frameworks loaded" />}
        </Card>

        <Card title="Documents by lifecycle status">
          <div style={{ height: 232 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={c.byStatus} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" {...chartAxis} tickLine={false} axisLine={false} interval={0} angle={-14} textAnchor="end" height={54} />
                <YAxis {...chartAxis} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-hover)' }} />
                <Bar dataKey="value" name="Documents" radius={[4, 4, 0, 0]}>
                  {c.byStatus.map((entry) => (
                    <Cell key={entry.key} fill={
                      entry.key === 'published' ? TONE_COLORS.ok
                        : entry.key === 'under_review' || entry.key === 'under_revision' ? TONE_COLORS.warn
                        : entry.key === 'approved' ? TONE_COLORS.info
                        : TONE_COLORS.neutral} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 14 }}>
        <Card title="Document types">
          <div style={{ height: 210 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={c.byType} dataKey="value" nameKey="name" innerRadius={46} outerRadius={74} paddingAngle={2}>
                  {c.byType.map((entry, i) => <Cell key={entry.key} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Controls by risk rating">
          <div style={{ height: 210 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={c.controlsByRisk} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" {...chartAxis} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" {...chartAxis} tickLine={false} axisLine={false}
                  width={64} tickFormatter={titleCase} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-hover)' }} />
                <Bar dataKey="value" name="Controls" radius={[0, 4, 4, 0]}>
                  {c.controlsByRisk.map((e) => <Cell key={e.name} fill={TONE_COLORS[e.name === 'critical' ? 'critical' : e.name === 'high' ? 'danger' : e.name === 'medium' ? 'warn' : 'ok']} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Open findings by category">
          {c.findingsByCategory.length ? (
            <div style={{ height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={c.findingsByCategory} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" {...chartAxis} tickLine={false} axisLine={false}
                    angle={-28} textAnchor="end" height={62} interval={0} tickFormatter={titleCase} />
                  <YAxis {...chartAxis} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-hover)' }} />
                  <Bar dataKey="value" name="Findings" fill={TONE_COLORS.warn} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty title="No open findings" >The quality engine has not raised any issues.</Empty>}
        </Card>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 14 }}>
        <Card title="Domain coverage" subtitle="Documents and controls held per cybersecurity domain.">
          <div className="table-wrap" style={{ maxHeight: 330, overflowY: 'auto' }}>
            <table className="data">
              <thead><tr><th>Domain</th><th className="num">Docs</th><th className="num">Published</th><th className="num">Controls</th><th className="num">Evidence</th></tr></thead>
              <tbody>
                {c.byDomain.map((d) => (
                  <tr key={d.key}>
                    <td>
                      <Link to={`/documents?domain=${d.key}`} className="cell-title">{d.name}</Link>
                      <div className="cell-sub">{d.categoryLabel}</div>
                    </td>
                    <td className="num">{d.documents}</td>
                    <td className="num">{d.published}</td>
                    <td className="num">{d.controls}</td>
                    <td className="num">{d.evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Review schedule" subtitle="Documents reaching their review date within 90 days."
          actions={<Link className="btn btn-sm" to="/documents?reviewDue=true">View all</Link>}>
          {data.reviewDue.length ? (
            <div className="stack-sm">
              {data.reviewDue.slice(0, 7).map((d) => (
                <Link key={d.id} to={`/documents/${d.id}`} className="between"
                  style={{ padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 7, color: 'inherit' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="row-tight">
                      <span className="ref-tag">{d.reference}</span>
                      <span className="strong small truncate">{d.title}</span>
                    </div>
                    <div className="tiny muted">{d.domain_label} · {d.owner_name || 'No owner'}</div>
                  </div>
                  <Badge tone={d.daysRemaining < 0 ? 'danger' : d.daysRemaining <= 30 ? 'warn' : 'neutral'}>
                    {d.daysRemaining < 0 ? `${Math.abs(d.daysRemaining)}d overdue` : `${d.daysRemaining}d`}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : <Empty icon={IconClock} title="Nothing due" >No document reaches its review date within 90 days.</Empty>}
        </Card>
      </div>

      <div className="grid grid-3">
        <Card title="Recently updated">
          {data.recentlyUpdated.length ? (
            <div className="stack-sm">
              {data.recentlyUpdated.map((d) => (
                <Link key={d.id} to={`/documents/${d.id}`} style={{ color: 'inherit' }}>
                  <div className="row-tight"><span className="ref-tag">{d.reference}</span><StatusBadge status={d.status} /></div>
                  <div className="small truncate" style={{ marginTop: 2 }}>{d.title}</div>
                  <div className="tiny muted">{relativeTime(d.updated_at)}</div>
                </Link>
              ))}
            </div>
          ) : <Empty icon={IconDocument} title="No documents yet" />}
        </Card>

        <Card title="Highest-severity findings"
          actions={<Link className="btn btn-sm" to="/findings">All findings</Link>}>
          {data.topFindings.length ? (
            <div className="stack-sm">
              {data.topFindings.slice(0, 6).map((f) => (
                <div key={f.id}>
                  <div className="row-tight"><SeverityBadge severity={f.severity} /><span className="tiny muted">{titleCase(f.category)}</span></div>
                  <div className="small" style={{ marginTop: 2 }}>{f.title}</div>
                  <div className="tiny muted truncate">{f.location}</div>
                </div>
              ))}
            </div>
          ) : <Empty icon={IconAlert} title="No open findings" />}
        </Card>

        <Card title="Recent activity" subtitle="From the platform audit log.">
          {data.recentActivity.length ? (
            <div className="stack-sm">
              {data.recentActivity.slice(0, 8).map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 8 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: 3, marginTop: 6, flex: '0 0 auto',
                    background: a.outcome === 'success' ? 'var(--ok)' : a.outcome === 'denied' ? 'var(--danger)' : 'var(--warn)'
                  }} />
                  <div style={{ minWidth: 0 }}>
                    <div className="small truncate">{a.summary || a.action}</div>
                    <div className="tiny muted">{a.user_email || 'system'} · {relativeTime(a.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : <Empty title="No activity recorded" />}
        </Card>
      </div>
    </>
  );
}
