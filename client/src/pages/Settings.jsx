import { useEffect, useState } from 'react';
import { api, qs } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import FrameworkPicker from '../components/FrameworkPicker.jsx';
import BrandSettings from '../components/BrandSettings.jsx';
import { useAuth } from '../lib/auth.jsx';
import {
  Card, Loading, ErrorNote, Empty, Badge, Tabs, Field, Select, Modal,
  DataTable, useToast, SearchInput
} from '../components/ui.jsx';
import {
  IconBuilding, IconUsers, IconShield, IconHistory, IconSparkles, IconPlus,
  IconLock, IconCheck, IconAlert, IconX, IconRefresh, IconTrash, IconCopy, IconPalette
} from '../components/Icons.jsx';
import { formatDate, relativeTime, titleCase } from '../lib/format.js';
import { EnrolMfa } from './AccountAction.jsx';
import { useLabels } from '../i18n/labels.js';
import { useT } from '../i18n/index.jsx';

/**
 * Roles as the server defines them. Kept here rather than fetched, because the
 * organisation tab is open to settings:write holders who have no right to read
 * the user directory.
 */
const ROLE_OPTIONS = [
  { value: 'admin' },
  { value: 'grc_manager' },
  { value: 'cyber_user' },
  { value: 'reviewer' },
  { value: 'approver' },
  { value: 'auditor' },
  { value: 'read_only' }
];

