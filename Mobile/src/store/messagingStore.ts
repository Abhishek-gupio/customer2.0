import { create } from 'zustand';

interface MessagingStoreState {
  /** Bumped whenever a conversation changes (new message, status, read) so the inbox refetches. */
  version: number;
  bumpVersion: () => void;
}

export const useMessagingStore = create<MessagingStoreState>((set) => ({
  version: 0,
  bumpVersion: () => set((s) => ({ version: s.version + 1 })),
}));
