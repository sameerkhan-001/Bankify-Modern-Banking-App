import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler } from '../services/api.js';
import { clearAccountsCache } from '../hooks/useAccounts.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true until the first /auth/me answers

  // Restore the session on page load (the httpOnly cookie is sent automatically).
  useEffect(() => {
    let active = true;
    setUnauthorizedHandler(() => {
      clearAccountsCache();
      setUser(null);
    });

    api
      .me()
      .then((data) => active && setUser(data.user))
      .catch(() => active && setUser(null))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
      setUnauthorizedHandler(null);
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login({ email, password });
    clearAccountsCache();
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const data = await api.register({ name, email, password });
    clearAccountsCache();
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      clearAccountsCache();
      setUser(null); // always clear local state, even if the request failed
    }
  }, []);

  // Re-reads the user from the server (e.g. to learn that hasPin became true).
  const refreshUser = useCallback(async () => {
    const data = await api.me();
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout, refreshUser }), [user, loading, login, register, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
