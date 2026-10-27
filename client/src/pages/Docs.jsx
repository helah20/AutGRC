/**
 * The platform guide.
 *
 * Content lives in i18n/docs as structured blocks, one file per language with
 * the same pages and slugs, so a page reads in the interface language and a
 * link to it works in both. The layout is a documentation site's: grouped
 * pages beside the content, a filter over titles and text, the page's own
 * headings for jumping within it, and the previous and next page at the foot.
 */

import { useMemo, useState, useEffect } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { SearchInput } from '../components/ui.jsx';
import { IconBook, IconChevronRight, IconInfo, IconArrowRight } from '../components/Icons.jsx';
import docsAr from '../i18n/docs/ar.js';
import docsEn from '../i18n/docs/en.js';

const anchor = (i) => `s-${i}`;

/** The plain text of a page, for the filter. */
function pageText(page) {
  return [page.title, page.summary, ...page.blocks.flatMap((b) => [
    b.h, b.p, b.note, b.tip, ...(b.ul || []), ...(b.ol || []),
    ...(b.table ? [...b.table.head, ...b.table.rows.flat()] : [])
  ])].filter(Boolean).join(' ').toLowerCase();
}

function Block({ block, index }) {
  if (block.h) return <h2 id={anchor(index)} className="docs-h2">{block.h}</h2>;
  if (block.p) return <p>{block.p}</p>;
  if (block.ul) return <ul>{block.ul.map((item) => <li key={item}>{item}</li>)}</ul>;
  if (block.ol) return <ol className="docs-steps">{block.ol.map((item) => <li key={item}>{item}</li>)}</ol>;
  if (block.note || block.tip) {
    return (
      <div className="callout" data-callout={block.tip ? 'tip' : 'note'}>
        <p style={{ margin: 0 }}><IconInfo width={14} height={14} style={{ verticalAlign: '-2px', marginInlineEnd: 6 }} />{block.note || block.tip}</p>
      </div>
    );
  }
  if (block.table) {
    return (
      <div className="docs-table-wrap">
        <table className="data docs-table">
          <thead><tr>{block.table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{block.table.rows.map((row) => (
            <tr key={row[0]}>{row.map((cell, i) => <td key={i}>{cell}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
    );
  }
  if (block.go) {
    return (
      <p><Link className="btn" to={block.go.to}>{block.go.label}<IconArrowRight className="flip" /></Link></p>
    );
  }
  return null;
}

export default function Docs() {
  const { language, t } = useI18n();
  const docs = language === 'ar' ? docsAr : docsEn;
  const { slug } = useParams();
  const [filter, setFilter] = useState('');

  const page = docs.pages.find((p) => p.slug === (slug || docs.pages[0].slug));
  const index = docs.pages.indexOf(page);

  useEffect(() => { window.scrollTo(0, 0); }, [slug]);

  const visible = useMemo(() => {
    const words = filter.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return docs.pages;
    return docs.pages.filter((p) => { const text = pageText(p); return words.every((w) => text.includes(w)); });
  }, [docs, filter]);

  if (!page) return <Navigate to="/docs" replace />;

  const headings = page.blocks.map((b, i) => (b.h ? { text: b.h, id: anchor(i) } : null)).filter(Boolean);
  const prev = docs.pages[index - 1];
  const next = docs.pages[index + 1];

  return (
    <div className="docs">
      <aside className="docs-nav" aria-label={docs.title}>
        <div className="docs-nav-title"><IconBook width={15} height={15} />{docs.title}</div>
        <SearchInput value={filter} onChange={setFilter} />
        {docs.groups.map((group) => {
          const pages = visible.filter((p) => p.group === group.key);
          if (!pages.length) return null;
          return (
            <div key={group.key} className="docs-nav-group">
              <div className="docs-nav-label">{group.title}</div>
              {pages.map((p) => (
                <Link key={p.slug} to={`/docs/${p.slug}`} className={`docs-nav-link ${p.slug === page.slug ? 'active' : ''}`}>
                  {p.title}
                </Link>
              ))}
            </div>
          );
        })}
      </aside>

      <article className="docs-article">
        <div className="docs-crumbs">
          {docs.title}<IconChevronRight className="flip" width={12} height={12} />
          {docs.groups.find((g) => g.key === page.group)?.title}
        </div>
        <h1 className="docs-h1">{page.title}</h1>
        <p className="docs-lead">{page.summary}</p>
        <div className="docs-body prose" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          {page.blocks.map((block, i) => <Block key={i} block={block} index={i} />)}
        </div>
        <nav className="docs-pager">
          {prev ? (
            <Link to={`/docs/${prev.slug}`} className="docs-pager-link">
              <span className="docs-pager-dir">{t('docs.previous')}</span>{prev.title}
            </Link>
          ) : <span />}
          {next && (
            <Link to={`/docs/${next.slug}`} className="docs-pager-link next">
              <span className="docs-pager-dir">{t('docs.next')}</span>{next.title}
            </Link>
          )}
        </nav>
      </article>

      {headings.length > 1 && (
        <aside className="docs-toc" aria-label={t('docs.onThisPage')}>
          <div className="docs-nav-label">{t('docs.onThisPage')}</div>
          {headings.map((h) => <a key={h.id} href={`#${h.id}`}>{h.text}</a>)}
        </aside>
      )}
    </div>
  );
}
