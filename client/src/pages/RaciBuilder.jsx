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

const VALUES = ['', 'R', 'A', 'S', 'C', 'I'];
const LEGEND = {
  R: 'Responsible — performs the activity.',
  A: 'Accountable — answerable for the outcome. Exactly one per activity.',
  S: 'Support — provides resources or assistance.',
  C: 'Consulted — provides input before the activity completes.',
  I: 'Informed — told of the outcome.'
};

export default function RaciBuilder() {
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

  if (loading) return <Loading label="Loading matrix…" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <Empty title="Matrix not found" />;

  const { matrix, columns, activities, grid, validation } = data;
  const editable = can('raci:write');
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
      toast.error('Could not update the assignment', err.message);
      reload();
    }
  }

  return (
    <>
      <div className="breadcrumb">
        <Link to="/raci">RACI Matrices</Link><IconChevronRight width={12} height={12} /><span>{matrix.name}</span>
      </div>

      <div className="page-head">
        <div className="page-head-text">
          <div className="row-tight" style={{ marginBottom: 5 }}>
            <Badge tone="neutral">{matrix.mode.toUpperCase()}</Badge>
            {matrix.domain_label && <Badge tone="info">{matrix.domain_label}</Badge>}
            {validation.length === 0
              ? <Badge tone="ok"><IconCheck width={11} height={11} />Valid</Badge>
              : <Badge tone="danger"><IconAlert width={11} height={11} />{validation.length} issue{validation.length === 1 ? '' : 's'}</Badge>}
          </div>
          <h1 className="page-title">{matrix.name}</h1>
          <p className="page-sub">
            {editable
              ? 'Click a cell to cycle through the assignment values. Changes save immediately and the matrix revalidates.'
              : 'Read-only view. Your role cannot modify responsibility assignments.'}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => api.download(`/export/raci/${id}.xlsx`, `${matrix.name}.xlsx`)
            .then(() => toast.success('Exported')).catch((e) => toast.error('Export failed', e.message))}>
            <IconDownload />Export
          </button>
          {editable && (
            <>
              <button className="btn" onClick={() => setAddRole(true)}><IconPlus />Add role</button>
              <button className="btn btn-primary" onClick={() => setAddActivity(true)}><IconPlus />Add activity</button>
            </>
          )}
        </div>
      </div>

      {validation.length > 0 && (
        <Card title="Validation findings" subtitle="Structural problems in the responsibility assignment." style={{ marginBottom: 14 }}>
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
              .map(([k, label]) => (
                <span key={k} className="raci-legend-item" title={label}>
                  <span className="raci-key" style={{
                    background: { A: '#D6E4F2', R: '#DDEEDB', S: '#F3E8D6', C: '#F0EEDA', I: '#ECEFF3' }[k],
                    color: { A: '#17395E', R: '#1F5B2E', S: '#7A5312', C: '#6A5E12', I: '#4C5A68' }[k]
                  }}>{k}</span>
                  <span className="tiny">{label.split(' — ')[0]}</span>
                </span>
              ))}
          </div>
          <span className="table-count">{activities.length} activities · {columns.length} roles</span>
        </div>

        {activities.length && columns.length ? (
          <div className="raci-scroll">
            <table className="raci">
              <thead>
                <tr>
                  <th className="col-activity">Activity</th>
                  <th className="col-phase">Phase</th>
                  {columns.map((c) => (
                    <th key={c.id} title={c.role_name || c.label}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <span>{c.label}</span>
                        {editable && (
                          <button className="btn btn-ghost btn-icon btn-sm" title={`Remove ${c.label}`}
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
                          <button className="btn btn-ghost btn-icon btn-sm" title="Remove activity"
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
                            title={v ? LEGEND[v] : `Assign ${c.label} to “${a.activity}”`}
                            aria-label={`${c.label} for ${a.activity}: ${v || 'not assigned'}`}>
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
            <Empty title="The matrix is empty"
              action={editable ? <button className="btn btn-primary btn-sm" onClick={() => setAddActivity(true)}><IconPlus />Add the first activity</button> : null}>
              Add role columns and activity rows, then assign responsibility.
            </Empty>
          </div>
        )}
      </Card>

      <Modal open={addActivity} onClose={() => setAddActivity(false)} title="Add activity"
        footer={
          <>
            <button className="btn" onClick={() => setAddActivity(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={!activityForm.activity.trim()} onClick={async () => {
              try {
                setData(await api.post(`/raci/${id}/activities`, activityForm));
                setActivityForm({ activity: '', phase: '' });
                setAddActivity(false);
                toast.success('Activity added');
              } catch (err) { toast.error('Could not add activity', err.message); }
            }}>Add</button>
          </>
        }>
        <Field label="Activity" required hint="Describe an activity, not an outcome — for example “Approve privileged access requests”.">
          <input className="input" autoFocus value={activityForm.activity}
            onChange={(e) => setActivityForm((f) => ({ ...f, activity: e.target.value }))} />
        </Field>
        <Field label="Phase" hint="Optional grouping, e.g. Govern, Protect, Detect, Respond, Assure.">
          <input className="input" value={activityForm.phase}
            onChange={(e) => setActivityForm((f) => ({ ...f, phase: e.target.value }))} />
        </Field>
      </Modal>

      <Modal open={addRole} onClose={() => setAddRole(false)} title="Add role column"
        footer={
          <>
            <button className="btn" onClick={() => setAddRole(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={!roleForm.label.trim()} onClick={async () => {
              try {
                setData(await api.post(`/raci/${id}/roles`, roleForm));
                setRoleForm({ label: '', role_id: '' });
                setAddRole(false);
                toast.success('Role column added');
              } catch (err) { toast.error('Could not add role', err.message); }
            }}>Add</button>
          </>
        }>
        <Field label="Link to a defined role" hint="Linking keeps the matrix connected to the role definition.">
          <Select value={roleForm.role_id} placeholder="Not linked"
            onChange={(v) => {
              const role = (roleData?.items || []).find((r) => r.id === v);
              setRoleForm({ role_id: v, label: role?.short_name || role?.name || '' });
            }}
            options={(roleData?.items || []).map((r) => ({ value: r.id, label: r.name }))} />
        </Field>
        <Field label="Column label" required hint="Kept short so the matrix stays readable.">
          <input className="input" value={roleForm.label}
            onChange={(e) => setRoleForm((f) => ({ ...f, label: e.target.value }))} />
        </Field>
      </Modal>

      <ConfirmDialog open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} danger
        title={confirmDelete?.type === 'role' ? 'Remove this role column?' : 'Remove this activity?'}
        confirmLabel="Remove"
        message={`“${confirmDelete?.label}” and all of its assignments will be removed from the matrix.`}
        onConfirm={async () => {
          try {
            const path = confirmDelete.type === 'role'
              ? `/raci/${id}/roles/${confirmDelete.id}`
              : `/raci/${id}/activities/${confirmDelete.id}`;
            setData(await api.del(path));
            toast.success('Removed');
            setConfirmDelete(null);
          } catch (err) { toast.error('Could not remove', err.message); }
        }} />
    </>
  );
}
