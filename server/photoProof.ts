// Photo proof → water. Kept free of imports so `node --test` can run
// photoProof.test.ts directly.
//
// Locked rules ("reward proof, not loopholes"):
//   - No active goal → nothing to measure against: HOLD (0 water). Jai starts
//     goal setup; the photo is re-checked once a goal is planted.
//   - Same image as before (content hash) → 0 water, "already counted".
//   - Confidence 0.00–0.59, or irrelevant / meme → REJECT (0 water).
//   - Confidence 0.60–0.74 → CLARIFY: ask one question, HOLD water.
//   - Confidence 0.75+ → APPROVE only if the photo shows a goal-aligned
//     action done TODAY: fresh work (not a finished artifact like a logo,
//     design, screenshot, or stock/AI image) AND a fresh capture (camera, or
//     a gallery file whose capture date is today). Otherwise CLARIFY + HOLD.
//   - Jai doesn't know enough about the goal to judge → CLARIFY with one
//     discovery question, HOLD.

export type PhotoSource = "camera" | "gallery" | "unknown";

// What the vision model says the picture is.
export type EvidenceType =
  | "action_in_progress"   // doing the work (planting, writing at a desk)
  | "fresh_output"         // just-made work: handwritten list, planted bed, drafted page
  | "finished_artifact"    // logo, design file, document, work screenshot, stock or AI image
  | "meme_or_unrelated"    // memes, random screenshots, selfies, pets, scenery
  | "unknown";

export type PhotoDecisionResult = "approved" | "held_no_goal" | "held_clarify" | "rejected" | "duplicate";

export interface PhotoFreshnessInput {
  source: PhotoSource;
  // Epoch ms from the browser File object, and the EXIF capture time if the
  // file had one. Either may be missing.
  lastModified?: number | null;
  capturedAt?: number | null;
  // The user's local calendar day (YYYY-MM-DD) and time zone.
  localDate: string;
  timeZone?: string;
}

export type Freshness = "fresh" | "old" | "unverified";

function localDay(ms: number, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

/**
 * Was this picture taken today?
 *   - Any date (capture or file) before today → "old".
 *   - Camera capture → "fresh" (the browser just made the file).
 *   - Gallery file → "fresh" only with a capture date of today; no capture
 *     date → "unverified".
 */
export function assessFreshness(f: PhotoFreshnessInput): Freshness {
  const isToday = (ms?: number | null) => typeof ms === "number" && ms > 0 && localDay(ms, f.timeZone) === f.localDate;
  const isBefore = (ms?: number | null) => typeof ms === "number" && ms > 0 && localDay(ms, f.timeZone) < f.localDate;
  if (isBefore(f.capturedAt) || isBefore(f.lastModified)) return "old";
  if (f.source === "camera") return "fresh";
  if (isToday(f.capturedAt)) return "fresh";
  return "unverified";
}

export interface PhotoDecisionInput {
  hasGoal: boolean;
  duplicate: boolean;
  confidence: number;
  relevant: boolean;            // action_type isn't unknown_or_irrelevant
  evidence: EvidenceType;
  needsContext: boolean;        // Jai doesn't know enough about the goal to judge
  freshness: Freshness;
}

export interface PhotoDecision {
  result: PhotoDecisionResult;
  water: number;                // garden water units (0 or 1)
  reason: string;
  // What Jai should ask when water is held for clarification.
  clarify?: "did_today" | "context" | "what_it_shows";
}

export function decidePhotoWater(i: PhotoDecisionInput): PhotoDecision {
  if (i.duplicate) return { result: "duplicate", water: 0, reason: "Same image as an earlier upload." };
  if (!i.hasGoal) return { result: "held_no_goal", water: 0, reason: "No active goal to measure this against yet." };
  if (!i.relevant || i.evidence === "meme_or_unrelated" || i.confidence < 0.6) {
    return { result: "rejected", water: 0, reason: i.confidence < 0.6 ? `Confidence ${i.confidence.toFixed(2)} is below 0.60.` : "Not connected to the goal." };
  }
  if (i.needsContext) return { result: "held_clarify", water: 0, reason: "Jai needs to know more about the goal before judging.", clarify: "context" };
  if (i.confidence < 0.75) return { result: "held_clarify", water: 0, reason: `Confidence ${i.confidence.toFixed(2)} is in the 0.60–0.74 range.`, clarify: "what_it_shows" };
  if (i.evidence === "finished_artifact" || i.evidence === "unknown") {
    return { result: "held_clarify", water: 0, reason: "A finished design, logo, screenshot, or stock/AI image isn't proof of today's action by itself.", clarify: "did_today" };
  }
  if (i.freshness !== "fresh") {
    return { result: "held_clarify", water: 0, reason: i.freshness === "old" ? "The file is older than today." : "No capture date on a gallery file, so it can't be shown to be from today.", clarify: "did_today" };
  }
  return { result: "approved", water: 1, reason: "Goal-aligned action, captured today." };
}

// Fixed wording for held/duplicate outcomes. Jai's own observation (from the
// vision check) comes first; these lines decide what happens to the water.
export const PHOTO_LINES = {
  duplicate: "I've already counted this one, so it won't add water again. Got a new step to show me?",
  noGoal: "I'd love to count this. Let's set your goal first so I know what it's building toward.",
  didToday: "Did you make or change this today? Tell me what you did, and I'll count it.",
  whatItShows: "Help me see it: what did you do here today?",
} as const;
