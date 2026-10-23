import { useState } from 'react';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import {
  Card, Loading, ErrorNote, Empty, Badge, DataTable, Select, useToast, Drawer, Field, Modal
} from '../components/ui.jsx';
import { IconCheck, IconPlus, IconDownload, IconLock, IconUsers } from '../components/Icons.jsx';
import { formatDate } from '../lib/format.js';
import { useI18n } from '../i18n/index.jsx';

const CATEGORIES = ['improvement', 'change', 'resources', 'risk', 'other'];

/**
 * Management reviews: the minutes of the meeting at which top management
 * reviews the management system (ISO 27001 9.3; NCA ECC 1-2-3, 1-8-3). The
 * inputs are captured when the review is recorded; decisions can raise
 * corrective actions; closed minutes are a record and are not edited.
 */
export default function ManagementReviews() {
  const { t } = useI18n();
  const toast = useToast();
  const { can } = useAuth();
  const [selected, setSelected] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const { data, loading, error, reload } = useFetch('/management-reviews');
  const canWrite = can('review:write');

  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">{t('reviews.title')}</h1>
          <p className="page-sub">{t('reviews.subtitle')}</p>
        </div>
        {canWrite && (
          <div className="page-actions">
            <button className="btn btn-primary" onClick={() => setAddOpen(true)}><IconPlus />{t('reviews.record')}</button>
          </div>
        )}
      </div>

      <Card flush>
        <DataTable
          columns={[
            { key: 'review_id', header: t('reviews.reference'), nowrap: true, width: 96, render: (r) => <span className="ref-tag">{r.review_id}</span> },
            { key: 'held_on', header: t('reviews.heldOn'), nowrap: true, render: (r) => formatDate(r.held_on) },
            { key: 'forum', header: t('reviews.forum'), render: (r) => r.forum || <span className="muted">—</span> },
            { key: 'decisions', header: t('reviews.decisions'), align: 'right' },
            {
              key: 'status', header: t('common.status'), nowrap: true,
              render: (r) => (r.status === 'closed'
                ? <Badge tone="ok" dot>{t('reviews.closed')}</Badge>
                : <Badge tone="neutral">{t('reviews.draft')}</Badge>)
            }
          ]}
          rows={data?.items || []}
          onRowClick={(r) => setSelected(r.id)}
          empty={<Empty icon={IconUsers} title={t('reviews.emptyTitle')}>{t('reviews.emptyBody')}</Empty>}
        />
      </Card>

      <ReviewDrawer id={selected} onClose={() => setSelected(null)} onChanged={reload}
        toast={toast} canWrite={canWrite} categories={data?.categories || {}} />
      <RecordReview open={addOpen} onClose={() => setAddOpen(false)} toast={toast}
        onCreated={(id) => { reload(); setSelected(id); }} />
    </>
  );
}

