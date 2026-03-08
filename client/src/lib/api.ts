import { queryClient } from "./queryClient";

const BASE = "/api";

async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(err.message);
  }
  return res.json();
}

export const api = {
  createUser: (data: any) => fetchJson<any>("/users", { method: "POST", body: JSON.stringify(data) }),
  getUser: (id: string) => fetchJson<any>(`/users/${id}`),
  updateUser: (id: string, data: any) => fetchJson<any>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  getMessages: (userId: string) => fetchJson<any[]>(`/users/${userId}/messages`),
  sendMessage: (userId: string, text: string) =>
    fetchJson<{ userMessage: any; jaeMessage: any; water?: { awarded: boolean; fillPercent: number; cupsFilled: number; cupJustFilled: boolean; stageAdvanced: boolean; preResetFillPercent: number } }>(`/users/${userId}/messages`, {
      method: "POST",
      body: JSON.stringify({ text }),
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

  getGardenSummary: (userId: string) => fetchJson<any>(`/users/${userId}/garden-summary`),

  getWeeklyReviewStatus: (userId: string) => fetchJson<any>(`/users/${userId}/weekly-review/status`),
  generateWeeklyReview: (userId: string) => fetchJson<any>(`/users/${userId}/weekly-review/generate`, { method: "POST" }),
  completeWeeklyReview: (userId: string, reviewId: string) =>
    fetchJson<any>(`/users/${userId}/weekly-review/${reviewId}/complete`, { method: "POST" }),
  getWeeklyReviewHistory: (userId: string) => fetchJson<any[]>(`/users/${userId}/weekly-review/history`),

  getSubscription: (userId: string) => fetchJson<any>(`/users/${userId}/subscription`),
  getSubscriptionPlans: () => fetchJson<any>(`/subscription/plans`),
  createCheckout: (userId: string, priceId: string) =>
    fetchJson<{ url: string }>(`/users/${userId}/checkout`, { method: "POST", body: JSON.stringify({ priceId }) }),
  createPortalSession: (userId: string) =>
    fetchJson<{ url: string }>(`/users/${userId}/portal`, { method: "POST" }),
};
