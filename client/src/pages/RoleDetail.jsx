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

const KINDS = [
  { key: 'responsibility', label: 'Key Responsibilities', help: 'What the role does on an ongoing basis.' },
  { key: 'accountability', label: 'Accountabilities', help: 'What the role answers for, and cannot delegate.' },
  { key: 'activity', label: 'Required Activities', help: 'Recurring activities the role must perform.' },
  { key: 'approval', label: 'Required Approvals', help: 'Decisions this role is authorised to approve.' },
  { key: 'escalation', label: 'Escalation Responsibilities', help: 'What the role must escalate, to whom and when.' }
];

export default function RoleDetail() {
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

  if (loading) return <Loading label="Loading role…" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const role = data?.role;
  if (!role) return <Empty title="Role not found" />;

  const editable = can('role:write');

  async function saveItem(itemId) {
    try {
      await api.put(`/roles/${id}/items/${itemId}`, { text: draft });
      toast.success('Statement updated');
      setEditing(null);
      reload();
    } catch (err) { toast.error('Could not save', err.message); }
  }

  async function addItem(kind) {
    if (!draft.trim()) return;
    try {
      await api.post(`/roles/${id}/items`, { kind, text: draft });
      toast.success('Statement added');
      setAdding(null);
      setDraft('');
      reload();
    } catch (err) { toast.error('Could not add', err.message); }
  }

  return (
    <>
      <div className="breadcrumb">
        <Link to="/roles">Roles</Link><IconChevronRight width={12} height={12} /><span>{role.name}</span>
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
              <IconTrash />Delete role
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-2" style={{ marginBottom: 14 }}>
        <Card title="Reporting line and authority">
          <div className="definition">
            <dt>Reports to</dt><dd>{role.reporting_line || <span className="muted">Not defined</span>}</dd>
            <dt>Authority</dt><dd>{role.authority || <span className="muted">Not defined</span>}</dd>
          </div>
        </Card>
        <Card title="Required competencies">
          {role.competencies?.length ? (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {role.competencies.map((c, i) => <li key={i} style={{ marginBottom: 4 }}>{c}</li>)}
            </ul>
          ) : <Empty title="No competencies recorded" />}
        </Card>
      </div>

      <Card flush>
        <Tabs
          tabs={[
            { key: 'responsibilities', label: 'Responsibilities', count: KINDS.reduce((a, k) => a + (role.items[k.key]?.length || 0), 0) },
            { key: 'interfaces', label: 'Interfaces', count: role.interfaces?.length || undefined },
            { key: 'raci', label: 'RACI assignments', count: role.raci?.length || undefined },
            { key: 'coverage', label: 'Domain coverage', count: coverage?.coverage?.length || undefined }
          ]}
          active={tab} onChange={setTab} />

        {tab === 'responsibilities' && (
          <div style={{ padding: 18 }} className="stack">
            {KINDS.map((kind) => (
              <Card key={kind.key} title={kind.label} subtitle={kind.help}
                actions={editable ? (
                  <button className="btn btn-sm" onClick={() => { setAdding(kind.key); setDraft(''); }}>
                    <IconPlus width={13} height={13} />Add
                  </button>
                ) : null}>
                {adding === kind.key && (
                  <div style={{ marginBottom: 12 }}>
                    <textarea className="textarea" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
                      placeholder={`New ${kind.key} statement…`} />
                    <div className="row-tight" style={{ marginTop: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => addItem(kind.key)} disabled={!draft.trim()}>
                        <IconCheck width={12} height={12} />Add
                      </button>
                      <button className="btn btn-sm" onClick={() => setAdding(null)}>Cancel</button>
                    </div>
                  </div>
                )}

                {role.items[kind.key]?.length ? (
                  <ol style={{ margin: 0, paddingLeft: 20 }}>
                    {role.items[kind.key].map((item) => (
                      <li key={item.id} style={{ marginBottom: 8 }}>
                        {editing === item.id ? (
                          <div>
                            <textarea className="textarea" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} />
                            <div className="row-tight" style={{ marginTop: 6 }}>
                              <button className="btn btn-primary btn-sm" onClick={() => saveItem(item.id)}><IconCheck width={12} height={12} />Save</button>
                              <button className="btn btn-sm" onClick={() => setEditing(null)}><IconX width={12} height={12} />Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="between" style={{ gap: 8, alignItems: 'flex-start' }}>
                            <span style={{ flex: 1 }}>{item.text}</span>
                            {editable && (
                              <span className="row-tight">
                                <button className="btn btn-ghost btn-icon btn-sm" title="Edit"
                                  onClick={() => { setEditing(item.id); setDraft(item.text); }}><IconEdit width={13} height={13} /></button>
                                <button className="btn btn-ghost btn-icon btn-sm" title="Remove"
                                  onClick={async () => {
                                    await api.del(`/roles/${id}/items/${item.id}`);
                                    toast.success('Statement removed');
                                    reload();
                                  }}><IconTrash width={13} height={13} /></button>
                              </span>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : <Empty title={`No ${kind.key} statements`} />}
              </Card>
            ))}
          </div>
        )}

        {tab === 'interfaces' && (
          <div style={{ padding: 18 }}>
            {role.interfaces?.length ? (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th style={{ width: 240 }}>Interfaces with</th><th>Nature of the interface</th></tr></thead>
                  <tbody>{role.interfaces.map((i, n) => (
                    <tr key={n}><td className="cell-title">{i.role}</td><td>{i.nature}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <Empty title="No interfaces recorded" />}
          </div>
        )}

        {tab === 'raci' && (
          <div style={{ padding: 18 }}>
            {role.raci?.length ? (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Matrix</th><th>Activity</th><th>Phase</th><th style={{ width: 120 }}>Assignment</th></tr></thead>
                  <tbody>
                    {role.raci.map((r, i) => (
                      <tr key={i}>
                        <td><Link to={`/raci/${r.matrix_id}`}>{r.matrix_name}</Link></td>
                        <td>{r.activity}</td>
                        <td className="small muted">{r.phase || '—'}</td>
                        <td>
                          <Badge tone={r.value === 'A' ? 'info' : r.value === 'R' ? 'ok' : 'neutral'}>
                            {{ R: 'Responsible', A: 'Accountable', S: 'Support', C: 'Consulted', I: 'Informed' }[r.value] || r.value}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty icon={IconGrid} title="Not assigned in any matrix" >This role does not yet appear in a RACI matrix.</Empty>}
          </div>
        )}

        {tab === 'coverage' && (
          <div style={{ padding: 18 }}>
            {coverage?.coverage?.length ? (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Domain</th><th className="num">Accountable</th><th className="num">Responsible</th><th className="num">Consulted</th><th className="num">Informed</th></tr></thead>
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
            ) : <Empty title="No domain coverage" >This role carries no assignments in the domain requirement models.</Empty>}
          </div>
        )}
      </Card>

      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} danger
        title="Delete this role?" confirmLabel="Delete"
        message={`${role.name} and all of its responsibility statements will be removed. RACI columns referencing it will lose their link.`}
        onConfirm={async () => {
          try { await api.del(`/roles/${id}`); toast.success('Role deleted'); navigate('/roles'); }
          catch (err) { toast.error('Delete failed', err.message); }
        }} />
    </>
  );
}
