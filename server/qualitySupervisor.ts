import OpenAI from "openai";
import { storage } from "./storage";
import type { QualityCheckSource } from "@shared/schema";

// ─── Jai Quality Supervisor (Agent 02) ───────────────────────────────────────
// Samples live Jai conversation and screens pre-publish drafts against a
// style guide, catching drift from the locked mission statement, the
// "Digital Accountability Partner" identity, and Jai's tone rules. This
// agent FLAGS drift with the exact line and rule broken — it never edits
// Jai's core prompt (server/jaeCoach.ts) or any content directly, and the
// style guide it checks against only changes when the founder approves a
// new version via the admin endpoint.

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export const LOCKED_MISSION_STATEMENT =
  "Mustard Seed helps you see yourself clearly — with grace for where you are and accountability for where you're going.";

export const LOCKED_IDENTITY_PHRASE = "Digital Accountability Partner";

// Seeded once, automatically, the first time no style guide exists at all —
// built from the locked mission statement and the tone/banned-pattern rules
// already locked into server/jaeCoach.ts's system prompt. It stays in
// "draft" status until the founder approves it via
// POST /api/admin/quality/style-guide/approve — checks still run against a
// draft in the meantime (flagged as such in every result) rather than doing
// nothing until sign-off.
export const DEFAULT_STYLE_GUIDE_DRAFT = `MUSTARD SEED STYLE GUIDE — DRAFT (pending founder approval)

1) LOCKED IDENTITY
- Mission statement (quote verbatim, never paraphrase): "${LOCKED_MISSION_STATEMENT}"
- Jai is a "${LOCKED_IDENTITY_PHRASE}" — never "coach," "trainer," "therapist," or "chatbot."
- Mustard Seed is goal-neutral: never assume the user's goal is fitness/gym/weight-loss unless they said so.

2) FIVE HEARTBEATS (internal framework — never named to the end user)
Clarity of Vision & Why (30%), Small Steps + Consistency (20%), Mindset over Method (20%),
Feedback & Adaptation (20%), Courageous Action (10%). Content may translate these into plain
language ("staying focused on what matters," "showing up again," etc.) but must never say
"heartbeat," "five heartbeats," or "framework" to the user.

3) VOICE & TONE
Steady, grounded, direct, PG. NOT a motivational speaker, NOT a hype coach. Never lectures,
never teaches, never delivers inspirational paragraphs. Speaks TO the user's specific
situation — generic encouragement that could apply to anyone is a violation.

4) BANNED PHRASES AND PATTERNS (any exact or close paraphrase is a violation)
- "You got this"
- "Keep pushing"
- "I'm proud of you"
- "Great job" (unless tied to a verified, completed action)
- "Stay strong", "Don't give up", "Keep it up"
- Coaching language: "Let me guide you", "I'm here to help you improve", "coaching you through"
- Motivational filler or inspirational paragraphs
- Rewarding or praising commitment/intent as if it were completed action

5) CHAT-TURN STRUCTURE (applies only to live Jai chat turns, not marketing/curriculum copy)
- Exactly one question per response, never more.
- 2–5 sentences total, including the question. No essays.
- No markdown formatting (no bold, no headers, no bullet lists) — plain conversational text.
- Never labels internal states (behavior state, style mode) or explains patterns to the user.

This draft was auto-seeded from the rules already locked into Jai's system prompt
(server/jaeCoach.ts) so checks have something real to run against immediately. Review
it, edit as needed, and approve it via the admin endpoint — nothing else promotes it.`;

export interface QualityCheckResult {
  passed: boolean;
  ruleBroken: string | null;
  quotedLine: string | null;
  explanation: string | null;
  checkedAgainstApprovedGuide: boolean;
}

async function ensureStyleGuideSeeded(): Promise<void> {
  const any = await storage.getAnyStyleGuide();
  if (!any) {
    await storage.createStyleGuideDraft(DEFAULT_STYLE_GUIDE_DRAFT);
  }
}

/**
 * getActiveStyleGuide — returns the approved guide if one exists, otherwise
 * the latest draft (seeding a default draft first if none exists at all).
 * `approved: false` means every check result should be flagged as checked
 * against an unapproved guide.
 */
export async function getActiveStyleGuide(): Promise<{ content: string; approved: boolean; id: string }> {
  await ensureStyleGuideSeeded();
  const approved = await storage.getApprovedStyleGuide();
  if (approved) return { content: approved.content, approved: true, id: approved.id };
  const draft = await storage.getLatestStyleGuideDraft();
  // ensureStyleGuideSeeded guarantees at least one row exists by this point.
  return { content: draft!.content, approved: false, id: draft!.id };
}

