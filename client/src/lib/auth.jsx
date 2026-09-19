import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { api, setAccessToken, onSessionLost } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Try to restore a session from the refresh cookie on first load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
        if (!res.ok) throw new Error('no session');
        const body = await res.json();
        if (cancelled) return;
        setAccessToken(body.accessToken);
        setSession(body);
      } catch {
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => onSessionLost(() => setSession(null)), []);

  const login = useCallback(async (email, password) => {
    const body = await api.post('/auth/login', { email, password });
    setAccessToken(body.accessToken);
    setSession(body);
    return body;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* already gone */ }
    setAccessToken(null);
    setSession(null);
  }, []);

  const refreshOrg = useCallback(async () => {
    const org = await api.get('/admin/org');
    setSession((s) => (s ? { ...s, org } : s));
    return org;
  }, []);

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    org: session?.org || null,
    permissions: session?.permissions || [],
    can: (permission) => (session?.permissions || []).includes(permission),
    loading,
    login,
    logout,
    refreshOrg
  }), [session, loading, login, logout, refreshOrg]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
