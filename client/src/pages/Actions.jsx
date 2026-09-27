import { useState, useEffect } from 'react';
import { api, qs } from '../lib/api.js';
import { useFetch, useDebounced } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import {
  Card, Loading, ErrorNote, Empty, Badge, DataTable, SearchInput, Select,
  useToast, Drawer, Field, Modal, Kpi
} from '../components/ui.jsx';
import { IconCheck, IconX, IconPlus, IconAlert } from '../components/Icons.jsx';
import { titleCase, SEVERITY_TONE, formatDate, relativeTime } from '../lib/format.js';

const STATUSES = ['open', 'in_progress', 'blocked', 'completed', 'cancelled'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

/**
 * Corrective actions. A finding used to be raised and then nothing held it:
 * this is what somebody is going to do about it, by when, and who checked.
 */
export default function Actions() {
  const toast = useToast();
  const { can, user } = useAuth();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [mine, setMine] = useState(false);
  const [overdue, setOverdue] = useState(false);
  const [selected, setSelected] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data, loading, error, reload } = useFetch(
    `/actions${qs({ search: debounced, status, priority, mine: mine || undefined, overdue: overdue || undefined, limit: 500 })}`
  );
  const { data: directory } = useFetch('/admin/directory');

  const s = data?.summary;

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">Corrective Actions</h1>
          <p className="page-sub">
            What is being done about each finding, gap and risk — with an owner, a date, and a
            verification by someone other than the person who did the work.
          </p>
        </div>
        {can('action:write') && (
          <div className="page-actions">
            <button className="btn btn-primary" onClick={() => setAddOpen(true)}><IconPlus />Raise an action</button>
          </div>
        )}
      </div>

      {s && (
        <div className="grid grid-4" style={{ marginBottom: 14 }}>
          <Kpi label="Open" value={s.open} meta="Not yet completed" onClick={() => { setStatus(''); setOverdue(false); }} />
          <Kpi label="Overdue" value={s.overdue} tone={s.overdue ? 'danger' : undefined}
            meta="Past the agreed date" onClick={() => setOverdue(true)} />
          <Kpi label="Blocked" value={s.blocked} tone={s.blocked ? 'warn' : undefined}
            meta="Waiting on something" onClick={() => setStatus('blocked')} />
          <Kpi label="Awaiting verification" value={s.completedAwaitingVerification}
            meta="Done, not yet checked" onClick={() => setStatus('completed')} />
        </div>
      )}

      <Card flush>
        <div className="table-toolbar">
          <div className="search-box"><SearchInput value={search} onChange={setSearch} placeholder="Search actions…" /></div>
          <Select value={status} onChange={setStatus} placeholder="All statuses"
            options={STATUSES.map((v) => ({ value: v, label: titleCase(v) }))} />
          <Select value={priority} onChange={setPriority} placeholder="All priorities"
            options={PRIORITIES.map((v) => ({ value: v, label: titleCase(v) }))} />
          <button className={`btn btn-sm ${mine ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMine((v) => !v)}>
            Mine{s?.mine ? ` (${s.mine})` : ''}
          </button>
          <button className={`btn btn-sm ${overdue ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setOverdue((v) => !v)}>
            Overdue
          </button>
          {(search || status || priority || mine || overdue) && (
            <button className="btn btn-ghost btn-sm" onClick={() => {
              setSearch(''); setStatus(''); setPriority(''); setMine(false); setOverdue(false);
            }}><IconX width={13} height={13} />Clear</button>
          )}
          <span className="table-count">{data ? `${data.items.length} of ${data.total}` : '—'}</span>
        </div>

        {loading && <Loading />}
        {error && <div className="card-body"><ErrorNote error={error} onRetry={reload} /></div>}
        {!loading && !error && (
          <DataTable
            columns={[
              { key: 'action_id', header: 'ID', nowrap: true, width: 96, render: (a) => <span className="ref-tag">{a.action_id}</span> },
              {
                key: 'title', header: 'Action',
                render: (a) => (<>
                  <div className="cell-title">{a.title}</div>
                  <div className="cell-sub">
                    {a.source
                      ? `${a.source.label}: ${(a.source.ref ? `${a.source.ref} — ` : '')}${(a.source.title || '').slice(0, 64)}`
                      : 'Raised directly'}
                  </div>
                </>)
              },
              { key: 'owner_name', header: 'Owner', nowrap: true, render: (a) => <span className="small">{a.owner_name || <span className="muted">Unassigned</span>}</span> },
              { key: 'priority', header: 'Priority', nowrap: true, render: (a) => <Badge tone={SEVERITY_TONE[a.priority] || 'neutral'}>{titleCase(a.priority)}</Badge> },
              {
                key: 'due_date', header: 'Due', nowrap: true,
                render: (a) => (a.overdue
                  ? <Badge tone="danger" title={`Due ${formatDate(a.due_date)}`}>Overdue</Badge>
                  : <span className="small">{formatDate(a.due_date)}</span>)
              },
              {
                key: 'progress', header: 'Progress', width: 120,
                render: (a) => (
                  <div className="meter" title={`${a.progress}%`}>
                    <span style={{ width: `${a.progress}%` }} />
                  </div>
                )
              },
              {
                key: 'status', header: 'Status', nowrap: true,
                render: (a) => (a.verified
                  ? <Badge tone="ok" dot title={`Verified by ${a.verified_by_name}`}>Verified</Badge>
                  : <Badge tone={a.status === 'blocked' ? 'warn' : a.status === 'completed' ? 'info' : 'neutral'}>{titleCase(a.status)}</Badge>)
              }
            ]}
            rows={data?.items || []}
            onRowClick={setSelected}
            empty={<Empty icon={IconCheck} title="No corrective actions">Raise one against a finding, a gap or a risk to give it an owner and a date.</Empty>}
          />
        )}
      </Card>

      <ActionDrawer action={selected} onClose={() => setSelected(null)}
        onChanged={reload} toast={toast} user={user}
        canWrite={can('action:write')} canVerify={can('action:verify')}
        directory={directory || []} />

      <RaiseAction open={addOpen} onClose={() => setAddOpen(false)} onCreated={reload}
        toast={toast} directory={directory || []} />
    </>
  );
}

