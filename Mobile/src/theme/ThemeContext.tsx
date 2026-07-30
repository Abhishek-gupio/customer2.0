import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { getThemeMode, setThemeMode as persistThemeMode } from '../services/storage';

export type ThemeMode = 'dark' | 'light';

export interface ThemeColors {
  /** Screen background. */
  background: string;
  /** Card / grouped-section background, one step up from background. */
  surface: string;
  /** Inset element background (icon wells, pills), one step further from background than surface. */
  surfaceSunken: string;
  /** Hairline dividers and card borders. */
  border: string;
  /** Primary text/title color. */
  textPrimary: string;
  /** Secondary text (subtitles, descriptions). */
  textSecondary: string;
  /** Faint/tertiary text (footers, timestamps). */
  textMuted: string;
  /** StatusBar style matching this theme. */
  statusBarStyle: 'light-content' | 'dark-content';
}

const darkColors: ThemeColors = {
  background: '#000000',
  surface: '#121212',
  surfaceSunken: '#000000',
  border: 'rgba(255,255,255,0.08)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.55)',
  textMuted: '#444444',
  statusBarStyle: 'light-content',
};

const lightColors: ThemeColors = {
  background: '#FFFFFF',
  surface: '#F4F4F6',
  surfaceSunken: '#ECECEF',
  border: 'rgba(0,0,0,0.08)',
  textPrimary: '#15161A',
  textSecondary: 'rgba(15,16,20,0.55)',
  textMuted: '#9AA0A6',
  statusBarStyle: 'dark-content',
};

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  colors: darkColors,
  setMode: () => {},
  toggleMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => getThemeMode() ?? 'dark');

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    persistThemeMode(next);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState(prev => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      persistThemeMode(next);
      return next;
    });
  }, []);

  const colors = mode === 'dark' ? darkColors : lightColors;

  const value = useMemo(
    () => ({ mode, colors, setMode, toggleMode }),
    [mode, colors, setMode, toggleMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