export default function Settings() {
  const t = useT();
  const labels = useLabels();
  const { can, user, org } = useAuth();
  const [tab, setTab] = useState('organisation');

  const tabs = [
    { key: 'organisation', label: t('settingsUi.tabs.organisation'), icon: <IconBuilding width={14} height={14} /> },
    { key: 'brand', label: t('settingsUi.tabs.brand'), icon: <IconPalette width={14} height={14} /> },
    ...(can('user:manage') ? [{ key: 'users', label: t('settingsUi.tabs.users'), icon: <IconUsers width={14} height={14} /> }] : []),
    { key: 'account', label: t('settingsUi.tabs.account'), icon: <IconLock width={14} height={14} /> },
    ...(can('audit:read') ? [{ key: 'audit', label: t('settingsUi.tabs.audit'), icon: <IconHistory width={14} height={14} /> }] : []),
    { key: 'system', label: t('settingsUi.tabs.system'), icon: <IconShield width={14} height={14} /> }
  ];

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">{t('settings.title')}</h1>
          <p className="page-sub">{t('settings.subtitle')}</p>
        </div>
      </div>

      <Card flush>
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
        <div style={{ padding: 18 }}>
          {tab === 'organisation' && <OrgSettings canEdit={can('settings:write')} />}
          {tab === 'brand' && <BrandSettings canEdit={can('settings:write')} orgName={org?.org_name || ''} />}
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
  const t = useT();
  const labels = useLabels();
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
        <strong>{t('settingsUi.org.whyTitle')}</strong>
        <p style={{ marginBottom: 0 }}>
          {t('settingsUi.org.whyBody')}
        </p>
      </div>

      <div className="field-row">
        <Field label={t('settingsUi.org.name')} required>
          <input className="input" disabled={!canEdit} value={form.org_name || ''}
            onChange={(e) => setForm((f) => ({ ...f, org_name: e.target.value }))} />
        </Field>
        <Field label={t('settingsUi.org.type')}>
          <input className="input" disabled={!canEdit} value={form.org_type || ''} placeholder={t('settingsUi.org.typePlaceholder')}
            onChange={(e) => setForm((f) => ({ ...f, org_type: e.target.value }))} />
        </Field>
        <Field label={t('settingsUi.org.industry')}>
          <input className="input" disabled={!canEdit} value={form.industry || ''} placeholder={t('settingsUi.org.industryPlaceholder')}
            onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} />
        </Field>
      </div>

      <div className="field-row">
        <Field label={t('settingsUi.org.size')}>
          <input className="input" disabled={!canEdit} value={form.size || ''} placeholder={t('settingsUi.org.sizePlaceholder')}
            onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))} />
        </Field>
        <Field label={t('settingsUi.org.country')}>
          <input className="input" disabled={!canEdit} value={form.country || ''}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
        </Field>
        <Field label={t('settingsUi.org.riskAppetite')}>
          <input className="input" disabled={!canEdit} value={form.risk_appetite || ''} placeholder={t('settingsUi.org.riskAppetitePlaceholder')}
            onChange={(e) => setForm((f) => ({ ...f, risk_appetite: e.target.value }))} />
        </Field>
      </div>

      <Field label={t('settingsUi.org.operatingModel')} hint={t('settingsUi.org.operatingModelHint')}>
        <input className="input" disabled={!canEdit} value={form.operating_model || ''}
          placeholder={t('settingsUi.org.operatingModelPlaceholder')}
          onChange={(e) => setForm((f) => ({ ...f, operating_model: e.target.value }))} />
      </Field>

      <div className="field-row">
        <Field label={t('settingsUi.org.regulators')} hint={t('settingsUi.org.onePerLine')}>
          <textarea className="textarea" disabled={!canEdit} value={listField('regulators')}
            onChange={(e) => setList('regulators', e.target.value)} />
        </Field>
        <Field label={t('settingsUi.org.technologyEnv')} hint={t('settingsUi.org.technologyEnvHint')}>
          <textarea className="textarea" disabled={!canEdit} value={listField('technology_env')}
            onChange={(e) => setList('technology_env', e.target.value)} />
        </Field>
        <Field label={t('settingsUi.org.dataClassifications')}
          hint={t('settingsUi.org.dataClassificationsHint')}>
          <textarea className="textarea" disabled={!canEdit} value={listField('data_classifications')}
            onChange={(e) => setList('data_classifications', e.target.value)} />
        </Field>
      </div>

      <div className="field-row">
        <Field label={t('settingsUi.org.otLevel')}
          hint={t('settingsUi.org.otLevelHint')}>
          <Select value={form.ot_facility_level || ''} disabled={!canEdit} placeholder={t('settingsUi.org.notSet')}
            onChange={(v) => setForm((f) => ({ ...f, ot_facility_level: v || null }))}
            options={[
              { value: 'L1', label: t('settingsUi.org.otL1') },
              { value: 'L2', label: t('settingsUi.org.otL2') },
              { value: 'L3', label: t('settingsUi.org.otL3') }
            ]} />
        </Field>
        <Field label={t('settingsUi.org.cloudRole')}
          hint={t('settingsUi.org.cloudRoleHint')}>
          <div className="checkbox-row">
            {[['CSP', t('settingsUi.org.cloudCsp')], ['CST', t('settingsUi.org.cloudCst')]].map(([value, label]) => {
              const selected = (form.cloud_roles || []).includes(value);
              return (
                <label key={value} className={`checkbox-chip ${selected ? 'on' : ''}`}>
                  <input type="checkbox" checked={selected} disabled={!canEdit}
                    onChange={(e) => setForm((f) => {
                      const current = new Set(f.cloud_roles || []);
                      if (e.target.checked) current.add(value); else current.delete(value);
                      return { ...f, cloud_roles: [...current] };
                    })} />
                  {label}
                </label>
              );
            })}
          </div>
        </Field>
      </div>

      <Field label={t('settingsUi.org.businessRequirements')} hint={t('settingsUi.org.businessRequirementsHint')}>
        <textarea className="textarea" disabled={!canEdit} value={form.business_requirements || ''}
          onChange={(e) => setForm((f) => ({ ...f, business_requirements: e.target.value }))} />
      </Field>

      <div className="divider" />
      <h4>{t('settingsUi.org.accessPolicy')}</h4>
      <Field label={t('settingsUi.org.mfaRoles')}
        hint={t('settingsUi.org.mfaRolesHint')}>
        <div className="checkbox-row">
          {ROLE_OPTIONS.map((role) => {
            const selected = (form.mfa_required_roles || []).includes(role.value);
            return (
              <label key={role.value} className={`checkbox-chip ${selected ? 'on' : ''}`}>
                <input type="checkbox" checked={selected} disabled={!canEdit}
                  onChange={(e) => setForm((f) => {
                    const current = new Set(f.mfa_required_roles || []);
                    if (e.target.checked) current.add(role.value); else current.delete(role.value);
                    return { ...f, mfa_required_roles: [...current] };
                  })} />
                {labels.role(role.value)}
              </label>
            );
          })}
        </div>
      </Field>
      {canEdit && (form.mfa_required_roles || []).length === 0 && (
        <p className="tiny" style={{ color: 'var(--warn)' }}>
          {t('settingsUi.org.noMfaRoles')}
        </p>
      )}

      {canEdit && (
        <div>
          <button className="btn btn-primary" onClick={async () => {
            try {
              await api.put('/admin/org', form);
              await refreshOrg();
              toast.success(t('settingsUi.org.saved'));
              reload();
            } catch (err) { toast.error(t('settingsUi.couldNotSave'), err.message); }
          }}><IconCheck width={13} height={13} />{t('settingsUi.org.saveProfile')}</button>
        </div>
      )}

      <ApplicableFrameworks canEdit={canEdit} current={form.applicable_frameworks || []} onSaved={reload} />
    </div>
  );
}

