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
import { useLabels } from '../i18n/labels.js';
import { useI18n } from '../i18n/index.jsx';

// The type names themselves live in the dictionary, so the filter offers them
// in the reader's language rather than a second English copy of the same list.
const DOC_TYPES = [
  'policy', 'standard', 'procedure', 'guideline', 'framework',
  'roles', 'raci', 'control_matrix', 'work_instruction'
];

/** Headings for the type-filtered routes, which have their own plural. */
const TYPE_TITLE = {
  policy: 'documents.titlePolicy',
  standard: 'documents.titleStandard',
  procedure: 'documents.titleProcedure'
};
const TYPE_SUBTITLE = {
  policy: 'documents.subtitlePolicy',
  standard: 'documents.subtitleStandard',
  procedure: 'documents.subtitleProcedure'
};

export default function Documents({ fixedType }) {
  const labels = useLabels();
  const { t, formatNumber, language } = useI18n();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { can } = useAuth();

  const [search, setSearch] = useState(params.get('search') || '');
  const debounced = useDebounced(search);
  const [type, setType] = useState(fixedType || params.get('type') || '');
  const [domain, setDomain] = useState(params.get('domain') || '');
  const [status, setStatus] = useState(params.get('status') || '');
  // null until the reader picks: the list then opens on documents in the
  // reader's own language, when there are any. 'all' shows every language.
  const [docLanguage, setDocLanguage] = useState(params.get('language'));
  const [reviewDue, setReviewDue] = useState(params.get('reviewDue') === 'true');
  const [sort, setSort] = useState('updated_at');

  useEffect(() => { if (fixedType) setType(fixedType); }, [fixedType]);

  const { data: meta } = useFetch('/documents/meta/options');
  const inReaderLanguage = meta?.counts?.byLanguage?.find((l) => l.language === language)?.n;
  const effectiveLanguage = docLanguage ?? (meta && !inReaderLanguage ? 'all' : language);

  const query = qs({
    search: debounced, type: fixedType || type, domain, status,
    reviewDue: reviewDue ? 'true' : '', sort, limit: 200,
    language: effectiveLanguage === 'all' ? undefined : effectiveLanguage });

  const { data, loading, error, reload } = useFetch(`/documents${query}`);

  useEffect(() => {
    const next = {};
    if (debounced) next.search = debounced;
    if (!fixedType && type) next.type = type;
    if (domain) next.domain = domain;
    if (status) next.status = status;
    if (reviewDue) next.reviewDue = 'true';
    if (docLanguage) next.language = docLanguage;
    setParams(next, { replace: true });
  }, [debounced, type, domain, status, reviewDue, docLanguage, fixedType, setParams]);

  const domainOptions = useMemo(() => {
    const counts = meta?.counts?.byDomain || [];
    return counts.map((d) => ({ value: d.domain_key, label: `${labels.domain(d.domain_key, titleCase(d.domain_key))} (${d.n})` }));
  }, [meta, labels]);

  const columns = [
    {
      key: 'reference', header: t('documentsUi.columnReference'), nowrap: true, width: 130,
      render: (d) => <span className="ref-tag">{d.reference}</span>
    },
    {
      key: 'title', header: t('documentsUi.columnDocument'),
      render: (d) => (
        <>
          <div className="cell-title">{d.title}</div>
          <div className="cell-sub">{labels.domain(d.domain_key, d.domain_label)} · v{d.version} · {labels.classification(d.classification)}</div>
        </>
      )
    },
    { key: 'doc_type', minor: true, header: t('common.type'), nowrap: true, render: (d) => <Badge tone="neutral">{labels.docType(d.doc_type, d.doc_type_label)}</Badge> },
    {
      key: 'language', minor: true, header: t('documents.language'), nowrap: true, width: 84,
      render: (d) => (d.language === 'ar'
        ? <Badge tone="info" lang="ar">العربية</Badge>
        : <span className="small muted">English</span>)
    },
    { key: 'status', header: t('common.status'), nowrap: true, render: (d) => <StatusBadge status={d.status} /> },
    { key: 'owner_name', minor: true, header: t('common.owner'), nowrap: true, render: (d) => d.owner_name || <span className="muted">{t('common.unassigned')}</span> },
    {
      key: 'review_date', header: t('documentsUi.columnReviewDue'), nowrap: true,
      render: (d) => {
        if (!d.review_date) return <span className="muted">{t('documentsUi.notSet')}</span>;
        const days = daysUntil(d.review_date);
        return (
          <div>
            <div className="small">{formatDate(d.review_date)}</div>
            {d.status !== 'retired' && days !== null && days <= 60 && (
              <Badge tone={days < 0 ? 'danger' : 'warn'}>{days < 0 ? t('documentsUi.daysOverdue', { count: Math.abs(days) }) : t('documentsUi.daysLeft', { count: days })}</Badge>
            )}
          </div>
        );
      }
    },
    { key: 'updated_at', minor: true, header: t('common.updated'), nowrap: true, render: (d) => <span className="small muted">{relativeTime(d.updated_at)}</span> }
  ];

  const activeFilters = [type && !fixedType, domain, status, reviewDue, debounced].filter(Boolean).length;

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          {/* The plural is a dictionary entry, not the type label with an "s"
              stuck on: that produced "Policys", and Arabic does not form a
              plural by suffix at all. */}
          <h1 className="page-title">{t(TYPE_TITLE[fixedType] || 'documents.title')}</h1>
          <p className="page-sub">{t(TYPE_SUBTITLE[fixedType] || 'documents.subtitle')}</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => api.download('/export/register.xlsx', 'Document Register.xlsx')
            .then(() => toast.success(t('documentsUi.registerExported')))
            .catch((e) => toast.error(t('common.exportFailed'), e.message))}>
            <IconDownload />{t('documentsUi.exportRegister')}
          </button>
          {can('generate:run') && <Link className="btn btn-primary" to="/generator"><IconWand />{t('documentsUi.generate')}</Link>}
        </div>
      </div>

      <Card flush>
        <div className="table-toolbar">
          <div className="search-box"><SearchInput value={search} onChange={setSearch} placeholder={t('documentsUi.searchPlaceholder')} /></div>
          {!fixedType && (
            <Select value={type} onChange={setType} placeholder={t('documents.allTypes')}
              options={DOC_TYPES.map((value) => ({ value, label: labels.docType(value) }))} />
          )}
          <Select value={domain} onChange={setDomain} placeholder={t('documentsUi.allDomains')} options={domainOptions} />
          <Select value={status} onChange={setStatus} placeholder={t('documentsUi.allStatuses')}
            options={['draft', 'under_review', 'approved', 'published', 'under_revision', 'retired'].map((v) => ({ value: v, label: labels.status(v, titleCase(v)) }))} />
          <Select value={effectiveLanguage} onChange={(v) => setDocLanguage(v || 'all')}
            options={[{ value: 'all', label: t('documents.allLanguages') }, { value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' }]} />
          <button className={`btn btn-sm ${reviewDue ? 'btn-primary' : ''}`} onClick={() => setReviewDue((r) => !r)}>
            <IconFilter width={13} height={13} />{t('documentsUi.columnReviewDue')}
          </button>
          {activeFilters > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => {
              setSearch(''); if (!fixedType) setType(''); setDomain(''); setStatus(''); setDocLanguage(null); setReviewDue(false);
            }}><IconX width={13} height={13} />{t('common.clear')}</button>
          )}
          <span className="table-count">{data ? `${formatNumber(data.items.length)} ${t('common.of')} ${formatNumber(data.total)}` : '—'}</span>
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
              <Empty icon={IconDocument} title={t('documentsUi.emptyTitle')}
                action={can('generate:run') ? <Link className="btn btn-primary btn-sm" to="/generator"><IconWand />{t('documentsUi.generatePackage')}</Link> : null}>
                {activeFilters ? t('documentsUi.emptyFiltered') : t('documentsUi.emptyBody')}
              </Empty>
            }
          />
        )}
      </Card>
    </>
  );
}
