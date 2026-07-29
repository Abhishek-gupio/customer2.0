import { create } from 'zustand';

interface CommunityStoreState {
  /** Bumped after a post/comment/join action so the feed refetches. */
  version: number;
  bumpVersion: () => void;
  /** Keep track of post IDs liked by the current user locally. */
  likedPosts: Record<string, boolean>;
  /** Toggle the liked status of a post. */
  toggleLike: (postId: string) => void;
  /** Set the liked status explicitly. */
  setLiked: (postId: string, liked: boolean) => void;
}

export const useCommunityStore = create<CommunityStoreState>((set) => ({
  version: 0,
  bumpVersion: () => set((s) => ({ version: s.version + 1 })),
  likedPosts: {},
  toggleLike: (postId) =>
    set((s) => {
      const next = { ...s.likedPosts };
      next[postId] = !next[postId];
      return { likedPosts: next };
    }),
  setLiked: (postId, liked) =>
    set((s) => {
      const next = { ...s.likedPosts };
      next[postId] = liked;
      return { likedPosts: next };
    }),
}));
