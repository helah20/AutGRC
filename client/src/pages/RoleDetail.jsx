import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import {
  Card, Loading, ErrorNote, Empty, Badge, Field, useToast, ConfirmDialog, Tabs
} from '../components/ui.jsx';
import { IconEdit, IconTrash, IconPlus, IconCheck, IconX, IconChevronRight, IconGrid } from '../components/Icons.jsx';
import { titleCase } from '../lib/format.js';
import { useLabels } from '../i18n/labels.js';
import { useT } from '../i18n/index.jsx';

// Built per render so the labels follow the current language.
function buildKinds(t) {
  return [
    { key: 'responsibility', label: t('roleDetailUi.responsibilityLabel'), help: t('roleDetailUi.responsibilityHelp'), placeholder: t('roleDetailUi.responsibilityPlaceholder'), empty: t('roleDetailUi.responsibilityEmpty') },
    { key: 'accountability', label: t('roleDetailUi.accountabilityLabel'), help: t('roleDetailUi.accountabilityHelp'), placeholder: t('roleDetailUi.accountabilityPlaceholder'), empty: t('roleDetailUi.accountabilityEmpty') },
    { key: 'activity', label: t('roleDetailUi.activityLabel'), help: t('roleDetailUi.activityHelp'), placeholder: t('roleDetailUi.activityPlaceholder'), empty: t('roleDetailUi.activityEmpty') },
    { key: 'approval', label: t('roleDetailUi.approvalLabel'), help: t('roleDetailUi.approvalHelp'), placeholder: t('roleDetailUi.approvalPlaceholder'), empty: t('roleDetailUi.approvalEmpty') },
    { key: 'escalation', label: t('roleDetailUi.escalationLabel'), help: t('roleDetailUi.escalationHelp'), placeholder: t('roleDetailUi.escalationPlaceholder'), empty: t('roleDetailUi.escalationEmpty') }
  ];
}

