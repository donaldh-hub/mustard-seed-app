// 7-Day Rebuild — single source of truth for content, structure, and config.
// The magic number 7 lives here only. Every other file reads REBUILD_INSTANCE_COUNT.

export const REBUILD_INSTANCE_COUNT = 7;

// ── Gap / welcome-back config ────────────────────────────────────────────────
// [FLAGGED] Adjust this threshold if product feedback suggests a different window.
export const WELCOME_BACK_GAP_HOURS = 48;

// ── Subscription nudge config ────────────────────────────────────────────────
// Each entry fires a soft breadcrumb (no pricing) at the given instance.
// Add a second entry here to add a second touchpoint — no other code changes needed.
// [FLAGGED] Currently: one breadcrumb at instance 5 only. Confirm or add more.
export const SUBSCRIPTION_NUDGE_INSTANCES: number[] = [5];

// ── Instance type map ────────────────────────────────────────────────────────
export type RebuildInstanceType =
  | "clarity" | "consistency" | "mindset" | "adaptation"
  | "courage" | "practice" | "integration";

export interface RebuildInstanceConfig {
  instanceNumber: number;
  type: RebuildInstanceType;
  heartbeat: string | null; // null for instances 6 & 7 (no new teaching)
  title: string;
  subtitle: string;
  // [FLAGGED] Replace placeholder URLs with real YouTube unlisted URLs per day.
  videoUrl: string;
  questions: string[];
  // Fields saved to memoryData for this instance (keys only — values come from user)
  memoryFields: string[];
}

export const REBUILD_INSTANCES: RebuildInstanceConfig[] = [
  {
    instanceNumber: 1,
    type: "clarity",
    heartbeat: "Clarity of Vision & Why",
    title: "Day 1: Clarity of Vision & Why",
    subtitle: "Roots grow before you see them.",
    videoUrl: "PLACEHOLDER_DAY1_YOUTUBE_URL",
    questions: [
      "In one sentence, what is your goal — the real one, not the sanitized version?",
      "Why does this goal matter to you — not the surface reason, the one underneath it?",
      "If you achieved this goal, who would you become? What would be different about you?",
    ],
    memoryFields: ["goalStatement", "whyStatement", "identityStatement"],
  },
  {
    instanceNumber: 2,
    type: "consistency",
    heartbeat: "Small Steps + Consistency",
    title: "Day 2: Small Steps + Consistency",
    subtitle: "A little water, often, beats a flood once.",
    videoUrl: "PLACEHOLDER_DAY2_YOUTUBE_URL",
    questions: [
      "What is the smallest version of your goal action that you could still do on your worst day?",
      "What does 'just showing up' look like when you have zero motivation?",
      "What is your non-negotiable minimum — the floor you won't go below?",
    ],
    memoryFields: ["nonNegotiableMinimum"],
  },
  {
    instanceNumber: 3,
    type: "mindset",
    heartbeat: "Mindset over Method",
    title: "Day 3: Mindset over Method",
    subtitle: "Your thinking is the first thing that runs.",
    videoUrl: "PLACEHOLDER_DAY3_YOUTUBE_URL",
    questions: [
      "Describe a time you stopped pursuing something — what story did you tell yourself that made stopping feel reasonable?",
      "What is the reframed version of that story — one that's still honest, but opens a door instead of closing one?",
      "What belief about yourself would need to change for this goal to feel inevitable instead of hopeful?",
    ],
    memoryFields: ["setbackStory", "reframedTruth"],
  },
  {
    instanceNumber: 4,
    type: "adaptation",
    heartbeat: "Feedback & Adaptation",
    title: "Day 4: Feedback & Adaptation",
    subtitle: "Review what happened. Adjust. Keep moving.",
    videoUrl: "PLACEHOLDER_DAY4_YOUTUBE_URL",
    questions: [
      "What's actually working so far — even in small ways?",
      "What's not working, or what have you been avoiding looking at honestly?",
      "Based on that — what is one specific adjustment you're willing to make?",
    ],
    memoryFields: ["whatWorking", "whatNotWorking", "chosenAdjustment"],
  },
  {
    instanceNumber: 5,
    type: "courage",
    heartbeat: "Courageous Action",
    title: "Day 5: Courageous Action",
    subtitle: "Act before you're ready. Discomfort is the signal, not the stop sign.",
    videoUrl: "PLACEHOLDER_DAY5_YOUTUBE_URL",
    questions: [
      "What is the one action you've been avoiding — the one that, if you did it, would change things?",
      "What is the fear underneath that avoidance? Name it plainly.",
      "What is the specific action you will take in the next 24 hours — not 'soon,' but today or tomorrow?",
    ],
    memoryFields: ["namedAvoidedAction", "namedFear", "committed24hrStep", "followUpStatus"],
  },
  {
    instanceNumber: 6,
    type: "practice",
    heartbeat: null,
    title: "Day 6: Bringing It Together",
    subtitle: "Season 2: Jordan's back — new goal, same Heartbeats.",
    videoUrl: "PLACEHOLDER_DAY6_YOUTUBE_URL",
    questions: [
      "In your own words — which Heartbeat showed up in Chapter 1?",
      "Which Heartbeat showed up in Chapter 2?",
      "Which Heartbeat showed up in Chapter 3?",
      "Which Heartbeat(s) showed up in Chapter 4?",
      // Bridge question (index 4) — submitted separately after the 4 chapters
      "You've spotted all five Heartbeats in Jordan's story now. Which one has been the hardest for YOU personally this week — and why?",
    ],
    memoryFields: ["characterTrack", "chapterAnswers", "hardestHeartbeat"],
  },
  {
    instanceNumber: 7,
    type: "integration",
    heartbeat: null,
    title: "Day 7: Bringing It Home",
    subtitle: "No new Heartbeat. Just you, everything you've built, and one plan to make.",
    videoUrl: "PLACEHOLDER_DAY7_YOUTUBE_URL",
    questions: [], // Day 7 uses stage-based questions below
    memoryFields: [
      "goalConfirmedOrUpdated", "finalWhy", "ongoingSmallStep",
      "mindsetPlan", "feedbackLoop", "nextCourageousAction",
    ],
  },
];

