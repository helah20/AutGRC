import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, Loading, ErrorNote, Empty, Badge, Modal, Field, useToast, DataTable } from '../components/ui.jsx';
import { IconUsers, IconPlus, IconDownload } from '../components/Icons.jsx';
import { useLabels } from '../i18n/labels.js';
import { useT } from '../i18n/index.jsx';

export default function Roles() {
  const t = useT();
  const labels = useLabels();
  const { data, loading, error, reload } = useFetch('/roles');
  const navigate = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(null);

  if (loading) return <Loading label={t('rolesUi.loading')} />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const missing = data.library.filter((r) => !r.exists);

  async function addFromLibrary(code) {
    setBusy(code);
    try {
      const res = await api.post('/roles/from-library', { code });
      toast.success(t('rolesUi.roleCreated'), t('rolesUi.roleCreatedBody', { name: res.role.name }));
      setAddOpen(false);
      reload();
    } catch (err) {
      toast.error(t('rolesUi.couldNotCreate'), err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">{t('rolesPage.title')}</h1>
          <p className="page-sub">{t('rolesPage.subtitle')}</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => api.download('/reports/roles_responsibilities/export.xlsx', 'Roles.xlsx')
            .then(() => toast.success(t('common.exported'))).catch((e) => toast.error(t('common.exportFailed'), e.message))}>
            <IconDownload />{t('common.export')}
          </button>
          {can('role:write') && missing.length > 0 && (
            <button className="btn btn-primary" onClick={() => setAddOpen(true)}><IconPlus />{t('rolesUi.addRole')}</button>
          )}
        </div>
      </div>

      <Card flush>
        <DataTable
          columns={[
            {
              key: 'name', header: t('rolesUi.colRole'),
              render: (r) => (<><div className="cell-title">{r.name}</div><div className="cell-sub clamp-2">{r.purpose}</div></>)
            },
            { key: 'category', header: t('rolesUi.colCategory'), nowrap: true, render: (r) => <Badge tone="neutral">{labels.roleCategory(r.category)}</Badge> },
            { key: 'reporting_line', header: t('rolesUi.colReportingLine'), render: (r) => <span className="small clamp-2">{r.reporting_line || '—'}</span> },
            { key: 'domain_label', header: t('rolesUi.colPrimaryDomain'), nowrap: true, render: (r) => r.domain_label || <span className="muted">{t('rolesUi.crossDomain')}</span> },
            { key: 'item_count', header: t('rolesUi.colStatements'), align: 'right', render: (r) => r.item_count }
          ]}
          rows={data.items}
          onRowClick={(r) => navigate(`/roles/${r.id}`)}
          empty={
            <Empty icon={IconUsers} title={t('rolesUi.emptyTitle')}
              action={can('role:write') ? <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}><IconPlus />{t('rolesUi.addARole')}</button> : null}>
              {t('rolesUi.emptyBody')}
            </Empty>
          }
        />
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('rolesUi.libraryTitle')} size="modal-lg">
        <p className="muted small" style={{ marginBottom: 14 }}>
          {t('rolesUi.libraryIntro')}
        </p>
        <div className="grid grid-2">
          {missing.map((r) => (
            <button key={r.code} type="button" className="option-card" disabled={busy === r.code}
              style={{ textAlign: 'start', font: 'inherit' }} onClick={() => addFromLibrary(r.code)}>
              <span className="option-card-body">
                <span className="option-card-title">{r.name}{busy === r.code && <span className="spinner" style={{ width: 12, height: 12 }} />}</span>
                <span className="option-card-desc">{labels.roleCategory(r.category)}</span>
              </span>
            </button>
          ))}
        </div>
        {!missing.length && <Empty title={t('rolesUi.libraryAllExist')} />}
      </Modal>
    </>
  );
}
