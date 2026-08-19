// 3-Day Grounding Journal — video + narration asset wiring.
// Mirrors the 7-Day Rebuild's pattern in rebuildContent.ts: a silent local
// animation file paired with separately recorded ElevenLabs narration clips,
// played back in sync via SyncedVideoPlayer.

import type { AudioSync, SlideTiming } from "@/components/SyncedVideoPlayer";

// [FLAGGED] One video per day (plays before the morning session) + one for
// the grounding statement. Swap each PLACEHOLDER_* value for the real
// "/journal-assets/dayN/dayN-video.mp4" path once that day's video lands —
// audio narration and slide-sync timing are already wired for Day 1 and 2
// below, so only the video file itself needs to drop in.
export const JOURNAL_VIDEOS: Partial<Record<string, string>> = {
  "day1-morning":        "PLACEHOLDER_JOURNAL_DAY1_VIDEO",
  "day2-morning":        "PLACEHOLDER_JOURNAL_DAY2_VIDEO",
  "day3-morning":        "PLACEHOLDER_JOURNAL_DAY3_VIDEO",
  "grounding-statement": "PLACEHOLDER_JOURNAL_GROUNDING_VIDEO",
};

function clipUrlFor(day: string) {
  return (n: number) => `/journal-assets/${day}/clip-${String(n).padStart(2, "0")}.mp3`;
}

function timedSync(day: string, clipCount: number, slides: SlideTiming[]): AudioSync {
  return { mode: "timed", clipCount, clipUrl: clipUrlFor(day), slides };
}

// Day 1 — RESET (real clip timings, measured with ffprobe against the
// downloaded ElevenLabs clips — see "Day 1 Reset - Voice Script.md").
// Actual total narration runtime: 78.4s. Target animation length: 90-110s,
// so there's comfortable margin once the video lands.
export const DAY1_SLIDES: SlideTiming[] = [
  { slideNumber: 1, startSec: 0, durationSec: 4.7, onScreenText: "Day 1 — Reset", narrationText: "Hi, it's Jai. Welcome to Day 1 of your 3-Day Grounding Journal. Today, we reset." },
  { slideNumber: 2, startSec: 4.7, durationSec: 6.9, onScreenText: "Find your footing. Regain your focus. Rebuild your calm.", narrationText: "Three days to find your footing, regain your focus, and rebuild your calm. This is where your Mustard Seed story starts." },
  { slideNumber: 3, startSec: 11.6, durationSec: 5.7, onScreenText: "This isn't a test. It's a mirror.", narrationText: "This isn't a test, and there's no score today. It's a mirror — you're just here to notice, not to perform." },
  { slideNumber: 4, startSec: 17.3, durationSec: 8.2, onScreenText: "Pause. Notice. Reflect. Choose. Rebuild.", narrationText: "Everything we do together runs on the same rhythm: pause, notice, reflect, choose, rebuild. Today, we practice the first two." },
  { slideNumber: 5, startSec: 25.5, durationSec: 7.6, onScreenText: "Today isn't about fixing everything.", narrationText: "Today isn't about fixing everything in your life. It's about noticing where you are right now, and choosing where your attention goes." },
  { slideNumber: 6, startSec: 33.1, durationSec: 5.4, onScreenText: "What's one thing I can give my attention to today? / How can I move through today with calm and purpose?", narrationText: "This morning, I'll ask you two honest questions — what deserves your attention today, and how you want to move through it." },
  { slideNumber: 7, startSec: 38.5, durationSec: 6.5, onScreenText: "Open Mustard Seed. Answer honestly.", narrationText: "Open the app when you're ready. Answer those two questions in your own words — there's no wrong answer, just your real answer." },
  { slideNumber: 8, startSec: 45.0, durationSec: 8.3, onScreenText: "I'll reflect back what I hear — not judge it.", narrationText: "Whatever you write, I'll reflect it back to you — not judge it. Then I'll ask one honest follow-up question, just one, so we go a little deeper together." },
  { slideNumber: 9, startSec: 53.3, durationSec: 5.6, onScreenText: "When did I feel most present today? / What moment taught me something about my pace or patience?", narrationText: "Tonight, we'll come back together. I'll ask what moment today you felt most present, and what your pace taught you." },
  { slideNumber: 10, startSec: 58.9, durationSec: 6.1, onScreenText: "Awareness is progress. Showing up counts.", narrationText: "You don't have to have a perfect day for this to work. Awareness is progress. Showing up today, honestly, is enough." },
  { slideNumber: 11, startSec: 65.0, durationSec: 6.5, onScreenText: "I remember what you tell me.", narrationText: "Everything you tell me today, I remember — for tomorrow, for Day 3, and for whenever you're ready to build something out of it." },
  { slideNumber: 12, startSec: 71.5, durationSec: 6.9, onScreenText: "Day 1: Reset. Let's begin.", narrationText: "Whenever you're ready — phone, laptop, doesn't matter — open Mustard Seed and start Day 1 with me. Let's reset, together." },
];

