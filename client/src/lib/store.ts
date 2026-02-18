import { create } from 'zustand';

type AppState = {
  userId: string | null;
  setUserId: (id: string) => void;
};

export const useStore = create<AppState>((set) => ({
  userId: localStorage.getItem('mustard_seed_user_id'),
  setUserId: (id) => {
    localStorage.setItem('mustard_seed_user_id', id);
    set({ userId: id });
  },
}));
