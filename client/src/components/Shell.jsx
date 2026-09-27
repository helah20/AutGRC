/** Application shell: sidebar navigation, topbar, command palette. */

import { useEffect, useState, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { initials, relativeTime } from '../lib/format.js';
import { useI18n } from '../i18n/index.jsx';
import {
  IconDashboard, IconDocument, IconWand, IconUsers, IconGrid, IconShield, IconLayers,
  IconLink, IconArchive, IconChart, IconSettings, IconSearch, IconUpload, IconAlert,
  IconSun, IconMoon, IconLogout, IconMenu, IconBook, IconTarget, IconX, IconChevronRight,
  IconBell, IconInbox, IconCheck, IconTrash, IconGlobe
} from './Icons.jsx';

const NAV = [
  {
    labelKey: 'nav.overview',
    items: [
      { to: '/dashboard', labelKey: 'nav.dashboard', icon: IconDashboard },
      { to: '/my-work', labelKey: 'nav.myWork', icon: IconInbox, countKey: 'myWork', tone: 'warn' },
      { to: '/generator', labelKey: 'nav.generate', icon: IconWand, permission: 'generate:run' }
    ]
  },
  {
    labelKey: 'nav.library',
    items: [
      { to: '/documents', labelKey: 'nav.allDocuments', icon: IconDocument, countKey: 'totalDocuments' },
      { to: '/policies', labelKey: 'nav.policies', icon: IconBook, countKey: 'policies' },
      { to: '/standards', labelKey: 'nav.standards', icon: IconLayers, countKey: 'standards' },
      { to: '/procedures', labelKey: 'nav.procedures', icon: IconGrid, countKey: 'procedures' },
      { to: '/hierarchy', labelKey: 'nav.hierarchy', icon: IconLink }
    ]
  },
  {
    labelKey: 'nav.accountability',
    items: [
      { to: '/roles', labelKey: 'nav.roles', icon: IconUsers, countKey: 'roles' },
      { to: '/raci', labelKey: 'nav.raci', icon: IconGrid, countKey: 'raciMatrices' }
    ]
  },
  {
    labelKey: 'nav.controlEnvironment',
    items: [
      { to: '/controls', labelKey: 'nav.controls', icon: IconShield, countKey: 'controls' },
      { to: '/frameworks', labelKey: 'nav.frameworks', icon: IconLayers, countKey: 'frameworks' },
      { to: '/mappings', labelKey: 'nav.mappings', icon: IconLink },
      { to: '/evidence', labelKey: 'nav.evidence', icon: IconArchive, countKey: 'evidence' }
    ]
  },
  {
    labelKey: 'nav.risk',
    items: [
      { to: '/risks', labelKey: 'nav.riskRegister', icon: IconTarget, countKey: 'risks', permission: 'risk:read' },
      { to: '/actions', labelKey: 'nav.actions', icon: IconCheck, countKey: 'openActions', tone: 'warn' }
    ]
  },
  {
    labelKey: 'nav.assurance',
    items: [
      { to: '/gap-assessment', labelKey: 'nav.gapAssessment', icon: IconTarget },
      { to: '/soa', labelKey: 'nav.soa', icon: IconLayers },
      { to: '/findings', labelKey: 'nav.findings', icon: IconAlert, countKey: 'openFindings', tone: 'danger' },
      { to: '/imports', labelKey: 'nav.imports', icon: IconUpload, permission: 'import:write' },
      { to: '/reports', labelKey: 'nav.reports', icon: IconChart }
    ]
  }
];

export default function Shell({ children }) {
  const { user, org, logout, can } = useAuth();
  const { t, formatNumber } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [counts, setCounts] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('autgrc-theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('autgrc-theme', theme);
  }, [theme]);

  // Sidebar counts refresh whenever the route changes, so they stay truthful
  // after a generation or approval without a manual reload.
  useEffect(() => {
    let cancelled = false;
    api.get('/dashboard')
      .then((d) => { if (!cancelled) setCounts(d.kpis || {}); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [location.pathname]);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app-shell">
      <nav className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label={t('nav.mainNavigation')}>
        <div className="sidebar-brand">
          <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#2E6F9E" />
            <path d="M16 6l8 3.2v6.1c0 4.6-3.2 8.8-8 10.2-4.8-1.4-8-5.6-8-10.2V9.2L16 6z" fill="none" stroke="#DCE8F4" strokeWidth="1.8" />
            <path d="M12.2 16.2l2.7 2.7 5-5.2" fill="none" stroke="#DCE8F4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="sidebar-brand-text">
            <span className="sidebar-brand-name">AutGRC</span>
            <span className="sidebar-brand-sub">{t('app.tagline')}</span>
          </span>
        </div>

        <div className="sidebar-scroll">
          {NAV.map((group) => {
            const items = group.items.filter((i) => !i.permission || can(i.permission));
            if (!items.length) return null;
            return (
              <div key={group.label}>
                <div className="nav-group-label">{t(group.labelKey)}</div>
                {items.map((item) => {
                  const Icon = item.icon;
                  const count = item.countKey ? counts[item.countKey] : undefined;
                  return (
                    <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                      <Icon />
                      <span className="nav-item-label">{t(item.labelKey)}</span>
                      {count > 0 && <span className="nav-count">{formatNumber(count)}</span>}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
          <div className="nav-group-label">{t('nav.administration')}</div>
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconSettings /><span className="nav-item-label">{t('nav.settings')}</span>
          </NavLink>
        </div>

        <div className="sidebar-footer">
          <div className="truncate" title={org?.org_name}>{org?.org_name || 'Organisation'}</div>
          <div style={{ opacity: .75 }}>{t('app.version')}</div>
        </div>
      </nav>

      <div className="main-area">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon menu-toggle" onClick={() => setMenuOpen((o) => !o)} aria-label={t('nav.toggleNavigation')}>
            {menuOpen ? <IconX /> : <IconMenu />}
          </button>

          <button className="topbar-search" onClick={() => setPaletteOpen(true)} type="button"
            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }} aria-label={t('search.openSearch')}>
            <IconSearch width={14} height={14} />
            <input readOnly value="" placeholder={t('search.placeholder')} style={{ cursor: 'pointer' }} />
            <kbd>⌘K</kbd>
          </button>

          <div className="topbar-right">
            <LanguageSwitch />
            <NotificationBell />
            <button className="btn btn-ghost btn-icon" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? t('common.lightTheme') : t('common.darkTheme')} title={t('common.toggleTheme')}>
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
            </button>
            <div className="row-tight" style={{ paddingLeft: 6, borderLeft: '1px solid var(--border)' }}>
              <span className="avatar" title={user?.email}>{initials(user?.name)}</span>
              <div style={{ lineHeight: 1.25 }} className="hide-sm">
                <div className="small strong truncate" style={{ maxWidth: 150 }}>{user?.name}</div>
                <div className="tiny muted">{user?.roleLabel}</div>
              </div>
            </div>
            <button className="btn btn-ghost btn-icon" onClick={() => logout().then(() => navigate('/login'))}
              aria-label={t('common.signOut')} title={t('common.signOut')}><IconLogout /></button>
          </div>
        </header>

        <main className="page">{children}</main>
      </div>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}

/* ------------------------------------------------------------- language -- */

/**
 * Language and direction. Two languages need a toggle, not a dropdown, and
 * each option is written in its own script so it is recognisable to someone
 * who cannot read the other one.
 */
function LanguageSwitch() {
  const { language, setLanguage, languages, t } = useI18n();
  const next = languages.find((l) => l.code !== language) || languages[0];

  return (
    <button className="btn btn-ghost btn-sm lang-switch"
      onClick={() => setLanguage(next.code)}
      title={t('common.changeLanguage')}
      aria-label={`${t('common.changeLanguage')}: ${next.label}`}
      lang={next.code}>
      <IconGlobe width={14} height={14} />
      <span className="lang-switch-label">{next.native}</span>
    </button>
  );
}

/* ---------------------------------------------------------- notifications -- */

const SEVERITY_TONE = { danger: 'danger', warn: 'warn', info: 'info' };

/**
 * The inbox. Poll rather than push: one small count query every 60 seconds on
 * a locally installed single-process application is cheaper in every sense
 * than holding a socket open, and a minute-old badge is accurate enough for a
 * review that falls due in 30 days.
 */
function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState(null);

  const refreshCount = useCallback(async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      setUnread(res.unread || 0);
    } catch { /* a failed poll is not worth reporting */ }
  }, []);

  useEffect(() => {
    refreshCount();
    const timer = setInterval(refreshCount, 60_000);
    return () => clearInterval(timer);
  }, [refreshCount]);

  const loadItems = useCallback(async () => {
    try {
      const res = await api.get('/notifications?limit=20');
      setItems(res.items || []);
      setUnread(res.unread || 0);
    } catch { setItems([]); }
  }, []);

  useEffect(() => { if (open) loadItems(); }, [open, loadItems]);

  // Close on an outside click or Escape, the way the command palette does.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function openItem(item) {
    setOpen(false);
    if (!item.read_at) {
      api.post(`/notifications/${item.id}/read`).then(refreshCount).catch(() => {});
    }
    if (item.url) navigate(item.url);
  }

  async function markAll() {
    try {
      await api.post('/notifications/read-all');
      setUnread(0);
      loadItems();
    } catch { /* the badge will correct itself on the next poll */ }
  }

  async function dismiss(item) {
    try {
      await api.del(`/notifications/${item.id}`);
      setItems((list) => list.filter((n) => n.id !== item.id));
      refreshCount();
    } catch { /* leave it in place */ }
  }

  return (
    <div className="notif-wrap">
      <button className="btn btn-ghost btn-icon" onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open} title="Notifications">
        <IconBell />
        {unread > 0 && <span className="notif-dot">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <>
          <div className="notif-backdrop" onMouseDown={() => setOpen(false)} />
          <div className="notif-panel" role="dialog" aria-label="Notifications">
            <div className="notif-head">
              <strong>Notifications</strong>
              {unread > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={markAll}>
                  <IconCheck width={12} height={12} />Mark all read
                </button>
              )}
            </div>

            <div className="notif-list">
              {items === null && <div className="loading-block" style={{ padding: 20 }}><span className="spinner" />Loading…</div>}
              {items?.length === 0 && (
                <div className="empty" style={{ padding: 24 }}>
                  <p>Nothing to report. Approvals, review dates and evidence checks appear here.</p>
                </div>
              )}
              {items?.map((item) => (
                <div key={item.id} className={`notif-item ${item.read_at ? '' : 'unread'}`}>
                  <button type="button" className="notif-item-main" onClick={() => openItem(item)}>
                    <span className="notif-item-title">{item.title}</span>
                    {item.body && <span className="notif-item-body">{item.body}</span>}
                    <span className="notif-item-meta">
                      {item.actor_name ? `${item.actor_name} · ` : ''}{relativeTime(item.created_at)}
                    </span>
                  </button>
                  <div className="notif-item-side">
                    {item.severity !== 'info' && <span className={`notif-flag ${SEVERITY_TONE[item.severity]}`} aria-hidden="true" />}
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => dismiss(item)}
                      aria-label="Dismiss" title="Dismiss"><IconTrash width={12} height={12} /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="notif-foot">
              <button className="btn btn-sm" onClick={() => { setOpen(false); navigate('/my-work'); }}>
                Open My Work<IconChevronRight width={12} height={12} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------- command palette -- */

const ENTITY_ROUTE = {
  document: (r) => `/documents/${r.id}`,
  control: () => '/controls',
  role: (r) => `/roles/${r.id}`,
  framework_requirement: () => '/frameworks',
  evidence: () => '/evidence',
  raci_activity: (r) => r.url,
  gap_item: (r) => r.url
};

function CommandPalette({ onClose }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [groups, setGroups] = useState([]);
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    if (term.trim().length < 2) { setGroups([]); return undefined; }
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(term)}&limit=24`);
        setGroups(res.groups || []);
        setCursor(0);
      } catch { setGroups([]); }
      finally { setBusy(false); }
    }, 180);
    return () => clearTimeout(timer);
  }, [term]);

  const flat = groups.flatMap((g) => g.items.map((i) => ({ ...i, type: g.type, typeLabel: g.label })));

  const go = useCallback((hit) => {
    const route = ENTITY_ROUTE[hit.type]?.(hit) || hit.url || '/dashboard';
    navigate(route);
    onClose();
  }, [navigate, onClose]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, flat.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (flat[cursor]) go(flat[cursor]);
      else if (term.trim()) { navigate(`/search?q=${encodeURIComponent(term)}`); onClose(); }
    }
  };

  let index = -1;
  return (
    <div className="cmdk" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmdk-panel">
        <input className="cmdk-input" autoFocus value={term} onChange={(e) => setTerm(e.target.value)}
          onKeyDown={onKeyDown} placeholder="Search policies, standards, procedures, controls, requirements, roles, evidence…" />
        <div className="cmdk-results">
          {busy && <div className="loading-block" style={{ padding: 24 }}><span className="spinner" />Searching…</div>}
          {!busy && term.trim().length >= 2 && !flat.length && (
            <div className="empty" style={{ padding: 28 }}><p>No matches for “{term}”.</p></div>
          )}
          {!busy && term.trim().length < 2 && (
            <div style={{ padding: '10px 12px' }} className="small muted">
              Type at least two characters. Search covers documents, controls, framework requirements, roles, evidence, RACI activities and gap items.
            </div>
          )}
          {groups.map((group) => (
            <div key={group.type}>
              <div className="cmdk-section">{group.label}</div>
              {group.items.map((item) => {
                index += 1;
                const active = index === cursor;
                return (
                  <button key={`${group.type}-${item.id}`} type="button"
                    className={`cmdk-item ${active ? 'active' : ''}`}
                    style={{ width: '100%', border: 'none', background: active ? 'var(--bg-active)' : 'none', font: 'inherit', textAlign: 'left' }}
                    onClick={() => go({ ...item, type: group.type })}>
                    <span className="cmdk-item-title">{item.title}</span>
                    {item.badge && <span className="pill">{item.badge}</span>}
                    <IconChevronRight width={13} height={13} style={{ color: 'var(--text-faint)' }} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
