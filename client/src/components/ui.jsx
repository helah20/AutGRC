/** Shared UI primitives used across every page. */

import { useEffect, useRef, useState, createContext, useContext, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  IconX, IconCheck, IconAlert, IconInfo, IconChevronDown, IconSearch, IconChevronRight
} from './Icons.jsx';
import { titleCase, STATUS_TONE, SEVERITY_TONE } from '../lib/format.js';
import { useI18n } from '../i18n/index.jsx';
import { useLabels } from '../i18n/labels.js';

/* ---------------------------------------------------------------- badges -- */

export function Badge({ tone = 'neutral', children, dot = false, title }) {
  return (
    <span className={`badge ${tone}`} title={title}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const labels = useLabels();
  return <Badge tone={STATUS_TONE[status] || 'neutral'} dot>{labels.status(status)}</Badge>;
}

export function SeverityBadge({ severity }) {
  const labels = useLabels();
  return <Badge tone={SEVERITY_TONE[severity] || 'neutral'}>{labels.rating(severity)}</Badge>;
}

const PROVENANCE_LABEL = {
  regulatory_requirement: 'Regulatory requirement',
  framework_guidance: 'Framework guidance',
  organizational_policy: 'Organisational policy',
  organizational_standard: 'Organisational standard',
  procedure: 'Procedure',
  implementation_guidance: 'Implementation guidance',
  ai_recommendation: 'AI-generated',
  user_input: 'Authored by a user',
  uploaded_source: 'Uploaded source'
};

const PROVENANCE_HELP = {
  regulatory_requirement: 'Comes from a regulation. Authoritative source material, reproduced as reference metadata.',
  framework_guidance: 'Comes from an adopted framework. Authoritative source material, reproduced as reference metadata.',
  organizational_policy: "The organisation's own policy position. Not a regulatory requirement.",
  organizational_standard: "The organisation's own standard. Not a regulatory requirement.",
  procedure: 'Operational steps defined by the organisation.',
  implementation_guidance: 'Advisory guidance. Creates no obligation.',
  ai_recommendation: 'Generated content. Review and approve before relying on it.',
  user_input: 'Authored or edited by a user of this platform.',
  uploaded_source: 'Extracted from a document uploaded to this platform.'
};

export function ProvenanceTag({ provenance }) {
  const { t } = useI18n();
  if (!provenance) return null;
  // The help text stays in the dictionary under provenanceHelp so the reason a
  // label matters is available in both languages, not only the label itself.
  const help = t(`provenanceHelp.${provenance}`);
  return (
    <span className={`provenance-tag ${provenance}`}
      title={help === provenance ? (PROVENANCE_HELP[provenance] || '') : help}>
      {t(`provenance.${provenance}`) === provenance
        ? (PROVENANCE_LABEL[provenance] || titleCase(provenance))
        : t(`provenance.${provenance}`)}
    </span>
  );
}

/* ------------------------------------------------------------------ card -- */

export function Card({ title, subtitle, actions, children, flush, footer, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          {title && <h3>{title}</h3>}
          {actions}
          {subtitle && <div className="card-head-sub">{subtitle}</div>}
        </header>
      )}
      <div className={flush ? 'card-body-flush' : 'card-body'}>{children}</div>
      {footer && <footer className="card-foot">{footer}</footer>}
    </section>
  );
}

export function Kpi({ label, value, meta, tone, progress, to, onClick }) {
  const Tag = to ? 'a' : onClick ? 'button' : 'div';
  const props = to ? { href: to } : onClick ? { onClick, type: 'button' } : {};
  return (
    <Tag className="kpi" style={Tag === 'button' ? { textAlign: 'left', font: 'inherit', cursor: 'pointer' } : undefined} {...props}>
      {tone && <span className={`kpi-accent ${tone}`} />}
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {meta && <span className="kpi-meta">{meta}</span>}
      {progress !== undefined && (
        <div className={`meter ${tone || ''}`}><span style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }} /></div>
      )}
    </Tag>
  );
}

/* ---------------------------------------------------------------- states -- */

