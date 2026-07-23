import React, { createContext, useCallback, useContext, useState } from 'react';
import { employeeApi } from '../api/employeeClient';

interface Employee {
  id: string;
  name: string;
}

interface EmployeeAuthState {
  employee: Employee | null;
  token: string | null;
}

const EmployeeAuthContext = createContext<EmployeeAuthState & {
  login: (phoneNumber: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
} | null>(null);

const TOKEN_KEY = 'parkingEmployeeToken';
const EMPLOYEE_KEY = 'parkingEmployeeUser';

export function EmployeeAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<EmployeeAuthState>(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const stored = localStorage.getItem(EMPLOYEE_KEY);
    let employee: Employee | null = null;
    if (stored) {
      try {
        employee = JSON.parse(stored) as Employee;
      } catch {
        localStorage.removeItem(EMPLOYEE_KEY);
      }
    }
    return { token, employee };
  });

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMPLOYEE_KEY);
    setState({ token: null, employee: null });
  }, []);

  const login = useCallback(async (phoneNumber: string, password: string) => {
    const res = await employeeApi.login(phoneNumber, password);
    if (!res.success) return { ok: false, error: res.error.message };
    const { accessToken, employee } = res.data;
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(EMPLOYEE_KEY, JSON.stringify(employee));
    setState({ token: accessToken, employee });
    return { ok: true };
  }, []);

  return (
    <EmployeeAuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </EmployeeAuthContext.Provider>
  );
}

export function useEmployeeAuth() {
  const ctx = useContext(EmployeeAuthContext);
  if (!ctx) throw new Error('useEmployeeAuth must be used within EmployeeAuthProvider');
  return ctx;
}