export default function RoleDetail() {
  const t = useT();
  const labels = useLabels();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const { data, loading, error, reload } = useFetch(`/roles/${id}`);
  const { data: coverage } = useFetch(`/roles/${id}/coverage`);
  const [tab, setTab] = useState('responsibilities');
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (loading) return <Loading label={t('roleDetailUi.loading')} />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const role = data?.role;
  if (!role) return <Empty title={t('roleDetailUi.notFound')} />;

  const editable = can('role:write');
  const KINDS = buildKinds(t);

  async function saveItem(itemId) {
    try {
      await api.put(`/roles/${id}/items/${itemId}`, { text: draft });
      toast.success(t('roleDetailUi.statementUpdated'));
      setEditing(null);
      reload();
    } catch (err) { toast.error(t('common.couldNotSave'), err.message); }
  }

  async function addItem(kind) {
    if (!draft.trim()) return;
    try {
      await api.post(`/roles/${id}/items`, { kind, text: draft });
      toast.success(t('roleDetailUi.statementAdded'));
      setAdding(null);
      setDraft('');
      reload();
    } catch (err) { toast.error(t('roleDetailUi.couldNotAdd'), err.message); }
  }

  return (
    <>
      <div className="breadcrumb">
        <Link to="/roles">{t('nav.roles')}</Link><IconChevronRight width={12} height={12} /><span>{role.name}</span>
      </div>

      <div className="page-head">
        <div className="page-head-text">
          <div className="row-tight" style={{ marginBottom: 5 }}>
            <Badge tone="neutral">{role.category}</Badge>
            {role.domain_label && <Badge tone="info">{labels.domain(role.domain_key, role.domain_label)}</Badge>}
            <span className="pill mono">{role.code}</span>
          </div>
          <h1 className="page-title">{role.name}</h1>
          <p className="page-sub">{role.purpose}</p>
        </div>
        {editable && (
          <div className="page-actions">
            <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete(true)}>
              <IconTrash />{t('roleDetailUi.deleteRole')}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-2" style={{ marginBottom: 14 }}>
        <Card title={t('roleDetailUi.reportingTitle')}>
          <dl className="definition">
            <dt>{t('roleDetailUi.reportsTo')}</dt><dd>{role.reporting_line || <span className="muted">{t('roleDetailUi.notDefined')}</span>}</dd>
            <dt>{t('roleDetailUi.authority')}</dt><dd>{role.authority || <span className="muted">{t('roleDetailUi.notDefined')}</span>}</dd>
          </dl>
        </Card>
        <Card title={t('roleDetailUi.competenciesTitle')}>
          {role.competencies?.length ? (
            <ul style={{ margin: 0, paddingInlineStart: 20 }}>
              {role.competencies.map((c, i) => <li key={i} style={{ marginBottom: 4 }}>{c}</li>)}
            </ul>
          ) : <Empty title={t('roleDetailUi.noCompetencies')} />}
        </Card>
      </div>

      <Card flush>
        <Tabs
          tabs={[
            { key: 'responsibilities', label: t('roleDetailUi.tabResponsibilities'), count: KINDS.reduce((a, k) => a + (role.items[k.key]?.length || 0), 0) },
            { key: 'interfaces', label: t('roleDetailUi.tabInterfaces'), count: role.interfaces?.length || undefined },
            { key: 'raci', label: t('roleDetailUi.tabRaci'), count: role.raci?.length || undefined },
            { key: 'coverage', label: t('roleDetailUi.tabCoverage'), count: coverage?.coverage?.length || undefined }
          ]}
          active={tab} onChange={setTab} />

        {tab === 'responsibilities' && (
          <div style={{ padding: 18 }} className="stack">
            {KINDS.map((kind) => (
              <Card key={kind.key} title={kind.label} subtitle={kind.help}
                actions={editable ? (
                  <button className="btn btn-sm" onClick={() => { setAdding(kind.key); setDraft(''); }}>
                    <IconPlus width={13} height={13} />{t('common.add')}
                  </button>
                ) : null}>
                {adding === kind.key && (
                  <div style={{ marginBottom: 12 }}>
                    <textarea className="textarea" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
                      placeholder={kind.placeholder} />
                    <div className="row-tight" style={{ marginTop: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => addItem(kind.key)} disabled={!draft.trim()}>
                        <IconCheck width={12} height={12} />{t('common.add')}
                      </button>
                      <button className="btn btn-sm" onClick={() => setAdding(null)}>{t('common.cancel')}</button>
                    </div>
                  </div>
                )}

                {role.items[kind.key]?.length ? (
                  <ol style={{ margin: 0, paddingInlineStart: 20 }}>
                    {role.items[kind.key].map((item) => (
                      <li key={item.id} style={{ marginBottom: 8 }}>
                        {editing === item.id ? (
                          <div>
                            <textarea className="textarea" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} />
                            <div className="row-tight" style={{ marginTop: 6 }}>
                              <button className="btn btn-primary btn-sm" onClick={() => saveItem(item.id)}><IconCheck width={12} height={12} />{t('common.save')}</button>
                              <button className="btn btn-sm" onClick={() => setEditing(null)}><IconX width={12} height={12} />{t('common.cancel')}</button>
                            </div>
                          </div>
                        ) : (
                          <div className="between" style={{ gap: 8, alignItems: 'flex-start' }}>
                            <span style={{ flex: 1 }}>{item.text}</span>
                            {editable && (
                              <span className="row-tight">
                                <button className="btn btn-ghost btn-icon btn-sm" title={t('common.edit')}
                                  onClick={() => { setEditing(item.id); setDraft(item.text); }}><IconEdit width={13} height={13} /></button>
                                <button className="btn btn-ghost btn-icon btn-sm" title={t('common.remove')}
                                  onClick={async () => {
                                    await api.del(`/roles/${id}/items/${item.id}`);
                                    toast.success(t('roleDetailUi.statementRemoved'));
                                    reload();
                                  }}><IconTrash width={13} height={13} /></button>
                              </span>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : <Empty title={kind.empty} />}
              </Card>
            ))}
          </div>
        )}

        {tab === 'interfaces' && (
          <div style={{ padding: 18 }}>
            {role.interfaces?.length ? (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th style={{ width: 240 }}>{t('roleDetailUi.interfacesWith')}</th><th>{t('roleDetailUi.interfaceNature')}</th></tr></thead>
                  <tbody>{role.interfaces.map((i, n) => (
                    <tr key={n}><td className="cell-title">{i.role}</td><td>{i.nature}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <Empty title={t('roleDetailUi.noInterfaces')} />}
          </div>
        )}

        {tab === 'raci' && (
          <div style={{ padding: 18 }}>
            {role.raci?.length ? (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>{t('roleDetailUi.colMatrix')}</th><th>{t('roleDetailUi.colActivity')}</th><th>{t('roleDetailUi.colPhase')}</th><th style={{ width: 120 }}>{t('roleDetailUi.colAssignment')}</th></tr></thead>
                  <tbody>
                    {role.raci.map((r, i) => (
                      <tr key={i}>
                        <td><Link to={`/raci/${r.matrix_id}`}>{r.matrix_name}</Link></td>
                        <td>{r.activity}</td>
                        <td className="small muted">{r.phase || '—'}</td>
                        <td>
                          <Badge tone={r.value === 'A' ? 'info' : r.value === 'R' ? 'ok' : 'neutral'}>
                            {{ R: t('roleDetailUi.responsible'), A: t('roleDetailUi.accountable'), S: t('roleDetailUi.support'), C: t('roleDetailUi.consulted'), I: t('roleDetailUi.informed') }[r.value] || r.value}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty icon={IconGrid} title={t('roleDetailUi.noRaciTitle')} >{t('roleDetailUi.noRaciBody')}</Empty>}
          </div>
        )}

        {tab === 'coverage' && (
          <div style={{ padding: 18 }}>
            {coverage?.coverage?.length ? (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>{t('common.domain')}</th><th className="num">{t('roleDetailUi.accountable')}</th><th className="num">{t('roleDetailUi.responsible')}</th><th className="num">{t('roleDetailUi.consulted')}</th><th className="num">{t('roleDetailUi.informed')}</th></tr></thead>
                  <tbody>
                    {coverage.coverage.map((c) => (
                      <tr key={c.domain}>
                        <td className="cell-title">{c.label}</td>
                        <td className="num">{c.accountable || '—'}</td>
                        <td className="num">{c.responsible || '—'}</td>
                        <td className="num">{c.consulted || '—'}</td>
                        <td className="num">{c.informed || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty title={t('roleDetailUi.noCoverageTitle')} >{t('roleDetailUi.noCoverageBody')}</Empty>}
          </div>
        )}
      </Card>

      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} danger
        title={t('roleDetailUi.confirmDeleteTitle')} confirmLabel={t('common.delete')}
        message={t('roleDetailUi.confirmDeleteMessage', { name: role.name })}
        onConfirm={async () => {
          try { await api.del(`/roles/${id}`); toast.success(t('roleDetailUi.roleDeleted')); navigate('/roles'); }
          catch (err) { toast.error(t('roleDetailUi.deleteFailed'), err.message); }
        }} />
    </>
  );
}
