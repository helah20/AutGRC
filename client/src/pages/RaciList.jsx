import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, Loading, ErrorNote, Empty, Badge, DataTable, Modal, Field, Select, useToast } from '../components/ui.jsx';
import { IconGrid, IconPlus, IconAlert, IconCheck } from '../components/Icons.jsx';
import { titleCase } from '../lib/format.js';
import { useLabels } from '../i18n/labels.js';
import { useT } from '../i18n/index.jsx';

export default function RaciList() {
  const t = useT();
  const labels = useLabels();
  const { data, loading, error, reload } = useFetch('/raci');
  const { data: options } = useFetch('/generator/options');
  const navigate = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', domain_key: '', mode: 'raci', seedFromDomain: true });

  if (loading) return <Loading label={t('raciListUi.loading')} />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">{t('raci.title')}</h1>
          <p className="page-sub">
            {t('raciListUi.subtitle')}
          </p>
        </div>
        {can('raci:write') && (
          <div className="page-actions">
            <button className="btn btn-primary" onClick={() => setOpen(true)}><IconPlus />{t('raciListUi.newMatrix')}</button>
          </div>
        )}
      </div>

      <Card flush>
        <DataTable
          columns={[
            { key: 'name', header: t('raciListUi.colMatrix'), render: (m) => (<><div className="cell-title">{m.name}</div><div className="cell-sub">{m.description || m.domain_label || t('raciListUi.crossDomain')}</div></>) },
            { key: 'mode', header: t('raciListUi.colMode'), nowrap: true, render: (m) => <Badge tone="neutral">{m.mode.toUpperCase()}</Badge> },
            { key: 'activities', header: t('raciListUi.colActivities'), align: 'right' },
            { key: 'roles', header: t('raciListUi.colRoles'), align: 'right' },
            {
              key: 'issues', header: t('raciListUi.colValidation'), nowrap: true,
              render: (m) => m.issues > 0
                ? <Badge tone="danger"><IconAlert width={11} height={11} />{t('raciListUi.issues', { count: m.issues })}</Badge>
                : <Badge tone="ok"><IconCheck width={11} height={11} />{t('raciListUi.valid')}</Badge>
            }
          ]}
          rows={data}
          onRowClick={(m) => navigate(`/raci/${m.id}`)}
          empty={<Empty icon={IconGrid} title={t('raciListUi.emptyTitle')} >{t('raciListUi.emptyBody')}</Empty>}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={t('raciListUi.modalTitle')}
        footer={
          <>
            <button className="btn" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
            <button className="btn btn-primary" disabled={!form.name.trim()} onClick={async () => {
              try {
                const res = await api.post('/raci', form);
                toast.success(t('raciListUi.matrixCreated'));
                setOpen(false);
                navigate(`/raci/${res.matrix.id}`);
              } catch (err) { toast.error(t('raciListUi.couldNotCreate'), err.message); }
            }}>{t('raciListUi.create')}</button>
          </>
        }>
        <Field label={t('raciListUi.matrixName')} required>
          <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t('raciListUi.matrixNamePlaceholder')} />
        </Field>
        <div className="field-row">
          <Field label={t('common.domain')}>
            <Select value={form.domain_key} onChange={(v) => setForm((f) => ({ ...f, domain_key: v }))} placeholder={t('raciListUi.crossDomain')}
              options={(options?.domains || []).map((d) => ({ value: d.key, label: d.name }))} />
          </Field>
          <Field label={t('raciListUi.mode')} hint={t('raciListUi.modeHint')}>
            <Select value={form.mode} onChange={(v) => setForm((f) => ({ ...f, mode: v }))}
              options={[{ value: 'raci', label: 'RACI' }, { value: 'rasci', label: 'RASCI' }]} />
          </Field>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={form.seedFromDomain}
            onChange={(e) => setForm((f) => ({ ...f, seedFromDomain: e.target.checked }))} />
          <span className="checkbox-text">
            {t('raciListUi.seedLabel')}
            <small>{t('raciListUi.seedHint')}</small>
          </span>
        </label>
      </Modal>
    </>
  );
}
