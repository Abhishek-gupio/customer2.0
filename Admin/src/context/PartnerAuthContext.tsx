import React, { createContext, useCallback, useContext, useState } from 'react';
import { partnerApi } from '../api/carwashPartnerClient';

interface Partner {
  id: string;
  name: string;
  status: string;
}

interface PartnerAuthState {
  partner: Partner | null;
  token: string | null;
}

const PartnerAuthContext = createContext<PartnerAuthState & {
  login: (phoneNumber: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
} | null>(null);

const TOKEN_KEY = 'washPartnerToken';
const PARTNER_KEY = 'washPartnerUser';

export function PartnerAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PartnerAuthState>(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const stored = localStorage.getItem(PARTNER_KEY);
    let partner: Partner | null = null;
    if (stored) {
      try {
        partner = JSON.parse(stored) as Partner;
      } catch {
        localStorage.removeItem(PARTNER_KEY);
      }
    }
    return { token, partner };
  });

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PARTNER_KEY);
    setState({ token: null, partner: null });
  }, []);

  const login = useCallback(async (phoneNumber: string, password: string) => {
    const res = await partnerApi.login(phoneNumber, password);
    if (!res.success) return { ok: false, error: res.error.message };
    const { accessToken, partner } = res.data;
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(PARTNER_KEY, JSON.stringify(partner));
    setState({ token: accessToken, partner });
    return { ok: true };
  }, []);

  return (
    <PartnerAuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </PartnerAuthContext.Provider>
  );
}

export function usePartnerAuth() {
  const ctx = useContext(PartnerAuthContext);
  if (!ctx) throw new Error('usePartnerAuth must be used within PartnerAuthProvider');
  return ctx;
}
