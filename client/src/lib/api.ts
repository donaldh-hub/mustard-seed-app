import { queryClient } from "./queryClient";
import { getLocalDateStr, getUserTimezone } from "./dateUtils";

// Stamp writes with the device's calendar day so entries, streaks and the
// calendar agree with the user's clock rather than the server's (UTC).
const localDateFields = () => ({ localDate: getLocalDateStr(), userTimezone: getUserTimezone() });

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

export type SafetyMessage = { from: "jae" | "user"; text: string };

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
  authChangeEmail: (newEmail: string, password: string) =>
    fetchJson<{ message: string; user: any }>("/auth/change-email", { method: "POST", body: JSON.stringify({ newEmail, password }) }),

  getUser: (id: string) => fetchJson<any>(`/users/${id}`),
  updateUser: (id: string, data: any) => fetchJson<any>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  getMessages: (userId: string) => fetchJson<any[]>(`/users/${userId}/messages`),
  sendMessage: (userId: string, text: string, localDate?: string, userTimezone?: string) =>
    fetchJson<{
      userMessage: any;
      jaeMessage: any;
      titan?: { category: string; actionPoints: number; insightPoints: number; driftMarkers: number };
      water?: {
        awarded: boolean;
        fillPercent: number;
        cupsFilled: number;
        cupJustFilled: boolean;
        stageAdvanced: boolean;
        preResetFillPercent: number;
        actionPointsAccumulated: number;
        rewardTransaction: string;
        progressFeedback?: { completedUnits: number; targetUnits: number; percentComplete: number; feedbackText: string; momentumBoostActive: boolean } | null;
      } | null;
      entryQualification?: string; reflectionSaved?: boolean; goalPlanted?: boolean | null;
      goalCompleted?: unknown;
    }>(`/users/${userId}/messages`, {
      method: "POST",
      body: JSON.stringify({ text, localDate, userTimezone }),
    }),

  askSupport: (userId: string, text: string) =>
    fetchJson<{ outcome: string; answer: string; libraryEntryId?: string | null; escalationReason?: string | null }>(`/users/${userId}/support/ask`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  sendPhoto: (userId: string, data: {
    photoUrl: string; caption?: string; localDate?: string; uploadAttemptId?: string;
    source?: "camera" | "gallery"; contentHash?: string | null; lastModified?: number | null; capturedAt?: number | null; userTimezone?: string;
  }) =>
    fetchJson<any>(`/users/${userId}/messages/photo`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getPhotoMemories: (userId: string) => fetchJson<any[]>(`/users/${userId}/photo-memories`),

  getEntries: (userId: string) => fetchJson<any[]>(`/users/${userId}/entries`),

  getAssessment: (userId: string) => fetchJson<any>(`/users/${userId}/assessment`),
  // "Talk with Jai about this heartbeat": the server posts Jai's opener using
  // the saved assessment scores.
  openHeartbeatChat: (userId: string, heartbeat: string) =>
    fetchJson<{ message: any; repeated?: boolean }>(`/users/${userId}/heartbeat-chat`, {
      method: "POST",
      body: JSON.stringify({ heartbeat }),
    }),
  getHeartbeatTrends: (userId: string) =>
    fetchJson<{ date: string; totalScore: number; heartbeatScores: Record<string, number> }[]>(`/users/${userId}/heartbeat-trends`),
  submitAssessment: (userId: string, answers: number[]) => fetchJson<any>(`/users/${userId}/assessment`, { method: "POST", body: JSON.stringify({ answers }) }),

  getConsistencySummary: (userId: string) => fetchJson<any>(`/users/${userId}/consistency-summary?localDate=${getLocalDateStr()}`),

  getActiveGoals: (userId: string) => fetchJson<any[]>(`/users/${userId}/goals`),
  // Opens Jai's guided goal setup in Chat (posts his offer, suggested from Memory).
  startGoalSetup: (userId: string, source: "chat" | "journal") =>
    fetchJson<{ started: boolean; reason?: string }>(`/users/${userId}/goal-setup/start`, {
      method: "POST",
      body: JSON.stringify({ source }),
    }),
  getAllGoals: (userId: string) => fetchJson<any[]>(`/users/${userId}/goals/all`),
  createGoal: (userId: string, data: any) =>
    fetchJson<any>(`/users/${userId}/goals`, { method: "POST", body: JSON.stringify({ ...localDateFields(), ...data }) }),
  updateGoal: (goalId: string, data: any) =>
    fetchJson<any>(`/goals/${goalId}`, { method: "PATCH", body: JSON.stringify(data) }),
  archiveGoal: (goalId: string) =>
    fetchJson<any>(`/goals/${goalId}/archive`, { method: "POST" }),
  completeGoal: (goalId: string, completionType?: string) =>
    fetchJson<any>(`/goals/${goalId}/complete`, { method: "POST", body: JSON.stringify({ completionType }) }),
  logGoalProgress: (goalId: string, data: { summary: string; mood?: string; progressValue?: number }) =>
    fetchJson<any>(`/goals/${goalId}/log`, { method: "POST", body: JSON.stringify({ ...localDateFields(), ...data }) }),

  confirmProgress: (userId: string, rawText: string) =>
    fetchJson<any>(`/users/${userId}/confirm-progress`, {
      method: "POST",
      body: JSON.stringify({ rawText, ...localDateFields() }),
    }),

  getGardenSummary: (userId: string) => fetchJson<any>(`/users/${userId}/garden-summary`),

  getWeeklyReviewStatus: (userId: string) => fetchJson<any>(`/users/${userId}/weekly-review/status`),
  generateWeeklyReview: (userId: string) => fetchJson<any>(`/users/${userId}/weekly-review/generate`, { method: "POST" }),
  completeWeeklyReview: (userId: string, reviewId: string) =>
    fetchJson<any>(`/users/${userId}/weekly-review/${reviewId}/complete`, { method: "POST" }),
  getWeeklyReviewHistory: (userId: string) => fetchJson<any[]>(`/users/${userId}/weekly-review/history`),

  getSubscription: (userId: string) => fetchJson<any>(`/users/${userId}/subscription`),

  getStripeConfig: () => fetchJson<{ configured: boolean; annualAvailable?: boolean; rebuildPurchaseAvailable?: boolean }>("/stripe/config"),
  createRebuildCheckout: (userId: string) =>
    fetchJson<{ url: string }>(`/users/${userId}/stripe/create-rebuild-checkout`, { method: "POST" }),
  createStripeCheckout: (userId: string, interval: "month" | "year" = "month") =>
    fetchJson<{ url: string }>(`/users/${userId}/stripe/create-checkout`, { method: "POST", body: JSON.stringify({ interval }) }),
  createStripePortalSession: (userId: string) =>
    fetchJson<{ url: string }>(`/users/${userId}/stripe/create-portal-session`, { method: "POST" }),

  getGroundingJournal: (userId: string) =>
    fetchJson<{
      entries: any[];
      completed: boolean;
      // First session that can't be started yet (evening: 8h after morning or
      // 9 PM local, whichever is first; next day: 4 AM local), and when it opens.
      lockedSession: { day: 1 | 2 | 3; session: "morning" | "evening" } | null;
      unlocksAt: string | null;
      // While an evening is waiting: the times the user can commit to coming
      // back, and the one they picked (if any).
      reflectionChoices: string[];
      reflectionPlannedAt: string | null;
      // Accounts on the JOURNAL_PACING_SKIP_EMAILS tester list.
      canSkipWait: boolean;
    }>(`/users/${userId}/grounding-journal?tz=${encodeURIComponent(getUserTimezone())}`),
  planJournalReflection: (userId: string, dayNumber: number, plannedAt: string) =>
    fetchJson<{ reflectionPlannedAt: string }>(`/users/${userId}/grounding-journal/reflection-plan`, {
      method: "PATCH",
      body: JSON.stringify({ dayNumber, plannedAt, userTimezone: getUserTimezone() }),
    }),
  submitJournalEntry: (
    userId: string,
    data: { dayNumber: number; session: string; prompts: { prompt: string; response: string }[]; localDate?: string }
  ) =>
    fetchJson<{ entry: any; jae: any; commitmentKept?: { plannedAt: string }; safetyTriggered?: boolean; safetyTier?: "clear" | "check_in"; safetyThread?: SafetyMessage[] }>(`/users/${userId}/grounding-journal/entry`, {
      method: "POST",
      body: JSON.stringify({ ...data, userTimezone: getUserTimezone() }),
    }),
  // Saves the optional follow-up answer; `reply` is Jai's 1–2 sentence
  // acknowledgment ("" when the answer was empty or the AI call failed).
  saveJournalFollowUp: (userId: string, entryId: string, followUpResponse: string) =>
    fetchJson<{ entry: any; reply: string; safetyTriggered?: boolean; safetyTier?: "clear" | "check_in"; safetyThread?: SafetyMessage[] }>(`/users/${userId}/grounding-journal/follow-up`, {
      method: "PATCH",
      body: JSON.stringify({ entryId, followUpResponse }),
    }),
  // The user's reply after a safety response. Jai always answers; `jae` is the
  // session's normal reflection when they made clear there's no risk.
  sendJournalSafetyReply: (userId: string, entryId: string, reply: string, localDate?: string) =>
    fetchJson<{ reply: string; outcome: "clarified_no_risk" | "still_unclear" | "escalated"; safetyThread: SafetyMessage[]; jae: any | null }>(
      `/users/${userId}/grounding-journal/safety-reply`,
      { method: "POST", body: JSON.stringify({ entryId, reply, localDate }) },
    ),
  completeGroundingJournal: (userId: string) =>
    fetchJson<any>(`/users/${userId}/grounding-journal/complete`, { method: "POST" }),

  getRebuild: (userId: string) =>
    fetchJson<{ instances: any[]; hasPaidRebuild: boolean; hasCompletedRebuild: boolean; lastRebuildActivityAt: string | null }>(`/users/${userId}/rebuild`),
  rebuildReflect: (
    userId: string,
    instanceNumber: number,
    data: { prompts: { prompt: string; response: string }[]; characterTrack?: string; chapterNumber?: number; stageNumber?: number; day7GoalPlan?: Record<string, any> }
  ) =>
    fetchJson<{ jae: any }>(`/users/${userId}/rebuild/${instanceNumber}/reflect`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  rebuildComplete: (
    userId: string,
    instanceNumber: number,
    data?: { memoryData?: Record<string, any>; day7Stages?: Record<string, any> }
  ) =>
    fetchJson<{ completed: boolean; nextUnlocksAt: string | null }>(`/users/${userId}/rebuild/${instanceNumber}/complete`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),
  rebuildDay5Followup: (userId: string, followUpStatus: "pending" | "confirmed" | "not_done") =>
    fetchJson<any>(`/users/${userId}/rebuild/5/followup`, {
      method: "PATCH",
      body: JSON.stringify({ followUpStatus }),
    }),

  exportData: (userId: string) => fetch(`${BASE}/users/${userId}/export-data`, { credentials: "include" }),
  resetProgress: (userId: string) =>
    fetchJson<{ message: string }>(`/users/${userId}/reset-progress`, { method: "POST" }),
};