/* ------------------------------------------------ applicable frameworks -- */

/**
 * The sources every generated package cites.
 *
 * Kept as its own section with its own save, because it is answered once at
 * setup and rarely changed, and because changing it changes what every future
 * document claims compliance with — which is not a thing to alter incidentally
 * while editing an address.
 */
function ApplicableFrameworks({ canEdit, current, onSaved }) {
  const t = useT();
  const toast = useToast();
  const { refreshOrg } = useAuth();
  const { data, loading, error, reload } = useFetch('/frameworks');
  const [selected, setSelected] = useState(current);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setSelected(current); }, [current.join(',')]);

  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const changed = selected.slice().sort().join(',') !== current.slice().sort().join(',');

  return (
    <Card title={t('settingsUi.frameworks.title')}
      subtitle={t('settingsUi.frameworks.subtitle')}>
      <FrameworkPicker frameworks={data.items} selected={selected} onChange={setSelected} disabled={!canEdit || busy} />
      {!selected.length && (
        <p className="tiny" style={{ color: 'var(--warn)' }}>
          {t('settingsUi.frameworks.noneSelected')}
        </p>
      )}
      {canEdit && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-primary" disabled={busy || !changed} onClick={async () => {
            setBusy(true);
            try {
              await api.put('/admin/org/frameworks', { codes: selected });
              await refreshOrg();
              toast.success(t('settingsUi.frameworks.saved'));
              onSaved?.();
            } catch (err) { toast.error(t('settingsUi.couldNotSave'), err.message); }
            finally { setBusy(false); }
          }}><IconCheck width={13} height={13} />{t('settingsUi.frameworks.save')}</button>
          {changed && <span className="tiny muted">{t('settingsUi.frameworks.changedNote')}</span>}
        </div>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------- users */

