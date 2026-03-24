import { create } from 'zustand';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AppState = {
  userId: string | null;
  authStatus: AuthStatus;
  onboardingCompleted: boolean;
  progressSyncing: boolean;
  setUserId: (id: string) => void;
  setAuthStatus: (status: AuthStatus) => void;
  completeOnboarding: () => void;
  setProgressSyncing: (syncing: boolean) => void;
  signOut: () => void;
};

export const useStore = create<AppState>((set) => ({
  userId: null,
  authStatus: 'loading',
  onboardingCompleted: localStorage.getItem('mustard_seed_onboarding_completed') === 'true',
  progressSyncing: false,
  setUserId: (id) => {
    set({ userId: id });
  },
  setAuthStatus: (status) => set({ authStatus: status }),
  completeOnboarding: () => {
    localStorage.setItem('mustard_seed_onboarding_completed', 'true');
    set({ onboardingCompleted: true });
  },
  setProgressSyncing: (syncing) => set({ progressSyncing: syncing }),
  signOut: () => {
    localStorage.removeItem('mustard_seed_onboarding_completed');
    set({ userId: null, authStatus: 'unauthenticated', onboardingCompleted: false });
  },
}));
