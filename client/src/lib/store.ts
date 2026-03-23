import { create } from 'zustand';

type AppState = {
  userId: string | null;
  onboardingCompleted: boolean;
  progressSyncing: boolean;
  setUserId: (id: string) => void;
  completeOnboarding: () => void;
  setProgressSyncing: (syncing: boolean) => void;
};

export const useStore = create<AppState>((set) => ({
  userId: localStorage.getItem('mustard_seed_user_id'),
  onboardingCompleted: localStorage.getItem('mustard_seed_onboarding_completed') === 'true',
  progressSyncing: false,
  setUserId: (id) => {
    localStorage.setItem('mustard_seed_user_id', id);
    set({ userId: id });
  },
  completeOnboarding: () => {
    localStorage.setItem('mustard_seed_onboarding_completed', 'true');
    set({ onboardingCompleted: true });
  },
  setProgressSyncing: (syncing) => set({ progressSyncing: syncing }),
}));
