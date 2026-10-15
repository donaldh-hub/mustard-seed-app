import OpenAI from "openai";
import { storage } from "./storage";
import { analyzePhoto, type VisionAnalysisResult } from "./visionAnalysis";
import { processRewardTransaction } from "./rewardEngine";
import { decidePhotoWater, PHOTO_LINES, type Freshness, type PhotoDecision } from "./photoProof";
import type { Goal, PhotoMemory, User } from "@shared/schema";

// Photo proof around the pure rules in photoProof.ts: what Jai says, what
// gets logged to Memory, and when held water is released.

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Held for a clarifying answer: the user's next chat message within this
// window is read as the answer.
const CLARIFY_WINDOW_MS = 6 * 60 * 60 * 1000;

export interface PhotoDecisionLog {
  result: string;
  confidence: number;
  reason: string;
  jaiResponse: string;
  water: number;
  at: string;
  freshness: Freshness;
  source: string;
  serveUrl: string;
  clarify?: string;
  resolvedBy?: string;
}

export function firstSentence(text: string): string {
  const m = (text || "").trim().match(/^.*?[.!](\s|$)/);
  return (m ? m[0] : text).trim();
}

/** Jai's line for a decision: his observation of the photo + what happens to the water. */
export function photoReplyText(decision: PhotoDecision, analysis: VisionAnalysisResult): string {
  const seen = analysis.next_prompt || "";
  switch (decision.result) {
    case "approved": return `${seen} That counts as today's step, so your seed got water.`.trim();
    case "duplicate": return PHOTO_LINES.duplicate;
    case "held_no_goal": return `${firstSentence(seen)} ${PHOTO_LINES.noGoal}`.trim();
    case "held_clarify":
      if (decision.clarify === "context") return seen; // the vision step wrote one discovery question
      return `${firstSentence(seen)} ${decision.clarify === "did_today" ? PHOTO_LINES.didToday : PHOTO_LINES.whatItShows}`.trim();
    case "rejected":
    default: return seen || "This doesn't show the work yet. What would show progress toward your goal?";
  }
}

/** Short Memory lines for the vision check: what Jai already knows about the goal. */
export async function photoMemoryLines(userId: string): Promise<string[]> {
  const [entries, journal] = await Promise.all([storage.getEntries(userId), storage.getGroundingJournalEntries(userId)]);
  const lines: { at: number; line: string }[] = [];
  for (const e of journal) {
    const answers = ((e.prompts as { response: string }[]) ?? []).map((p) => p.response).filter(Boolean).join(" / ");
    if (answers) lines.push({ at: new Date(e.createdAt ?? 0).getTime(), line: `Journal ${e.session === "intention" ? "intention" : `Day ${e.dayNumber} ${e.session}`}: ${answers}`.slice(0, 200) });
  }
  for (const e of entries) {
    if (e.summary && !e.summary.startsWith("📷")) lines.push({ at: new Date(e.createdAt ?? 0).getTime(), line: `Memory: ${e.summary}`.slice(0, 200) });
  }
  return lines.sort((a, b) => b.at - a.at).slice(0, 6).map((l) => l.line);
}

/** Water an approved photo: promotes its hidden calendar entry and credits the goal. */
export async function rewardPhoto(user: User, pm: PhotoMemory, analysis: VisionAnalysisResult, goal: Goal, dateKey: string) {
  const ap = (analysis.proof_level ?? 0) >= 2 ? 3 : 2;
  const reward = await processRewardTransaction({
    userId: user.id,
    rawText: `photo ${pm.id}`,
    apDelta: user.cBurnActive ? 0 : ap,
    matchGoal: goal,
    actionType: "PHOTO_PROOF",
    todayStr: dateKey,
    existingEntryId: pm.entryId ?? undefined,
  });
  const credits = (user.heartbeatCredits || { clarity: 0, consistency: 0, mindset: 0, adaptation: 0, courage: 0 }) as Record<string, number>;
  const key = analysis.action_type?.includes("courage") ? "courage" : "consistency";
  await storage.updateUser(user.id, {
    heartbeatCredits: { ...credits, [key]: (credits[key] || 0) + 1 } as any,
    lastVerifiedActionAt: new Date(),
    consecutiveIOCount: 0,
    cBurnActive: 0,
  } as any);
  return reward;
}