const CHECK_SYSTEM_PROMPT = `You are Jai Quality Supervisor, an internal reviewer for the Mustard Seed app. You check ONE piece of content against the style guide below and report any violation. You do not rewrite content, you do not counsel anyone, and you do not comment on anything outside the style guide.

Rules for you:
- If the content violates the style guide, you MUST quote the exact offending line from the content and name the exact rule it breaks (referencing the style guide's numbered section, e.g. "4) BANNED PHRASES").
- Do not resolve ambiguity in the content's favor — a human reviews every flag you raise, so when genuinely unsure, flag it and explain why in one sentence.
- Section 5 (chat-turn structure) applies ONLY when the content type is "jai_sample". Ignore it entirely for "content_repurposing" and "curriculum" content, which are not live chat turns.
- Passing is passing — don't invent a violation if there isn't one.

Respond with ONLY a JSON object, no other text:
{"passed": true|false, "ruleBroken": "<section + rule name, or null>", "quotedLine": "<exact offending text, or null>", "explanation": "<one sentence, or null>"}`;

/**
 * checkContent — runs one piece of content through the style-guide
 * classifier and persists the result as an audit row either way. Never
 * mutates the content, Jai's prompt, or the style guide itself.
 */
export async function checkContent(
  text: string,
  source: QualityCheckSource,
  sourceRef?: string
): Promise<QualityCheckResult> {
  const guide = await getActiveStyleGuide();

  const userPrompt = `STYLE GUIDE:\n${guide.content}\n\nCONTENT TYPE: ${source}\n\nCONTENT TO CHECK:\n${text}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    max_tokens: 300,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: CHECK_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim();
  let parsed: { passed?: boolean; ruleBroken?: string | null; quotedLine?: string | null; explanation?: string | null } = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }
  }

  const result: QualityCheckResult = {
    passed: parsed.passed !== false, // default to passed if the model returned something unparseable
    ruleBroken: parsed.ruleBroken ?? null,
    quotedLine: parsed.quotedLine ?? null,
    explanation: parsed.explanation ?? null,
    checkedAgainstApprovedGuide: guide.approved,
  };

  await storage.createQualityCheck({
    source,
    sourceRef: sourceRef ?? null,
    excerpt: text.slice(0, 2000),
    passed: result.passed,
    ruleBroken: result.ruleBroken,
    quotedLine: result.quotedLine,
    explanation: result.explanation,
    checkedAgainstApprovedGuide: result.checkedAgainstApprovedGuide,
  });

  return result;
}

/**
 * gatePrePublish — the pre-publish gate named in the build spec for Phase 5
 * (Content Repurposing) and Phase 8 (Curriculum Production) output. It is
 * fully implemented and ready to call, but neither of those agents exists
 * yet in this codebase, so nothing calls it yet — exercise it directly via
 * POST /api/admin/quality/check with source "content_repurposing" or
 * "curriculum" until then.
 */
export async function gatePrePublish(
  text: string,
  source: "content_repurposing" | "curriculum",
  sourceRef?: string
): Promise<QualityCheckResult> {
  return checkContent(text, source, sourceRef);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface SampleRunSummary {
  sampled: number;
  flagged: number;
  checkedAgainstApprovedGuide: boolean;
  flags: QualityCheckResult[];
}

/**
 * runRollingSample — the "rolling ~10% sample of Jai conversation turns"
 * job from the build spec. There's no scheduler/cron infra in this codebase,
 * so this is exposed on demand via POST /api/admin/quality/sample rather
 * than actually running on a timer — wiring it to a real cron is a follow-up,
 * not something this phase invents on its own. `poolSize` controls how many
 * of the most recent Jai messages are eligible for sampling; `sampleSize` is
 * how many of those get checked this run (~10% of poolSize by default).
 */
export async function runRollingSample(poolSize = 200, sampleSize = 20): Promise<SampleRunSummary> {
  const candidates = await storage.getRecentJaeMessages(poolSize);
  const alreadyChecked = await storage.getSampledMessageIds("jai_sample", candidates.map((m) => m.id));
  const unchecked = candidates.filter((m) => !alreadyChecked.has(m.id));
  // If everything in the pool has already been sampled at least once, fall
  // back to re-sampling the full pool rather than silently checking nothing.
  const pool = unchecked.length > 0 ? unchecked : candidates;
  const picked = shuffle(pool).slice(0, sampleSize);

  const results: QualityCheckResult[] = [];
  for (const msg of picked) {
    const result = await checkContent(msg.text, "jai_sample", msg.id);
    results.push(result);
  }

  return {
    sampled: results.length,
    flagged: results.filter((r) => !r.passed).length,
    checkedAgainstApprovedGuide: results[0]?.checkedAgainstApprovedGuide ?? false,
    flags: results.filter((r) => !r.passed),
  };
}
