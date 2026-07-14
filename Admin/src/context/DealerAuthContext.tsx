import React, { createContext, useCallback, useContext, useState } from 'react';
import { dealerApi } from '../api/dealerClient';

interface Dealer {
  id: string;
  ownerName: string;
  status: string;
}

interface DealerAuthState {
  dealer: Dealer | null;
  token: string | null;
}

const DealerAuthContext = createContext<DealerAuthState & {
  login: (phoneNumber: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
} | null>(null);

const TOKEN_KEY = 'dealerToken';
const DEALER_KEY = 'dealerUser';

export function DealerAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DealerAuthState>(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const stored = localStorage.getItem(DEALER_KEY);
    let dealer: Dealer | null = null;
    if (stored) {
      try {
        dealer = JSON.parse(stored) as Dealer;
      } catch {
        localStorage.removeItem(DEALER_KEY);
      }
    }
    return { token, dealer };
  });

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(DEALER_KEY);
    setState({ token: null, dealer: null });
  }, []);

  const login = useCallback(async (phoneNumber: string, password: string) => {
    const res = await dealerApi.login(phoneNumber, password);
    if (!res.success) return { ok: false, error: res.error.message };
    const { accessToken, dealer } = res.data;
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(DEALER_KEY, JSON.stringify(dealer));
    setState({ token: accessToken, dealer });
    return { ok: true };
  }, []);

  return (
    <DealerAuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </DealerAuthContext.Provider>
  );
}

export function useDealerAuth() {
  const ctx = useContext(DealerAuthContext);
  if (!ctx) throw new Error('useDealerAuth must be used within DealerAuthProvider');
  return ctx;
}