// ── Day 7 stage definitions ──────────────────────────────────────────────────
// Each stage maps to one Heartbeat, has one core question, and saves one memory field.
export interface Day7Stage {
  stageNumber: number;
  heartbeat: string;
  title: string;
  question: string;
  memoryField: string;
  priorMemoryRef?: string; // which field from an earlier instance to surface
}

export const DAY7_STAGES: Day7Stage[] = [
  {
    stageNumber: 0,
    heartbeat: "Goal Confirmation",
    title: "Stage 0 — Confirm Your Goal",
    question: "All week you've been working on a goal. Is that still the goal — or has this week changed things?",
    memoryField: "goalConfirmedOrUpdated",
    priorMemoryRef: "goalStatement", // from instance 1
  },
  {
    stageNumber: 1,
    heartbeat: "Clarity of Vision & Why",
    title: "Stage 1 — Clarity",
    question: "Your why from Day 1 was: {day1Why}. Does that still feel true, or has it sharpened this week?",
    memoryField: "finalWhy",
    priorMemoryRef: "whyStatement",
  },
  {
    stageNumber: 2,
    heartbeat: "Small Steps + Consistency",
    title: "Stage 2 — Small Steps",
    question: "Your non-negotiable minimum from Day 2 was: {day2Min}. Is that still the right floor — or do you want to refine it?",
    memoryField: "ongoingSmallStep",
    priorMemoryRef: "nonNegotiableMinimum",
  },
  {
    stageNumber: 3,
    heartbeat: "Mindset over Method",
    title: "Stage 3 — Mindset",
    question: "The belief you said needed to change was: {day3Reframe}. What does that shift look like as a plan — not a hope, but a practice?",
    memoryField: "mindsetPlan",
    priorMemoryRef: "reframedTruth",
  },
  {
    stageNumber: 4,
    heartbeat: "Feedback & Adaptation",
    title: "Stage 4 — Feedback Loop",
    question: "The adjustment you committed to on Day 4 was: {day4Adjustment}. How will you know when it's working — what will you track or review, and how often?",
    memoryField: "feedbackLoop",
    priorMemoryRef: "chosenAdjustment",
  },
  {
    stageNumber: 5,
    heartbeat: "Courageous Action",
    title: "Stage 5 — Courageous Action",
    question: "The action you named on Day 5 was: {day5Action}. After this week — what is the next courageous action you're committing to, starting now?",
    memoryField: "nextCourageousAction",
    priorMemoryRef: "committed24hrStep",
  },
];

// ── Day 6 Jordan chapter content ─────────────────────────────────────────────
export type CharacterTrack = "male" | "female" | "neutral";

export function jordanText(base: string, track: CharacterTrack): string {
  if (track === "male") return base.replace(/they/g, "he").replace(/them/g, "him").replace(/their/g, "his").replace(/They/g, "He").replace(/Them/g, "Him");
  if (track === "female") return base.replace(/they/g, "she").replace(/them/g, "her").replace(/their/g, "her").replace(/They/g, "She").replace(/Them/g, "Her");
  return base;
}

export const JORDAN_CHAPTERS = [
  {
    number: 1,
    heartbeat: "Clarity of Vision & Why",
    story: "Jordan wants to learn guitar so they can play one full song at their nephew's birthday party — three months away. They download five apps, read three books, buy two courses. One month in, they haven't touched a guitar.",
    prompt: "Which Heartbeat is missing for Jordan in this chapter?",
  },
  {
    number: 2,
    heartbeat: "Small Steps + Consistency",
    story: "Jordan starts practicing 15 minutes every morning before work. Some days their fingers hurt and the chords sound terrible. They almost skip it — but they show up anyway. Two weeks in, the chord changes are smoother.",
    prompt: "Which Heartbeat is Jordan showing up with in this chapter?",
  },
  {
    number: 3,
    heartbeat: "Mindset over Method",
    story: "Jordan compares their playing to YouTube guitarists and feels embarrassed. Considers quitting. Then shifts: stops measuring against professionals, starts measuring against yesterday's version of themselves.",
    prompt: "Which Heartbeat just saved Jordan in this chapter?",
  },
  {
    number: 4,
    heartbeat: "Feedback & Adaptation and Courageous Action",
    story: "A musician friend tells Jordan: stop running scales, just play songs you like and learn the chords as you go. Jordan adjusts their whole approach. The birthday party song comes together — and Jordan plays it at the party, even though their hands are shaking.",
    prompt: "Two Heartbeats show up at the end of this chapter. Which ones?",
  },
];
