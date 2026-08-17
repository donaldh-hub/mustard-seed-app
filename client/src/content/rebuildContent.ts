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
    videoUrl: "/rebuild-assets/day1/day1-video.mp4",
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
    videoUrl: "/rebuild-assets/day2/day2-video.mp4",
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
    videoUrl: "/rebuild-assets/day4/day4-video.mp4",
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
    videoUrl: "/rebuild-assets/day5/day5-video.mp4",
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
    videoUrl: "/rebuild-assets/day6/day6-video.mp4",
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
    videoUrl: "/rebuild-assets/day7/day7-video.mp4",
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

// ── Real asset wiring (7-Day Rebuild animation + voiceover) ──────────────────
// Videos are hosted externally (YouTube unlisted) — swap the PLACEHOLDER_*
// videoUrl values above once Donald sends links. Narration audio clips are
// committed locally under client/public/rebuild-assets/ and served as static
// files, one mp3 per narration line, in the order Donald generated them.

export const REBUILD_OVERVIEW_VIDEO_URL = "/rebuild-assets/overview/overview-video.mp4";
export const REBUILD_OVERVIEW_AUDIO_URL = "/rebuild-assets/overview/overview-vo.mp3";

export interface RebuildSlideTiming {
  slideNumber: number;
  startSec: number;
  durationSec: number;
  // Reference only — this text is already rendered inside the video itself,
  // it is NOT re-rendered as an on-screen overlay by the player.
  onScreenText: string;
  narrationText: string;
}

export interface RebuildAudioSync {
  mode: "timed" | "sequential";
  clipCount: number;
  clipUrl: (n: number) => string;
  slides?: RebuildSlideTiming[];
  // Present when the day's own script self-reported that total narration
  // runs longer than the animation. Donald's call: extend the animation
  // (not trim narration). Until he sends a longer re-export, the player's
  // interim behavior is to hold the video's last frame once it ends while
  // narration keeps playing to completion, so nothing gets cut short. Swap
  // in the extended video file and drop this field once it lands.
  timingMismatch?: { narrationSec: number; videoSec: number };
}

function clipUrlFor(day: string) {
  return (n: number) => `/rebuild-assets/${day}/clip-${String(n).padStart(2, "0")}.mp3`;
}

function sequentialSync(day: string, clipCount: number): RebuildAudioSync {
  return { mode: "sequential", clipCount, clipUrl: clipUrlFor(day) };
}

function timedSync(
  day: string,
  clipCount: number,
  slides: RebuildSlideTiming[],
  timingMismatch?: { narrationSec: number; videoSec: number }
): RebuildAudioSync {
  return { mode: "timed", clipCount, clipUrl: clipUrlFor(day), slides, timingMismatch };
}