// Day 2 — REFOCUS (real clip timings, measured with ffprobe — see
// "Day 2 Refocus - Voice Script.md"). Actual total narration runtime: 61.0s.
// Target animation length: 75-95s. Real runtime came in noticeably shorter
// than the estimate used to storyboard it, same as Day 1 — pacing ran
// faster than the word-count formula predicted.
export const DAY2_SLIDES: SlideTiming[] = [
  { slideNumber: 1, startSec: 0, durationSec: 2.5, onScreenText: "Day 2 — Refocus", narrationText: "Hi, it's Jai. Day 2 — Refocus." },
  { slideNumber: 2, startSec: 2.5, durationSec: 4.0, onScreenText: "Yesterday, you paused. Today, you choose.", narrationText: "Yesterday helped you pause. Today is about choosing what truly matters." },
  { slideNumber: 3, startSec: 6.5, durationSec: 3.5, onScreenText: "Not everything deserves your energy. So what does?", narrationText: "Not everything deserves your energy today. So — what does?" },
  { slideNumber: 4, startSec: 10.1, durationSec: 5.6, onScreenText: "Pause. Notice. Reflect. Choose. Rebuild. Today: Choose.", narrationText: "Same rhythm as yesterday: pause, notice, reflect, choose, rebuild. Today, we practice choosing." },
  { slideNumber: 5, startSec: 15.7, durationSec: 8.8, onScreenText: "Refocus isn't a perfect day. It's noticing what pulled you away — and what brought you back.", narrationText: "Refocus doesn't mean you had a perfect day. It means noticing what pulled you away, and what brought you back. That awareness is growth." },
  { slideNumber: 6, startSec: 24.5, durationSec: 5.9, onScreenText: "What truly matters to me today? / How can I give myself permission to slow down?", narrationText: "This morning, two questions: what truly matters to you today, and how you can give yourself permission to slow down." },
  { slideNumber: 7, startSec: 30.3, durationSec: 3.7, onScreenText: "Open Mustard Seed. Answer honestly.", narrationText: "Open the app when you're ready. Answer in your own words, same as yesterday." },
  { slideNumber: 8, startSec: 34.0, durationSec: 6.5, onScreenText: "I'm still listening. Nothing you said yesterday is gone.", narrationText: "I'm still listening — nothing you told me yesterday is gone. I'll reflect on it, then ask one honest follow-up question." },
  { slideNumber: 9, startSec: 40.6, durationSec: 6.2, onScreenText: "What moment brought peace or gratitude today? / What can I release before tomorrow begins?", narrationText: "Tonight, I'll ask what moment brought you peace or gratitude, and what you're ready to release before tomorrow." },
  { slideNumber: 10, startSec: 46.8, durationSec: 4.8, onScreenText: "Noticing what pulled you away is growth, not failure.", narrationText: "Noticing what pulled you away today isn't failure. It's exactly what refocusing looks like." },
  { slideNumber: 11, startSec: 51.6, durationSec: 4.8, onScreenText: "Everything from yesterday is still here. I haven't forgotten.", narrationText: "Everything you've told me stays with me — today, tomorrow, whenever you're ready to build from it." },
  { slideNumber: 12, startSec: 56.4, durationSec: 4.6, onScreenText: "Day 2: Refocus. One more day after this.", narrationText: "Whenever you're ready, open Mustard Seed and start Day 2 with me. One more day after this." },
];

// Days without a per-slide timing map fall back to plain (unsynced) local
// video playback once their video file lands.
export const JOURNAL_AUDIO_SYNC: Partial<Record<string, AudioSync>> = {
  "day1-morning": timedSync("day1", 12, DAY1_SLIDES),
  "day2-morning": timedSync("day2", 12, DAY2_SLIDES),
};

// ── Jai check-in follow-up question bank ─────────────────────────────────────
// Reference copy only — mirrors REBUILD_FOLLOWUP_QUESTIONS in rebuildContent.ts.
// The actual prompt-engineering use lives server-side in server/jaeJournal.ts
// (same "duplicated server-side, not imported from client content" pattern
// jaeRebuild.ts already uses for HEARTBEAT_CONTEXT/JORDAN_CHAPTERS).
// Surfaced only at the EVENING step of each day, once both that day's morning
// and evening prompts are answered — Jai selects 1-2 per conversation, never
// the full list, never a fixed order. Bracketed tokens are filled from the
// user's own saved answers to that day's 4 on-screen prompts; a question is
// skipped rather than shown with a blank if its answer isn't available.
export const JOURNAL_FOLLOWUP_QUESTIONS: Record<number, string[]> = {
  1: [ // Reset
    "You said your attention today was going toward [morning attention answer] — what pulled it away, if anything did?",
    "You wrote that moving through today with calm meant [morning calm/purpose answer] — how close did the day actually come to that?",
    "The moment you felt most present was [evening present answer] — what made that moment different from the rest of the day?",
    "You noticed something about your pace or patience: [evening pace/patience answer] — has that shown up before today, or is it new?",
    "If tomorrow started exactly like today ended, what would you want to carry forward?",
    "What almost kept you from sitting down and answering these questions today?",
    "Where in today did you notice yourself rushing, even a little?",
    "What would \"enough\" have looked like today, if you'd let it be enough?",
  ],
  2: [ // Refocus
    "You said what truly mattered today was [morning matters answer] — did today's actual time match that, or pull somewhere else?",
    "You wrote that slowing down meant giving yourself permission to [morning slow-down answer] — what got in the way of that, if anything?",
    "The moment that brought peace or gratitude was [evening peace/gratitude answer] — what made that moment safe enough to notice?",
    "You named something you're ready to release: [evening release answer] — how long has that been sitting with you?",
    "What's the difference between what deserved your energy today and what actually got it?",
    "If you gave yourself full permission to slow down tomorrow, what would you do differently?",
    "What's one thing today that felt urgent but wasn't actually important?",
    "What would it look like to protect tomorrow's energy before the day starts, not after it's already gone?",
  ],
};
