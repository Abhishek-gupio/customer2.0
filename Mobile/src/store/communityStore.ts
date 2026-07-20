import { create } from 'zustand';

interface CommunityStoreState {
  /** Bumped after a post/comment/join action so the feed refetches. */
  version: number;
  bumpVersion: () => void;
}

export const useCommunityStore = create<CommunityStoreState>((set) => ({
  version: 0,
  bumpVersion: () => set((s) => ({ version: s.version + 1 })),
}));
