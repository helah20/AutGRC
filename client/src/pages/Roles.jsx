import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, Loading, ErrorNote, Empty, Badge, Modal, Field, useToast, DataTable } from '../components/ui.jsx';
import { IconUsers, IconPlus, IconDownload } from '../components/Icons.jsx';
import { titleCase } from '../lib/format.js';
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

  if (loading) return <Loading label="Loading roles…" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const missing = data.library.filter((r) => !r.exists);

  async function addFromLibrary(code) {
    setBusy(code);
    try {
      const res = await api.post('/roles/from-library', { code });
      toast.success('Role created', `${res.role.name} added with its full responsibility set.`);
      setAddOpen(false);
      reload();
    } catch (err) {
      toast.error('Could not create role', err.message);
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
            .then(() => toast.success('Exported')).catch((e) => toast.error('Export failed', e.message))}>
            <IconDownload />Export
          </button>
          {can('role:write') && missing.length > 0 && (
            <button className="btn btn-primary" onClick={() => setAddOpen(true)}><IconPlus />Add role</button>
          )}
        </div>
      </div>

      <Card flush>
        <DataTable
          columns={[
            {
              key: 'name', header: 'Role',
              render: (r) => (<><div className="cell-title">{r.name}</div><div className="cell-sub clamp-2">{r.purpose}</div></>)
            },
            { key: 'category', header: 'Category', nowrap: true, render: (r) => <Badge tone="neutral">{r.category}</Badge> },
            { key: 'reporting_line', header: 'Reporting line', render: (r) => <span className="small clamp-2">{r.reporting_line || '—'}</span> },
            { key: 'domain_label', header: 'Primary domain', nowrap: true, render: (r) => r.domain_label || <span className="muted">Cross-domain</span> },
            { key: 'item_count', header: 'Statements', align: 'right', render: (r) => r.item_count }
          ]}
          rows={data.items}
          onRowClick={(r) => navigate(`/roles/${r.id}`)}
          empty={
            <Empty icon={IconUsers} title="No roles defined"
              action={can('role:write') ? <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}><IconPlus />Add a role</button> : null}>
              Roles are created automatically when you generate a governance package, or you can add
              them individually from the curated library.
            </Empty>
          }
        />
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a role from the library" size="modal-lg">
        <p className="muted small" style={{ marginBottom: 14 }}>
          Library roles arrive fully populated with purpose, authority, responsibilities, accountabilities,
          approvals, escalations and competencies. Every statement can be edited afterwards.
        </p>
        <div className="grid grid-2">
          {missing.map((r) => (
            <button key={r.code} type="button" className="option-card" disabled={busy === r.code}
              style={{ textAlign: 'left', font: 'inherit' }} onClick={() => addFromLibrary(r.code)}>
              <span className="option-card-body">
                <span className="option-card-title">{r.name}{busy === r.code && <span className="spinner" style={{ width: 12, height: 12 }} />}</span>
                <span className="option-card-desc">{r.category}</span>
              </span>
            </button>
          ))}
        </div>
        {!missing.length && <Empty title="Every library role already exists" />}
      </Modal>
    </>
  );
}
