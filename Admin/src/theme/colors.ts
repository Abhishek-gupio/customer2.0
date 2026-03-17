/**
 * Premium admin theme – Linear/Stripe style: deep neutral + indigo (no yellow)
 */
export const colors = {
  text: '#fafafa',
  background: '#09090b',
  border: 'rgba(255,255,255,0.06)',
  primary: '#fafafa',
  secondary: '#a1a1aa',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#6366f1',
  light: '#18181b',
  dark: '#09090b',
  accent: '#6366f1',
  accentLight: '#818cf8',
} as const;

export type ThemeColors = typeof colors;