/* ------------------------------------------------------------- drawer --- */

function ActionDrawer({ action, onClose, onChanged, toast, user, canWrite, canVerify, directory }) {
  const [draft, setDraft] = useState(null);
  const current = draft?.id === action?.id ? draft : action;

  // Seed the editable copy from the selected row in an effect rather than
  // during render, so the drawer has one predictable update per selection.
  useEffect(() => {
    setDraft(action ? { ...action } : null);
  }, [action]);

  async function save(patch) {
    try {
      const res = await api.patch(`/actions/${action.id}`, patch);
      setDraft({ ...res.action });
      toast.success('Action updated');
      onChanged();
    } catch (err) { toast.error('Could not update', err.message); }
  }

  async function verify() {
    try {
      const res = await api.post(`/actions/${action.id}/verify`, {});
      setDraft({ ...res.action });
      toast.success('Action verified', 'Recorded against your name.');
      onChanged();
    } catch (err) { toast.error('Could not verify', err.message); }
  }

  const ownedByMe = current?.owner_id === user?.id;

  return (
    <Drawer open={Boolean(action)} onClose={() => { setDraft(null); onClose(); }}
      title={current ? `${current.action_id} — ${current.title}` : ''}
      footer={current && (
        <>
          <button className="btn" onClick={() => { setDraft(null); onClose(); }}>Close</button>
          {canVerify && current.status === 'completed' && !current.verified && !ownedByMe && (
            <button className="btn btn-primary" onClick={verify}><IconCheck width={13} height={13} />Verify complete</button>
          )}
          {canWrite && !current.verified && (
            <button className="btn btn-primary" onClick={() => save({
              status: draft.status, progress: draft.progress, priority: draft.priority,
              due_date: draft.due_date, owner_id: draft.owner_id,
              blocked_reason: draft.blocked_reason || null
            })}><IconCheck width={13} height={13} />Save</button>
          )}
        </>
      )}>
      {current && draft && (
        <div className="stack">
          <div className="row-tight" style={{ flexWrap: 'wrap' }}>
            <Badge tone={SEVERITY_TONE[current.priority] || 'neutral'}>{titleCase(current.priority)}</Badge>
            <Badge tone={current.verified ? 'ok' : 'neutral'}>{current.verified ? 'Verified' : titleCase(current.status)}</Badge>
            {current.overdue && <Badge tone="danger">Overdue</Badge>}
          </div>

          {current.description && <p className="small">{current.description}</p>}

          <div className="definition">
            <dt>Raised</dt><dd>{formatDate(current.created_at)} ({relativeTime(current.created_at)})</dd>
            <dt>Due</dt><dd>{formatDate(current.due_date)}</dd>
            {current.completed_at && <><dt>Completed</dt><dd>{formatDate(current.completed_at)}</dd></>}
            {current.verified && <><dt>Verified</dt><dd>{current.verified_by_name} on {formatDate(current.verified_at)}</dd></>}
          </div>

          {current.verified && (
            <div className="callout" data-callout="ok">
              <p style={{ margin: 0 }}>
                This action is verified closed and cannot be changed. Raise a new one rather than reopening it.
              </p>
            </div>
          )}

          {ownedByMe && current.status === 'completed' && !current.verified && canVerify && (
            <div className="callout" data-callout="warn">
              <div className="row-tight"><IconAlert width={14} height={14} /><strong style={{ margin: 0 }}>Someone else has to verify this</strong></div>
              <p style={{ marginTop: 4, marginBottom: 0 }}>
                You own this action, so you cannot verify your own work.
              </p>
            </div>
          )}

          {canWrite && !current.verified && (
            <>
              <div className="grid grid-2">
                <Field label="Status">
                  <Select value={draft.status} onChange={(v) => setDraft((d) => ({ ...d, status: v }))}
                    options={STATUSES.map((v) => ({ value: v, label: titleCase(v) }))} />
                </Field>
                <Field label="Priority">
                  <Select value={draft.priority} onChange={(v) => setDraft((d) => ({ ...d, priority: v }))}
                    options={PRIORITIES.map((v) => ({ value: v, label: titleCase(v) }))} />
                </Field>
              </div>
              <div className="grid grid-2">
                <Field label="Owner">
                  <Select value={draft.owner_id || ''} onChange={(v) => setDraft((d) => ({ ...d, owner_id: v }))}
                    options={directory.map((u) => ({ value: u.id, label: `${u.name} — ${u.job_title || u.role}` }))} />
                </Field>
                <Field label="Due date">
                  <input className="input" type="date" value={(draft.due_date || '').slice(0, 10)}
                    onChange={(e) => setDraft((d) => ({ ...d, due_date: e.target.value }))} />
                </Field>
              </div>
              <Field label={`Progress — ${draft.progress}%`}>
                <input type="range" min={0} max={100} step={5} value={draft.progress}
                  onChange={(e) => setDraft((d) => ({ ...d, progress: Number(e.target.value) }))}
                  style={{ width: '100%' }} />
              </Field>
              {draft.status === 'blocked' && (
                <Field label="What is blocking it" hint="Required. &quot;Blocked&quot; with no reason tells the next reader nothing.">
                  <textarea className="textarea" value={draft.blocked_reason || ''}
                    onChange={(e) => setDraft((d) => ({ ...d, blocked_reason: e.target.value }))} />
                </Field>
              )}
            </>
          )}
        </div>
      )}
    </Drawer>
  );
}

