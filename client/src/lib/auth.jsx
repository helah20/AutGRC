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

  /**
   * Returns the session, or an MFA challenge. A challenge is not a session:
   * the token it carries cannot reach any route until a code completes it.
   */
  const login = useCallback(async (email, password) => {
    const body = await api.post('/auth/login', { email, password });
    if (body.mfaRequired) return body;
    setAccessToken(body.accessToken);
    setSession(body);
    return body;
  }, []);

  const completeMfa = useCallback(async (mfaToken, code) => {
    const body = await api.post('/auth/mfa/verify', { mfaToken, code });
    setAccessToken(body.accessToken);
    setSession(body);
    return body;
  }, []);

  /** After enrolling or changing a password, the session state has moved on. */
  const applySession = useCallback((body) => {
    if (body?.accessToken) setAccessToken(body.accessToken);
    setSession((s) => ({ ...s, ...body }));
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
    completeMfa,
    applySession,
    logout,
    refreshOrg,
    // Non-null when the account may do nothing but clear this state.
    accountBlock: session?.accountBlock || null
  }), [session, loading, login, completeMfa, applySession, logout, refreshOrg]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
