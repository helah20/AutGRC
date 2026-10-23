import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import {
  Card, Loading, ErrorNote, Empty, Badge, Modal, Field, Select, useToast, ConfirmDialog
} from '../components/ui.jsx';
import FindingCard from '../components/FindingCard.jsx';
import {
  IconPlus, IconDownload, IconTrash, IconAlert, IconCheck, IconChevronRight, IconX
} from '../components/Icons.jsx';
import { useLabels } from '../i18n/labels.js';
import { useI18n } from '../i18n/index.jsx';

const VALUES = ['', 'R', 'A', 'S', 'C', 'I'];
// Built per render so the legend follows the current language. `name` is the
// short label beside each key; `full` is the tooltip and cell title.
function buildLegend(t) {
  return {
    R: { name: t('raciBuilderUi.responsible'), full: t('raciBuilderUi.responsibleFull') },
    A: { name: t('raciBuilderUi.accountable'), full: t('raciBuilderUi.accountableFull') },
    S: { name: t('raciBuilderUi.support'), full: t('raciBuilderUi.supportFull') },
    C: { name: t('raciBuilderUi.consulted'), full: t('raciBuilderUi.consultedFull') },
    I: { name: t('raciBuilderUi.informed'), full: t('raciBuilderUi.informedFull') }
  };
}