async function logDecision(pm: PhotoMemory, analysis: VisionAnalysisResult, decision: PhotoDecision, log: Omit<PhotoDecisionLog, "result" | "confidence" | "reason" | "water" | "at">) {
  const entry: PhotoDecisionLog = {
    ...log,
    result: decision.result,
    confidence: analysis.confidence ?? 0,
    reason: decision.reason,
    water: decision.water,
    at: new Date().toISOString(),
    ...(decision.clarify ? { clarify: decision.clarify } : {}),
  };
  const history = Array.isArray((pm.analysisJson as any)?.decisionHistory) ? (pm.analysisJson as any).decisionHistory : [];
  await storage.updatePhotoMemory(pm.id, {
    status: decision.result,
    waterAwarded: decision.water,
    waterReason: decision.reason,
    analysisJson: { ...analysis, water_award: decision.water, decision: entry, decisionHistory: [...history, entry] } as any,
  });
  return entry;
}
export { logDecision as logPhotoDecision };

// ─── The answer to "Did you make or change this today?" ─────────────────────

async function judgeClarification(ctx: {
  goal: string;
  photo: string;
  question: string;
  reply: string;
}): Promise<{ verdict: "approve" | "decline" | "unrelated"; ack: string }> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      max_tokens: 160,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Jai asked the user a question about a photo they shared as proof of progress. Decide from their reply:
- "approve": they clearly say they did goal-aligned work shown in this photo TODAY (made it, changed it, wrote it, planted it today).
- "decline": they say it's older work, someone else's, or not something they did today.
- "unrelated": the reply isn't an answer to the question.
"ack": 1–2 short, warm sentences in Jai's voice. Approve → name what they did and tie it to the goal. Decline → thank them for being straight, no shame, and invite a fresh photo when they take a step. Unrelated → "". No praise words like "great job". Plain text.
Respond ONLY with JSON: {"verdict": "...", "ack": "..."}`,
        },
        { role: "user", content: `Goal: ${ctx.goal}\nPhoto: ${ctx.photo}\nJai asked: ${ctx.question}\nThey replied: ${ctx.reply}` },
      ],
    });
    const p = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    const verdict = ["approve", "decline", "unrelated"].includes(p.verdict) ? p.verdict : "unrelated";
    return { verdict, ack: typeof p.ack === "string" ? p.ack.trim() : "" };
  } catch {
    return { verdict: "unrelated", ack: "" };
  }
}

/**
 * If a photo is waiting on the user's answer, read their chat message as
 * that answer. Returns Jai's reply, or null to let normal chat handle it.
 */
export async function resolveHeldPhotoReply(userId: string, text: string): Promise<{ text: string; waterAwarded: boolean } | null> {
  const held = (await storage.getPhotoMemoriesByStatus(userId, "held_clarify"))[0];
  if (!held || !held.createdAt || Date.now() - new Date(held.createdAt).getTime() > CLARIFY_WINDOW_MS) return null;
  const analysis = (held.analysisJson ?? {}) as VisionAnalysisResult & { decision?: PhotoDecisionLog };
  const log = analysis.decision;
  if (!log) return null;
  const [user, goals] = await Promise.all([storage.getUser(userId), storage.getActiveGoals(userId)]);
  const goal = goals.find((g) => g.goalType === "targeted") ?? goals[0];
  if (!user || !goal) return null;

  // Thin context: their answer tells Jai about the goal. Re-check the photo
  // with it, under the same rules.
  if (log.clarify === "context") {
    const again = await analyzePhoto(log.serveUrl, `Context from the user about their goal: ${text}`, goal.title, null, user.name || "", {
      goalWhy: goal.emotionalWhy,
      recentMemory: [`Chat: ${text}`, ...(await photoMemoryLines(userId))],
    });
    const decision = decidePhotoWater({
      hasGoal: true, duplicate: false, confidence: again.confidence, relevant: again.action_type !== "unknown_or_irrelevant",
      evidence: again.evidence_type ?? "unknown", needsContext: false, freshness: log.freshness,
    });
    const reply = photoReplyText(decision, again);
    await logDecision(held, again, decision, { jaiResponse: reply, freshness: log.freshness, source: log.source, serveUrl: log.serveUrl, resolvedBy: "context_reply" });
    if (decision.result === "approved") await rewardPhoto(user, { ...held, entryId: held.entryId }, again, goal, held.dateKey);
    return { text: reply, waterAwarded: decision.result === "approved" };
  }

  const question = log.clarify === "did_today" ? PHOTO_LINES.didToday : PHOTO_LINES.whatItShows;
  const judged = await judgeClarification({ goal: goal.title, photo: (analysis.labels ?? []).join(", ") || analysis.water_reason, question, reply: text });
  if (judged.verdict === "unrelated") return null;

  // A file dated before today can't be today's step, whatever the answer.
  const approve = judged.verdict === "approve" && log.freshness !== "old";
  const decision: PhotoDecision = approve
    ? { result: "approved", water: 1, reason: "User confirmed they did this today." }
    : { result: "rejected", water: 0, reason: log.freshness === "old" && judged.verdict === "approve" ? "The file is dated before today." : "User said it wasn't today's work." };
  const reply = approve
    ? `${judged.ack} That counts as today's step, so your seed got water.`.trim()
    : log.freshness === "old" && judged.verdict === "approve"
      ? "Thanks for telling me. This file is dated before today, so it can't count as today's step. Next time you work on it, snap a fresh photo and I'll count it."
      : judged.ack || "Thanks for being straight with me. It's saved in your Memory. When you take today's step, show me and I'll count it.";
  await logDecision(held, analysis, decision, { jaiResponse: reply, freshness: log.freshness, source: log.source, serveUrl: log.serveUrl, resolvedBy: "clarify_reply" });
  if (approve) await rewardPhoto(user, held, analysis, goal, held.dateKey);
  return { text: reply, waterAwarded: approve };
}

