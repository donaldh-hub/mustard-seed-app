import { create } from 'zustand';

export type Message = {
  id: string;
  text: string;
  sender: 'user' | 'jae';
  timestamp: Date;
  type?: 'text' | 'prompt' | 'summary';
};

export type UserProfile = {
  name: string;
  goals: string[];
  struggles: string[];
  commitmentLevel: 'casual' | 'serious' | 'intense';
};

type AppState = {
  // Navigation
  currentView: 'welcome' | 'assessment' | 'home' | 'progress' | 'calendar' | 'profile';
  setView: (view: AppState['currentView']) => void;

  // User Data
  profile: UserProfile;
  updateProfile: (data: Partial<UserProfile>) => void;
  isOnboarded: boolean;
  completeOnboarding: () => void;

  // Chat
  messages: Message[];
  addMessage: (msg: Omit<Message, 'id' | 'timestamp'>) => void;
  isTyping: boolean;
  setTyping: (typing: boolean) => void;

  // Gamification (Tree)
  waterLevel: number;
  treeStage: number; // 1-5
  streak: number;
  waterTree: () => void;

  // Calendar/Memory
  entries: Record<string, { summary: string; mood: 'happy' | 'neutral' | 'sad' }>;
  addEntry: (date: string, summary: string, mood: 'happy' | 'neutral' | 'sad') => void;
};

export const useStore = create<AppState>((set) => ({
  currentView: 'welcome',
  setView: (view) => set({ currentView: view }),

  profile: {
    name: '',
    goals: [],
    struggles: [],
    commitmentLevel: 'serious',
  },
  updateProfile: (data) => set((state) => ({ profile: { ...state.profile, ...data } })),
  isOnboarded: false,
  completeOnboarding: () => set({ isOnboarded: true, currentView: 'home' }),

  messages: [
    {
      id: 'welcome-1',
      text: "Hi, I'm Jae. I'm here to help you grow, one small step at a time. Ready to begin?",
      sender: 'jae',
      timestamp: new Date(),
    }
  ],
  addMessage: (msg) => set((state) => ({
    messages: [...state.messages, { ...msg, id: Math.random().toString(36), timestamp: new Date() }]
  })),
  isTyping: false,
  setTyping: (typing) => set({ isTyping: typing }),

  waterLevel: 30,
  treeStage: 1,
  streak: 0,
  waterTree: () => set((state) => {
    const newLevel = Math.min(state.waterLevel + 20, 100);
    const newStage = newLevel >= 100 && state.treeStage < 5 ? state.treeStage + 1 : state.treeStage;
    return { 
      waterLevel: newLevel >= 100 ? 0 : newLevel, 
      treeStage: newStage 
    };
  }),

  entries: {},
  addEntry: (date, summary, mood) => set((state) => ({
    entries: { ...state.entries, [date]: { summary, mood } }
  })),
}));