export default function RaciBuilder() {
  const labels = useLabels();
  const { t, formatNumber } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const { data, loading, error, reload, setData } = useFetch(`/raci/${id}`);
  const { data: roleData } = useFetch('/roles');
  const [addActivity, setAddActivity] = useState(false);
  const [addRole, setAddRole] = useState(false);
  const [activityForm, setActivityForm] = useState({ activity: '', phase: '' });
  const [roleForm, setRoleForm] = useState({ label: '', role_id: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);

  if (loading) return <Loading label={t('raciBuilderUi.loading')} />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <Empty title={t('raciBuilderUi.notFound')} />;

  const { matrix, columns, activities, grid, validation } = data;
  const editable = can('raci:write');
  const LEGEND = buildLegend(t);
  const values = matrix.mode === 'rasci' ? VALUES : VALUES.filter((v) => v !== 'S');

  const conflictActivities = new Set(
    validation.filter((v) => v.title.includes('Multiple accountable')).map((v) => v.location)
  );

  async function cycle(activityId, colId) {
    if (!editable) return;
    const current = grid[activityId]?.[colId] || '';
    const next = values[(values.indexOf(current) + 1) % values.length];
    // Optimistic update keeps the grid responsive while the server confirms.
    setData((d) => ({
      ...d,
      grid: { ...d.grid, [activityId]: { ...(d.grid[activityId] || {}), [colId]: next } }
    }));
    try {
      const res = await api.put(`/raci/${id}/assign`, { activity_id: activityId, role_col_id: colId, value: next });
      setData(res);
    } catch (err) {
      toast.error(t('raciBuilderUi.couldNotUpdate'), err.message);
      reload();
    }
  }

  return (
    <>
      <div className="breadcrumb">
        <Link to="/raci">{t('nav.raci')}</Link><IconChevronRight width={12} height={12} /><span>{matrix.name}</span>
      </div>

      <div className="page-head">
        <div className="page-head-text">
          <div className="row-tight" style={{ marginBottom: 5 }}>
            <Badge tone="neutral">{matrix.mode.toUpperCase()}</Badge>
            {matrix.domain_label && <Badge tone="info">{labels.domain(matrix.domain_key, matrix.domain_label)}</Badge>}
            {validation.length === 0
              ? <Badge tone="ok"><IconCheck width={11} height={11} />{t('raciBuilderUi.valid')}</Badge>
              : <Badge tone="danger"><IconAlert width={11} height={11} />{t('raciBuilderUi.issues', { count: validation.length })}</Badge>}
          </div>
          <h1 className="page-title">{matrix.name}</h1>
          <p className="page-sub">
            {editable ? t('raci.editableHint') : t('raci.readOnlyHint')}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => api.download(`/export/raci/${id}.xlsx`, `${matrix.name}.xlsx`)
            .then(() => toast.success(t('common.exported'))).catch((e) => toast.error(t('common.exportFailed'), e.message))}>
            <IconDownload />{t('common.export')}
          </button>
          {editable && (
            <>
              <button className="btn" onClick={() => setAddRole(true)}><IconPlus />{t('raciBuilderUi.addRole')}</button>
              <button className="btn btn-primary" onClick={() => setAddActivity(true)}><IconPlus />{t('raciBuilderUi.addActivity')}</button>
            </>
          )}
        </div>
      </div>

      {validation.length > 0 && (
        <Card title={t('raciBuilderUi.validationTitle')} subtitle={t('raciBuilderUi.validationSubtitle')} style={{ marginBottom: 14 }}>
          <div className="stack-sm">
            {validation.map((v, i) => <FindingCard key={i} finding={v} />)}
          </div>
        </Card>
      )}

      <Card flush>
        <div className="table-toolbar">
          <div className="raci-legend">
            {Object.entries(LEGEND)
              .filter(([k]) => matrix.mode === 'rasci' || k !== 'S')
              .map(([k, entry]) => (
                <span key={k} className="raci-legend-item" title={entry.full}>
                  <span className="raci-key" style={{
                    background: { A: '#D6E4F2', R: '#DDEEDB', S: '#F3E8D6', C: '#F0EEDA', I: '#ECEFF3' }[k],
                    color: { A: '#17395E', R: '#1F5B2E', S: '#7A5312', C: '#6A5E12', I: '#4C5A68' }[k]
                  }}>{k}</span>
                  <span className="tiny">{entry.name}</span>
                </span>
              ))}
          </div>
          <span className="table-count">{t('counts.raci', { activities: formatNumber(activities.length), roles: formatNumber(columns.length) })}</span>
        </div>

        {activities.length && columns.length ? (
          <div className="raci-scroll">
            <table className="raci">
              <thead>
                <tr>
                  <th className="col-activity">{t('raciBuilderUi.activity')}</th>
                  <th className="col-phase">{t('raciBuilderUi.phase')}</th>
                  {columns.map((c) => (
                    <th key={c.id} title={c.role_name || c.label}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <span>{c.label}</span>
                        {editable && (
                          <button className="btn btn-ghost btn-icon btn-sm" title={t('raciBuilderUi.removeColumn', { label: c.label })}
                            onClick={() => setConfirmDelete({ type: 'role', id: c.id, label: c.label })}>
                            <IconX width={11} height={11} />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => (
                  <tr key={a.id}>
                    <th className="cell-activity" scope="row">
                      <div className="between" style={{ gap: 6 }}>
                        <span>{a.activity}</span>
                        {editable && (
                          <button className="btn btn-ghost btn-icon btn-sm" title={t('raciBuilderUi.removeActivity')}
                            onClick={() => setConfirmDelete({ type: 'activity', id: a.id, label: a.activity })}>
                            <IconTrash width={12} height={12} />
                          </button>
                        )}
                      </div>
                    </th>
                    <td className="cell-phase">{a.phase || '—'}</td>
                    {columns.map((c) => {
                      const v = grid[a.id]?.[c.id] || '';
                      const conflict = v === 'A' && conflictActivities.has(a.activity);
                      return (
                        <td key={c.id} className="cell-assign">
                          <button type="button" className={`raci-cell ${conflict ? 'conflict' : ''}`} data-v={v}
                            disabled={!editable} onClick={() => cycle(a.id, c.id)}
                            title={v ? LEGEND[v]?.full : t('raciBuilderUi.assignTitle', { role: c.label, activity: a.activity })}
                            aria-label={t('raciBuilderUi.cellAria', { role: c.label, activity: a.activity, value: v || t('raciBuilderUi.notAssigned') })}>
                            {v || '·'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card-body">
            <Empty title={t('raciBuilderUi.emptyTitle')}
              action={editable ? <button className="btn btn-primary btn-sm" onClick={() => setAddActivity(true)}><IconPlus />{t('raciBuilderUi.addFirstActivity')}</button> : null}>
              {t('raciBuilderUi.emptyBody')}
            </Empty>
          </div>
        )}
      </Card>

      <Modal open={addActivity} onClose={() => setAddActivity(false)} title={t('raciBuilderUi.addActivity')}
        footer={
          <>
            <button className="btn" onClick={() => setAddActivity(false)}>{t('common.cancel')}</button>
            <button className="btn btn-primary" disabled={!activityForm.activity.trim()} onClick={async () => {
              try {
                setData(await api.post(`/raci/${id}/activities`, activityForm));
                setActivityForm({ activity: '', phase: '' });
                setAddActivity(false);
                toast.success(t('raciBuilderUi.activityAdded'));
              } catch (err) { toast.error(t('raciBuilderUi.couldNotAddActivity'), err.message); }
            }}>{t('common.add')}</button>
          </>
        }>
        <Field label={t('raciBuilderUi.activity')} required hint={t('raciBuilderUi.activityHint')}>
          <input className="input" autoFocus value={activityForm.activity}
            onChange={(e) => setActivityForm((f) => ({ ...f, activity: e.target.value }))} />
        </Field>
        <Field label={t('raciBuilderUi.phase')} hint={t('raciBuilderUi.phaseHint')}>
          <input className="input" value={activityForm.phase}
            onChange={(e) => setActivityForm((f) => ({ ...f, phase: e.target.value }))} />
        </Field>
      </Modal>

      <Modal open={addRole} onClose={() => setAddRole(false)} title={t('raciBuilderUi.addRoleColumn')}
        footer={
          <>
            <button className="btn" onClick={() => setAddRole(false)}>{t('common.cancel')}</button>
            <button className="btn btn-primary" disabled={!roleForm.label.trim()} onClick={async () => {
              try {
                setData(await api.post(`/raci/${id}/roles`, roleForm));
                setRoleForm({ label: '', role_id: '' });
                setAddRole(false);
                toast.success(t('raciBuilderUi.roleColumnAdded'));
              } catch (err) { toast.error(t('raciBuilderUi.couldNotAddRole'), err.message); }
            }}>{t('common.add')}</button>
          </>
        }>
        <Field label={t('raciBuilderUi.linkRole')} hint={t('raciBuilderUi.linkRoleHint')}>
          <Select value={roleForm.role_id} placeholder={t('raciBuilderUi.notLinked')}
            onChange={(v) => {
              const role = (roleData?.items || []).find((r) => r.id === v);
              setRoleForm({ role_id: v, label: role?.short_name || role?.name || '' });
            }}
            options={(roleData?.items || []).map((r) => ({ value: r.id, label: r.name }))} />
        </Field>
        <Field label={t('raciBuilderUi.columnLabel')} required hint={t('raciBuilderUi.columnLabelHint')}>
          <input className="input" value={roleForm.label}
            onChange={(e) => setRoleForm((f) => ({ ...f, label: e.target.value }))} />
        </Field>
      </Modal>

      <ConfirmDialog open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} danger
        title={confirmDelete?.type === 'role' ? t('raciBuilderUi.confirmRemoveRole') : t('raciBuilderUi.confirmRemoveActivity')}
        confirmLabel={t('common.remove')}
        message={t('raciBuilderUi.confirmRemoveMessage', { label: confirmDelete?.label })}
        onConfirm={async () => {
          try {
            const path = confirmDelete.type === 'role'
              ? `/raci/${id}/roles/${confirmDelete.id}`
              : `/raci/${id}/activities/${confirmDelete.id}`;
            setData(await api.del(path));
            toast.success(t('raciBuilderUi.removed'));
            setConfirmDelete(null);
          } catch (err) { toast.error(t('raciBuilderUi.couldNotRemove'), err.message); }
        }} />
    </>
  );
}
