/** Premium palette (Linear/Stripe style). No yellow – indigo accent only. */
export interface COLORS {
  Text: string;
  Background: string;
  Border: string;
  Primary: string;
  Secondary: string;
  Success: string;
  Warning: string;
  Error: string;
  Info: string;
  Light: string;
  Dark: string;
  /** Accent (indigo). Replaces previous yellow for premium look. */
  Yellow: string;
  Accent: string;
  AccentLight: string;
  Green: string;
  Red: string;
}

export const colors: COLORS = {
  Text: '#000000',
  Background: '#0a0a0a',
  Border: '#cccccc',
  Primary: '#fff',
  Secondary: '#888',
  Success: '#32D74B',
  Warning: '#5f9ea0',
  Error: '#ef4444',
  Info: '#6366f1',
  Light: '#f8f9fa',
  Dark: '#343a40',
  Yellow: '#6366f1',
  Accent: '#6366f1',
  AccentLight: '#818cf8',
  Green: '#22c55e',
  Red: '#ef4444',
};
