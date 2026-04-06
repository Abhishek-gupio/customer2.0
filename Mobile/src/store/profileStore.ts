import { create } from 'zustand';
import { getProfile, type ProfileResponse } from '../services/profileService';

const PROFILE_CACHE_TTL_MS = 60_000;
let profileLoadPromise: Promise<ProfileResponse | null> | null = null;

type LoadProfileOptions = {
  force?: boolean;
  maxAgeMs?: number;
};

type ProfileStore = {
  profile: ProfileResponse | null;
  loading: boolean;
  error: string | null;
  fetchedAt: number | null;
  setProfile: (profile: ProfileResponse | null) => void;
  clearProfile: () => void;
  loadProfile: (options?: LoadProfileOptions) => Promise<ProfileResponse | null>;
};

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profile: null,
  loading: false,
  error: null,
  fetchedAt: null,
  setProfile: (profile) =>
    set({
      profile,
      error: null,
      fetchedAt: profile ? Date.now() : null,
      loading: false,
    }),
  clearProfile: () =>
    set({
      profile: null,
      error: null,
      fetchedAt: null,
      loading: false,
    }),
  loadProfile: async (options) => {
    const { profile, fetchedAt, loading } = get();
    const force = options?.force ?? false;
    const maxAgeMs = options?.maxAgeMs ?? PROFILE_CACHE_TTL_MS;
    const now = Date.now();

    if (!force && profile && fetchedAt && now - fetchedAt < maxAgeMs) {
      return profile;
    }

    if (loading && profileLoadPromise) {
      return profileLoadPromise;
    }

    set({ loading: true, error: null });

    profileLoadPromise = (async () => {
      try {
        const nextProfile = await getProfile();
        set({
          profile: nextProfile,
          loading: false,
          error: null,
          fetchedAt: Date.now(),
        });
        return nextProfile;
      } catch (error: any) {
        set({
          loading: false,
          error: error?.message || 'Failed to load profile',
        });
        return get().profile;
      } finally {
        profileLoadPromise = null;
      }
    })();

    return profileLoadPromise;
  },
}));

export function loadCachedProfile(options?: LoadProfileOptions): Promise<ProfileResponse | null> {
  return useProfileStore.getState().loadProfile(options);
}

export function setCachedProfile(profile: ProfileResponse | null): void {
  useProfileStore.getState().setProfile(profile);
}

export function clearCachedProfile(): void {
  useProfileStore.getState().clearProfile();
}
