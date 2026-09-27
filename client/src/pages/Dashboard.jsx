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
import { useI18n } from '../i18n/index.jsx';
import { useLabels } from '../i18n/labels.js';

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
  const { t, formatNumber } = useI18n();
  const labels = useLabels();

  if (loading) return <Loading label={t('dashboard.loading')} />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const k = data.kpis;
  // The charts arrive with English names already rendered. Re-label them from
  // the key the server sends alongside, so axes and tooltips read in Arabic
  // without the API having to know the reader's language.
  const c = {
    ...data.charts,
    byStatus: data.charts.byStatus.map((r) => ({ ...r, name: labels.status(r.key, r.name) })),
    byType: data.charts.byType.map((r) => ({ ...r, name: labels.docType(r.key, r.name) })),
    controlsByRisk: (data.charts.controlsByRisk || []).map((r) => ({ ...r, name: labels.rating(r.name, r.name) })),
    findingsByCategory: (data.charts.findingsByCategory || []).map((r) => ({ ...r, name: labels.findingCategory(r.name, r.name) }))
  };

  const coverageTone = k.complianceCoverage >= 80 ? 'ok' : k.complianceCoverage >= 50 ? 'warn' : 'danger';
  // The headline averages every mandatory source, including catalogued
  // regulations the organisation has not yet mapped any control to. Naming
  // the denominator stops the figure reading as a single framework's score.
  const mandatoryCount = c.coverage.filter((f) => f.is_mandatory).length;

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">{t('dashboard.title')}</h1>
          <p className="page-sub">
            {t('dashboard.summary', {
              org: org?.org_name || '',
              documents: formatNumber(k.totalDocuments),
              controls: formatNumber(k.controls),
              requirements: formatNumber(k.frameworkRequirements)
            })}
          </p>
        </div>
        <div className="page-actions">
          <Link className="btn" to="/reports"><IconChart />{t('dashboard.reports')}</Link>
          {can('generate:run') && <Link className="btn btn-primary" to="/generator"><IconWand />{t('dashboard.generate')}</Link>}
        </div>
      </div>

      {(k.overdue > 0 || k.criticalFindings > 0) && (
        <div className="grid grid-2" style={{ marginBottom: 14 }}>
          {k.overdue > 0 && (
            <div className="callout" data-callout="warning" style={{ margin: 0 }}>
              <strong>{t('dashboard.overdueTitle', { count: formatNumber(k.overdue) })}</strong>
              <p style={{ marginBottom: 0 }}>
                {t('dashboard.overdueBody')}{' '}
                <Link to="/documents?reviewDue=true">{t('dashboard.reviewNow')}</Link>.
              </p>
            </div>
          )}
          {k.criticalFindings > 0 && (
            <div className="callout" data-callout="danger" style={{ margin: 0 }}>
              <strong>{t('dashboard.findingsTitle', { count: formatNumber(k.criticalFindings) })}</strong>
              <p style={{ marginBottom: 0 }}>
                {t('dashboard.findingsBody')}{' '}
                <Link to="/findings">{t('dashboard.openFindings')}</Link>.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-kpi" style={{ marginBottom: 16 }}>
        <Kpi label={t('dashboard.kpiTotalDocuments')} value={formatNumber(k.totalDocuments)}
          meta={t('dashboard.kpiTotalDocumentsMeta', { published: formatNumber(k.published), draft: formatNumber(k.draft) })} />
        <Kpi label={t('dashboard.kpiPolicies')} value={formatNumber(k.policies)} meta={t('dashboard.kpiPoliciesMeta')} />
        <Kpi label={t('dashboard.kpiStandards')} value={formatNumber(k.standards)} meta={t('dashboard.kpiStandardsMeta')} />
        <Kpi label={t('dashboard.kpiProcedures')} value={formatNumber(k.procedures)} meta={t('dashboard.kpiProceduresMeta')} />
        <Kpi label={t('dashboard.kpiControls')} value={formatNumber(k.controls)} meta={t('dashboard.kpiControlsMeta', { evidence: formatNumber(k.evidence) })} />
        <Kpi label={t('dashboard.kpiRoles')} value={formatNumber(k.roles)} meta={t('dashboard.kpiRolesMeta', { matrices: formatNumber(k.raciMatrices) })} />
        <Kpi label={t('dashboard.kpiCoverage')} value={`${formatNumber(k.complianceCoverage)}%`} tone={coverageTone}
          progress={k.complianceCoverage}
          meta={t('dashboard.kpiCoverageMeta', { count: formatNumber(mandatoryCount) })} />
        <Kpi label={t('dashboard.kpiUnderReview')} value={formatNumber(k.underReview)} tone={k.underReview ? 'warn' : undefined} meta={t('dashboard.kpiUnderReviewMeta')} />
        <Kpi label={t('dashboard.kpiReviewDue')} value={formatNumber(k.reviewDue)} tone={k.overdue ? 'danger' : 'warn'} meta={t('dashboard.kpiReviewDueMeta', { overdue: formatNumber(k.overdue) })} />
        <Kpi label={t('dashboard.kpiOpenFindings')} value={formatNumber(k.openFindings)} tone={k.criticalFindings ? 'danger' : undefined}
          meta={t('dashboard.kpiOpenFindingsMeta', { critical: formatNumber(k.criticalFindings) })} />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 14 }}>
        <Card title={t('dashboard.frameworkCoverage')} subtitle={t('dashboard.frameworkCoverageSub')}>
          {c.coverage.length ? (
            <div className="stack-sm">
              {c.coverage.map((f) => (
                <div key={f.code} className="between" style={{ gap: 14 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="row-tight">
                      <span className="strong small">{f.code}</span>
                      {f.is_mandatory ? <Badge tone="critical">{t('dashboard.mandatory')}</Badge> : <Badge tone="neutral">{t('dashboard.adopted')}</Badge>}
                    </div>
                    <div className="tiny muted truncate">{t('dashboard.coverageDetail', {
                      covered: formatNumber(f.covered), total: formatNumber(f.total),
                      partial: formatNumber(f.partial), notCovered: formatNumber(f.notCovered)
                    })}</div>
                  </div>
                  <CoverageBar value={f.coverage} />
                </div>
              ))}
            </div>
          ) : <Empty title={t('dashboard.noFrameworks')} />}
        </Card>

        <Card title={t('dashboard.byStatus')}>
          <div style={{ height: 232 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={c.byStatus} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" {...chartAxis} tickLine={false} axisLine={false} interval={0} angle={-14} textAnchor="end" height={54} />
                <YAxis {...chartAxis} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-hover)' }} />
                <Bar dataKey="value" name={t('nav.allDocuments')} radius={[4, 4, 0, 0]}>
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
        <Card title={t('dashboard.byType')}>
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

        <Card title={t('dashboard.byRisk')}>
          <div style={{ height: 210 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={c.controlsByRisk} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" {...chartAxis} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" {...chartAxis} tickLine={false} axisLine={false}
                  width={64} tickFormatter={titleCase} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-hover)' }} />
                <Bar dataKey="value" name={t('nav.controls')} radius={[0, 4, 4, 0]}>
                  {c.controlsByRisk.map((e) => <Cell key={e.name} fill={TONE_COLORS[e.name === 'critical' ? 'critical' : e.name === 'high' ? 'danger' : e.name === 'medium' ? 'warn' : 'ok']} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title={t('dashboard.findingsByCategory')}>
          {c.findingsByCategory.length ? (
            <div style={{ height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={c.findingsByCategory} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" {...chartAxis} tickLine={false} axisLine={false}
                    angle={-28} textAnchor="end" height={62} interval={0} tickFormatter={titleCase} />
                  <YAxis {...chartAxis} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-hover)' }} />
                  <Bar dataKey="value" name={t('nav.findings')} fill={TONE_COLORS.warn} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty title={t('dashboard.noOpenFindings')} >{t('dashboard.noOpenFindingsBody')}</Empty>}
        </Card>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 14 }}>
        <Card title={t('dashboard.domainCoverage')} subtitle={t('dashboard.domainCoverageSub')}>
          <div className="table-wrap" style={{ maxHeight: 330, overflowY: 'auto' }}>
            <table className="data">
              <thead><tr><th>{t('dashboard.columnDomain')}</th><th className="num">{t('nav.allDocuments')}</th><th className="num">{t('dashboard.columnPublished')}</th><th className="num">{t('dashboard.columnControls')}</th><th className="num">{t('dashboard.columnEvidence')}</th></tr></thead>
              <tbody>
                {c.byDomain.map((d) => (
                  <tr key={d.key}>
                    <td>
                      <Link to={`/documents?domain=${d.key}`} className="cell-title">{labels.domain(d.key, d.name)}</Link>
                      <div className="cell-sub">{labels.domainCategory(d.category, d.categoryLabel)}</div>
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

        <Card title={t('dashboard.reviewSchedule')} subtitle={t('dashboard.reviewScheduleSub')}
          actions={<Link className="btn btn-sm" to="/documents?reviewDue=true">{t('dashboard.viewAll')}</Link>}>
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
                    <div className="tiny muted">{labels.domain(d.domain_key, d.domain_label)} · {d.owner_name || 'No owner'}</div>
                  </div>
                  <Badge tone={d.daysRemaining < 0 ? 'danger' : d.daysRemaining <= 30 ? 'warn' : 'neutral'}>
                    {d.daysRemaining < 0 ? `${Math.abs(d.daysRemaining)}d overdue` : `${d.daysRemaining}d`}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : <Empty icon={IconClock} title={t('dashboard.nothingDue')} >{t('dashboard.nothingDueBody')}</Empty>}
        </Card>
      </div>

      <div className="grid grid-3">
        <Card title={t('dashboard.recentlyUpdated')}>
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
          ) : <Empty icon={IconDocument} title={t('dashboard.noDocuments')} />}
        </Card>

        <Card title={t('dashboard.highestSeverity')}
          actions={<Link className="btn btn-sm" to="/findings">{t('dashboard.allFindings')}</Link>}>
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
          ) : <Empty icon={IconAlert} title={t('dashboard.noOpenFindings')} />}
        </Card>

        <Card title={t('dashboard.recentActivity')} subtitle={t('dashboard.recentActivitySub')}>
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
          ) : <Empty title={t('dashboard.noActivity')} />}
        </Card>
      </div>
    </>
  );
}