function ReviewDrawer({ id, onClose, onChanged, toast, canWrite, categories }) {
  const { t } = useI18n();
  const { data, loading, reload } = useFetch(id ? `/management-reviews/${id}` : null);
  const { data: directory } = useFetch(id && canWrite ? '/admin/directory' : null);
  const blank = { category: 'improvement', decision: '', owner_id: '', due_date: '', raise_action: false };
  const [form, setForm] = useState(blank);

  const review = data?.review;
  const open = review && review.status !== 'closed' && canWrite;
  const ready = form.decision.trim().length >= 5 && (!form.raise_action || (form.owner_id && form.due_date));

  async function addDecision() {
    try {
      await api.post(`/management-reviews/${id}/decisions`, {
        ...form, owner_id: form.owner_id || null, due_date: form.due_date || null
      });
      setForm(blank);
      reload(); onChanged();
      toast.success(t('reviews.decisionAdded'));
    } catch (err) { toast.error(t('reviews.couldNotSave'), err.message); }
  }

  async function close() {
    try {
      await api.post(`/management-reviews/${id}/close`, {});
      reload(); onChanged();
      toast.success(t('reviews.closedToast'));
    } catch (err) { toast.error(t('reviews.couldNotSave'), err.message); }
  }

  function download(format) {
    api.download(`/management-reviews/${id}/minutes.${format}`, `${review.review_id} Minutes.${format}`)
      .catch((err) => toast.error(t('reviews.couldNotSave'), err.message));
  }

  return (
    <Drawer open={Boolean(id)} onClose={onClose} wide
      title={review ? `${review.review_id} — ${formatDate(review.held_on)}` : ''}
      footer={review && (
        <>
          <button className="btn" onClick={() => download('docx')}><IconDownload width={13} height={13} />Word</button>
          <button className="btn" onClick={() => download('pdf')}><IconDownload width={13} height={13} />PDF</button>
          {open && <button className="btn btn-primary" onClick={close}><IconLock width={13} height={13} />{t('reviews.closeMinutes')}</button>}
        </>
      )}>
      {loading && <Loading />}
      {review && (
        <div className="stack">
          <div className="definition">
            <dt>{t('reviews.forum')}</dt><dd>{review.forum || '—'}</dd>
            <dt>{t('reviews.chair')}</dt><dd>{review.chair || '—'}</dd>
            <dt>{t('reviews.attendees')}</dt><dd>{review.attendees || '—'}</dd>
            {review.summary && <><dt>{t('reviews.summary')}</dt><dd>{review.summary}</dd></>}
          </div>
          {review.status === 'closed' && (
            <div className="callout" data-callout="ok"><p style={{ margin: 0 }}>{t('reviews.closedNote')}</p></div>
          )}

          <h3 style={{ margin: 0 }}>{t('reviews.inputs')}</h3>
          <p className="tiny muted" style={{ margin: 0 }}>{t('reviews.inputsNote', { date: formatDate(data.inputs?.capturedAt) })}</p>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>{t('reviews.input')}</th><th>{t('reviews.position')}</th><th>{t('reviews.attention')}</th></tr></thead>
              <tbody>
                {(data.inputs?.rows || []).map((row) => (
                  <tr key={row[1]}>
                    <td><div className="cell-title">{row[0]}</div><div className="cell-sub">{row[1]}</div></td>
                    <td className="small">{row[2]}</td>
                    <td><Badge tone={row[4] === 'Decision needed' ? 'warn' : 'neutral'}>{row[4]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ margin: 0 }}>{t('reviews.decisions')}</h3>
          {data.decisions.length ? (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>#</th><th>{t('reviews.decision')}</th><th>{t('common.owner')}</th><th>{t('common.due')}</th><th>{t('reviews.action')}</th></tr></thead>
                <tbody>
                  {data.decisions.map((d) => (
                    <tr key={d.id}>
                      <td>{d.position}</td>
                      <td><div className="cell-title">{d.decision}</div><div className="cell-sub">{categories[d.category] || d.category}</div></td>
                      <td className="small">{d.owner_name || '—'}</td>
                      <td className="small">{d.due_date ? formatDate(d.due_date) : '—'}</td>
                      <td className="small">{d.action_ref
                        ? <><span className="ref-tag">{d.action_ref}</span> {d.action_verified_at ? t('actions.verified') : d.action_status}</>
                        : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="small muted" style={{ margin: 0 }}>{t('reviews.noDecisions')}</p>}

          {open && (
            <Card>
              <div className="stack">
                <Field label={t('reviews.decision')} required>
                  <textarea className="textarea" value={form.decision}
                    onChange={(e) => setForm((f) => ({ ...f, decision: e.target.value }))} />
                </Field>
                <div className="grid grid-2">
                  <Field label={t('reviews.category')}>
                    <Select value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))}
                      options={CATEGORIES.map((c) => ({ value: c, label: categories[c] || c }))} />
                  </Field>
                  <Field label={t('common.owner')}>
                    <Select value={form.owner_id} onChange={(v) => setForm((f) => ({ ...f, owner_id: v }))}
                      placeholder={t('common.owner')}
                      options={(directory || []).map((u) => ({ value: u.id, label: `${u.name} — ${u.job_title || u.role}` }))} />
                  </Field>
                </div>
                <div className="grid grid-2">
                  <Field label={t('actions.dueDate')}>
                    <input className="input" type="date" value={form.due_date}
                      onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
                  </Field>
                  <Field label={t('reviews.raiseAction')} hint={t('reviews.raiseActionHint')}>
                    <label className="row-tight small">
                      <input type="checkbox" checked={form.raise_action}
                        onChange={(e) => setForm((f) => ({ ...f, raise_action: e.target.checked }))} />
                      {t('reviews.raiseActionLabel')}
                    </label>
                  </Field>
                </div>
                <div>
                  <button className="btn btn-primary" disabled={!ready} onClick={addDecision}>
                    <IconCheck width={13} height={13} />{t('reviews.addDecision')}
                  </button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </Drawer>
  );
}

function RecordReview({ open, onClose, onCreated, toast }) {
  const { t } = useI18n();
  const blank = { held_on: '', forum: '', chair: '', attendees: '', summary: '' };
  const [form, setForm] = useState(blank);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function create() {
    try {
      const res = await api.post('/management-reviews', {
        held_on: form.held_on,
        forum: form.forum || null, chair: form.chair || null,
        attendees: form.attendees || null, summary: form.summary || null
      });
      setForm(blank);
      onClose();
      onCreated(res.review.id);
    } catch (err) { toast.error(t('reviews.couldNotSave'), err.message); }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('reviews.record')}
      footer={
        <>
          <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" disabled={!form.held_on} onClick={create}>
            <IconPlus width={13} height={13} />{t('reviews.record')}
          </button>
        </>
      }>
      <p className="small muted">{t('reviews.recordNote')}</p>
      <div className="field-row">
        <Field label={t('reviews.heldOn')} required>
          <input className="input" type="date" value={form.held_on} onChange={set('held_on')} />
        </Field>
        <Field label={t('reviews.forum')}>
          <input className="input" value={form.forum} onChange={set('forum')} placeholder={t('reviews.forumPlaceholder')} />
        </Field>
      </div>
      <div className="field-row">
        <Field label={t('reviews.chair')}>
          <input className="input" value={form.chair} onChange={set('chair')} />
        </Field>
        <Field label={t('reviews.attendees')}>
          <input className="input" value={form.attendees} onChange={set('attendees')} />
        </Field>
      </div>
      <Field label={t('reviews.summary')}>
        <textarea className="textarea" value={form.summary} onChange={set('summary')} />
      </Field>
    </Modal>
  );
}