export function Empty({ icon: Icon = IconInfo, title, children, action }) {
  return (
    <div className="empty">
      <Icon width={30} height={30} />
      {title && <h4>{title}</h4>}
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Loading({ label = 'Loading…' }) {
  return <div className="loading-block"><span className="spinner" />{label}</div>;
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="callout" data-callout="danger">
      <strong>Something went wrong</strong>
      <p>{error.message || String(error)}</p>
      {onRetry && <button className="btn btn-sm" onClick={onRetry} type="button">Try again</button>}
    </div>
  );
}

/* ----------------------------------------------------------------- modal -- */

export function Modal({ open, onClose, title, children, footer, size = '' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previous; };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close"><IconX /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}

export function Drawer({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className={`drawer ${wide ? 'drawer-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="drawer-head">
          <h3 className="truncate">{title}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close"><IconX /></button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer && <footer className="drawer-foot">{footer}</footer>}
      </aside>
    </>,
    document.body
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy}
            onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>
            {busy && <span className="spinner" style={{ width: 13, height: 13 }} />}{confirmLabel}
          </button>
        </>
      }>
      <p>{message}</p>
    </Modal>
  );
}

/* ---------------------------------------------------------------- toasts -- */

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, ...toast }]);
    setTimeout(() => dismiss(id), toast.duration || 5200);
  }, [dismiss]);

  const value = useMemo(() => ({
    push,
    success: (title, msg) => push({ tone: 'ok', title, msg }),
    error: (title, msg) => push({ tone: 'danger', title, msg, duration: 8000 }),
    info: (title, msg) => push({ tone: 'info', title, msg }),
    warn: (title, msg) => push({ tone: 'warn', title, msg })
  }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="toast-stack">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.tone || ''}`} role="status">
              {t.tone === 'ok' ? <IconCheck style={{ color: 'var(--ok)' }} />
                : t.tone === 'danger' ? <IconAlert style={{ color: 'var(--danger)' }} />
                : <IconInfo style={{ color: 'var(--info)' }} />}
              <div className="toast-body">
                <div className="toast-title">{t.title}</div>
                {t.msg && <div className="toast-msg">{t.msg}</div>}
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => dismiss(t.id)} aria-label="Dismiss"><IconX /></button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

/* ------------------------------------------------------------------ tabs -- */

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button key={tab.key} type="button" role="tab" aria-selected={active === tab.key}
          className={`tab ${active === tab.key ? 'active' : ''}`} onClick={() => onChange(tab.key)}>
          {tab.icon}
          {tab.label}
          {tab.count !== undefined && <span className="tab-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- forms -- */

export function Field({ label, hint, error, children, required }) {
  return (
    <div className="field">
      {label && (
        <label className="label">
          {label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}
        </label>
      )}
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}

export function Select({ value, onChange, options, placeholder, ...rest }) {
  return (
    <select className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? titleCase(o.value ?? o)}</option>
      ))}
    </select>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={`topbar-search ${className}`} style={{ maxWidth: 'none' }}>
      <IconSearch width={14} height={14} />
      <input className="input" style={{ paddingLeft: 30, paddingRight: 28 }} value={value}
        onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {value && (
        <button className="btn btn-ghost btn-icon btn-sm" style={{ position: 'absolute', right: 2 }}
          onClick={() => onChange('')} aria-label="Clear search"><IconX width={13} height={13} /></button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- collapsible */

export function Collapsible({ title, subtitle, defaultOpen = false, children, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card">
      <button type="button" className="card-head" onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', background: 'none', border: 'none', borderBottom: open ? '1px solid var(--border)' : 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
        <IconChevronRight style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s', flex: '0 0 auto', color: 'var(--text-muted)' }} />
        <h3 style={{ flex: 1 }}>{title}</h3>
        {badge}
        {subtitle && <div className="card-head-sub">{subtitle}</div>}
      </button>
      {open && <div className="card-body">{children}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- tables -- */

export function DataTable({ columns, rows, onRowClick, empty, keyOf, rowClass }) {
  if (!rows?.length) {
    return <div className="card-body">{empty || <Empty title="Nothing to show" />}</div>;
  }
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.align === 'right' ? 'num' : ''} style={c.width ? { width: c.width } : undefined}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={keyOf ? keyOf(row) : row.id || i}
              className={`${onRowClick ? 'clickable' : ''} ${rowClass ? rowClass(row) : ''}`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}>
              {columns.map((c) => (
                <td key={c.key} className={`${c.align === 'right' ? 'num' : ''} ${c.nowrap ? 'nowrap' : ''}`}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------ misc bits --- */

export function ScoreRing({ score, size = 76 }) {
  const tone = score >= 85 ? 'ok' : score >= 60 ? 'warn' : 'danger';
  const colour = { ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)' }[tone];
  const r = (size - 9) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="score-ring">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flex: '0 0 auto' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-sunken)" strokeWidth="7" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colour} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - Math.max(0, Math.min(score, 100)) / 100)}
          style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div>
        <div className="score-value" style={{ color: colour }}>{score}</div>
        <div className="tiny muted">out of 100</div>
      </div>
    </div>
  );
}

export function CoverageBar({ value, label }) {
  const tone = value >= 80 ? 'ok' : value >= 50 ? 'warn' : 'danger';
  return (
    <div style={{ minWidth: 118 }}>
      <div className="between" style={{ marginBottom: 2 }}>
        {label && <span className="tiny muted">{label}</span>}
        <span className="tiny strong">{value}%</span>
      </div>
      <div className={`meter ${tone}`}><span style={{ width: `${value}%` }} /></div>
    </div>
  );
}

/** Renders sanitised document HTML produced by the server. */
export function Prose({ html, className = '' }) {
  return <div className={`prose ${className}`} dangerouslySetInnerHTML={{ __html: html || '' }} />;
}
