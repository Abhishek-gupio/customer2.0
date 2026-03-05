import { asyncHandler } from "../utils/asyncHandler";

// State-level fuel price mapping (as provided by user)
const STATE_PRICES: Record<string, { PETROL: number; DIESEL: number }> = {
  "Andhra Pradesh": { PETROL: 108.98, DIESEL: 96.22 },
  Assam: { PETROL: 96.38, DIESEL: 89.42 },
  Bihar: { PETROL: 105.6, DIESEL: 91.67 },
  Chandigarh: { PETROL: 94.24, DIESEL: 82.45 },
  Delhi: { PETROL: 94.77, DIESEL: 87.67 },
  Gujarat: { PETROL: 95.0, DIESEL: 90.27 },
  Haryana: { PETROL: 95.3, DIESEL: 88.4 },
  Karnataka: { PETROL: 100.23, DIESEL: 90.99 },
  Kerala: { PETROL: 106.4, DIESEL: 96.18 },
  "Madhya Pradesh": { PETROL: 108.28, DIESEL: 91.89 },
  Maharashtra: { PETROL: 104.44, DIESEL: 90.03 },
  Punjab: { PETROL: 96.7, DIESEL: 82.45 },
  Rajasthan: { PETROL: 104.69, DIESEL: 89.93 },
  "Tamil Nadu": { PETROL: 101.57, DIESEL: 92.39 },
  Telangana: { PETROL: 109.65, DIESEL: 95.7 },
  "Uttar Pradesh": { PETROL: 94.42, DIESEL: 87.81 },
  "West Bengal": { PETROL: 105.01, DIESEL: 91.82 },
};

export const stateFuelService = {
  normalizeState(state?: string) {
    if (!state) return null;
    const key = state
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/\bstate\b/i, "")
      .trim();

    // Try exact match first
    for (const s of Object.keys(STATE_PRICES)) {
      if (s.toLowerCase() === key) return s;
    }

    // Try startsWith or includes
    for (const s of Object.keys(STATE_PRICES)) {
      if (s.toLowerCase().startsWith(key) || s.toLowerCase().includes(key)) {
        return s;
      }
    }

    return null;
  },

  async getByState(state?: string) {
    const normalized = this.normalizeState(state);
    if (!normalized) return null;
    return STATE_PRICES[normalized];
  },
};
