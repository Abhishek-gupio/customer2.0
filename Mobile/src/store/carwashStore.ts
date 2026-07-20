import { create } from 'zustand';

interface CarwashStoreState {
  /** Bumped on every booking create/cancel so subscribers can refetch without polling. */
  version: number;
  notifyBookingChanged: () => void;
}

export const useCarwashStore = create<CarwashStoreState>((set) => ({
  version: 0,
  notifyBookingChanged: () => set((s) => ({ version: s.version + 1 })),
}));