// ─── After a goal is planted ─────────────────────────────────────────────────

/**
 * Photos held because there was no goal yet get checked against the new
 * goal. Only today's photos qualify; each still has to pass every rule.
 * Returns how many earned water.
 */
export async function releaseHeldPhotos(userId: string, localDate: string): Promise<number> {
  const held = await storage.getPhotoMemoriesByStatus(userId, "held_no_goal");
  const [user, goals] = await Promise.all([storage.getUser(userId), storage.getActiveGoals(userId)]);
  const goal = goals.find((g) => g.goalType === "targeted") ?? goals[0];
  if (!user || !goal) return 0;
  let awarded = 0;
  for (const pm of held) {
    const log = (pm.analysisJson as any)?.decision as PhotoDecisionLog | undefined;
    if (!log || pm.dateKey !== localDate) continue;
    const analysis = await analyzePhoto(log.serveUrl, "", goal.title, null, user.name || "", {
      goalWhy: goal.emotionalWhy,
      recentMemory: await photoMemoryLines(userId),
    });
    const decision = decidePhotoWater({
      hasGoal: true, duplicate: false, confidence: analysis.confidence, relevant: analysis.action_type !== "unknown_or_irrelevant",
      evidence: analysis.evidence_type ?? "unknown", needsContext: analysis.needs_context === true, freshness: log.freshness,
    });
    // Held photos aren't re-asked about; anything short of approval stays unscored.
    const final: PhotoDecision = decision.result === "approved"
      ? decision
      : { result: "rejected", water: 0, reason: `Re-checked after the goal was planted: ${decision.reason}` };
    await logDecision(pm, analysis, final, { jaiResponse: "", freshness: log.freshness, source: log.source, serveUrl: log.serveUrl, resolvedBy: "goal_planted" });
    if (final.result === "approved") {
      await rewardPhoto(user, pm, analysis, goal, pm.dateKey);
      awarded++;
    }
  }
  return awarded;
}
