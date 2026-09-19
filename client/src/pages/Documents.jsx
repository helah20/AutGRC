import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useFetch, useDebounced } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import { api, qs } from '../lib/api.js';
import {
  Card, Loading, ErrorNote, DataTable, StatusBadge, Badge, Empty,
  SearchInput, Select, useToast
} from '../components/ui.jsx';
import { formatDate, relativeTime, titleCase, daysUntil } from '../lib/format.js';
import { IconWand, IconDownload, IconDocument, IconFilter, IconX } from '../components/Icons.jsx';

const TYPE_LABEL = {
  policy: 'Policy', standard: 'Standard', procedure: 'Procedure', guideline: 'Guideline',
  framework: 'Framework', roles: 'Roles & Responsibilities', raci: 'RACI / RASCI',
  control_matrix: 'Control Matrix', work_instruction: 'Work Instruction'
};

export default function Documents({ fixedType }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { can } = useAuth();

  const [search, setSearch] = useState(params.get('search') || '');
  const debounced = useDebounced(search);
  const [type, setType] = useState(fixedType || params.get('type') || '');
  const [domain, setDomain] = useState(params.get('domain') || '');
  const [status, setStatus] = useState(params.get('status') || '');
  const [reviewDue, setReviewDue] = useState(params.get('reviewDue') === 'true');
  const [sort, setSort] = useState('updated_at');

  useEffect(() => { if (fixedType) setType(fixedType); }, [fixedType]);

  const query = qs({
    search: debounced, type: fixedType || type, domain, status,
    reviewDue: reviewDue ? 'true' : '', sort, limit: 200
  });

  const { data, loading, error, reload } = useFetch(`/documents${query}`);
  const { data: meta } = useFetch('/documents/meta/options');

  useEffect(() => {
    const next = {};
    if (debounced) next.search = debounced;
    if (!fixedType && type) next.type = type;
    if (domain) next.domain = domain;
    if (status) next.status = status;
    if (reviewDue) next.reviewDue = 'true';
    setParams(next, { replace: true });
  }, [debounced, type, domain, status, reviewDue, fixedType, setParams]);

  const domainOptions = useMemo(() => {
    const counts = meta?.counts?.byDomain || [];
    return counts.map((d) => ({ value: d.domain_key, label: `${titleCase(d.domain_key)} (${d.n})` }));
  }, [meta]);

  const columns = [
    {
      key: 'reference', header: 'Reference', nowrap: true, width: 130,
      render: (d) => <span className="ref-tag">{d.reference}</span>
    },
    {
      key: 'title', header: 'Document',
      render: (d) => (
        <>
          <div className="cell-title">{d.title}</div>
          <div className="cell-sub">{d.domain_label} · v{d.version} · {d.classification.replace('_', ' ')}</div>
        </>
      )
    },
    { key: 'doc_type', header: 'Type', nowrap: true, render: (d) => <Badge tone="neutral">{d.doc_type_label}</Badge> },
    { key: 'status', header: 'Status', nowrap: true, render: (d) => <StatusBadge status={d.status} /> },
    { key: 'owner_name', header: 'Owner', nowrap: true, render: (d) => d.owner_name || <span className="muted">Unassigned</span> },
    {
      key: 'review_date', header: 'Review due', nowrap: true,
      render: (d) => {
        if (!d.review_date) return <span className="muted">Not set</span>;
        const days = daysUntil(d.review_date);
        return (
          <div>
            <div className="small">{formatDate(d.review_date)}</div>
            {d.status !== 'retired' && days !== null && days <= 60 && (
              <Badge tone={days < 0 ? 'danger' : 'warn'}>{days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}</Badge>
            )}
          </div>
        );
      }
    },
    { key: 'updated_at', header: 'Updated', nowrap: true, render: (d) => <span className="small muted">{relativeTime(d.updated_at)}</span> }
  ];

  const activeFilters = [type && !fixedType, domain, status, reviewDue, debounced].filter(Boolean).length;

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">{fixedType ? `${TYPE_LABEL[fixedType]}s` : 'Governance Documents'}</h1>
          <p className="page-sub">
            {fixedType
              ? `Every ${TYPE_LABEL[fixedType].toLowerCase()} in the library, with its lifecycle state and review position.`
              : 'The complete governance library across every document type, domain and lifecycle state.'}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => api.download('/export/register.xlsx', 'Document Register.xlsx')
            .then(() => toast.success('Register exported'))
            .catch((e) => toast.error('Export failed', e.message))}>
            <IconDownload />Export register
          </button>
          {can('generate:run') && <Link className="btn btn-primary" to="/generator"><IconWand />Generate</Link>}
        </div>
      </div>

      <Card flush>
        <div className="table-toolbar">
          <div className="search-box"><SearchInput value={search} onChange={setSearch} placeholder="Search by title, reference or summary…" /></div>
          {!fixedType && (
            <Select value={type} onChange={setType} placeholder="All types"
              options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))} />
          )}
          <Select value={domain} onChange={setDomain} placeholder="All domains" options={domainOptions} />
          <Select value={status} onChange={setStatus} placeholder="All statuses"
            options={['draft', 'under_review', 'approved', 'published', 'under_revision', 'retired'].map((v) => ({ value: v, label: titleCase(v) }))} />
          <button className={`btn btn-sm ${reviewDue ? 'btn-primary' : ''}`} onClick={() => setReviewDue((r) => !r)}>
            <IconFilter width={13} height={13} />Review due
          </button>
          {activeFilters > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => {
              setSearch(''); if (!fixedType) setType(''); setDomain(''); setStatus(''); setReviewDue(false);
            }}><IconX width={13} height={13} />Clear</button>
          )}
          <span className="table-count">{data ? `${data.items.length} of ${data.total}` : '—'}</span>
        </div>

        {loading && <Loading />}
        {error && <div className="card-body"><ErrorNote error={error} onRetry={reload} /></div>}
        {!loading && !error && (
          <DataTable
            columns={columns}
            rows={data?.items || []}
            onRowClick={(d) => navigate(`/documents/${d.id}`)}
            rowClass={(d) => (d.status === 'retired' ? 'muted' : '')}
            empty={
              <Empty icon={IconDocument} title="No documents match"
                action={can('generate:run') ? <Link className="btn btn-primary btn-sm" to="/generator"><IconWand />Generate a package</Link> : null}>
                {activeFilters ? 'Adjust or clear the filters to widen the search.' : 'Generate a governance package to populate the library.'}
              </Empty>
            }
          />
        )}
      </Card>
    </>
  );
}
