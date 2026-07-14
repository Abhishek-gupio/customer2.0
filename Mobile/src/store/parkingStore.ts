import { create } from 'zustand';

interface ParkingStoreState {
  /** Bumped on every booking create/cancel so subscribers can refetch without polling. */
  version: number;
  lastBookingId: string | null;
  notifyBookingChanged: (bookingId?: string) => void;
}

export const useParkingStore = create<ParkingStoreState>((set) => ({
  version: 0,
  lastBookingId: null,
  notifyBookingChanged: (bookingId) =>
    set((state) => ({
      version: state.version + 1,
      lastBookingId: bookingId ?? state.lastBookingId,
    })),
}));
