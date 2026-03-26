import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { adminApi } from '../api/client';

type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT';

interface Admin {
  id: string;
  email: string;
  name?: string | null;
  role: AdminRole;
}

interface AuthState {
  admin: Admin | null;
  token: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState & {
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signup: (data: { email: string; password: string; name?: string; role?: string }) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  hasRole: (...roles: AdminRole[]) => boolean;
} | null>(null);

const TOKEN_KEY = 'adminToken';
const ADMIN_KEY = 'adminUser';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    admin: null,
    token: localStorage.getItem(TOKEN_KEY),
    loading: true,
  });

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
    setState({ admin: null, token: null, loading: false });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    const stored = localStorage.getItem(ADMIN_KEY);
    if (stored) {
      try {
        const admin = JSON.parse(stored) as Admin;
        setState((s) => ({ ...s, admin, loading: false }));
        return;
      } catch {
        localStorage.removeItem(ADMIN_KEY);
      }
    }
    adminApi.me().then((res) => {
      if (res.success && res.data.admin) {
        const admin = res.data.admin as Admin;
        localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
        setState((s) => ({ ...s, admin, loading: false }));
      } else {
        logout();
      }
    }).catch(() => logout());
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await adminApi.login(email, password);
    if (!res.success) {
      return { ok: false, error: res.error.message };
    }
    const { accessToken, admin } = res.data;
    const adminTyped: Admin = { ...admin, role: admin.role as AdminRole };
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(adminTyped));
    setState({ admin: adminTyped, token: accessToken, loading: false });
    return { ok: true };
  }, []);

  const hasRole = useCallback((...roles: AdminRole[]) => {
    return state.admin ? roles.includes(state.admin.role) : false;
  }, [state.admin]);

  const signup = useCallback(async (data: { email: string; password: string; name?: string; role?: string }) => {
    const res = await adminApi.signup(data);
    if (!res.success) {
      return { ok: false, error: res.error.message };
    }
    return { ok: true };
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, signup, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
