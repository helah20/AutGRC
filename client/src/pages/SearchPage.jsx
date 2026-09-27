import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFetch, useDebounced } from '../lib/useApi.js';
import { Card, Loading, ErrorNote, Empty, Badge, SearchInput } from '../components/ui.jsx';
import { IconSearch } from '../components/Icons.jsx';
import { useLabels } from '../i18n/labels.js';

const ROUTE = {
  document: (r) => `/documents/${r.id}`,
  control: () => '/controls',
  role: (r) => `/roles/${r.id}`,
  framework_requirement: () => '/frameworks',
  evidence: () => '/evidence',
  raci_activity: (r) => r.url || '/raci',
  gap_item: (r) => r.url || '/gap-assessment'
};

export default function SearchPage() {
  const labels = useLabels();
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState(params.get('q') || '');
  const debounced = useDebounced(term, 260);
  const [type, setType] = useState('');

  useEffect(() => {
    setParams(debounced ? { q: debounced } : {}, { replace: true });
  }, [debounced, setParams]);

  const { data, loading, error, reload } = useFetch(
    debounced.trim().length >= 2 ? `/search?q=${encodeURIComponent(debounced)}${type ? `&types=${type}` : ''}&limit=120` : null
  );

  return (
    <div className="page-narrow" style={{ margin: '0 auto' }}>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">Search</h1>
          <p className="page-sub">
            One query across policies, standards, procedures, roles, controls, framework requirements,
            evidence, RACI activities and gap assessment rows.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <SearchInput value={term} onChange={setTerm} placeholder="Search everything — try “MFA”, “access review” or “backup”…" />
      </div>

      {debounced.trim().length < 2 && (
        <Empty icon={IconSearch} title="Start typing">
          Enter at least two characters. Searching for “MFA” returns the policies that mandate it, the
          standard that specifies it, the controls that implement it, the framework requirements it
          satisfies and the evidence that proves it.
        </Empty>
      )}

      {loading && <Loading label="Searching…" />}
      {error && <ErrorNote error={error} onRetry={reload} />}

      {data && (
        <>
          <div className="row" style={{ marginBottom: 14 }}>
            <div className="btn-group">
              <button className={`btn btn-sm ${!type ? 'active' : ''}`} onClick={() => setType('')}>
                All ({data.total})
              </button>
              {data.groups.map((g) => (
                <button key={g.type} className={`btn btn-sm ${type === g.type ? 'active' : ''}`} onClick={() => setType(g.type)}>
                  {g.label} ({g.items.length})
                </button>
              ))}
            </div>
          </div>

          {data.groups.length ? data.groups.map((group) => (
            <section key={group.type} className="search-group">
              <h3 style={{ marginBottom: 8 }}>{group.label} <span className="muted small">({group.items.length})</span></h3>
              {group.items.map((item) => (
                <Link key={item.id} to={ROUTE[group.type]?.(item) || '/dashboard'} className="search-hit">
                  <div className="between" style={{ alignItems: 'flex-start' }}>
                    <span className="search-hit-title">{item.title}</span>
                    <span className="row-tight">
                      {item.domainLabel && <Badge tone="neutral">{item.domainLabel}</Badge>}
                      {item.badge && <Badge tone="info">{String(item.badge).replace(/_/g, ' ')}</Badge>}
                    </span>
                  </div>
                  {item.excerpt && (
                    <div className="search-hit-excerpt" dangerouslySetInnerHTML={{ __html: item.excerpt }} />
                  )}
                </Link>
              ))}
            </section>
          )) : (
            <Empty icon={IconSearch} title={`No matches for “${debounced}”`}>
              Try a broader term, or check the spelling.
            </Empty>
          )}
        </>
      )}
    </div>
  );
}
