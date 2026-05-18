/**
 * continuityContext.ts
 *
 * Builds a prioritized, summarized list of 6–8 recent accountability-relevant
 * records to inject into Jae's context window before each response.
 *
 * Selection is honest: only real stored records, current user only.
 * Records are ranked by accountability relevance, then trimmed to 6–8.
 */

export type ContinuityRecordType =
  | "completed_action"
  | "missed_commitment"
  | "completed_commitment"
  | "pending_commitment"
  | "photo_verified_action"
  | "weekly_review"
  | "goal_created"
  | "why_statement"
  | "repeated_intent"
  | "chat_commitment";

export interface ContinuityRecord {
  type: ContinuityRecordType;
  date: string;
  summary: string;
  relatedGoalTitle?: string;
  accountabilityRelevance: string;
  relevanceScore: number;
}

interface RawData {
  recentCommitments: Array<{
    id: string;
    action: string;
    status: string;
    createdAt: Date | null;
    resolvedAt?: Date | null;
    expectedTime?: string | null;
  }>;
  recentHappyEntries: Array<{
    summary: string | null;
    dateKey: string | null;
    createdAt: Date | null;
    goalId?: string | null;
  }>;
  recentPhotoMemories: Array<{
    analysisResult: string | null;
    dateKey: string | null;
    createdAt: Date | null;
    isGoalAligned?: boolean | null;
  }>;
  latestWeeklyReview: {
    weekSummary: string | null;
    recommendedFocus: string | null;
    heartbeatInsights?: Record<string, string> | null;
    createdAt: Date | null;
  } | null;
  activeGoals: Array<{
    title: string;
    emotionalWhy?: string | null;
    createdAt: Date | null;
    type: string;
  }>;
  recentChatMessages: Array<{ sender: string; text: string; createdAt?: Date | null }>;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "recently";
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays <= 6) return `${diffDays} days ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function truncate(text: string, maxLen = 100): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > maxLen ? clean.slice(0, maxLen - 1) + "…" : clean;
}

export function buildContinuityContext(data: RawData): ContinuityRecord[] {
  const candidates: ContinuityRecord[] = [];

  // --- 1. Missed commitments (score 10 — highest: signals pattern) ---
  const missed = data.recentCommitments.filter(c => c.status === "missed").slice(0, 3);
  for (const c of missed) {
    candidates.push({
      type: "missed_commitment",
      date: fmtDate(c.createdAt),
      summary: `User committed to: "${truncate(c.action, 90)}" — not completed.`,
      accountabilityRelevance: "Missed commitment — may indicate pattern or blocker.",
      relevanceScore: 10,
    });
  }

  // --- 2. Recently completed commitments (score 8 — confirm follow-through) ---
  const completed = data.recentCommitments.filter(c => c.status === "completed").slice(0, 2);
  for (const c of completed) {
    candidates.push({
      type: "completed_commitment",
      date: fmtDate(c.resolvedAt || c.createdAt),
      summary: `User followed through on: "${truncate(c.action, 90)}"`,
      accountabilityRelevance: "Completed commitment — evidence of follow-through.",
      relevanceScore: 8,
    });
  }

  // --- 3. Repeated intent detection from chat (score 7) ---
  const intentPattern = /\b(i('m| am) going to|i('ll| will)|i plan to|gonna|planning to|i need to|i should)\b/i;
  const intentMessages = data.recentChatMessages
    .filter(m => m.sender === "user" && intentPattern.test(m.text))
    .slice(-4);
  if (intentMessages.length >= 2) {
    const intents = intentMessages.map(m => `"${truncate(m.text, 70)}"`).join("; ");
    candidates.push({
      type: "repeated_intent",
      date: "recent",
      summary: `User has stated intent ${intentMessages.length} times recently: ${intents}`,
      accountabilityRelevance: "Repeated intent pattern — may not have converted to action yet.",
      relevanceScore: 7,
    });
  }

  // --- 4. Chat commitments (explicit future plans stated in chat, score 6) ---
  const chatCommitments = data.recentChatMessages
    .filter(m => m.sender === "user" && intentPattern.test(m.text) && m.text.length > 25)
    .slice(-2);
  for (const m of chatCommitments) {
    candidates.push({
      type: "chat_commitment",
      date: fmtDate((m as any).createdAt),
      summary: `Said in chat: "${truncate(m.text, 90)}"`,
      accountabilityRelevance: "User stated a future plan in chat — worth gentle follow-up if not actioned.",
      relevanceScore: 6,
    });
  }

  // --- 5. Recent completed actions / happy entries (score 7) ---
  const happyEntries = data.recentHappyEntries.slice(0, 5);
  for (const e of happyEntries) {
    if (!e.summary) continue;
    const relatedGoal = e.goalId
      ? data.activeGoals.find(g => (g as any).id === e.goalId)?.title
      : undefined;
    candidates.push({
      type: "completed_action",
      date: e.dateKey || fmtDate(e.createdAt),
      summary: truncate(e.summary, 100),
      relatedGoalTitle: relatedGoal,
      accountabilityRelevance: "Verified completed action — evidence of real progress.",
      relevanceScore: 7,
    });
  }

  // --- 6. Photo-verified actions (score 6) ---
  const photos = data.recentPhotoMemories.filter(p => p.isGoalAligned).slice(0, 2);
  for (const p of photos) {
    const analysis = p.analysisResult ? truncate(p.analysisResult, 80) : "goal-aligned action";
    candidates.push({
      type: "photo_verified_action",
      date: p.dateKey || fmtDate(p.createdAt),
      summary: `Photo-verified action: ${analysis}`,
      accountabilityRelevance: "User provided visual evidence of a completed action.",
      relevanceScore: 6,
    });
  }

  // --- 7. Goal WHY statements (score 5) ---
  for (const g of data.activeGoals) {
    if (g.emotionalWhy) {
      candidates.push({
        type: "why_statement",
        date: fmtDate(g.createdAt),
        summary: `Goal "${truncate(g.title, 60)}" — why it matters: "${truncate(g.emotionalWhy, 80)}"`,
        relatedGoalTitle: g.title,
        accountabilityRelevance: "User's stated emotional reason for this goal — anchor point for accountability.",
        relevanceScore: 5,
      });
    }
  }

  // --- 8. Weekly review insight (score 5) ---
  if (data.latestWeeklyReview?.weekSummary) {
    const focus = data.latestWeeklyReview.recommendedFocus
      ? ` Recommended focus: ${truncate(data.latestWeeklyReview.recommendedFocus, 60)}.`
      : "";
    candidates.push({
      type: "weekly_review",
      date: fmtDate(data.latestWeeklyReview.createdAt),
      summary: `Weekly review: ${truncate(data.latestWeeklyReview.weekSummary, 100)}.${focus}`,
      accountabilityRelevance: "Recent structured review of the user's week — reveals patterns and directions.",
      relevanceScore: 5,
    });
  }

  // --- 9. Goal creation context (score 3) ---
  for (const g of data.activeGoals) {
    candidates.push({
      type: "goal_created",
      date: fmtDate(g.createdAt),
      summary: `Active ${g.type} goal: "${truncate(g.title, 80)}"`,
      relatedGoalTitle: g.title,
      accountabilityRelevance: "Active goal the user is working toward.",
      relevanceScore: 3,
    });
  }

  // --- Deduplicate and select top 6–8 ---
  // Remove candidates whose summary is nearly identical (e.g. goal_created + why_statement for same goal)
  const seen = new Set<string>();
  const deduped = candidates.filter(c => {
    const key = c.type + "::" + c.summary.slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by relevance score descending, then recency (type "completed_action" first if tied)
  deduped.sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
    return 0;
  });

  // Return top 7 (within 6–8 range)
  return deduped.slice(0, 7);
}
