import { queryClient } from "./queryClient";

const BASE = "/api";

async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...opts,
  });
  if (res.status === 401 && !url.includes("/auth/")) {
    window.location.href = "/auth";
    throw new Error("Session expired");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(err.message);
  }
  return res.json();
}

export const api = {
  getConfig: () => fetchJson<{ googleClientId: string | null }>("/config"),

  authMe: () => fetchJson<any>("/auth/me"),
  authRegister: (data: { name: string; email: string; password: string }) =>
    fetchJson<any>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  authLogin: (data: { email: string; password: string }) =>
    fetchJson<any>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  authGoogle: (credential: string) =>
    fetchJson<any>("/auth/google", { method: "POST", body: JSON.stringify({ credential }) }),
  authLogout: () =>
    fetchJson<{ message: string }>("/auth/logout", { method: "POST" }),
  authForgotPassword: (email: string) =>
    fetchJson<any>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  authResetPassword: (token: string, password: string) =>
    fetchJson<any>("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }),

  createUser: (data: any) => fetchJson<any>("/users", { method: "POST", body: JSON.stringify(data) }),
  getUser: (id: string) => fetchJson<any>(`/users/${id}`),
  updateUser: (id: string, data: any) => fetchJson<any>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  getMessages: (userId: string) => fetchJson<any[]>(`/users/${userId}/messages`),
  sendMessage: (userId: string, text: string, localDate?: string, userTimezone?: string) =>
    fetchJson<{ userMessage: any; jaeMessage: any; water?: { awarded: boolean; fillPercent: number; cupsFilled: number; cupJustFilled: boolean; stageAdvanced: boolean; preResetFillPercent: number } }>(`/users/${userId}/messages`, {
      method: "POST",
      body: JSON.stringify({ text, localDate, userTimezone }),
    }),

  sendPhoto: (userId: string, data: { photoUrl: string; caption?: string; localDate?: string; uploadAttemptId?: string }) =>
    fetchJson<any>(`/users/${userId}/messages/photo`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getPhotoMemories: (userId: string) => fetchJson<any[]>(`/users/${userId}/photo-memories`),

  getEntries: (userId: string) => fetchJson<any[]>(`/users/${userId}/entries`),

  getAssessment: (userId: string) => fetchJson<any>(`/users/${userId}/assessment`),
  submitAssessment: (userId: string, answers: number[]) => fetchJson<any>(`/users/${userId}/assessment`, { method: "POST", body: JSON.stringify({ answers }) }),

  getConsistencySummary: (userId: string) => fetchJson<any>(`/users/${userId}/consistency-summary`),

  getActiveGoals: (userId: string) => fetchJson<any[]>(`/users/${userId}/goals`),
  getAllGoals: (userId: string) => fetchJson<any[]>(`/users/${userId}/goals/all`),
  createGoal: (userId: string, data: any) =>
    fetchJson<any>(`/users/${userId}/goals`, { method: "POST", body: JSON.stringify(data) }),
  updateGoal: (goalId: string, data: any) =>
    fetchJson<any>(`/goals/${goalId}`, { method: "PATCH", body: JSON.stringify(data) }),
  archiveGoal: (goalId: string) =>
    fetchJson<any>(`/goals/${goalId}/archive`, { method: "POST" }),
  completeGoal: (goalId: string, completionType?: string) =>
    fetchJson<any>(`/goals/${goalId}/complete`, { method: "POST", body: JSON.stringify({ completionType }) }),
  logGoalProgress: (goalId: string, data: { summary: string; mood?: string; progressValue?: number }) =>
    fetchJson<any>(`/goals/${goalId}/log`, { method: "POST", body: JSON.stringify(data) }),

  confirmProgress: (userId: string, rawText: string) =>
    fetchJson<any>(`/users/${userId}/confirm-progress`, {
      method: "POST",
      body: JSON.stringify({ rawText }),
    }),

  getGardenSummary: (userId: string) => fetchJson<any>(`/users/${userId}/garden-summary`),

  getWeeklyReviewStatus: (userId: string) => fetchJson<any>(`/users/${userId}/weekly-review/status`),
  generateWeeklyReview: (userId: string) => fetchJson<any>(`/users/${userId}/weekly-review/generate`, { method: "POST" }),
  completeWeeklyReview: (userId: string, reviewId: string) =>
    fetchJson<any>(`/users/${userId}/weekly-review/${reviewId}/complete`, { method: "POST" }),
  getWeeklyReviewHistory: (userId: string) => fetchJson<any[]>(`/users/${userId}/weekly-review/history`),

  getSubscription: (userId: string) => fetchJson<any>(`/users/${userId}/subscription`),

  getStripeConfig: () => fetchJson<{ configured: boolean }>("/stripe/config"),
  createStripeCheckout: (userId: string) =>
    fetchJson<{ url: string }>(`/users/${userId}/stripe/create-checkout`, { method: "POST" }),

  getGroundingJournal: (userId: string) =>
    fetchJson<{ entries: any[]; completed: boolean }>(`/users/${userId}/grounding-journal`),
  submitJournalEntry: (
    userId: string,
    data: { dayNumber: number; session: string; prompts: { prompt: string; response: string }[] }
  ) =>
    fetchJson<{ entry: any; jae: any }>(`/users/${userId}/grounding-journal/entry`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  saveJournalFollowUp: (userId: string, entryId: string, followUpResponse: string) =>
    fetchJson<any>(`/users/${userId}/grounding-journal/follow-up`, {
      method: "PATCH",
      body: JSON.stringify({ entryId, followUpResponse }),
    }),
  completeGroundingJournal: (userId: string) =>
    fetchJson<any>(`/users/${userId}/grounding-journal/complete`, { method: "POST" }),

  exportData: (userId: string) => fetch(`${BASE}/users/${userId}/export-data`, { credentials: "include" }),
  resetProgress: (userId: string) =>
    fetchJson<{ message: string }>(`/users/${userId}/reset-progress`, { method: "POST" }),
};
