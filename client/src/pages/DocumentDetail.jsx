import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import {
  Card, Loading, ErrorNote, Tabs, StatusBadge, Badge, Empty, Prose, ProvenanceTag,
  Modal, Drawer, ConfirmDialog, Field, Select, useToast, ScoreRing, DataTable
} from '../components/ui.jsx';
import RichTextEditor from '../components/RichTextEditor.jsx';
import FlowDiagram, { DecisionList } from '../components/FlowDiagram.jsx';
import FindingCard from '../components/FindingCard.jsx';
import { Scorecard, AssessmentPanel } from '../components/Scorecard.jsx';
import { formatDate, relativeTime, titleCase, daysUntil } from '../lib/format.js';
import {
  IconDownload, IconEdit, IconSparkles, IconHistory, IconComment, IconCheck, IconAlert,
  IconTrash, IconFlow, IconShield, IconLink, IconChevronRight, IconRefresh, IconX, IconInfo
} from '../components/Icons.jsx';
import { useLabels } from '../i18n/labels.js';
import { useI18n } from '../i18n/index.jsx';

export default function DocumentDetail() {
  const labels = useLabels();
  const { t, language, isRtl } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { can, user } = useAuth();

  const { data, loading, error, reload } = useFetch(`/documents/${id}`);
  const { data: directory } = useFetch('/admin/directory');
  const [tab, setTab] = useState('content');
  const [editing, setEditing] = useState(null);
  const [transitions, setTransitions] = useState([]);
  const [transitionTarget, setTransitionTarget] = useState(null);
  const [transitionNote, setTransitionNote] = useState('');
  const [review, setReview] = useState(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [comment, setComment] = useState('');
  const [compare, setCompare] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get(`/documents/${id}/transitions`).then(setTransitions).catch(() => {});
  }, [id, data?.document?.status]);

  const doc = data?.document;
  const params = doc?.generation_meta?.parameters || {};

  const editable = doc && can('document:update') && doc.status !== 'published';

  const saveSection = useCallback(async (sectionId, html) => {
    try {
      await api.put(`/documents/${id}/sections/${sectionId}`, { body: html });
      toast.success('Section saved');
      setEditing(null);
      reload();
    } catch (err) {
      toast.error('Could not save', err.message);
      throw err;
    }
  }, [id, reload, toast]);

  const runReview = useCallback(async () => {
    setReviewBusy(true);
    try {
      const res = await api.post(`/ai/review/document/${id}`);
      setReview(res);
      setTab('review');
      const high = res.findings.filter((f) => ['critical', 'high'].includes(f.severity)).length;
      if (high) toast.warn(`Review complete — ${high} high or critical finding${high === 1 ? '' : 's'}`, `Readiness score ${res.score.score}/100.`);
      else toast.success('Review complete', `Readiness score ${res.score.score}/100 with no high-severity findings.`);
    } catch (err) {
      toast.error('Review failed', err.message);
    } finally {
      setReviewBusy(false);
    }
  }, [id, toast]);

  async function applyTransition() {
    try {
      const res = await api.post(`/documents/${id}/transition`, { to: transitionTarget.to, comment: transitionNote || undefined });
      toast.success(`Document ${res.document.status_label.toLowerCase()}`, `${res.document.reference} is now at version ${res.document.version}.`);
      setTransitionTarget(null);
      setTransitionNote('');
      reload();
    } catch (err) {
      toast.error('Transition rejected', err.message);
    }
  }

  async function exportAs(format, exportLanguage = language) {
    try {
      const query = exportLanguage === 'ar' ? '?lang=ar' : '';
      const name = await api.download(`/export/documents/${id}.${format}${query}`);
      toast.success(t('documents.exportReady'), name);
    } catch (err) {
      toast.error(t('common.exportFailed'), err.message);
    }
  }

  async function aiRewrite(html, mode) {
    setAiBusy(true);
    try {
      const res = await api.post('/ai/rewrite', { text: html, mode, documentId: id });
      if (res.changes?.length) {
        toast.info(`${res.changes.length} change${res.changes.length === 1 ? '' : 's'} applied`, res.notes?.[0]);
      } else {
        toast.info('No changes needed', res.notes?.[0]);
        return null;
      }
      return res.html;
    } catch (err) {
      toast.error('Rewrite failed', err.message);
      return null;
    } finally {
      setAiBusy(false);
    }
  }

  if (loading) return <Loading label={t('documentDetail.loading')} />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!doc) return <Empty title="Document not found" />;

  const reviewDays = daysUntil(doc.review_date);
  const openFindings = review?.findings || data.findings || [];

  const tabs = [
    { key: 'content', label: t('documentDetail.tabContent'), count: data.sections.length },
    ...(data.flow ? [{ key: 'flow', label: t('documentDetail.processFlow') }] : []),
    { key: 'review', label: t('documentDetail.tabQuality'), count: openFindings.length || undefined },
    { key: 'traceability', label: t('documentDetail.tabTraceability'), count: data.controls.length || undefined },
    { key: 'history', label: t('documentDetail.tabHistory'), count: data.versions.length },
    { key: 'comments', label: t('documentDetail.tabComments'), count: data.comments.length || undefined }
  ];

  return (
    <>
      <div className="breadcrumb">
        <Link to="/documents">Documents</Link><IconChevronRight width={12} height={12} />
        <span>{doc.doc_type_label}</span><IconChevronRight width={12} height={12} />
        <span className="mono">{doc.reference}</span>
      </div>

      <div className="page-head">
        <div className="page-head-text">
          <div className="row-tight" style={{ marginBottom: 5 }}>
            <span className="ref-tag">{doc.reference}</span>
            <StatusBadge status={doc.status} />
            <Badge tone="neutral">v{doc.version}</Badge>
            <Badge tone={doc.classification === 'public' ? 'neutral' : doc.classification === 'internal' ? 'info' : 'critical'}>
              {titleCase(doc.classification)}
            </Badge>
            <ProvenanceTag provenance={doc.provenance} />
          </div>
          <h1 className="page-title">{doc.title}</h1>
          <p className="page-sub">
            {labels.domain(doc.domain_key, doc.domain_label)} · Owner {doc.owner_name || 'unassigned'}
            {doc.approver_name ? ` · Approver ${doc.approver_name}` : ''}
            {doc.review_date ? ` · Review due ${formatDate(doc.review_date)}` : ''}
          </p>
        </div>
        <div className="page-actions">
          <div className="btn-group">
            <button className="btn" onClick={() => exportAs('docx')}><IconDownload />{t('documentDetail.word')}</button>
            {/* Arabic PDF would come out with its letters unjoined, so the
                button says so rather than producing it. */}
            <button className="btn" onClick={() => exportAs('pdf', 'en')}
              title={language === 'ar' ? t('documents.pdfEnglishOnly') : undefined}>
              PDF{language === 'ar' ? ' (EN)' : ''}
            </button>
          </div>
          {can('ai:use') && (
            <button className="btn" onClick={runReview} disabled={reviewBusy}>
              {reviewBusy ? <span className="spinner" style={{ width: 13, height: 13 }} /> : <IconSparkles />}
              Review with AI
            </button>
          )}
          {can('document:update') && <button className="btn" onClick={() => setPropsOpen(true)}><IconEdit />{t('documentDetail.properties')}</button>}
          {transitions.filter((t) => t.allowed).map((t) => (
            <button key={t.to} className={`btn ${t.to === 'published' || t.to === 'approved' ? 'btn-primary' : ''}`}
              onClick={() => setTransitionTarget(t)}>
              {t.to === 'approved' ? <IconCheck /> : null}{t.label === 'Draft' ? 'Return to draft' : t.label}
            </button>
          ))}
        </div>
      </div>

      {doc.status === 'published' && reviewDays !== null && reviewDays < 0 && (
        <div className="callout" data-callout="warning">
          <strong>{t('documentDetail.overdue')}</strong>
          <p style={{ marginBottom: 0 }}>
            This document was due for review {Math.abs(reviewDays)} days ago on {formatDate(doc.review_date)} and
            remains published. Move it to Under Revision to bring it up to date.
          </p>
        </div>
      )}

      {doc.status === 'published' && can('document:update') && (
        <div className="callout" data-callout="note">
          <strong>{t('documentDetail.readOnly')}</strong>
          <p style={{ marginBottom: 0 }}>Move this document to Under Revision to edit its content. The published version stays in force until a new version is published.</p>
        </div>
      )}

      <Card flush>
        <Tabs tabs={tabs} active={tab} onChange={setTab} />

        {tab === 'content' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 208px', gap: 20, padding: 18 }}>
            <div className="doc-surface" style={{ padding: 0, border: 'none', background: 'none' }}>
              {data.sections.map((section, i) => (
                <section key={section.id} id={`section-${section.section_key}`} className="doc-section">
                  <div className="doc-section-head">
                    <span className="doc-section-num">{i + 1}</span>
                    <h3>{section.heading}</h3>
                    <ProvenanceTag provenance={section.provenance} />
                    {editable && editing !== section.id && (
                      <span className="doc-section-tools">
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(section.id)}>
                          <IconEdit width={13} height={13} />Edit
                        </button>
                      </span>
                    )}
                  </div>

                  {editing === section.id ? (
                    <RichTextEditor
                      value={section.body}
                      busy={aiBusy}
                      onCancel={() => setEditing(null)}
                      onSave={(html) => saveSection(section.id, html)}
                      aiActions={can('ai:use') ? [
                        { label: 'Improve', title: 'Replace unmeasurable wording with auditable formulations', run: (html) => aiRewrite(html, 'improve') },
                        { label: 'Formalise', title: 'Rewrite in a formal corporate register', run: (html) => aiRewrite(html, 'formalise') },
                        { label: 'Shorten', title: 'Reduce wordiness without changing obligations', run: (html) => aiRewrite(html, 'shorten') }
                      ] : undefined}
                    />
                  ) : (
                    <>
                      <Prose html={section.body} />
                      {section.source_refs?.length > 0 && (
                        <details style={{ marginTop: 8 }}>
                          <summary className="tiny muted" style={{ cursor: 'pointer' }}>
                            {section.source_refs.length} source reference{section.source_refs.length === 1 ? '' : 's'}
                          </summary>
                          <div className="row-tight" style={{ marginTop: 6, flexWrap: 'wrap' }}>
                            {section.source_refs.filter((r) => r.type === 'framework').map((r, j) => (
                              <span key={j} className="pill mono">{r.framework} {r.ref}</span>
                            ))}
                            {section.source_refs.filter((r) => r.type === 'parameter').map((r, j) => (
                              <span key={`p${j}`} className="pill">Value: {r.name}</span>
                            ))}
                          </div>
                        </details>
                      )}
                    </>
                  )}
                </section>
              ))}
            </div>

            <nav className="doc-toc" aria-label={t('documentDetail.sectionNavigation')}>
              <div className="nav-group-label" style={{ color: 'var(--text-faint)', padding: '0 0 6px' }}>{t('documentDetail.onThisPage')}</div>
              {data.sections.map((s, i) => (
                <a key={s.id} href={`#section-${s.section_key}`}>{i + 1}. {s.heading}</a>
              ))}
            </nav>
          </div>
        )}

        {tab === 'flow' && data.flow && (
          <div style={{ padding: 18 }}>
            <div className="stack">
              <div>
                <h3 style={{ marginBottom: 4 }}>{data.flow.title}</h3>
                <p className="muted small">{t('documentDetail.swimlaneCaption')}</p>
              </div>
              <FlowDiagram
                steps={data.flow.steps}
                lanes={data.flow.lanes}
                rows={data.flow.rows}
                params={params}
                rtl={isRtl}
              />
              <div>
                <h4 style={{ marginBottom: 8 }}>{t('documentDetail.decisionPoints')}</h4>
                <DecisionList steps={data.flow.steps} params={params} strings={{
                  step: t('documentDetail.stepLabel'),
                  yes: t('documentDetail.branchYes'),
                  no: t('documentDetail.branchNo')
                }} />
              </div>
            </div>
          </div>
        )}

        {tab === 'review' && (
          <div style={{ padding: 18 }}>
            {!review && !openFindings.length && (
              <Empty icon={IconSparkles} title="No review has been run"
                action={can('ai:use') ? <button className="btn btn-primary" onClick={runReview} disabled={reviewBusy}><IconSparkles />{t('documentDetail.reviewWithAi')}</button> : null}>
                The quality engine checks completeness, cross-document consistency, accountability,
                auditability, compliance coverage and ambiguous wording.
              </Empty>
            )}

            {(review || openFindings.length > 0) && (
              <div className="stack">
                {review && (
                  <div className="between" style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 9 }}>
                    <ScoreRing score={review.score.score} />
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div className="strong">{t('documentDetail.readinessScore')}</div>
                      <p className="small muted" style={{ marginBottom: 6 }}>{review.summary}</p>
                      <div className="row-tight">
                        {Object.entries(review.score.bySeverity || {}).map(([sev, n]) => (
                          <Badge key={sev} tone={sev === 'critical' ? 'critical' : sev === 'high' ? 'danger' : sev === 'medium' ? 'warn' : 'neutral'}>
                            {n} {sev}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="stack-sm" style={{ alignItems: 'flex-end' }}>
                      <span className="tiny muted">Engine: {review.provider === 'anthropic' ? `Claude (${review.model})` : 'built-in knowledge engine'}</span>
                      <button className="btn btn-sm" onClick={runReview} disabled={reviewBusy}><IconRefresh width={13} height={13} />{t('documentDetail.rerun')}</button>
                    </div>
                  </div>
                )}

                {review?.scorecard && <Scorecard scorecard={review.scorecard} />}

                {openFindings.length === 0 ? (
                  <Empty icon={IconCheck} title="No findings" >This document passed every check the quality engine performs.</Empty>
                ) : (
                  <div className="stack-sm">
                    {openFindings.map((f, i) => (
                      <FindingCard key={f.id || i} finding={f} canManage={can('finding:write')}
                        onStatusChange={async (finding, status) => {
                          try {
                            await api.patch(`/findings/${finding.id}`, { status });
                            toast.success('Finding updated', titleCase(status));
                            setReview((r) => (r ? { ...r, findings: r.findings.filter((x) => x.id !== finding.id) } : r));
                            reload();
                          } catch (err) { toast.error('Update failed', err.message); }
                        }} />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              <AssessmentPanel documentId={id} showEngine={!review?.scorecard} />
            </div>
          </div>
        )}

        {tab === 'traceability' && (
          <div style={{ padding: 18 }} className="stack">
            <Card title="Related documents" flush>
              {data.links.length || data.backlinks.length ? (
                <div className="table-wrap">
                  <table className="data">
                    <thead><tr><th>{t('documentDetail.direction')}</th><th>{t('documentDetail.relationship')}</th><th>Document</th><th>Status</th></tr></thead>
                    <tbody>
                      {data.links.map((l) => (
                        <tr key={`o-${l.id}`}>
                          <td><Badge tone="neutral">{t('documentDetail.outbound')}</Badge></td>
                          <td className="small">{titleCase(l.link_type)}</td>
                          <td><Link to={`/documents/${l.to_id}`}><span className="ref-tag">{l.reference}</span> {l.title}</Link></td>
                          <td><StatusBadge status={l.status} /></td>
                        </tr>
                      ))}
                      {data.backlinks.map((l) => (
                        <tr key={`i-${l.id}`}>
                          <td><Badge tone="info">{t('documentDetail.inbound')}</Badge></td>
                          <td className="small">{titleCase(l.link_type)}</td>
                          <td><Link to={`/documents/${l.from_id}`}><span className="ref-tag">{l.reference}</span> {l.title}</Link></td>
                          <td><StatusBadge status={l.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="card-body"><Empty icon={IconLink} title="No relationships recorded" /></div>}
            </Card>

            <Card title="Controls implementing this document" flush>
              <DataTable
                columns={[
                  { key: 'control_id', header: 'Control ID', nowrap: true, render: (c) => <span className="mono">{c.control_id}</span> },
                  { key: 'name', header: 'Control' },
                  { key: 'control_type', header: 'Type', nowrap: true, render: (c) => <Badge tone="neutral">{titleCase(c.control_type)}</Badge> },
                  { key: 'risk_rating', header: 'Risk', nowrap: true, render: (c) => <Badge tone={c.risk_rating === 'critical' ? 'critical' : c.risk_rating === 'high' ? 'danger' : c.risk_rating === 'medium' ? 'warn' : 'ok'}>{titleCase(c.risk_rating)}</Badge> }
                ]}
                rows={data.controls}
                onRowClick={() => navigate('/controls')}
                empty={<Empty icon={IconShield} title="No controls linked" >Controls are created alongside a generated Standard.</Empty>}
              />
            </Card>

            {doc.generation_meta && (
              <Card title="Generation record" subtitle="What this document was generated from.">
                <div className="definition">
                  <dt>Engine</dt><dd>{doc.generation_meta.provider === 'anthropic' ? 'Claude' : doc.generation_meta.provider === 'import' ? 'Imported document' : 'Built-in knowledge engine'}</dd>
                  <dt>Generated</dt><dd>{formatDate(doc.generation_meta.generatedAt || doc.created_at, { withTime: true })}</dd>
                  <dt>{t('documentDetail.sources')}</dt><dd>{doc.generation_meta.frameworks?.length ? doc.generation_meta.frameworks.join(', ') : <span className="muted">{t('documentDetail.noneSelected')}</span>}</dd>
                </div>
                {doc.generation_meta.assumptions?.length > 0 && (
                  <>
                    <div className="divider" />
                    <h4 style={{ marginBottom: 8 }}>{t('documentDetail.assumptions')}</h4>
                    <div className="stack-sm">
                      {doc.generation_meta.assumptions.map((a, i) => (
                        <div key={i} className="evidence-quote">
                          <div className="evidence-quote-label">{a.field}</div>
                          {a.assumption}
                          <div className="tiny muted" style={{ marginTop: 4 }}>{a.impact}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {doc.generation_meta.parameters && (
                  <>
                    <div className="divider" />
                    <h4 style={{ marginBottom: 8 }}>{t('documentDetail.agreedValues')}</h4>
                    <div className="definition">
                      {Object.entries(doc.generation_meta.parameters)
                        .filter(([k]) => k !== 'orgName')
                        .map(([k, v]) => (
                          <div key={k} style={{ display: 'contents' }}>
                            <dt>{titleCase(k.replace(/([A-Z])/g, ' $1'))}</dt><dd>{String(v)}</dd>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </Card>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div style={{ padding: 18 }} className="stack">
            <Card title="Approval history" flush>
              <DataTable
                columns={[
                  { key: 'action', header: 'Action', nowrap: true, render: (a) => <Badge tone={a.action === 'approved' || a.action === 'published' ? 'ok' : a.action === 'retired' ? 'neutral' : 'info'}>{titleCase(a.action)}</Badge> },
                  { key: 'from', header: 'Transition', nowrap: true, render: (a) => <span className="small muted">{titleCase(a.from_status)} → {titleCase(a.to_status)}</span> },
                  { key: 'actor_name', header: 'By', nowrap: true, render: (a) => <>{a.actor_name}<div className="cell-sub">{titleCase(a.actor_role)}</div></> },
                  { key: 'comment', header: 'Comment', render: (a) => a.comment || <span className="muted">—</span> },
                  { key: 'created_at', header: 'When', nowrap: true, render: (a) => <span className="small">{formatDate(a.created_at, { withTime: true })}</span> }
                ]}
                rows={data.approvals}
                empty={<Empty icon={IconHistory} title="No approval activity yet" />}
              />
            </Card>

            <Card title="Version history" flush
              actions={data.versions.length > 1 ? <span className="tiny muted">Select a version to compare with the current content</span> : null}>
              <DataTable
                columns={[
                  { key: 'version', header: 'Version', nowrap: true, render: (v) => <span className="mono strong">{v.version}</span> },
                  { key: 'change_type', header: 'Type', nowrap: true, render: (v) => <Badge tone="neutral">{titleCase(v.change_type)}</Badge> },
                  { key: 'change_note', header: 'Change note', render: (v) => v.change_note || <span className="muted">—</span> },
                  { key: 'author_name', header: 'Author', nowrap: true },
                  { key: 'created_at', header: 'When', nowrap: true, render: (v) => <span className="small">{formatDate(v.created_at, { withTime: true })}</span> },
                  {
                    key: 'actions', header: '', nowrap: true, render: (v) => (
                      <button className="btn btn-sm" onClick={async (e) => {
                        e.stopPropagation();
                        try { setCompare(await api.get(`/documents/${id}/compare?from=${v.id}`)); }
                        catch (err) { toast.error('Comparison failed', err.message); }
                      }}>{t('documentDetail.compare')}</button>
                    )
                  }
                ]}
                rows={data.versions}
                empty={<Empty icon={IconHistory} title="No versions recorded" />}
              />
            </Card>
          </div>
        )}

        {tab === 'comments' && (
          <div style={{ padding: 18 }} className="stack">
            {can('comment:write') && (
              <Card>
                <Field label={t('documentDetail.addComment')}>
                  <textarea className="textarea" value={comment} onChange={(e) => setComment(e.target.value)}
                    placeholder="Raise a question, note a required change, or record a review observation…" />
                </Field>
                <button className="btn btn-primary btn-sm" disabled={!comment.trim()} onClick={async () => {
                  try {
                    await api.post(`/documents/${id}/comments`, { body: comment });
                    setComment('');
                    toast.success('Comment added');
                    reload();
                  } catch (err) { toast.error('Could not add comment', err.message); }
                }}><IconComment width={13} height={13} />{t('documentDetail.postComment')}</button>
              </Card>
            )}
            {data.comments.length ? (
              <div className="stack-sm">
                {data.comments.map((c) => (
                  <div key={c.id} className="card" style={{ padding: 12 }}>
                    <div className="between">
                      <div className="row-tight">
                        <span className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>
                          {(c.author_name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}
                        </span>
                        <span className="strong small">{c.author_name}</span>
                        <span className="tiny muted">{relativeTime(c.created_at)}</span>
                        {c.resolved ? <Badge tone="ok">{t('documentDetail.resolved')}</Badge> : null}
                      </div>
                      {can('comment:write') && !c.resolved && (
                        <button className="btn btn-ghost btn-sm" onClick={async () => {
                          await api.patch(`/documents/${id}/comments/${c.id}`, { resolved: true });
                          reload();
                        }}><IconCheck width={12} height={12} />{t('documentDetail.resolve')}</button>
                      )}
                    </div>
                    <p style={{ marginTop: 6, marginBottom: 0 }}>{c.body}</p>
                  </div>
                ))}
              </div>
            ) : <Empty icon={IconComment} title="No comments" >Reviewers can raise observations here without editing the document.</Empty>}
          </div>
        )}
      </Card>

      {/* ------------------------------------------------------ dialogs -- */}

      <Modal open={Boolean(transitionTarget)} onClose={() => setTransitionTarget(null)}
        title={`Move to ${transitionTarget?.label || ''}`}
        footer={
          <>
            <button className="btn" onClick={() => setTransitionTarget(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={applyTransition}>Confirm</button>
          </>
        }>
        <p className="muted small">
          {transitionTarget?.to === 'approved' && 'Approving records your name and role against this document. A document cannot be approved by its own owner.'}
          {transitionTarget?.to === 'published' && 'Publishing issues a whole version number, sets the effective date and schedules the next review in 12 months.'}
          {transitionTarget?.to === 'under_review' && 'Submitting moves the document into the review queue.'}
          {transitionTarget?.to === 'retired' && 'Retiring removes the document from force. The record and its history are preserved.'}
          {transitionTarget?.to === 'under_revision' && 'The published version stays in force while you revise.'}
          {transitionTarget?.to === 'draft' && 'Returning to draft sends the document back to its author.'}
        </p>
        <Field label={t('documentDetail.addComment')} hint="Recorded in the approval history.">
          <textarea className="textarea" value={transitionNote} onChange={(e) => setTransitionNote(e.target.value)} />
        </Field>
      </Modal>

      <PropertiesModal open={propsOpen} onClose={() => setPropsOpen(false)} doc={doc}
        directory={directory || []} onSaved={() => { setPropsOpen(false); reload(); }}
        onDelete={() => { setPropsOpen(false); setConfirmDelete(true); }} canDelete={can('document:delete')} />

      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} danger
        title="Delete this document?" confirmLabel="Delete"
        message={`${doc.reference} and all of its sections, versions and comments will be permanently removed. Published documents must be retired instead.`}
        onConfirm={async () => {
          try {
            await api.del(`/documents/${id}`);
            toast.success('Document deleted');
            navigate('/documents');
          } catch (err) { toast.error('Delete failed', err.message); }
        }} />

      <Drawer open={Boolean(compare)} onClose={() => setCompare(null)} wide
        title={`Compare version ${compare?.from?.version || ''} with current`}>
        {compare && (
          <div className="stack-sm">
            <p className="small muted">
              Version {compare.from.version} by {compare.from.author} on {formatDate(compare.from.created_at)}, compared with the current content.
            </p>
            {compare.sections.map((s) => (
              <div key={s.section_key} className="card" style={{ padding: 12 }}>
                <div className="row-tight" style={{ marginBottom: s.diff ? 8 : 0 }}>
                  <span className="strong small">{s.heading}</span>
                  <Badge tone={s.status === 'unchanged' ? 'neutral' : s.status === 'added' ? 'ok' : s.status === 'removed' ? 'danger' : 'warn'}>
                    {titleCase(s.status)}
                  </Badge>
                </div>
                {s.diff && (
                  <div className="mono tiny" style={{ display: 'grid', gap: 2 }}>
                    {s.diff.filter((d) => d.type !== 'same').slice(0, 30).map((d, i) => (
                      <div key={i} style={{
                        padding: '3px 7px', borderRadius: 3,
                        background: d.type === 'added' ? 'var(--ok-soft)' : 'var(--danger-soft)',
                        color: d.type === 'added' ? 'var(--ok)' : 'var(--danger)'
                      }}>
                        <span style={{ fontWeight: 700, marginRight: 6 }}>{d.type === 'added' ? '+' : '−'}</span>{d.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </>
  );
}

function PropertiesModal({ open, onClose, doc, directory, onSaved, onDelete, canDelete }) {
  const { t } = useI18n();
  const labels = useLabels();
  const toast = useToast();
  const [form, setForm] = useState({});
  useEffect(() => {
    if (!open) return;
    setForm({
      title: doc.title, summary: doc.summary || '', classification: doc.classification,
      owner_id: doc.owner_id || '', approver_id: doc.approver_id || '',
      effective_date: doc.effective_date || '', review_date: doc.review_date || ''
    });
  }, [open, doc]);

  return (
    <Modal open={open} onClose={onClose} title="Document properties" size="modal-lg"
      footer={
        <>
          {canDelete && doc.status !== 'published' && (
            <button className="btn btn-ghost" style={{ marginRight: 'auto', color: 'var(--danger)' }} onClick={onDelete}>
              <IconTrash width={13} height={13} />Delete document
            </button>
          )}
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={async () => {
            try {
              await api.patch(`/documents/${doc.id}`, {
                ...form,
                owner_id: form.owner_id || null,
                approver_id: form.approver_id || null,
                effective_date: form.effective_date || null,
                review_date: form.review_date || null
              });
              toast.success('Properties updated');
              onSaved();
            } catch (err) { toast.error('Update failed', err.message); }
          }}>{t('documentDetail.saveChanges')}</button>
        </>
      }>
      <Field label={t('documentDetail.docTitle')} required>
        <input className="input" value={form.title || ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
      </Field>
      <Field label={t('documentDetail.summary')}>
        <textarea className="textarea" value={form.summary || ''} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} />
      </Field>
      <div className="field-row">
        <Field label={t('documentDetail.documentOwner')} hint="Accountable for content and review.">
          <Select value={form.owner_id} onChange={(v) => setForm((f) => ({ ...f, owner_id: v }))} placeholder="Unassigned"
            options={directory.map((u) => ({ value: u.id, label: `${u.name} — ${u.job_title || labels.role(u.role)}` }))} />
        </Field>
        <Field label={t('documentDetail.approver')}>
          <Select value={form.approver_id} onChange={(v) => setForm((f) => ({ ...f, approver_id: v }))} placeholder="Unassigned"
            options={directory.filter((u) => ['approver', 'admin'].includes(u.role)).map((u) => ({ value: u.id, label: `${u.name} — ${u.job_title || labels.role(u.role)}` }))} />
        </Field>
      </div>
      <div className="field-row">
        <Field label={t('documentDetail.classification')}>
          <Select value={form.classification} onChange={(v) => setForm((f) => ({ ...f, classification: v }))}
            options={['public', 'internal', 'confidential', 'secret', 'top_secret'].map((v) => ({ value: v, label: titleCase(v) }))} />
        </Field>
        <Field label={t('documentDetail.effectiveDate')}>
          <input className="input" type="date" value={form.effective_date || ''} onChange={(e) => setForm((f) => ({ ...f, effective_date: e.target.value }))} />
        </Field>
        <Field label={t('documentDetail.reviewDate')}>
          <input className="input" type="date" value={form.review_date || ''} onChange={(e) => setForm((f) => ({ ...f, review_date: e.target.value }))} />
        </Field>
      </div>
    </Modal>
  );
}