// Day 2 — Small Steps + Consistency (estimated timings; script notes actual
// clip length is the source of truth if it drifts from these estimates)
export const DAY2_SLIDES: RebuildSlideTiming[] = [
  { slideNumber: 1, startSec: 0, durationSec: 3, onScreenText: "Day 2: Small Steps & Consistency", narrationText: "Hi, it's Jai. Welcome back — Day 2." },
  { slideNumber: 2, startSec: 3, durationSec: 21, onScreenText: "Clarity of Vision & Why → Small Steps + Consistency", narrationText: "Yesterday you found your Clarity of Vision and Why. Clarity tells you where you're going, but it doesn't get you there by itself. A vision without small, repeatable steps just stays a nice idea. Today's Heartbeat is Small Steps and Consistency — this is how your why turns into daily motion." },
  { slideNumber: 3, startSec: 24, durationSec: 12, onScreenText: "Heartbeat 2: Small Steps + Consistency", narrationText: "Small Steps and Consistency. Not the biggest step you can imagine — the smallest one you'll actually repeat. Less about intensity, more about showing up, over and over." },
  { slideNumber: 4, startSec: 36, durationSec: 16, onScreenText: "A little water, often, beats a flood, once.", narrationText: "You already know this one — it's built into the app. Every honest small action waters your seed. One giant effort, once, floods the soil and runs right off. A little water, consistently, is what reaches the roots." },
  { slideNumber: 5, startSec: 52, durationSec: 18, onScreenText: "Motivation is a spark. Consistency is the fire.", narrationText: "Motivation got you here — that's real. But motivation comes and goes. If your plan only works on the days you feel inspired, it won't survive a normal week. Consistency doesn't need motivation. It just needs a step small enough to do anyway." },
  { slideNumber: 6, startSec: 70, durationSec: 14, onScreenText: "Vague: \"I'll work out when I have time.\" / Clear: \"I walk 15 minutes every morning at 7.\"", narrationText: "One depends on finding time and energy you won't always have. The other is small enough to survive a bad day. That's the whole difference between a goal that fades and one that sticks." },
  { slideNumber: 7, startSec: 84, durationSec: 19, onScreenText: "1. Smallest version of this goal, today? 2. What does \"just showing up\" look like on my hardest days? 3. My non-negotiable minimum?", narrationText: "Three questions. What's the smallest version of this goal you could do today. What does just showing up look like on your hardest day, not your best one. And what's your non-negotiable minimum — the version you'll do no matter what. That last one matters most." },
  { slideNumber: 8, startSec: 103, durationSec: 19, onScreenText: "Jordan, one week later. Fired up — and burned out.", narrationText: "Remember Jordan? Fired up after finding the why, Jordan decided to bake twelve loaves the first week and sell them door to door. Every evening in the kitchen, exhausted — by week two, too burned out to bake at all. Three weeks went by without a single loaf." },
  { slideNumber: 9, startSec: 122, durationSec: 15, onScreenText: "Jordan's fix: One loaf, every Saturday, three neighbors.", narrationText: "When Jordan came back to it, the fix was smaller, not bigger: one loaf, every Saturday morning, sold to the same three neighbors. That, Jordan could actually keep doing. Small isn't small when it stacks." },
  { slideNumber: 10, startSec: 137, durationSec: 10, onScreenText: "Your move: Tell Jai your non-negotiable minimum.", narrationText: "Here's today's move: open Mustard Seed and tell me your non-negotiable minimum for this goal. One sentence. That's today's water." },
  { slideNumber: 11, startSec: 147, durationSec: 11, onScreenText: "What happens next: Jai helps you land on one repeatable action.", narrationText: "I'll ask you those same three questions and help you land on one small, repeatable action — the thing you check off most days this week, not just today." },
  { slideNumber: 12, startSec: 158, durationSec: 17, onScreenText: "The cup is rising. Two Heartbeats connected.", narrationText: "That's Day 2. You just defined the smallest version of your promise — the one you can actually keep. Two Heartbeats connected now. Tomorrow, we talk about what happens in your head on the days this feels hard. Come find me in the app." },
];