/* --------------------------------------------------------------- raise --- */

function RaiseAction({ open, onClose, onCreated, toast, directory }) {
  const blank = {
    title: '', description: '', source_type: 'manual', source_id: '',
    owner_id: '', priority: 'medium', due_date: ''
  };
  const [form, setForm] = useState(blank);

  const needsSource = form.source_type !== 'manual';
  const ready = form.title.trim().length >= 5 && form.owner_id && form.due_date
    && (!needsSource || form.source_id.trim());

  async function create() {
    try {
      await api.post('/actions', {
        ...form,
        description: form.description || null,
        source_id: needsSource ? form.source_id.trim() : null
      });
      toast.success('Action raised', 'The owner has been notified.');
      setForm(blank);
      onClose();
      onCreated();
    } catch (err) { toast.error('Could not raise it', err.message); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Raise a corrective action"
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!ready} onClick={create}>
            <IconPlus width={13} height={13} />Raise it
          </button>
        </>
      }>
      <Field label="What needs doing" required>
        <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Reconcile the privileged account inventory to the HR leaver feed" />
      </Field>
      <Field label="Detail">
        <textarea className="textarea" value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      </Field>
      <div className="field-row">
        <Field label="Raised against">
          <Select value={form.source_type} onChange={(v) => setForm((f) => ({ ...f, source_type: v, source_id: '' }))}
            options={[
              { value: 'manual', label: 'Nothing in particular' },
              { value: 'finding', label: 'A finding' },
              { value: 'risk', label: 'A risk' },
              { value: 'gap_item', label: 'A gap item' },
              { value: 'assessment', label: 'An assessment' }
            ]} />
        </Field>
        {needsSource && (
          <Field label="Record id" hint="The id of the record this action addresses." required>
            <input className="input mono" value={form.source_id}
              onChange={(e) => setForm((f) => ({ ...f, source_id: e.target.value }))} />
          </Field>
        )}
      </div>
      <div className="field-row">
        <Field label="Owner" hint="An action with nobody accountable is not an action." required>
          <Select value={form.owner_id} onChange={(v) => setForm((f) => ({ ...f, owner_id: v }))}
            placeholder="Choose an owner"
            options={directory.map((u) => ({ value: u.id, label: `${u.name} — ${u.job_title || u.role}` }))} />
        </Field>
        <Field label="Priority">
          <Select value={form.priority} onChange={(v) => setForm((f) => ({ ...f, priority: v }))}
            options={PRIORITIES.map((v) => ({ value: v, label: titleCase(v) }))} />
        </Field>
        <Field label="Due date" required>
          <input className="input" type="date" value={form.due_date}
            onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
        </Field>
      </div>
    </Modal>
  );
}
