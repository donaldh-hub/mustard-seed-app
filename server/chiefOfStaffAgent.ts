import OpenAI from "openai";
import { storage } from "./storage";

// ─── Mustard Seed Chief of Staff Agent (Agent 11) ────────────────────────────
// One place to check status across all ten other agents instead of checking
// each one separately. HARD CONSTRAINT: routing and prioritization only —
// this agent grants no other agent new authority, and it never resolves a
// conflict itself; it only surfaces one to the founder. It is the last
// agent built because it coordinates work that has to already exist — all
// ten others are built as of this phase.

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface QueueItem {
  agent: string;
  itemType: string;
  id: string;
  title: string;
  status: "pending_approval" | "blocked" | "shipped";
  createdAt: Date | null;
}

/**
 * getMasterQueue — "one dashboard/queue: pending my approval, blocked,
 * shipped," pulled live from every other agent's own storage rather than a
 * separately maintained duplicate of their state (so it can't drift out of
 * sync with what each agent actually did).
 */
export async function getMasterQueue(): Promise<{ pendingApproval: QueueItem[]; blocked: QueueItem[]; shipped: QueueItem[] }> {
  const [contentDrafts, curriculumDrafts, abTests, releaseItems, qualityFlags, changelog] = await Promise.all([
    storage.getContentDrafts(),
    storage.getCurriculumDrafts(),
    storage.getABTests(),
    storage.getReleaseItems(),
    storage.getOpenQualityFlags(),
    storage.getChangelogEntries(20),
  ]);

  const pendingApproval: QueueItem[] = [];
  const blocked: QueueItem[] = [];
  const shipped: QueueItem[] = [];

  for (const d of contentDrafts) {
    const base = { agent: "Content Repurposing", itemType: "content_draft", id: d.id, title: d.showNotes.slice(0, 60) || "(untitled content draft)", createdAt: d.createdAt };
    if (d.status === "pending_review") pendingApproval.push({ ...base, status: "pending_approval" });
    else if (d.status === "blocked_needs_revision") blocked.push({ ...base, status: "blocked" });
  }

  for (const d of curriculumDrafts) {
    const base = { agent: "Curriculum Production", itemType: "curriculum_draft", id: d.id, title: d.title, createdAt: d.createdAt };
    if (d.status === "pending_review") pendingApproval.push({ ...base, status: "pending_approval" });
    else if (d.status === "blocked_needs_revision") blocked.push({ ...base, status: "blocked" });
  }

  for (const t of abTests) {
    if (t.status === "proposed") {
      pendingApproval.push({ agent: "Funnel Optimization", itemType: "ab_test", id: t.id, title: t.name, status: "pending_approval", createdAt: t.createdAt });
    }
  }

  for (const r of releaseItems) {
    const base = { agent: "Technical & Release Ops", itemType: "release_item", id: r.id, title: r.title, createdAt: r.createdAt };
    if (r.status === "verified") pendingApproval.push({ ...base, status: "pending_approval" });
    else if (r.status === "shipped") shipped.push({ ...base, status: "shipped" });
  }

  for (const q of qualityFlags) {
    blocked.push({
      agent: "Jai Quality Supervisor",
      itemType: "quality_flag",
      id: q.id,
      title: q.ruleBroken ? `Flagged: ${q.ruleBroken}` : "Flagged content",
      status: "blocked",
      createdAt: q.createdAt,
    });
  }

  for (const c of changelog) {
    shipped.push({ agent: "Technical & Release Ops", itemType: "changelog_entry", id: c.id, title: c.summary, status: "shipped", createdAt: c.createdAt });
  }

  const byDateDesc = (a: QueueItem, b: QueueItem) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  return {
    pendingApproval: pendingApproval.sort(byDateDesc),
    blocked: blocked.sort(byDateDesc),
    shipped: shipped.sort(byDateDesc),
  };
}

const AGENT_NAMES = [
  "Trust & Safety", "Jai Quality Supervisor", "Support & Onboarding", "Billing & Subscription",
  "Content Repurposing", "Retention & Engagement", "Analytics & Reporting", "Curriculum Production",
  "Funnel Optimization", "Technical & Release Ops", "Chief of Staff",
] as const;

