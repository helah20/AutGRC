import { useEffect, useState } from 'react';
import { api, qs } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import {
  Card, Loading, ErrorNote, Empty, Badge, Tabs, Field, Select, Modal,
  DataTable, useToast, SearchInput
} from '../components/ui.jsx';
import {
  IconBuilding, IconUsers, IconShield, IconHistory, IconSparkles, IconPlus,
  IconLock, IconCheck, IconAlert, IconX
} from '../components/Icons.jsx';
import { formatDate, relativeTime, titleCase } from '../lib/format.js';

export default function Settings() {
  const { can, user } = useAuth();
  const [tab, setTab] = useState('organisation');

  const tabs = [
    { key: 'organisation', label: 'Organisation', icon: <IconBuilding width={14} height={14} /> },
    ...(can('user:manage') ? [{ key: 'users', label: 'Users & access', icon: <IconUsers width={14} height={14} /> }] : []),
    { key: 'account', label: 'My account', icon: <IconLock width={14} height={14} /> },
    ...(can('audit:read') ? [{ key: 'audit', label: 'Audit log', icon: <IconHistory width={14} height={14} /> }] : []),
    { key: 'system', label: 'System', icon: <IconShield width={14} height={14} /> }
  ];

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Organisation context, access control, the audit log and platform status.</p>
        </div>
      </div>

      <Card flush>
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
        <div style={{ padding: 18 }}>
          {tab === 'organisation' && <OrgSettings canEdit={can('settings:write')} />}
          {tab === 'users' && <UserSettings />}
          {tab === 'account' && <AccountSettings user={user} />}
          {tab === 'audit' && <AuditLog />}
          {tab === 'system' && <SystemStatus />}
        </div>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------ organisation */

function OrgSettings({ canEdit }) {
  const toast = useToast();
  const { refreshOrg } = useAuth();
  const { data, loading, error, reload } = useFetch('/admin/org');
  const [form, setForm] = useState(null);

  useEffect(() => { if (data) setForm({ ...data }); }, [data]);

  if (loading || !form) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const listField = (key) => (form[key] || []).join('\n');
  const setList = (key, value) => setForm((f) => ({ ...f, [key]: value.split('\n').map((s) => s.trim()).filter(Boolean) }));

  return (
    <div className="stack">
      <div className="callout">
        <strong>Why this matters</strong>
        <p style={{ marginBottom: 0 }}>
          The generator uses this profile to tailor documents. Where a field is empty it records an
          explicit assumption on every generated package rather than presenting a guess as fact.
        </p>
      </div>

      <div className="field-row">
        <Field label="Organisation name" required>
          <input className="input" disabled={!canEdit} value={form.org_name || ''}
            onChange={(e) => setForm((f) => ({ ...f, org_name: e.target.value }))} />
        </Field>
        <Field label="Organisation type">
          <input className="input" disabled={!canEdit} value={form.org_type || ''} placeholder="e.g. Public joint-stock company"
            onChange={(e) => setForm((f) => ({ ...f, org_type: e.target.value }))} />
        </Field>
        <Field label="Industry">
          <input className="input" disabled={!canEdit} value={form.industry || ''} placeholder="e.g. Banking and financial services"
            onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} />
        </Field>
      </div>

      <div className="field-row">
        <Field label="Size">
          <input className="input" disabled={!canEdit} value={form.size || ''} placeholder="e.g. 2,500–10,000 employees"
            onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))} />
        </Field>
        <Field label="Country">
          <input className="input" disabled={!canEdit} value={form.country || ''}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
        </Field>
        <Field label="Risk appetite">
          <input className="input" disabled={!canEdit} value={form.risk_appetite || ''} placeholder="e.g. Moderate — low appetite for regulatory risk"
            onChange={(e) => setForm((f) => ({ ...f, risk_appetite: e.target.value }))} />
        </Field>
      </div>

      <Field label="Cybersecurity operating model" hint="Affects how the generator assigns responsibility across roles.">
        <input className="input" disabled={!canEdit} value={form.operating_model || ''}
          placeholder="e.g. Centralised cybersecurity function with federated system ownership"
          onChange={(e) => setForm((f) => ({ ...f, operating_model: e.target.value }))} />
      </Field>

      <div className="field-row">
        <Field label="Regulators" hint="One per line.">
          <textarea className="textarea" disabled={!canEdit} value={listField('regulators')}
            onChange={(e) => setList('regulators', e.target.value)} />
        </Field>
        <Field label="Technology environment" hint="One per line. Referenced in generated scope statements.">
          <textarea className="textarea" disabled={!canEdit} value={listField('technology_env')}
            onChange={(e) => setList('technology_env', e.target.value)} />
        </Field>
        <Field label="Data classification levels" hint="One per line.">
          <textarea className="textarea" disabled={!canEdit} value={listField('data_classifications')}
            onChange={(e) => setList('data_classifications', e.target.value)} />
        </Field>
      </div>

      <Field label="Business requirements" hint="What the cybersecurity programme must enable or protect.">
        <textarea className="textarea" disabled={!canEdit} value={form.business_requirements || ''}
          onChange={(e) => setForm((f) => ({ ...f, business_requirements: e.target.value }))} />
      </Field>

      {canEdit && (
        <div>
          <button className="btn btn-primary" onClick={async () => {
            try {
              await api.put('/admin/org', form);
              await refreshOrg();
              toast.success('Organisation profile saved');
              reload();
            } catch (err) { toast.error('Could not save', err.message); }
          }}><IconCheck width={13} height={13} />Save profile</button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- users */

function UserSettings() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch('/admin/users');
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'cyber_user', job_title: '', password: '' });

  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  return (
    <div className="stack">
      <div className="between">
        <div>
          <h3>User accounts</h3>
          <p className="small muted" style={{ marginBottom: 0 }}>
            Access is granted by role. Each role holds a fixed set of permissions applied consistently across every route.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}><IconPlus />Add user</button>
      </div>

      <Card flush>
        <DataTable
          columns={[
            { key: 'name', header: 'User', render: (u) => (<><div className="cell-title">{u.name}</div><div className="cell-sub">{u.email}</div></>) },
            { key: 'job_title', header: 'Job title', render: (u) => u.job_title || <span className="muted">—</span> },
            { key: 'role', header: 'Role', nowrap: true, render: (u) => <Badge tone={u.role === 'admin' ? 'critical' : 'info'}>{u.role_label}</Badge> },
            { key: 'permissions', header: 'Permissions', align: 'right' },
            {
              key: 'status', header: 'Status', nowrap: true,
              render: (u) => u.locked_until && new Date(u.locked_until) > new Date()
                ? <Badge tone="danger"><IconLock width={11} height={11} />Locked</Badge>
                : <Badge tone={u.status === 'active' ? 'ok' : 'neutral'}>{titleCase(u.status)}</Badge>
            },
            { key: 'last_login_at', header: 'Last sign-in', nowrap: true, render: (u) => u.last_login_at ? <span className="small">{relativeTime(u.last_login_at)}</span> : <span className="muted">Never</span> }
          ]}
          rows={data.items}
          onRowClick={setEditing}
        />
      </Card>

      <Card title="Permission matrix" subtitle="What each role may do. Routes check the permission, never the role directly." flush>
        <div className="table-wrap" style={{ maxHeight: 420, overflow: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Permission</th>
                {data.roles.map((r) => <th key={r.value} className="center" style={{ minWidth: 92 }}>{r.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {Object.keys(data.permissionMatrix).map((perm) => (
                <tr key={perm}>
                  <td className="mono small">{perm}</td>
                  {data.roles.map((r) => (
                    <td key={r.value} className="center">
                      {data.permissionMatrix[perm].includes(r.value)
                        ? <IconCheck width={14} height={14} style={{ color: 'var(--ok)' }} />
                        : <span className="faint">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add user"
        footer={
          <>
            <button className="btn" onClick={() => setAddOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={async () => {
              try {
                await api.post('/admin/users', form);
                toast.success('User created', `${form.email} can now sign in.`);
                setAddOpen(false);
                setForm({ name: '', email: '', role: 'cyber_user', job_title: '', password: '' });
                reload();
              } catch (err) {
                toast.error('Could not create the user', Array.isArray(err.payload?.detail) ? err.payload.detail.join(' ') : err.message);
              }
            }}>Create user</button>
          </>
        }>
        <div className="field-row">
          <Field label="Full name" required>
            <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Email" required>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Job title">
            <input className="input" value={form.job_title} onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))} />
          </Field>
          <Field label="Role" required>
            <Select value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))}
              options={data.roles.map((r) => ({ value: r.value, label: r.label }))} />
          </Field>
        </div>
        <Field label="Initial password" required
          hint="At least 12 characters with upper case, lower case and a digit. The user should change it after signing in.">
          <input className="input" type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
        </Field>
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.name}` : ''}
        footer={
          editing && (
            <>
              {editing.locked_until && new Date(editing.locked_until) > new Date() && (
                <button className="btn" style={{ marginRight: 'auto' }} onClick={async () => {
                  await api.post(`/admin/users/${editing.id}/unlock`);
                  toast.success('Account unlocked');
                  setEditing(null);
                  reload();
                }}><IconLock width={13} height={13} />Unlock account</button>
              )}
              <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={async () => {
                try {
                  await api.patch(`/admin/users/${editing.id}`, {
                    name: editing.name, role: editing.role, job_title: editing.job_title,
                    status: editing.status, ...(editing.newPassword ? { password: editing.newPassword } : {})
                  });
                  toast.success('User updated');
                  setEditing(null);
                  reload();
                } catch (err) {
                  toast.error('Update failed', Array.isArray(err.payload?.detail) ? err.payload.detail.join(' ') : err.message);
                }
              }}>Save changes</button>
            </>
          )
        }>
        {editing && (
          <>
            <div className="field-row">
              <Field label="Full name">
                <input className="input" value={editing.name} onChange={(e) => setEditing((u) => ({ ...u, name: e.target.value }))} />
              </Field>
              <Field label="Job title">
                <input className="input" value={editing.job_title || ''} onChange={(e) => setEditing((u) => ({ ...u, job_title: e.target.value }))} />
              </Field>
            </div>
            <div className="field-row">
              <Field label="Role">
                <Select value={editing.role} onChange={(v) => setEditing((u) => ({ ...u, role: v }))}
                  options={data.roles.map((r) => ({ value: r.value, label: r.label }))} />
              </Field>
              <Field label="Status" hint="Suspending an account revokes every active session immediately.">
                <Select value={editing.status} onChange={(v) => setEditing((u) => ({ ...u, status: v }))}
                  options={[{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }]} />
              </Field>
            </div>
            <Field label="Reset password" hint="Leave blank to keep the current password. Resetting revokes every active session.">
              <input className="input" type="text" value={editing.newPassword || ''}
                onChange={(e) => setEditing((u) => ({ ...u, newPassword: e.target.value }))} />
            </Field>
          </>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ account */

function AccountSettings({ user }) {
  const toast = useToast();
  const { logout } = useAuth();
  const { data: sessions, reload } = useFetch('/auth/sessions');
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });

  return (
    <div className="stack">
      <Card title="Your account">
        <div className="definition">
          <dt>Name</dt><dd>{user.name}</dd>
          <dt>Email</dt><dd>{user.email}</dd>
          <dt>Role</dt><dd><Badge tone="info">{user.roleLabel}</Badge></dd>
          <dt>Job title</dt><dd>{user.jobTitle || '—'}</dd>
          <dt>Last sign-in</dt><dd>{user.lastLoginAt ? formatDate(user.lastLoginAt, { withTime: true }) : '—'}</dd>
        </div>
      </Card>

      <Card title="Change password"
        subtitle="Changing your password signs you out of every device, including this one.">
        <div className="field-row">
          <Field label="Current password">
            <input className="input" type="password" autoComplete="current-password" value={form.currentPassword}
              onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))} />
          </Field>
          <Field label="New password" hint="At least 12 characters with upper case, lower case and a digit.">
            <input className="input" type="password" autoComplete="new-password" value={form.newPassword}
              onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))} />
          </Field>
          <Field label="Confirm new password"
            error={form.confirm && form.confirm !== form.newPassword ? 'Passwords do not match.' : null}>
            <input className="input" type="password" autoComplete="new-password" value={form.confirm}
              onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} />
          </Field>
        </div>
        <button className="btn btn-primary"
          disabled={!form.currentPassword || !form.newPassword || form.newPassword !== form.confirm}
          onClick={async () => {
            try {
              await api.post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
              toast.success('Password changed', 'Please sign in again.');
              setTimeout(() => logout(), 1200);
            } catch (err) {
              toast.error('Could not change the password', Array.isArray(err.payload?.detail) ? err.payload.detail.join(' ') : err.message);
            }
          }}><IconLock width={13} height={13} />Change password</button>
      </Card>

      <Card title="Active sessions" flush
        actions={
          <button className="btn btn-sm" onClick={async () => {
            await api.del('/auth/sessions');
            toast.success('All sessions revoked', 'Sign in again to continue.');
            setTimeout(() => logout(), 1000);
          }}>Revoke all</button>
        }>
        <DataTable
          columns={[
            { key: 'user_agent', header: 'Device', render: (s) => <span className="small clamp-2">{s.user_agent || 'Unknown'}</span> },
            { key: 'ip', header: 'Address', nowrap: true, render: (s) => <span className="mono small">{s.ip || '—'}</span> },
            { key: 'created_at', header: 'Started', nowrap: true, render: (s) => <span className="small">{formatDate(s.created_at, { withTime: true })}</span> },
            { key: 'last_seen_at', header: 'Last seen', nowrap: true, render: (s) => <span className="small">{relativeTime(s.last_seen_at)}</span> },
            { key: 'revoked_at', header: 'State', nowrap: true, render: (s) => s.revoked_at ? <Badge tone="neutral">Revoked</Badge> : <Badge tone="ok">Active</Badge> }
          ]}
          rows={sessions || []}
          empty={<Empty title="No sessions recorded" />}
        />
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- audit log */

function AuditLog() {
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState('');
  const [action, setAction] = useState('');
  const { data, loading, error, reload } = useFetch(`/admin/audit${qs({ search, outcome, action, limit: 200 })}`);

  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  return (
    <div className="stack">
      <div>
        <h3>Audit log</h3>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Every authentication, authorisation decision, document change, generation, export and
          administrative action, with the actor and outcome.
        </p>
      </div>

      <Card flush>
        <div className="table-toolbar">
          <div className="search-box"><SearchInput value={search} onChange={setSearch} placeholder="Search the log…" /></div>
          <Select value={action} onChange={setAction} placeholder="All actions"
            options={(data.facets.actions || []).map((a) => ({ value: a.action, label: `${a.action} (${a.n})` }))} />
          <Select value={outcome} onChange={setOutcome} placeholder="All outcomes"
            options={(data.facets.outcomes || []).map((o) => ({ value: o.outcome, label: `${titleCase(o.outcome)} (${o.n})` }))} />
          {(search || outcome || action) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setOutcome(''); setAction(''); }}>
              <IconX width={13} height={13} />Clear
            </button>
          )}
          <span className="table-count">{data.items.length} of {data.total}</span>
        </div>
        <DataTable
          columns={[
            { key: 'at', header: 'When', nowrap: true, render: (r) => <span className="small">{formatDate(r.at, { withTime: true })}</span> },
            { key: 'user_email', header: 'Actor', nowrap: true, render: (r) => <span className="small">{r.user_email || 'system'}</span> },
            { key: 'action', header: 'Action', nowrap: true, render: (r) => <span className="mono small">{r.action}</span> },
            { key: 'summary', header: 'Summary', render: (r) => r.summary || '—' },
            {
              key: 'outcome', header: 'Outcome', nowrap: true,
              render: (r) => <Badge tone={r.outcome === 'success' ? 'ok' : r.outcome === 'denied' ? 'danger' : 'warn'}>{titleCase(r.outcome)}</Badge>
            }
          ]}
          rows={data.items}
          empty={<Empty icon={IconHistory} title="No audit entries match" />}
        />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------- system */

function SystemStatus() {
  const { data, loading, error, reload } = useFetch('/admin/system');
  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  return (
    <div className="stack">
      <Card title="AI provider">
        <div className="row-tight" style={{ marginBottom: 8 }}>
          <IconSparkles width={16} height={16} style={{ color: 'var(--accent)' }} />
          <span className="strong">{data.ai.provider === 'anthropic' ? `Claude — ${data.ai.model}` : 'Built-in knowledge engine'}</span>
          <Badge tone={data.ai.configured ? 'ok' : 'neutral'}>{data.ai.configured ? 'API configured' : 'Offline mode'}</Badge>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>{data.ai.description}</p>
      </Card>

      <Card title="Knowledge base">
        <div className="definition">
          <dt>Domains</dt><dd>{data.knowledgeBase.domains}</dd>
          <dt>Frameworks</dt><dd>{data.knowledgeBase.frameworks}</dd>
          <dt>Framework requirements</dt><dd>{data.knowledgeBase.frameworkRequirements}</dd>
          <dt>Cross-framework equivalences</dt><dd>{data.knowledgeBase.crosswalks}</dd>
          <dt>Integrity</dt>
          <dd>
            {data.knowledgeBase.integrityProblems.length === 0
              ? <Badge tone="ok"><IconCheck width={11} height={11} />No problems</Badge>
              : <Badge tone="danger"><IconAlert width={11} height={11} />{data.knowledgeBase.integrityProblems.length} problems</Badge>}
          </dd>
        </div>
        {data.knowledgeBase.integrityProblems.length > 0 && (
          <div className="callout" data-callout="danger" style={{ marginTop: 12 }}>
            <strong>Integrity problems</strong>
            <ul style={{ marginBottom: 0, paddingLeft: 18 }}>
              {data.knowledgeBase.integrityProblems.slice(0, 10).map((p, i) => <li key={i} className="small">{p}</li>)}
            </ul>
          </div>
        )}
      </Card>

      <Card title="Platform data">
        <div className="grid grid-4">
          {Object.entries(data.counts).map(([key, value]) => (
            <div key={key}>
              <div className="kpi-label">{titleCase(key.replace(/([A-Z])/g, ' $1'))}</div>
              <div className="strong" style={{ fontSize: 20 }}>{value.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
