import { storage } from "./storage";
import type { RetentionNudgeType, RetentionSegment, User } from "@shared/schema";

// ─── Retention & Engagement Agent (Agent 06) ─────────────────────────────────
// Streak nudges, "falling behind your own goal" prompts, and a welcome-back
// message for lapsed users who return — from a fixed, approved template set
// only, never freeform generation, same reasoning as the Support library:
// locked tone without needing a per-message quality check. Any user with a
// recent Trust & Safety flag is skipped entirely — that's a human follow-up,
// never an engagement nudge.
//
// KNOWN GAP: this fires lazily when a user opens chat (same injection point
// as the app's existing daily-encouragement/reassessment nudges in
// routes.ts), because that's the only delivery channel that exists — there's
// no outbound email/push infra for engagement messaging yet. That means a
// true "reach someone who stopped opening the app" win-back campaign isn't
// possible today; what's built here is a welcome-back message that fires the
// next time a lapsed user actually comes back, not a proactive nudge that
// reaches them while they're gone. Flagged, not silently glossed over.

const MIN_NUDGE_GAP_MS = 3 * 24 * 60 * 60 * 1000; // don't nudge more than once per 3 days
const SAFETY_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000; // skip nudging for a week after any flag
const LAPSED_THRESHOLD_DAYS = 7;

export function classifySegment(user: User): RetentionSegment {
  const streak = user.streak ?? 0;
  const daysSinceAction = user.lastVerifiedActionAt
    ? (Date.now() - new Date(user.lastVerifiedActionAt).getTime()) / (1000 * 60 * 60 * 24)
    : null;

  if (daysSinceAction !== null && daysSinceAction >= LAPSED_THRESHOLD_DAYS) return "lapsed";
  if (streak >= 4) return "locked_in";
  if (streak >= 2) return "building";
  if (streak === 0 && (user.treeStage ?? 1) > 1) return "slipping";
  return "starting";
}

// Starter templates — flagged for founder review, same as Support's library
// and Billing's dunning draft. Rotates by a stable index so consecutive
// nudges to the same user don't repeat verbatim.
const STREAK_TEMPLATES = [
  (name: string, streak: number) => `${name ? `${name}, ` : ""}you're at a ${streak}-day streak. What's the next honest step to keep it going today?`,
  (name: string, streak: number) => `${streak} days in a row now${name ? `, ${name}` : ""}. That's a real pattern — what are you doing today to add to it?`,
  (name: string, streak: number) => `${name ? `${name}: ` : ""}${streak} days of showing up. Worth protecting — what's today's move?`,
];

const FALLING_BEHIND_TEMPLATES = [
  (name: string, goalTitle: string | null) => `${name ? `${name}, ` : ""}it's been a few days since your last check-in${goalTitle ? ` on "${goalTitle}"` : ""}. What's one small step you can take today?`,
  (name: string, goalTitle: string | null) => `${name ? `${name}, ` : ""}no judgment — just checking in.${goalTitle ? ` "${goalTitle}" is still there waiting.` : ""} What's the next honest step?`,
];

const WIN_BACK_TEMPLATES = [
  (name: string) => `Welcome back${name ? `, ${name}` : ""}. It's been a while — no need to explain, just glad you're here. What's one small step you can take today?`,
  (name: string) => `${name ? `${name}, ` : ""}good to see you again. Whatever kept you away, you're back now — what's today's move?`,
];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

/**
 * maybeInjectRetentionNudge — called from the same injection point as the
 * app's existing daily-encouragement/reassessment nudges (GET
 * /users/:userId/messages in server/routes.ts), so it fires on the same
 * lazy, cadence-gated, in-chat-message pattern already established there.
 */
export async function maybeInjectRetentionNudge(userId: string): Promise<void> {
  const user = await storage.getUser(userId);
  if (!user) return;

  const recentFlags = await storage.getRecentSafetyEvents(userId, new Date(Date.now() - SAFETY_LOOKBACK_MS));
  if (recentFlags.some((f) => f.responseType === "primary")) return;

  const last = await storage.getLastRetentionNudge(userId);
  if (last && Date.now() - new Date(last.createdAt!).getTime() < MIN_NUDGE_GAP_MS) return;

  const segment = classifySegment(user);
  const streak = user.streak ?? 0;
  const daySeed = new Date().getDay();

  let nudgeType: RetentionNudgeType | null = null;
  let text: string | null = null;

  if (segment === "lapsed") {
    nudgeType = "win_back";
    text = pick(WIN_BACK_TEMPLATES, daySeed)(user.name || "");
  } else if (segment === "slipping") {
    const activeGoals = await storage.getActiveGoals(userId);
    const goalTitle = activeGoals[0]?.title ?? null;
    nudgeType = "falling_behind";
    text = pick(FALLING_BEHIND_TEMPLATES, daySeed)(user.name || "", goalTitle);
  } else if ((segment === "building" || segment === "locked_in") && streak > 0 && streak % 3 === 0) {
    // Notable streak milestones only (3, 6, 9...) — not every single day.
    nudgeType = "streak_nudge";
    text = pick(STREAK_TEMPLATES, daySeed)(user.name || "", streak);
  }

  if (!nudgeType || !text) return;

  const message = await storage.createMessage({ userId, text, sender: "jae" });
  await storage.createRetentionNudge({ userId, nudgeType, segment, messageId: message.id });
}

export interface EngagementLiftReport {
  windowDays: number;
  byNudgeType: Record<RetentionNudgeType, { sent: number; engaged: number; liftRate: number | null }>;
}

/**
 * generateEngagementLiftReport — "engaged" means the user sent at least one
 * chat message within 48h of the nudge. A real product would also weigh
 * verified actions specifically, but message activity is the honest signal
 * available without deeper instrumentation right now.
 */
export async function generateEngagementLiftReport(windowDays = 30): Promise<EngagementLiftReport> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const nudges = await storage.getRetentionNudgesSince(since);

  const byNudgeType: EngagementLiftReport["byNudgeType"] = {
    streak_nudge: { sent: 0, engaged: 0, liftRate: null },
    falling_behind: { sent: 0, engaged: 0, liftRate: null },
    win_back: { sent: 0, engaged: 0, liftRate: null },
  };

  for (const nudge of nudges) {
    const type = nudge.nudgeType as RetentionNudgeType;
    byNudgeType[type].sent += 1;

    const after = await storage.getMessagesSince(nudge.userId, new Date(nudge.createdAt!));
    const engaged = after.some((m) => m.sender === "user" && m.id !== nudge.messageId);
    if (engaged) byNudgeType[type].engaged += 1;
  }

  for (const type of Object.keys(byNudgeType) as RetentionNudgeType[]) {
    const bucket = byNudgeType[type];
    bucket.liftRate = bucket.sent > 0 ? Math.round((bucket.engaged / bucket.sent) * 1000) / 1000 : null;
  }

  return { windowDays, byNudgeType };
}

export interface SegmentSnapshot {
  segment: RetentionSegment;
  count: number;
}

export async function getSegmentSnapshot(): Promise<SegmentSnapshot[]> {
  const users = await storage.getAllUsers();
  const counts: Record<RetentionSegment, number> = {
    starting: 0, building: 0, locked_in: 0, slipping: 0, lapsed: 0,
  };
  for (const user of users) {
    counts[classifySegment(user)] += 1;
  }
  return Object.entries(counts).map(([segment, count]) => ({ segment: segment as RetentionSegment, count }));
}