// Day 5 — Courageous Action (real clip timings). [FLAGGED] Narration
// (2:38) runs 95s longer than the 63s animation — unresolved as of authoring.
export const DAY5_SLIDES: RebuildSlideTiming[] = [
  { slideNumber: 1, startSec: 0, durationSec: 6, onScreenText: "Day 5: Courageous Action", narrationText: "Hi, it's Jai. Day 5 — this is the one that actually moves things." },
  { slideNumber: 2, startSec: 6, durationSec: 12, onScreenText: "Feedback + Adaptation → Courageous Action", narrationText: "Feedback tells you what needs to change. Courageous Action is what you actually do with that truth — the moment you act on what you've learned, even when it's uncomfortable." },
  { slideNumber: 3, startSec: 18, durationSec: 6, onScreenText: "Heartbeat 5: Courageous Action", narrationText: "Courageous Action. Not fearless — courageous. You feel the fear, and you move anyway." },
  { slideNumber: 4, startSec: 24, durationSec: 12, onScreenText: "Every sprout pushes through something.", narrationText: "Nothing grows without resistance somewhere. The sprout doesn't wait for the soil to soften — it pushes through it. That's what courage actually looks like: moving before it feels easy." },
  { slideNumber: 5, startSec: 36, durationSec: 15, onScreenText: "Clarity, consistency, mindset, and feedback change nothing by themselves.", narrationText: "All four Heartbeats so far are real. But none of them move anything on their own until you act on what they've taught you. This is the Heartbeat that turns insight into an actual result." },
  { slideNumber: 6, startSec: 51, durationSec: 7, onScreenText: "Avoidant: \"I'll do the easy 90% and skip the scary part.\" / Courageous: \"I do the one thing I've been avoiding.\"", narrationText: "Most of a goal is comfortable. It's the ten percent you've been avoiding that actually decides the outcome." },
  { slideNumber: 7, startSec: 58, durationSec: 12, onScreenText: "1. What's the action I've been avoiding? 2. What am I actually afraid will happen? 3. What's one courageous step in the next 24 hours?", narrationText: "What's the action you've been avoiding. What are you actually afraid will happen if you do it. And what's one courageous step you'll take in the next twenty-four hours." },
  { slideNumber: 8, startSec: 70, durationSec: 21, onScreenText: "Jordan, six weeks later. Knew it. Hadn't done it.", narrationText: "A different customer said the bread was good enough for the Saturday farmers market, not just door to door — Jordan should get a booth. Jordan had known this for weeks. But standing behind a table, calling yourself a real baker in front of strangers — that felt like too much." },
  { slideNumber: 9, startSec: 91, durationSec: 18, onScreenText: "Season 1 finale: Jordan showed up. Sold out.", narrationText: "Saturday morning, Jordan showed up anyway — hands shaking, sign a little crooked. By noon, every loaf was gone. That's Courageous Action: not the absence of fear, just moving anyway. That's Jordan's whole season — Clarity, Consistency, Mindset, Feedback, and finally, Action." },
  { slideNumber: 10, startSec: 109, durationSec: 8, onScreenText: "Your move: Tell Jai the action — then go do it.", narrationText: "Today's move is different: tell me the action, and then actually go do it. I'll check back with you." },
  { slideNumber: 11, startSec: 117, durationSec: 12, onScreenText: "What happens next: Jai names the action with you, then follows up.", narrationText: "I'll help you name the action clearly, and I'll check back in to see how it went — not to catch you, to keep you honest with yourself." },
  { slideNumber: 12, startSec: 129, durationSec: 29, onScreenText: "Three-quarter cup: this is becoming me. All five Heartbeats are yours now.", narrationText: "That's Day 5. Three-quarter cup is named exactly for this: 'this is becoming me.' Courageous action is how identity actually changes — not just your to-do list. And that's Jordan's story wrapped — Season 1, complete. Day 6, you'll meet Jordan again, with a brand new goal, and you'll get to spot all five Heartbeats for yourself, in someone else's story first. Day 7, we bring it home." },
];

