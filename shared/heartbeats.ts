// The Five Heartbeats — one source of truth for names, order, loop copy,
// and weights. Kept free of imports so `node --test` can run
// heartbeats.test.ts directly.

export type HeartbeatKey = "clarity" | "consistency" | "mindset" | "adaptation" | "courage";

// Loop order: 1 → 2 → 3 → 4 → 5 → back to 1. Locked.
export const HEARTBEAT_ORDER: HeartbeatKey[] = ["clarity", "consistency", "mindset", "adaptation", "courage"];

// Locked names — never shorten, rename, or reorder.
export const HEARTBEAT_NAMES: Record<HeartbeatKey, string> = {
  clarity: "Clarity of Vision & Why",
  consistency: "Small Steps + Consistency",
  mindset: "Mindset over Method",
  adaptation: "Feedback & Adaptation",
  courage: "Courageous Action",
};

// Assessment answers are 0–5 (Strongly Disagree → Strongly Agree), so each
// Heartbeat score is an average from 0.0 to 5.0
// (server/heartbeat.ts computeHeartbeatScores).
export const HEARTBEAT_SCORE_MAX = 5;

// ─── Loop copy — DRAFT, pending Donald's approval ───────────────────────────
// All loop wording lives here: the meaning line, how each Heartbeat feeds the
// next, and the question Jai opens with when the user taps "Talk with Jai".
export const HEARTBEAT_COPY: Record<HeartbeatKey, { meaning: string; feedsNext: string; jaiQuestion: string }> = {
  clarity: {
    meaning: "Creates direction.",
    feedsNext: "Direction tells Small Steps + Consistency where to go.",
    jaiQuestion: "What feels least clear right now: what you're building, who it's for, or why it matters to you?",
  },
  consistency: {
    meaning: "Creates momentum.",
    feedsNext: "Momentum gives Mindset over Method real progress to stand on.",
    jaiQuestion: "What's one small step you could repeat this week, even on a busy day?",
  },
  mindset: {
    meaning: "Helps sustain progress.",
    feedsNext: "A steady mindset keeps you going long enough for Feedback & Adaptation to show you what's working.",
    jaiQuestion: "What do you tell yourself when progress feels slow?",
  },
  adaptation: {
    meaning: "Reveals what's working.",
    feedsNext: "What you learn gives Courageous Action its next decision.",
    jaiQuestion: "What's one thing you tried recently, and what did it teach you?",
  },
  courage: {
    meaning: "Turns what you learned into a new decision, which feeds back into Clarity.",
    feedsNext: "Each new decision sharpens Clarity of Vision & Why, and the loop starts again.",
    jaiQuestion: "What's the step you've been putting off because it feels uncomfortable?",
  },
};

// ─── Weights — UNCONFIRMED ───────────────────────────────────────────────────
// From the loop design (30/20/20/20/10). Not verified against any source file.
// Display only, and only once SHOW_WEIGHTS is turned on. Never used in any
// score or calculation.
export const HEARTBEAT_WEIGHTS: Record<HeartbeatKey, number> = {
  clarity: 30,
  consistency: 20,
  mindset: 20,
  adaptation: 20,
  courage: 10,
};
export const SHOW_WEIGHTS = false;

// ─── Strongest and focus ─────────────────────────────────────────────────────

export interface HeartbeatStanding {
  // Every Heartbeat tied for the highest score. Empty when all five are
  // equal (nothing stands out) or there are no scores.
  strongest: HeartbeatKey[];
  // The focus Heartbeat: the one saved with the assessment
  // (assessments.weakest_heartbeat), so the loop, Home, and Jai always agree.
  focus: HeartbeatKey | null;
  // Other Heartbeats tied with the focus at the lowest score.
  tiedWithFocus: HeartbeatKey[];
}

const isKey = (k: unknown): k is HeartbeatKey => typeof k === "string" && (HEARTBEAT_ORDER as string[]).includes(k);

export function heartbeatStanding(scores: Record<string, number> | null | undefined, savedWeakest?: string | null): HeartbeatStanding {
  const valid = HEARTBEAT_ORDER.filter((k) => typeof scores?.[k] === "number");
  if (valid.length === 0) return { strongest: [], focus: null, tiedWithFocus: [] };
  const values = valid.map((k) => scores![k]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const strongest = max === min ? [] : valid.filter((k) => scores![k] === max);
  const focus = isKey(savedWeakest) ? savedWeakest : valid.find((k) => scores![k] === min) ?? null;
  const focusScore = focus ? scores![focus] : undefined;
  const tiedWithFocus = focus && focusScore === min ? valid.filter((k) => k !== focus && scores![k] === min) : [];
  return { strongest: strongest.filter((k) => k !== focus), focus, tiedWithFocus };
}

/** Jai's opening line when the user taps "Talk with Jai about this heartbeat". */
export function heartbeatChatOpener(
  key: HeartbeatKey,
  scores: Record<string, number> | null | undefined,
  savedWeakest?: string | null,
  firstName?: string,
): string {
  const name = HEARTBEAT_NAMES[key];
  const number = HEARTBEAT_ORDER.indexOf(key) + 1;
  const score = scores?.[key];
  const standing = heartbeatStanding(scores, savedWeakest);
  const role = standing.focus === key ? " It's your focus Heartbeat right now." : standing.strongest.includes(key) ? " It's your strongest Heartbeat." : "";
  const scoreLine = typeof score === "number"
    ? ` Your assessment put it at ${score.toFixed(1)} out of ${HEARTBEAT_SCORE_MAX}.${role}`
    : " You haven't taken the assessment yet, so we'll go by what you tell me.";
  const hello = firstName ? `${firstName}, let's` : "Let's";
  return `${hello} talk about Heartbeat ${number}, ${name}. ${HEARTBEAT_COPY[key].meaning}${scoreLine} ${HEARTBEAT_COPY[key].jaiQuestion}`;
}