const ROUTING_SYSTEM_PROMPT = `You route one incoming task description to exactly one of these 11 Mustard Seed operational agents, by what the task IS ABOUT, not by guessing intent beyond the text:

1. Trust & Safety — crisis/distress language screening, safety incidents
2. Jai Quality Supervisor — Jai's tone/voice/brand consistency, style guide
3. Support & Onboarding — user "how do I" questions, account issues, onboarding friction
4. Billing & Subscription — payments, dunning, cancellations, MRR/billing reconciliation
5. Content Repurposing — turning video/transcripts into show notes, email nudges, social captions
6. Retention & Engagement — streak nudges, win-back, lapsed-user segmentation
7. Analytics & Reporting — funnel/cohort/subscriber numbers, anomaly detection
8. Curriculum Production — 7-Day Rebuild module scripts, worksheets, voiceover
9. Funnel Optimization — A/B tests on assessment/journal/subscription copy
10. Technical & Release Ops — bugs, feature requests, staging/verification, changelog
11. Chief of Staff — cross-agent coordination itself, ambiguous/multi-agent tasks

You only route — you never propose a fix or take an action.

Respond with ONLY a JSON object: {"agent": "<one of the 11 names above, verbatim>", "reasoning": "<one short sentence>"}`;

export interface RoutingResult {
  agent: string;
  reasoning: string;
}

/**
 * routeIncomingTask — "routes a new task to the right agent instead of you
 * deciding each time." Classification only — this function never calls
 * another agent's write functions itself, it just names which one should
 * handle it.
 */
export async function routeIncomingTask(description: string): Promise<RoutingResult> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    max_tokens: 100,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: ROUTING_SYSTEM_PROMPT },
      { role: "user", content: description },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim();
  let parsed: { agent?: string; reasoning?: string } = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }
  }

  const agent = parsed.agent && (AGENT_NAMES as readonly string[]).includes(parsed.agent) ? parsed.agent : "Chief of Staff";
  return { agent, reasoning: parsed.reasoning ?? "Could not confidently classify — routed to Chief of Staff for a human call." };
}

export interface ConflictFlag {
  type: string;
  userId: string;
  description: string;
  detail: Record<string, unknown>;
}

const CONFLICT_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * checkForConflicts — real, data-driven cross-agent checks (not simulated
 * for show). Flags only — never resolves anything itself; that's always the
 * founder's call.
 *
 * 1. Billing vs. Support: a user has an open payment-dispute escalation AND
 *    a dunning email went out to them in the same window — Billing may be
 *    dunning someone actively disputing a charge with Support.
 * 2. Retention vs. Trust & Safety: a retention nudge was sent to a user who
 *    also has a safety flag within a day of it — a defense-in-depth check
 *    that Retention's own skip logic actually held, surfaced either way.
 */
export async function checkForConflicts(): Promise<ConflictFlag[]> {
  const since = new Date(Date.now() - CONFLICT_LOOKBACK_MS);
  const [supportInquiries, billingEvents, retentionNudges, safetyEvents] = await Promise.all([
    storage.getSupportInquiriesSince(since),
    storage.getBillingEventsSince(since),
    storage.getRetentionNudgesSince(since),
    storage.getSafetyEventsSince(since),
  ]);

  const flags: ConflictFlag[] = [];

  const disputeUserIds = new Set(
    supportInquiries.filter((i) => i.escalationReason === "payment_dispute").map((i) => i.userId)
  );
  const dunningByUser = new Map<string, typeof billingEvents>();
  for (const e of billingEvents) {
    if (e.type !== "dunning_sent") continue;
    if (!dunningByUser.has(e.userId)) dunningByUser.set(e.userId, []);
    dunningByUser.get(e.userId)!.push(e);
  }
  for (const userId of Array.from(disputeUserIds)) {
    const dunning = dunningByUser.get(userId);
    if (dunning && dunning.length > 0) {
      flags.push({
        type: "billing_vs_support",
        userId,
        description: "Billing sent a dunning email to a user who has an active payment-dispute escalation with Support — reconcile before continuing the dunning sequence.",
        detail: { dunningEventsInWindow: dunning.length },
      });
    }
  }

  const safetyByUser = new Map<string, Date[]>();
  for (const e of safetyEvents) {
    if (!e.createdAt) continue;
    if (!safetyByUser.has(e.userId)) safetyByUser.set(e.userId, []);
    safetyByUser.get(e.userId)!.push(new Date(e.createdAt));
  }
  for (const nudge of retentionNudges) {
    const safetyDates = safetyByUser.get(nudge.userId);
    if (!safetyDates || !nudge.createdAt) continue;
    const nudgeTime = new Date(nudge.createdAt).getTime();
    const nearby = safetyDates.some((d) => Math.abs(d.getTime() - nudgeTime) < 24 * 60 * 60 * 1000);
    if (nearby) {
      flags.push({
        type: "retention_vs_safety",
        userId: nudge.userId,
        description: "A retention nudge was sent within 24h of a Trust & Safety flag for the same user — verify Retention's skip check held as intended.",
        detail: { nudgeType: nudge.nudgeType },
      });
    }
  }

  return flags;
}