function UserSettings() {
  const t = useT();
  const labels = useLabels();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch('/admin/users');
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'cyber_user', job_title: '', password: '' });
  // Returned once by the reset endpoint; never stored anywhere it can be read again.
  const [temporaryPassword, setTemporaryPassword] = useState(null);

  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  return (
    <div className="stack">
      <div className="between">
        <div>
          <h3>{t('settingsUi.users.title')}</h3>
          <p className="small muted" style={{ marginBottom: 0 }}>
            {t('settingsUi.users.subtitle')}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}><IconPlus />{t('settingsUi.users.addUser')}</button>
      </div>

      <Card flush>
        <DataTable
          columns={[
            { key: 'name', header: t('settingsUi.users.colUser'), render: (u) => (<><div className="cell-title">{u.name}</div><div className="cell-sub">{u.email}</div></>) },
            { key: 'job_title', header: t('settingsUi.users.colJobTitle'), render: (u) => u.job_title || <span className="muted">—</span> },
            { key: 'role', header: t('settingsUi.users.colRole'), nowrap: true, render: (u) => <Badge tone={u.role === 'admin' ? 'critical' : 'info'}>{labels.role(u.role, u.role_label)}</Badge> },
            { key: 'permissions', header: t('settingsUi.users.colPermissions'), align: 'right' },
            {
              key: 'status', header: t('settingsUi.users.colStatus'), nowrap: true,
              render: (u) => u.locked_until && new Date(u.locked_until) > new Date()
                ? <Badge tone="danger"><IconLock width={11} height={11} />{t('settingsUi.users.locked')}</Badge>
                : <Badge tone={u.status === 'active' ? 'ok' : 'neutral'}>{u.status === 'active' ? t('settingsUi.users.statusActive') : u.status === 'suspended' ? t('settingsUi.users.statusSuspended') : labels.humanise(u.status)}</Badge>
            },
            {
              key: 'mfa_enabled', header: t('settingsUi.users.colTwoStep'), nowrap: true,
              render: (u) => (u.mfa_enabled
                ? <Badge tone="ok" dot title={t('settingsUi.users.enrolledOn', { date: formatDate(u.mfa_enrolled_at) })}>{t('settingsUi.on')}</Badge>
                : <Badge tone="neutral">{t('settingsUi.off')}</Badge>)
            },
            { key: 'last_login_at', header: t('settingsUi.users.colLastSignIn'), nowrap: true, render: (u) => u.last_login_at ? <span className="small">{relativeTime(u.last_login_at)}</span> : <span className="muted">{t('settingsUi.users.never')}</span> }
          ]}
          rows={data.items}
          onRowClick={(u) => { setEditing(u); setTemporaryPassword(null); }}
        />
      </Card>

      <Card title={t('settingsUi.users.matrixTitle')} subtitle={t('settingsUi.users.matrixSubtitle')} flush>
        <div className="table-wrap" style={{ maxHeight: 420, overflow: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>{t('settingsUi.users.permission')}</th>
                {data.roles.map((r) => <th key={r.value} className="center" style={{ minWidth: 92 }}>{labels.role(r.value, r.label)}</th>)}
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

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('settingsUi.users.addUser')}
        footer={
          <>
            <button className="btn" onClick={() => setAddOpen(false)}>{t('settingsUi.cancel')}</button>
            <button className="btn btn-primary" onClick={async () => {
              try {
                await api.post('/admin/users', form);
                toast.success(t('settingsUi.users.created'), t('settingsUi.users.createdBody', { email: form.email }));
                setAddOpen(false);
                setForm({ name: '', email: '', role: 'cyber_user', job_title: '', password: '' });
                reload();
              } catch (err) {
                toast.error(t('settingsUi.users.createFailed'), Array.isArray(err.payload?.detail) ? err.payload.detail.join(' ') : err.message);
              }
            }}>{t('settingsUi.users.createUser')}</button>
          </>
        }>
        <div className="field-row">
          <Field label={t('settingsUi.users.fullName')} required>
            <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label={t('settingsUi.users.email')} required>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
        </div>
        <div className="field-row">
          <Field label={t('settingsUi.users.colJobTitle')}>
            <input className="input" value={form.job_title} onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))} />
          </Field>
          <Field label={t('settingsUi.users.colRole')} required>
            <Select value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))}
              options={data.roles.map((r) => ({ value: r.value, label: labels.role(r.value, r.label) }))} />
          </Field>
        </div>
        <Field label={t('settingsUi.users.initialPassword')} required
          hint={t('settingsUi.users.initialPasswordHint')}>
          <input className="input" type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
        </Field>
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing ? t('settingsUi.users.editTitle', { name: editing.name }) : ''}
        footer={
          editing && (
            <>
              {editing.locked_until && new Date(editing.locked_until) > new Date() && (
                <button className="btn" style={{ marginInlineEnd: 'auto' }} onClick={async () => {
                  await api.post(`/admin/users/${editing.id}/unlock`);
                  toast.success(t('settingsUi.users.unlocked'));
                  setEditing(null);
                  reload();
                }}><IconLock width={13} height={13} />{t('settingsUi.users.unlock')}</button>
              )}
              <button className="btn" onClick={() => setEditing(null)}>{t('settingsUi.cancel')}</button>
              <button className="btn btn-primary" onClick={async () => {
                try {
                  await api.patch(`/admin/users/${editing.id}`, {
                    name: editing.name, role: editing.role, job_title: editing.job_title,
                    status: editing.status, ...(editing.newPassword ? { password: editing.newPassword } : {})
                  });
                  toast.success(t('settingsUi.users.updated'));
                  setEditing(null);
                  reload();
                } catch (err) {
                  toast.error(t('settingsUi.users.updateFailed'), Array.isArray(err.payload?.detail) ? err.payload.detail.join(' ') : err.message);
                }
              }}>{t('settingsUi.users.saveChanges')}</button>
            </>
          )
        }>
        {editing && (
          <>
            {temporaryPassword && (
              <div className="callout" data-callout="warn" style={{ marginBottom: 14 }}>
                <div className="row-tight">
                  <IconAlert width={14} height={14} />
                  <strong style={{ margin: 0 }}>{t('settingsUi.users.tempPasswordTitle')}</strong>
                </div>
                <p style={{ marginTop: 6, marginBottom: 6 }}>
                  {t('settingsUi.users.tempPasswordBody', { name: editing.name })}
                </p>
                <code className="temp-password">{temporaryPassword}</code>
                <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => {
                  navigator.clipboard?.writeText(temporaryPassword)
                    .then(() => toast.success(t('settingsUi.copied')))
                    .catch(() => toast.error(t('settingsUi.couldNotCopy'), t('settingsUi.users.copyPasswordManually')));
                }}><IconCopy width={13} height={13} />{t('settingsUi.copy')}</button>
              </div>
            )}

            <div className="field-row">
              <Field label={t('settingsUi.users.fullName')}>
                <input className="input" value={editing.name} onChange={(e) => setEditing((u) => ({ ...u, name: e.target.value }))} />
              </Field>
              <Field label={t('settingsUi.users.colJobTitle')}>
                <input className="input" value={editing.job_title || ''} onChange={(e) => setEditing((u) => ({ ...u, job_title: e.target.value }))} />
              </Field>
            </div>
            <div className="field-row">
              <Field label={t('settingsUi.users.colRole')}>
                <Select value={editing.role} onChange={(v) => setEditing((u) => ({ ...u, role: v }))}
                  options={data.roles.map((r) => ({ value: r.value, label: labels.role(r.value, r.label) }))} />
              </Field>
              <Field label={t('settingsUi.users.colStatus')} hint={t('settingsUi.users.statusHint')}>
                <Select value={editing.status} onChange={(v) => setEditing((u) => ({ ...u, status: v }))}
                  options={[{ value: 'active', label: t('settingsUi.users.statusActive') }, { value: 'suspended', label: t('settingsUi.users.statusSuspended') }]} />
              </Field>
            </div>
            <Field label={t('settingsUi.users.setPassword')}
              hint={t('settingsUi.users.setPasswordHint')}>
              <input className="input" type="text" value={editing.newPassword || ''}
                onChange={(e) => setEditing((u) => ({ ...u, newPassword: e.target.value }))} />
            </Field>

            <div className="divider" />
            <h4>{t('settingsUi.users.recovery')}</h4>
            <p className="small muted">
              {t('settingsUi.users.recoveryBody')}
            </p>
            <div className="row-tight" style={{ marginTop: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-sm" onClick={async () => {
                try {
                  const res = await api.post(`/admin/users/${editing.id}/reset-password`);
                  setTemporaryPassword(res.temporaryPassword);
                  toast.success(t('settingsUi.users.passwordReset'), t('settingsUi.users.passwordResetBody'));
                  reload();
                } catch (err) { toast.error(t('settingsUi.users.resetFailed'), err.message); }
              }}><IconRefresh width={13} height={13} />{t('settingsUi.users.issueTempPassword')}</button>

              {editing.mfa_enabled && (
                <button className="btn btn-sm btn-danger-ghost" onClick={async () => {
                  try {
                    const res = await api.post(`/admin/users/${editing.id}/reset-mfa`);
                    toast.success(t('settingsUi.users.mfaRemoved'), res.message);
                    setEditing((u) => ({ ...u, mfa_enabled: 0 }));
                    reload();
                  } catch (err) { toast.error(t('settingsUi.users.mfaRemoveFailed'), err.message); }
                }}><IconShield width={13} height={13} />{t('settingsUi.users.removeMfa')}</button>
              )}
            </div>
            {editing.mfa_enabled && (
              <p className="tiny muted" style={{ marginTop: 8 }}>
                {t('settingsUi.users.removeMfaNote')}
              </p>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ account */

/**
 * Two-step verification for the signed-in account. A role the organisation has
 * made mandatory cannot switch it off here: the server refuses, and so does
 * this, rather than offering a button that returns a 403.
 */
function MfaPanel() {
  const t = useT();
  const labels = useLabels();
  const toast = useToast();
  const { applySession } = useAuth();
  const { data, loading, reload } = useFetch('/auth/mfa/status');
  const [enrolling, setEnrolling] = useState(false);
  const [password, setPassword] = useState('');
  const [newCodes, setNewCodes] = useState(null);

  if (loading || !data) return <Card title={t('settingsUi.mfa.title')}><Loading /></Card>;

  if (enrolling) {
    return (
      <div>
        <EnrolMfa embedded onDone={() => { setEnrolling(false); reload(); }} />
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => { setEnrolling(false); reload(); }}>
          {t('settingsUi.cancel')}
        </button>
      </div>
    );
  }

  return (
    <Card title={t('settingsUi.mfa.title')}
      subtitle={t('settingsUi.mfa.subtitle')}
      actions={data.enabled
        ? <Badge tone="ok" dot>{t('settingsUi.on')}</Badge>
        : <Badge tone={data.required ? 'danger' : 'warn'}>{data.required ? t('settingsUi.mfa.required') : t('settingsUi.off')}</Badge>}>

      {!data.enabled && (
        <>
          <p className="small">
            {data.required
              ? t('settingsUi.mfa.requiredBody', { roles: data.requiredRoles.map((r) => labels.role(r, titleCase(r))).join(t('settingsUi.listSeparator')) })
              : t('settingsUi.mfa.recommendedBody')}
          </p>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={() => setEnrolling(true)}>
            <IconShield width={13} height={13} />{t('settingsUi.mfa.setUp')}
          </button>
        </>
      )}

      {data.enabled && (
        <div className="stack">
          <dl className="definition">
            <dt>{t('settingsUi.mfa.enrolled')}</dt><dd>{formatDate(data.enrolledAt, { withTime: true })}</dd>
            <dt>{t('settingsUi.mfa.codesLeft')}</dt>
            <dd>
              <Badge tone={data.recoveryCodesRemaining > 2 ? 'neutral' : 'warn'}>
                {t('settingsUi.mfa.codesOfTen', { count: data.recoveryCodesRemaining })}
              </Badge>
            </dd>
            <dt>{t('settingsUi.mfa.mandatory')}</dt><dd>{data.required ? t('settingsUi.yes') : t('settingsUi.no')}</dd>
          </dl>

          {newCodes && (
            <div>
              <div className="callout" data-callout="warn">
                <div className="row-tight"><IconAlert width={14} height={14} /><strong style={{ margin: 0 }}>{t('settingsUi.mfa.newCodesWarning')}</strong></div>
              </div>
              <ul className="recovery-codes" style={{ marginTop: 10 }}>{newCodes.map((c) => <li key={c}>{c}</li>)}</ul>
              <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => {
                navigator.clipboard?.writeText(newCodes.join('\n')).then(() => toast.success(t('settingsUi.copied'))).catch(() => {});
              }}><IconCopy width={13} height={13} />{t('settingsUi.copyAll')}</button>
            </div>
          )}

          <Field label={t('settingsUi.mfa.password')} hint={t('settingsUi.mfa.passwordHint')}>
            <input className="input" type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} style={{ maxWidth: 320 }} />
          </Field>
          <div className="row-tight">
            <button className="btn btn-sm" disabled={!password} onClick={async () => {
              try {
                const res = await api.post('/auth/mfa/recovery-codes', { password });
                setNewCodes(res.recoveryCodes);
                setPassword('');
                reload();
              } catch (err) { toast.error(t('settingsUi.mfa.regenerateFailed'), err.message); }
            }}><IconRefresh width={13} height={13} />{t('settingsUi.mfa.newCodes')}</button>

            {!data.required && (
              <button className="btn btn-sm btn-danger-ghost" disabled={!password} onClick={async () => {
                try {
                  const res = await api.post('/auth/mfa/disable', { password });
                  applySession(res);
                  setPassword('');
                  toast.success(t('settingsUi.mfa.turnedOff'));
                  reload();
                } catch (err) { toast.error(t('settingsUi.mfa.turnOffFailed'), err.message); }
              }}>{t('settingsUi.mfa.turnOff')}</button>
            )}
          </div>
          {data.required && (
            <p className="tiny muted">
              {t('settingsUi.mfa.requiredNote', { roles: data.requiredRoles.map((r) => labels.role(r, titleCase(r))).join(t('settingsUi.listSeparator')) })}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function AccountSettings({ user }) {
  const t = useT();
  const labels = useLabels();
  const toast = useToast();
  const { logout } = useAuth();
  const { data: sessions, reload } = useFetch('/auth/sessions');
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });

  return (
    <div className="stack">
      <Card title={t('settingsUi.account.title')}>
        <dl className="definition">
          <dt>{t('settingsUi.account.name')}</dt><dd>{user.name}</dd>
          <dt>{t('settingsUi.users.email')}</dt><dd>{user.email}</dd>
          <dt>{t('settingsUi.users.colRole')}</dt><dd><Badge tone="info">{labels.role(user.role, user.roleLabel)}</Badge></dd>
          <dt>{t('settingsUi.users.colJobTitle')}</dt><dd>{user.jobTitle || '—'}</dd>
          <dt>{t('settingsUi.users.colLastSignIn')}</dt><dd>{user.lastLoginAt ? formatDate(user.lastLoginAt, { withTime: true }) : '—'}</dd>
        </dl>
      </Card>

      <MfaPanel />

      <Card title={t('settingsUi.account.changePassword')}
        subtitle={t('settingsUi.account.changePasswordSubtitle')}>
        <div className="field-row">
          <Field label={t('settingsUi.account.currentPassword')}>
            <input className="input" type="password" autoComplete="current-password" value={form.currentPassword}
              onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))} />
          </Field>
          <Field label={t('settingsUi.account.newPassword')} hint={t('settingsUi.account.newPasswordHint')}>
            <input className="input" type="password" autoComplete="new-password" value={form.newPassword}
              onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))} />
          </Field>
          <Field label={t('settingsUi.account.confirmPassword')}
            error={form.confirm && form.confirm !== form.newPassword ? t('settingsUi.account.mismatch') : null}>
            <input className="input" type="password" autoComplete="new-password" value={form.confirm}
              onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} />
          </Field>
        </div>
        <button className="btn btn-primary"
          disabled={!form.currentPassword || !form.newPassword || form.newPassword !== form.confirm}
          onClick={async () => {
            try {
              await api.post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
              toast.success(t('settingsUi.account.passwordChanged'), t('settingsUi.account.signInAgain'));
              setTimeout(() => logout(), 1200);
            } catch (err) {
              toast.error(t('settingsUi.account.changeFailed'), Array.isArray(err.payload?.detail) ? err.payload.detail.join(' ') : err.message);
            }
          }}><IconLock width={13} height={13} />{t('settingsUi.account.changePassword')}</button>
      </Card>

      <Card title={t('settingsUi.account.sessions')} flush
        actions={
          <button className="btn btn-sm" onClick={async () => {
            await api.del('/auth/sessions');
            toast.success(t('settingsUi.account.sessionsRevoked'), t('settingsUi.account.sessionsRevokedBody'));
            setTimeout(() => logout(), 1000);
          }}>{t('settingsUi.account.revokeAll')}</button>
        }>
        <DataTable
          columns={[
            { key: 'user_agent', header: t('settingsUi.account.colDevice'), render: (s) => <span className="small clamp-2">{s.user_agent || t('settingsUi.account.unknown')}</span> },
            { key: 'ip', header: t('settingsUi.account.colAddress'), nowrap: true, render: (s) => <span className="mono small">{s.ip || '—'}</span> },
            { key: 'created_at', header: t('settingsUi.account.colStarted'), nowrap: true, render: (s) => <span className="small">{formatDate(s.created_at, { withTime: true })}</span> },
            { key: 'last_seen_at', header: t('settingsUi.account.colLastSeen'), nowrap: true, render: (s) => <span className="small">{relativeTime(s.last_seen_at)}</span> },
            { key: 'revoked_at', header: t('settingsUi.account.colState'), nowrap: true, render: (s) => s.revoked_at ? <Badge tone="neutral">{t('settingsUi.account.revoked')}</Badge> : <Badge tone="ok">{t('settingsUi.account.active')}</Badge> }
          ]}
          rows={sessions || []}
          empty={<Empty title={t('settingsUi.account.noSessions')} />}
        />
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- audit log */