// Day 6 — Bringing It Together / Season 2 opener (real clip timings).
// [FLAGGED] Narration (2:29) runs 77s longer than the 72s animation —
// unresolved as of authoring.
export const DAY6_SLIDES: RebuildSlideTiming[] = [
  { slideNumber: 1, startSec: 0, durationSec: 5, onScreenText: "Day 6: Bringing It Together", narrationText: "Hi, it's Jai. Day 6. No new lesson today — I promise." },
  { slideNumber: 2, startSec: 5, durationSec: 10, onScreenText: "Season 1 is done. Jordan kept the promise.", narrationText: "Yesterday, Jordan sold out at that market table. Season 1's complete. You've met all five Heartbeats now — through Jordan's story, and your own." },
  { slideNumber: 3, startSec: 15, durationSec: 14, onScreenText: "One plant. Five parts. All at once.", narrationText: "Look at what you've actually built this week — Clarity, Consistency, Mindset, Feedback, Courageous Action. A plant doesn't grow one part at a time. Neither did you, even if it felt that way." },
  { slideNumber: 4, startSec: 29, durationSec: 19, onScreenText: "It's easier to see a problem in someone else's life than in your own.", narrationText: "Here's something true about people, not just about this app: you're better at spotting what someone else needs to do than you are at spotting it for yourself. That's not a flaw — it's just how minds work. So today, we start with someone else again." },
  { slideNumber: 5, startSec: 48, durationSec: 16, onScreenText: "Season 2: Jordan's back. New goal.", narrationText: "Jordan's back — same person you followed all week, new goal this time. Today's move doesn't touch your goal at all. You'll follow Jordan's new story, chapter by chapter, and spot which Heartbeat shows up at each turn." },
  { slideNumber: 6, startSec: 64, durationSec: 17, onScreenText: "Your call: Picture Jordan as a man, a woman, or keep it neutral.", narrationText: "One thing's different this time: you get to choose. You've been picturing Jordan your own way all week without me asking — now I'm actually asking. A man, a woman, or keep the neutral version you already know. Whatever feels right." },
  { slideNumber: 7, startSec: 81, durationSec: 10, onScreenText: "One story. Four chapters. Five Heartbeats.", narrationText: "Same format as before: one story, four chapters. The last chapter covers two Heartbeats at once — you'll see why when you get there." },
  { slideNumber: 8, startSec: 91, durationSec: 15, onScreenText: "Reminder — how it works: \"This person can't decide between three paths, so they take none of them.\"", narrationText: "Quick reminder of how the spotting works: someone can't decide between three paths, so they end up taking none of them. What's missing for them? ... That's Clarity of Vision and Why. Same game, new season." },
  { slideNumber: 9, startSec: 106, durationSec: 12, onScreenText: "Watch Jordan's new arc.", narrationText: "Same character, new challenge, same five Heartbeats underneath. If Jordan could do it once, with bread, you'll see it's not a fluke when it happens again, with something totally different." },
  { slideNumber: 10, startSec: 118, durationSec: 10, onScreenText: "Your move: Open Mustard Seed. Choose Jordan's look. Follow along.", narrationText: "Today's move: open Mustard Seed, tell me how you'd like to picture Jordan, and follow the new story with me, one chapter at a time." },
  { slideNumber: 11, startSec: 128, durationSec: 8, onScreenText: "What happens next: 4 chapters, 1 question about you at the end.", narrationText: "After the four chapters, I've got one more question — this one's actually about you. That one sets up tomorrow." },
  { slideNumber: 12, startSec: 136, durationSec: 13, onScreenText: "Almost full. Tomorrow: no new Heartbeat. Just you, everything you've built, and one conclusion to reach.", narrationText: "That's the setup for Day 6. Season 2 starts the moment you open the app. Tomorrow, we turn all of this back around on your goal. Come find me in the app." },
];

// Days without a timing map (no slide-by-slide script exists) fall back to
// sequential clip playback alongside the video's own pacing. Clip counts are
// provisional — confirm against the actual files landed under
// client/public/rebuild-assets/dayN/ before shipping.
export const REBUILD_AUDIO_SYNC: Record<number, RebuildAudioSync> = {
  1: sequentialSync("day1", 12), // [FLAGGED] no timing map for Day 1
  2: timedSync("day2", 11, DAY2_SLIDES), // Drive folder has 11 unique clips, not the 12 the script self-reported
  3: sequentialSync("day3", 12), // has a full narration script, but not a per-slide timing table
  4: sequentialSync("day4", 11), // [FLAGGED] no timing map for Day 4
  5: timedSync("day5", 12, DAY5_SLIDES, { narrationSec: 158, videoSec: 63 }),
  6: timedSync("day6", 12, DAY6_SLIDES, { narrationSec: 149, videoSec: 72 }),
  7: sequentialSync("day7", 7), // [FLAGGED] no timing map for Day 7
};

export const DAY4_STORYBOARD_IMAGES = Array.from({ length: 12 }, (_, i) =>
  `/rebuild-assets/day4/storyboard/${String(i + 1).padStart(2, "0")}.png`
);

