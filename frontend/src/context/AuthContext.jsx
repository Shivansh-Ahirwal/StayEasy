import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api, setAuthToken } from '../services/api';

const AuthContext = createContext(null);

const STORAGE_KEY = 'yoyo_tokens';

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [tokens, setTokens] = useState(() => loadStored());
  const [user, setUser] = useState(null);

  const refreshMe = useCallback(async () => {
    if (!tokens?.access) {
      setUser(null);
      return null;
    }
    const me = await api.get('/auth/me/');
    setUser(me.data);
    return me.data;
  }, [tokens?.access]);

  React.useEffect(() => {
    if (tokens?.access) {
      setAuthToken(tokens.access);
      refreshMe()
        .catch(() => {
          setUser(null);
          setTokens(null);
          localStorage.removeItem(STORAGE_KEY);
          setAuthToken(null);
        });
    } else {
      setAuthToken(null);
      setUser(null);
    }
  }, [tokens]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login/', { email, password });
    const next = { access: data.access, refresh: data.refresh };
    setTokens(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setAuthToken(data.access);
    const me = await api.get('/auth/me/');
    setUser(me.data);
    return me.data;
  };

  const register = async (payload) => {
    await api.post('/auth/register/', payload);
  };

  const logout = () => {
    setTokens(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
  };

  const value = useMemo(
    () => ({
      user,
      tokens,
      login,
      register,
      logout,
      refreshMe,
      isAuthenticated: Boolean(tokens?.access),
    }),
    [user, tokens, refreshMe],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