function AuditLog() {
  const t = useT();
  const labels = useLabels();
  const { language } = labels;
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState('');
  const [action, setAction] = useState('');
  const { data, loading, error, reload } = useFetch(`/admin/audit${qs({ search, outcome, action, limit: 200 })}`);
  const outcomeLabel = (value) => ({
    success: t('settingsUi.audit.outcomeSuccess'),
    denied: t('settingsUi.audit.outcomeDenied'),
    failure: t('settingsUi.audit.outcomeFailure')
  }[value] || titleCase(value));

  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  return (
    <div className="stack">
      <div>
        <h3>{t('settingsUi.tabs.audit')}</h3>
        <p className="small muted" style={{ marginBottom: 0 }}>
          {t('settingsUi.audit.subtitle')}
        </p>
      </div>

      <Card flush>
        <div className="table-toolbar">
          <div className="search-box"><SearchInput value={search} onChange={setSearch} placeholder={t('settingsUi.audit.search')} /></div>
          <Select value={action} onChange={setAction} placeholder={t('settingsUi.audit.allActions')}
            options={(data.facets.actions || []).map((a) => ({ value: a.action, label: `${a.action} (${a.n})` }))} />
          <Select value={outcome} onChange={setOutcome} placeholder={t('settingsUi.audit.allOutcomes')}
            options={(data.facets.outcomes || []).map((o) => ({ value: o.outcome, label: `${outcomeLabel(o.outcome)} (${o.n})` }))} />
          {(search || outcome || action) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setOutcome(''); setAction(''); }}>
              <IconX width={13} height={13} />{t('settingsUi.audit.clear')}
            </button>
          )}
          <span className="table-count">{t('settingsUi.audit.countOf', { shown: data.items.length, total: data.total })}</span>
        </div>
        <DataTable
          columns={[
            { key: 'at', header: t('settingsUi.audit.colWhen'), nowrap: true, render: (r) => <span className="small">{formatDate(r.at, { withTime: true })}</span> },
            { key: 'user_email', header: t('settingsUi.audit.colActor'), nowrap: true, render: (r) => <span className="small">{r.user_email || t('settingsUi.audit.systemActor')}</span> },
            { key: 'action', header: t('settingsUi.audit.colAction'), nowrap: true, render: (r) => <span className="mono small">{r.action}</span> },
            { key: 'summary', header: t('settingsUi.audit.colSummary'), render: (r) => (r.summary ? <span title={language === 'ar' ? r.summary : undefined}>{labels.activity(r)}</span> : '—') },
            {
              key: 'outcome', header: t('settingsUi.audit.colOutcome'), nowrap: true,
              render: (r) => <Badge tone={r.outcome === 'success' ? 'ok' : r.outcome === 'denied' ? 'danger' : 'warn'}>{outcomeLabel(r.outcome)}</Badge>
            }
          ]}
          rows={data.items}
          empty={<Empty icon={IconHistory} title={t('settingsUi.audit.empty')} />}
        />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------- system */