// ── Jai check-in follow-up question bank ─────────────────────────────────────
// 8 candidate follow-ups per instance, matched to that day's ACTUAL heartbeat
// and saved memory fields (not the old five-heartbeat-assessment mapping).
// Jai selects 1-2 per conversation based on what the user actually wrote —
// never the full list, never a fixed order. Bracketed tokens get filled from
// real saved memory before Jai ever uses the question; if the underlying
// data isn't available yet, skip that question rather than showing a blank.
export const REBUILD_FOLLOWUP_QUESTIONS: Record<number, string[]> = {
  1: [ // Clarity of Vision & Why
    "Which part of your why feels truest right now — not the version you'd say out loud to someone else, but the one underneath it?",
    "If this goal disappeared tomorrow, would the why still matter to you?",
    "Who else, if anyone, is tied up in this why?",
    "What would change about how you show up today if you kept this why in view?",
    "Is there a fear hiding inside this why that you haven't said out loud yet?",
    "Where did this why already show up for you this past week?",
    "When you pictured who you'd become by reaching this goal, what surprised you about that answer?",
    "What would it cost you to keep living as if this goal didn't matter?",
  ],
  2: [ // Small Steps + Consistency
    "What almost talked you out of choosing [non-negotiable minimum] as your minimum?",
    "Honestly — is [non-negotiable minimum] small enough to survive a genuinely bad day?",
    "What's the earliest point in your day this could realistically happen?",
    "What's broken a similar streak for you before?",
    "Who or what will remind you to do this when motivation drops?",
    "If you miss a day, what will you do instead of quitting on the whole thing?",
    "How does this action actually connect back to your why?",
    "What would seven straight days of this prove to you?",
  ],
  3: [ // Mindset over Method
    "Where has that story shown up in other parts of your life, not just this goal?",
    "What would you say to a friend who told you that exact story about themselves?",
    "Is [reframed truth] still honest, or did it swing too far the other way?",
    "What's the earliest moment you could catch that story starting, next time?",
    "Who taught you to believe the original version of that story?",
    "What would it mean about you if [reframed truth] were the real one all along?",
    "How does this belief connect to the why you named on Day 1?",
    "What's one piece of evidence from this week that already contradicts the old story?",
  ],
  4: [ // Feedback & Adaptation
    "What did you expect versus what's actually happened so far?",
    "Where have you been treating a result as a verdict on you instead of information?",
    "Is [chosen adjustment] a real change, or the same approach with more effort?",
    "What pattern keeps showing up across what's working and what isn't?",
    "What would you try differently if failing at it were completely fine?",
    "Does this adjustment still honor the why you named on Day 1?",
    "What's one thing that's working, even partially, that you almost overlooked?",
    "If [chosen adjustment] held for 30 days, what would it build?",
  ],
  5: [ // Courageous Action
    "What's the actual worst case if you do this, and could you survive it?",
    "What has avoiding [avoided action] already cost you?",
    "Is this the smallest true step, or are you hiding inside a bigger plan?",
    "Who's affected if you don't take this step?",
    "What do you already know that makes this less risky than it feels?",
    "What would it mean about you if you took this step and it didn't go perfectly?",
    "How does this connect to the belief you shifted on Day 3?",
    "What's stopping you from doing this today instead of 'soon'?",
  ],
  6: [ // Practice (Jordan's Season 2 story) — no new heartbeat
    "Which chapter of Jordan's story felt closest to something you're actually living right now?",
    "What made that Heartbeat easier to spot in Jordan's story than in your own life?",
    "You named [hardest heartbeat] as the hardest one for you — what does a hard day around that actually look like?",
    "If you were narrating your own week like Jordan's story, what would this chapter be called?",
    "Which Heartbeat came easiest to spot for you, and why do you think that one stands out?",
    "What would it take for [hardest heartbeat] to move even a little this week?",
    "Where did you see a version of Jordan's turning point show up for you, even in a small way?",
    "Now that you've spotted all five in someone else's story — which one do you trust yourself with least right now?",
  ],
  7: [ // Integration / Bringing It Home
    "Looking at the whole week, which day's work are you most likely to actually keep using?",
    "What changed about your why between Day 1 and today — even slightly?",
    "Is [ongoing small step] still small enough to survive a bad week, or has it crept up?",
    "What pattern from this week do you most want to protect going forward?",
    "Which Heartbeat are you proudest of this week, and which one still needs the most attention?",
    "If nothing else from this week stuck, what's the one thing you'd want to keep?",
    "What would thirty more days of this same plan actually build?",
    "Is this still the right goal, or is something else calling to you now?",
  ],
};

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
