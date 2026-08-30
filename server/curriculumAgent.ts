import OpenAI from "openai";
import { storage } from "./storage";
import { gatePrePublish, LOCKED_MISSION_STATEMENT, LOCKED_IDENTITY_PHRASE } from "./qualitySupervisor";
import type { CurriculumDraft } from "@shared/schema";

// ─── Curriculum Production Agent (Agent 08) ──────────────────────────────────
// Drafts a talk track, worksheet questions, a slide outline, and an
// ElevenLabs-ready voiceover script for a Rebuild module — matching Day 1's
// real, locked structure and pacing (copied below verbatim from
// client/src/content/rebuildContent.ts, not re-derived, so the pattern this
// agent mirrors is the actual shipped Day 1, not a guess). Every draft
// routes through Jai Quality Supervisor's gate before it can reach the
// founder's approval queue. NOTHING here finalizes on its own: every module
// is still recorded on camera by the founder, and "approved" only means the
// script is signed off — never that a video exists.

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Real Day 1 reference, copied from client/src/content/rebuildContent.ts
// (server code doesn't import client code, so this is a faithful copy, not
// a live import — if Day 1's real content changes, update this block too).
const DAY1_REFERENCE = {
  title: "Day 1: Clarity of Vision & Why",
  subtitle: "Roots grow before you see them.",
  questions: [
    "In one sentence, what is your goal — the real one, not the sanitized version?",
    "Why does this goal matter to you — not the surface reason, the one underneath it?",
    "If you achieved this goal, who would you become? What would be different about you?",
  ],
  narrationSlides: [
    "Hi — I'm Jai. Welcome to Day 1 of your 7-Day Rebuild. Today, we start where real change always starts: Clarity of Vision and Why.",
    "You already showed up twice — the assessment, the grounding journal. That's proof you follow through. Today, we build on that.",
    "Here's my promise: by Day 7, you won't just have progress on one goal. You'll know a system for every goal you set.",
    "This system runs on five Heartbeats. You'll meet all five this week. Today, we go deep on the first one.",
    "Heartbeat 1: Clarity of Vision and Why. People skip it fastest — but it decides if everything else sticks.",
    "A seed's roots grow first, underground, before you see a sprout. Your goal works the same way — the invisible work comes before any visible progress.",
    "Meet Jordan — two years wanting a home bakery, still stuck between sourdough, cakes, and cookies. A little of each, real progress on none. Sound familiar?",
    "Three questions got Jordan unstuck: What do I actually want? Why does it matter right now? Who do I become if I keep this promise?",
    "One night, Jordan picked: sourdough, Grandma's recipe. Two days later, the first loaf was baked. That's Clarity of Vision and Why — you just watched it happen.",
    "Your move: open Mustard Seed, talk to me directly. Just three honest answers.",
    "I'll ask you those same three questions. Answer honestly — there's no wrong answer. Your answers become your Day 1 memory.",
    "That's Day 1 — a quarter of the cup, because you showed up and told the truth. One Heartbeat down, four to go. Tomorrow: Small Steps and Consistency. Come find me in the app.",
  ],
};

const GENERATION_SYSTEM_PROMPT = `You are the Curriculum Production drafting assistant for Mustard Seed's 7-Day Rebuild, a program delivered by the companion Jai (a "${LOCKED_IDENTITY_PHRASE}"). You draft ONE module's script — nothing you produce is ever finalized automatically. Every module is still recorded on camera by the founder; you are drafting the script they'll read and adapt, not producing a finished asset.

Match this REAL, LOCKED pattern from Day 1 — same structure, same depth, same pacing (roughly 12 short narration beats, ~75-90 seconds of spoken narration total, 3 reflective worksheet questions):

Day 1 title: "${DAY1_REFERENCE.title}"
Day 1 subtitle: "${DAY1_REFERENCE.subtitle}"
Day 1's 12-beat narration arc (paraphrased structure, follow this shape — hook, proof of the user's follow-through so far, promise for the week, frame the Heartbeat, define the Heartbeat, a metaphor, a "Jordan" character story showing the Heartbeat in action, the reflective questions teased, the call to action into the app, transition to answering the questions live, and a closing beat crediting the user + a preview of tomorrow):
${DAY1_REFERENCE.narrationSlides.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Day 1's 3 worksheet questions (reflective, personal, building on each other):
${DAY1_REFERENCE.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Locked rules:
- Whenever you quote the mission statement, use this exact wording, verbatim: "${LOCKED_MISSION_STATEMENT}"
- Jai narrates in first person, exactly as Day 1 does ("Hi — I'm Jai...").
- Keep the recurring "Jordan" character device if it fits naturally — Jordan is the ongoing example character used across the Rebuild's teaching story. Don't force it if the day's Heartbeat doesn't lend itself to it.
- Tone: steady, grounded, direct — never hype, never "you got this" filler.

Produce ONLY a JSON object with this exact shape:
{
  "title": "<Day N: Heartbeat Name>",
  "subtitle": "<one short line, in the spirit of Day 1's 'Roots grow before you see them.'>",
  "talkTrack": "<the full talk track as continuous prose, the source the narration slides below are drawn from>",
  "worksheetQuestions": ["<question 1>", "<question 2>", "<question 3>"],
  "slideOutline": [{"slideNumber": 1, "narrationText": "<beat 1>"}, ...],
  "voiceoverScript": "<the narration slides concatenated into one ElevenLabs-ready script, one line per beat>"
}`;