function SystemStatus() {
  const t = useT();
  const { data, loading, error, reload } = useFetch('/admin/system');
  const countLabel = (key) => ({
    users: t('settingsUi.system.countUsers'),
    documents: t('settingsUi.system.countDocuments'),
    controls: t('settingsUi.system.countControls'),
    evidence: t('settingsUi.system.countEvidence'),
    findings: t('settingsUi.system.countFindings'),
    auditEntries: t('settingsUi.system.countAuditEntries')
  }[key] || titleCase(key.replace(/([A-Z])/g, ' $1')));
  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  return (
    <div className="stack">
      <Card title={t('settingsUi.system.aiProvider')}>
        <div className="row-tight" style={{ marginBottom: 8 }}>
          <IconSparkles width={16} height={16} style={{ color: 'var(--accent)' }} />
          <span className="strong">{data.ai.provider === 'anthropic' ? `Claude — ${data.ai.model}` : t('settingsUi.system.builtInEngine')}</span>
          <Badge tone={data.ai.configured ? 'ok' : 'neutral'}>{data.ai.configured ? t('settingsUi.system.apiConfigured') : t('settingsUi.system.offline')}</Badge>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>{data.ai.description}</p>
      </Card>

      <Card title={t('settingsUi.system.knowledgeBase')}>
        <dl className="definition">
          <dt>{t('settingsUi.system.domains')}</dt><dd>{data.knowledgeBase.domains}</dd>
          <dt>{t('settingsUi.system.frameworks')}</dt><dd>{data.knowledgeBase.frameworks}</dd>
          <dt>{t('settingsUi.system.frameworkRequirements')}</dt><dd>{data.knowledgeBase.frameworkRequirements}</dd>
          <dt>{t('settingsUi.system.crosswalks')}</dt><dd>{data.knowledgeBase.crosswalks}</dd>
          <dt>{t('settingsUi.system.integrity')}</dt>
          <dd>
            {data.knowledgeBase.integrityProblems.length === 0
              ? <Badge tone="ok"><IconCheck width={11} height={11} />{t('settingsUi.system.noProblems')}</Badge>
              : <Badge tone="danger"><IconAlert width={11} height={11} />{t('settingsUi.system.problems', { count: data.knowledgeBase.integrityProblems.length })}</Badge>}
          </dd>
        </dl>
        {data.knowledgeBase.integrityProblems.length > 0 && (
          <div className="callout" data-callout="danger" style={{ marginTop: 12 }}>
            <strong>{t('settingsUi.system.integrityProblems')}</strong>
            <ul style={{ marginBottom: 0, paddingInlineStart: 18 }}>
              {data.knowledgeBase.integrityProblems.slice(0, 10).map((p, i) => <li key={i} className="small">{p}</li>)}
            </ul>
          </div>
        )}
      </Card>

      <Card title={t('settingsUi.system.platformData')}>
        <div className="grid grid-4">
          {Object.entries(data.counts).map(([key, value]) => (
            <div key={key}>
              <div className="kpi-label">{countLabel(key)}</div>
              <div className="strong" style={{ fontSize: 20 }}>{value.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
