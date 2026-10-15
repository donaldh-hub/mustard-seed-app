import OpenAI from "openai";
import { SAFETY_TRIGGER_CATEGORIES, type SafetyTriggerCategory, type SafetyTier } from "@shared/schema";

// ─── Trust & Safety screen (model calls only) ────────────────────────────────
// Kept free of storage/email so scripts/journal-jai-check.ts can exercise the
// real classifier without touching the database. trustSafety.ts does the
// logging, alerting, and script selection.

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface SafetyScreen {
  category: SafetyTriggerCategory;
  tier: SafetyTier;
  // check_in only: the user's distress phrase and what it seems to be about,
  // dropped into the fixed check-in wording.
  phrase: string;
  topic: string;
}

export type ScreenContext = { sender: string; text: string }[];

// Categories that always get the full script, whatever the model says.
const ALWAYS_CLEAR: SafetyTriggerCategory[] = [
  "passive_ideation",
  "active_ideation",
  "ideation_with_plan_or_means",
  "direct_self_harm",
  "abuse_in_progress",
  "medical_emergency",
  "disordered_eating",
];

// Fail-safe keyword net used ONLY if the model classifier call errors — a
// crisis screen must fail closed (still catch the obvious cases), never
// silently pass everything through because an API call failed.
const FALLBACK_PATTERNS: { category: SafetyTriggerCategory; re: RegExp }[] = [
  { category: "ideation_with_plan_or_means", re: /\b(i know how i'?d do it|i have (the pills|a gun|a plan)|i('ve| have) got(ten)? (the means|a way to do it))\b/i },
  { category: "active_ideation", re: /\b(kill myself|end my life|ending my life|want(ed)? to die|thinking about suicide|suicidal)\b/i },
  { category: "direct_self_harm", re: /\b(hurt myself|harm myself|cut(ting)? myself|want to cut)\b/i },
  { category: "abuse_in_progress", re: /\b(he'?s hurting me|she'?s hurting me|(is )?hitting me right now|being abused)\b/i },
  { category: "medical_emergency", re: /\b(i('m| am) overdosing|can'?t breathe|chest pain|i'?m dying)\b/i },
  { category: "hopelessness_finality", re: /\b(no point in (anything|trying|living)|nothing matters|better off dead|better off without me)\b/i },
  { category: "passive_ideation", re: /\b(don'?t see the point (in|of) (anything|living)|wish i (wasn'?t here|could disappear|weren'?t alive))\b/i },
  { category: "disordered_eating", re: /\b(haven'?t eaten in (days|\d+ days)|not (going to|gonna) eat|starving myself)\b/i },
];

const FALLBACK_CHECK_IN = /\b(too (frustrated|overwhelmed|tired)|overwhelmed|can'?t do this( anymore)?|i'?m done|giving up|give up|what'?s the point|i can'?t anymore)\b/i;

export function fallbackScreen(text: string): SafetyScreen | null {
  for (const { category, re } of FALLBACK_PATTERNS) {
    if (re.test(text)) return { category, tier: "clear", phrase: "", topic: "" };
  }
  if (FALLBACK_CHECK_IN.test(text)) return { category: "ambiguous_distress", tier: "check_in", phrase: "", topic: "" };
  return null;
}

const CLASSIFIER_SYSTEM_PROMPT = `You are a clinical risk-screening classifier embedded in a wellness/accountability app. You do not respond to the user, counsel them, or give advice — you ONLY classify their most recent message.

Categories:
1. passive_ideation — passive suicidal ideation, no plan or intent ("don't see the point in living," "wish I wasn't here")
2. active_ideation — active suicidal ideation, wanting to end their life
3. ideation_with_plan_or_means — suicidal ideation with a specific plan, method, or access to means
4. hopelessness_finality — hopelessness about life itself, beyond a task ("nothing matters anymore," "everyone would be better off without me")
5. direct_self_harm — wanting to, or currently, self-harming (e.g. cutting), not necessarily suicidal
6. abuse_in_progress — physical, sexual, or severe emotional abuse happening now or very recently, described as ongoing danger
7. medical_emergency — a medical emergency happening right now (overdose, can't breathe, chest pain, severe injury)
8. disordered_eating — active, deliberate self-harm through eating (e.g. extended intentional starvation), not ordinary diet talk
9. ambiguous_distress — distress that is most likely about a task, goal, or the day, but could be heavier: "I'm too frustrated to think," "I'm overwhelmed," "I can't do this," "I'm done," "giving up," "what's the point" — with NO explicit risk language

Tiers:
- "clear": explicit risk language — suicide, wanting to die or not be alive, wishing they weren't here, self-harm, a plan or means, abuse happening now, a medical emergency, deliberate starvation, or hopelessness about living itself. Categories 1–8.
- "check_in": ambiguous distress (category 9). A gentle question will follow, not a crisis script.
- null: no concern — ordinary venting clearly tied to a task with nothing heavier hinted, hyperbole ("this workout is killing me," "I could die of embarrassment"), or a reply that clarifies a previous check-in was about the task.

Rules — these matter more than any single word:
- Judge the pattern across ideation, plan, intent, and access to means — not one scary word in isolation.
- Weigh the recent conversation, not just the last message — risk can build across several turns, and context tells you what "this" refers to.
- Use "clear" only when there is explicit risk language. Frustration, exhaustion, or "I'm done" with a task is never "clear" on its own.
- When unsure between null and "check_in", choose "check_in". When unsure between "check_in" and "clear" and there IS explicit risk language, choose "clear".
- For "check_in" only, also give:
  "phrase": 2–6 words naming their distress in plain lowercase words, close to how they said it (e.g. "too frustrated", "done with this", "overwhelmed"). No quotation marks.
  "topic": 2–6 words for what it seems to be about, written to the user (e.g. "the name", "your writing", "the garden"). "" if you can't tell.

Respond with ONLY a JSON object, no other text:
{"category": "<one of the 9 ids above, or null>", "tier": "clear" | "check_in" | null, "phrase": "", "topic": "", "reasoning": "<one short sentence>"}`;

function contextBlock(recent: ScreenContext): string {
  return recent
    .slice(-8)
    .map((m) => `${m.sender === "user" ? "User" : "Jai"}: ${m.text}`)
    .join("\n");
}

function cleanSlot(s: unknown): string {
  if (typeof s !== "string") return "";
  const t = s.replace(/["“”‘’`]/g, "").replace(/\s+/g, " ").trim().replace(/[.?!,;:]+$/, "");
  return t.split(" ").length > 8 || t.length > 60 ? "" : t;
}

/**
 * Classifies one message. Throws if the model call fails — the caller falls
 * back to `fallbackScreen`.
 */
export async function screenMessage(text: string, recent: ScreenContext = []): Promise<SafetyScreen | null> {
  const ctx = contextBlock(recent);
  const userPrompt = ctx
    ? `Recent conversation (oldest first):\n${ctx}\n\nMost recent message to classify:\nUser: ${text}`
    : `Most recent message to classify:\nUser: ${text}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    max_tokens: 160,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: CLASSIFIER_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim();
  if (!raw) return null;
  let parsed: { category?: string | null; tier?: string | null; phrase?: string; topic?: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const category = parsed.category;
  if (!category || !(SAFETY_TRIGGER_CATEGORIES as readonly string[]).includes(category)) return null;
  const cat = category as SafetyTriggerCategory;
  // Explicit-risk categories always get the full script; ambiguous distress
  // is always a check-in; hopelessness follows the model's tier.
  const tier: SafetyTier = ALWAYS_CLEAR.includes(cat)
    ? "clear"
    : cat === "ambiguous_distress"
    ? "check_in"
    : parsed.tier === "check_in" ? "check_in" : "clear";
  return { category: cat, tier, phrase: cleanSlot(parsed.phrase), topic: cleanSlot(parsed.topic) };
}

// ─── Fixed wording ───────────────────────────────────────────────────────────
// Only the two short slots in the check-in vary; nothing here is generated.

export function checkInResponse(phrase: string, topic: string): string {
  const said = phrase ? `When you say ${phrase}` : "When you say that";
  const about = topic || "what you're working on";
  return `${said}, is that about ${about}, or is something heavier going on? If it's heavier, 988 is there anytime. Either way, I'm here.`;
}

// After a safety response, when the reply doesn't make it clear they're okay.
export const STAY_WITH_YOU_RESPONSE =
  "Thank you for answering me. I'm staying right here with you. If any part of this is heavier than the task, 988 is there anytime — call or text — or text HOME to 741741. You don't need the right words to reach out.";

// Added to the no-risk acknowledgment after a clear-risk flag, so the line
// stays in view.
export const RESOURCE_LINE = "If that ever changes, 988 is there anytime.";

// ─── Reading the reply to a safety response ─────────────────────────────────

export interface ReplyClarity {
  clarity: "no_risk" | "unclear";
  ack: string;
}

/**
 * Decides whether the user's reply clearly says there's no risk, and if so
 * writes a warm 1–2 sentence acknowledgment that returns to their goal.
 * Fails safe: any error reads as "unclear".
 */
export async function clarifyReply(ctx: {
  triggerText: string;
  safetyResponse: string;
  reply: string;
  goal?: string | null;
}): Promise<ReplyClarity> {
  const system = `You are Jai, a calm accountability partner in the Mustard Seed app. Earlier, the user wrote something that triggered a safety check, and you responded. Now they replied.

Decide:
- "no_risk": their reply clearly says they're okay — it was about the task, frustration, or a figure of speech — and nothing in it hints at anything heavier.
- "unclear": anything else — a bare "fine", "whatever", "never mind" with no explanation, mixed signals, or any hint of something heavier.

If "no_risk", write "ack": 1–2 short sentences. Warm, no shame, no apology, no lecture. Thank them for telling you, normalize the feeling in plain words, and bring them back to their goal${ctx.goal ? "" : " (the work they were doing)"}. Paraphrase, never quote them. No question. Do not mention crisis lines. Plain text.
If "unclear", "ack" is "".

Respond ONLY with JSON: {"clarity": "no_risk" | "unclear", "ack": "..."}`;
  const user = `${ctx.goal ? `Their goal (reference only): ${ctx.goal}\n` : ""}What they wrote first: ${ctx.triggerText}
Your safety response: ${ctx.safetyResponse}
Their reply: ${ctx.reply}`;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: 160,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    const ack = typeof parsed.ack === "string" ? parsed.ack.trim() : "";
    if (parsed.clarity === "no_risk" && ack) return { clarity: "no_risk", ack };
    return { clarity: "unclear", ack: "" };
  } catch {
    return { clarity: "unclear", ack: "" };
  }
}