export interface CurriculumPackDraft {
  title: string;
  subtitle: string;
  talkTrack: string;
  worksheetQuestions: string[];
  slideOutline: { slideNumber: number; narrationText: string }[];
  voiceoverScript: string;
}

async function generateCurriculumPack(forDay: number, heartbeatFocus: string, brief: string): Promise<CurriculumPackDraft> {
  const userPrompt = `Draft the module for Day ${forDay}, Heartbeat focus: "${heartbeatFocus}".\n\nBrief from the founder: ${brief || "(no additional brief given — use your judgment based on the Heartbeat focus and Day 1's pattern)"}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.6,
    max_tokens: 1800,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: GENERATION_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim();
  let parsed: Partial<CurriculumPackDraft> = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }
  }

  return {
    title: parsed.title ?? `Day ${forDay}: ${heartbeatFocus}`,
    subtitle: parsed.subtitle ?? "",
    talkTrack: parsed.talkTrack ?? "",
    worksheetQuestions: Array.isArray(parsed.worksheetQuestions) ? parsed.worksheetQuestions : [],
    slideOutline: Array.isArray(parsed.slideOutline) ? parsed.slideOutline : [],
    voiceoverScript: parsed.voiceoverScript ?? "",
  };
}

/**
 * draftCurriculumModule — the only entry point this agent exposes. Generates
 * the module, runs the combined text through the Phase 2 pre-publish gate,
 * and persists either way. A draft that fails the quality gate is held as
 * "blocked_needs_revision" with the cited rule attached and can't be
 * approved until regenerated.
 */
export async function draftCurriculumModule(
  forDay: number,
  heartbeatFocus: string,
  brief: string
): Promise<CurriculumDraft> {
  const pack = await generateCurriculumPack(forDay, heartbeatFocus, brief);
  const combinedText = [pack.talkTrack, ...pack.worksheetQuestions, pack.voiceoverScript].join("\n\n");

  const qualityResult = await gatePrePublish(combinedText, "curriculum");

  return storage.createCurriculumDraft({
    forDay,
    heartbeatFocus,
    title: pack.title,
    subtitle: pack.subtitle,
    talkTrack: pack.talkTrack,
    worksheetQuestions: pack.worksheetQuestions,
    slideOutline: pack.slideOutline,
    voiceoverScript: pack.voiceoverScript,
    qualityCheckPassed: qualityResult.passed,
    qualityCheckDetail: {
      ruleBroken: qualityResult.ruleBroken,
      quotedLine: qualityResult.quotedLine,
      explanation: qualityResult.explanation,
      checkedAgainstApprovedGuide: qualityResult.checkedAgainstApprovedGuide,
    },
    status: qualityResult.passed ? "pending_review" : "blocked_needs_revision",
    reviewNote: null,
    reviewedAt: null,
  });
}

export async function listCurriculumDrafts(status?: string): Promise<CurriculumDraft[]> {
  return storage.getCurriculumDrafts(status);
}

/**
 * reviewCurriculumDraft — the founder's decision, and the ceiling of what
 * this agent can do. "approved" means the script is signed off for the
 * founder to record on camera — it does not produce, publish, or finalize
 * a video, since nothing in this codebase does that.
 */
export async function reviewCurriculumDraft(
  id: string,
  decision: "approved" | "rejected",
  note?: string
): Promise<CurriculumDraft | undefined> {
  const draft = await storage.getCurriculumDraft(id);
  if (!draft) return undefined;
  if (decision === "approved" && !draft.qualityCheckPassed) {
    throw new Error("Cannot approve a draft that's still blocked on a quality flag — regenerate it first.");
  }
  return storage.updateCurriculumDraft(id, { status: decision, reviewNote: note ?? null, reviewedAt: new Date() });
}
