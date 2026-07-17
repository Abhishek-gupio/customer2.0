import React, { createContext, useCallback, useContext, useState } from 'react';
import { technicianApi } from '../api/carwashTechnicianClient';

interface Technician {
  id: string;
  name: string;
}

interface TechnicianAuthState {
  technician: Technician | null;
  token: string | null;
}

const TechnicianAuthContext = createContext<TechnicianAuthState & {
  login: (phoneNumber: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
} | null>(null);

const TOKEN_KEY = 'washTechnicianToken';
const TECHNICIAN_KEY = 'washTechnicianUser';

export function TechnicianAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TechnicianAuthState>(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const stored = localStorage.getItem(TECHNICIAN_KEY);
    let technician: Technician | null = null;
    if (stored) {
      try {
        technician = JSON.parse(stored) as Technician;
      } catch {
        localStorage.removeItem(TECHNICIAN_KEY);
      }
    }
    return { token, technician };
  });

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TECHNICIAN_KEY);
    setState({ token: null, technician: null });
  }, []);

  const login = useCallback(async (phoneNumber: string, password: string) => {
    const res = await technicianApi.login(phoneNumber, password);
    if (!res.success) return { ok: false, error: res.error.message };
    const { accessToken, technician } = res.data;
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(TECHNICIAN_KEY, JSON.stringify(technician));
    setState({ token: accessToken, technician });
    return { ok: true };
  }, []);

  return (
    <TechnicianAuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </TechnicianAuthContext.Provider>
  );
}

export function useTechnicianAuth() {
  const ctx = useContext(TechnicianAuthContext);
  if (!ctx) throw new Error('useTechnicianAuth must be used within TechnicianAuthProvider');
  return ctx;
}
