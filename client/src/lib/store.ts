import { create } from 'zustand';

type AppState = {
  userId: string | null;
  onboardingCompleted: boolean;
  setUserId: (id: string) => void;
  completeOnboarding: () => void;
};

export const useStore = create<AppState>((set) => ({
  userId: localStorage.getItem('mustard_seed_user_id'),
  onboardingCompleted: localStorage.getItem('mustard_seed_onboarding_completed') === 'true',
  setUserId: (id) => {
    localStorage.setItem('mustard_seed_user_id', id);
    set({ userId: id });
  },
  completeOnboarding: () => {
    localStorage.setItem('mustard_seed_onboarding_completed', 'true');
    set({ onboardingCompleted: true });
  },
}));
