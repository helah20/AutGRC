/** Application shell: sidebar navigation, topbar, command palette. */

import { useEffect, useState, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { initials } from '../lib/format.js';
import {
  IconDashboard, IconDocument, IconWand, IconUsers, IconGrid, IconShield, IconLayers,
  IconLink, IconArchive, IconChart, IconSettings, IconSearch, IconUpload, IconAlert,
  IconSun, IconMoon, IconLogout, IconMenu, IconBook, IconTarget, IconX, IconChevronRight
} from './Icons.jsx';

const NAV = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: IconDashboard },
      { to: '/generator', label: 'Generate', icon: IconWand, permission: 'generate:run' }
    ]
  },
  {
    label: 'Governance Library',
    items: [
      { to: '/documents', label: 'All Documents', icon: IconDocument, countKey: 'totalDocuments' },
      { to: '/policies', label: 'Policies', icon: IconBook, countKey: 'policies' },
      { to: '/standards', label: 'Standards', icon: IconLayers, countKey: 'standards' },
      { to: '/procedures', label: 'Procedures', icon: IconGrid, countKey: 'procedures' },
      { to: '/hierarchy', label: 'Hierarchy', icon: IconLink }
    ]
  },
  {
    label: 'Accountability',
    items: [
      { to: '/roles', label: 'Roles', icon: IconUsers, countKey: 'roles' },
      { to: '/raci', label: 'RACI Matrices', icon: IconGrid, countKey: 'raciMatrices' }
    ]
  },
  {
    label: 'Control Environment',
    items: [
      { to: '/controls', label: 'Controls', icon: IconShield, countKey: 'controls' },
      { to: '/frameworks', label: 'Frameworks', icon: IconLayers, countKey: 'frameworks' },
      { to: '/mappings', label: 'Mappings', icon: IconLink },
      { to: '/evidence', label: 'Evidence', icon: IconArchive, countKey: 'evidence' }
    ]
  },
  {
    label: 'Assurance',
    items: [
      { to: '/gap-assessment', label: 'Gap Assessment', icon: IconTarget },
      { to: '/findings', label: 'Findings', icon: IconAlert, countKey: 'openFindings', tone: 'danger' },
      { to: '/imports', label: 'Import & Analyse', icon: IconUpload, permission: 'import:write' },
      { to: '/reports', label: 'Reports', icon: IconChart }
    ]
  }
];

export default function Shell({ children }) {
  const { user, org, logout, can } = useAuth();
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
      <nav className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#2E6F9E" />
            <path d="M16 6l8 3.2v6.1c0 4.6-3.2 8.8-8 10.2-4.8-1.4-8-5.6-8-10.2V9.2L16 6z" fill="none" stroke="#DCE8F4" strokeWidth="1.8" />
            <path d="M12.2 16.2l2.7 2.7 5-5.2" fill="none" stroke="#DCE8F4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="sidebar-brand-text">
            <span className="sidebar-brand-name">AutGRC</span>
            <span className="sidebar-brand-sub">Governance Platform</span>
          </span>
        </div>

        <div className="sidebar-scroll">
          {NAV.map((group) => {
            const items = group.items.filter((i) => !i.permission || can(i.permission));
            if (!items.length) return null;
            return (
              <div key={group.label}>
                <div className="nav-group-label">{group.label}</div>
                {items.map((item) => {
                  const Icon = item.icon;
                  const count = item.countKey ? counts[item.countKey] : undefined;
                  return (
                    <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                      <Icon />
                      <span className="nav-item-label">{item.label}</span>
                      {count > 0 && <span className="nav-count">{count}</span>}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
          <div className="nav-group-label">Administration</div>
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <IconSettings /><span className="nav-item-label">Settings</span>
          </NavLink>
        </div>

        <div className="sidebar-footer">
          <div className="truncate" title={org?.org_name}>{org?.org_name || 'Organisation'}</div>
          <div style={{ opacity: .75 }}>AutGRC v1.0</div>
        </div>
      </nav>

      <div className="main-area">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon menu-toggle" onClick={() => setMenuOpen((o) => !o)} aria-label="Toggle navigation">
            {menuOpen ? <IconX /> : <IconMenu />}
          </button>

          <button className="topbar-search" onClick={() => setPaletteOpen(true)} type="button"
            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }} aria-label="Open search">
            <IconSearch width={14} height={14} />
            <input readOnly value="" placeholder="Search policies, controls, requirements, roles…" style={{ cursor: 'pointer' }} />
            <kbd>⌘K</kbd>
          </button>

          <div className="topbar-right">
            <button className="btn btn-ghost btn-icon" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title="Toggle theme">
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
              aria-label="Sign out" title="Sign out"><IconLogout /></button>
          </div>
        </header>

        <main className="page">{children}</main>
      </div>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
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
