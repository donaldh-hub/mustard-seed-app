// 3-Day Grounding Journal — video + narration asset wiring.
// Mirrors the 7-Day Rebuild's pattern in rebuildContent.ts: a silent local
// animation file paired with separately recorded ElevenLabs narration clips,
// played back in sync via SyncedVideoPlayer.

import type { AudioSync, SlideTiming } from "@/components/SyncedVideoPlayer";

// [FLAGGED] One video per day (plays before the morning session) + one for
// the grounding statement. The grounding statement's own video is still
// PLACEHOLDER_* until recorded — Day 3's video (Slide 11) previews the
// invitation into that step, but isn't the same asset.
export const JOURNAL_VIDEOS: Partial<Record<string, string>> = {
  "day1-morning":        "/journal-assets/day1/day1-video.mp4",
  "day2-morning":        "/journal-assets/day2/day2-video.mp4",
  "day3-morning":        "/journal-assets/day3/day3-video.mp4",
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
// Actual total narration runtime: 78.4s. Video runs 94.8s — comfortable
// margin, nothing gets cut off.
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
// Video runs 81.0s — comfortable margin. Real runtime came in noticeably
// shorter than the estimate used to storyboard it, same as Day 1 — pacing
// ran faster than the word-count formula predicted.
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

// Day 3 — REBUILD (real clip timings, measured with ffprobe — see
// "Day 3 Rebuild - Voice Script.md"). Actual total narration runtime: 60.6s.
// Video runs 87.0s — comfortable margin. Day 3 does double duty: it closes
// the 3-Day Journal (Slide 11 previews the Grounding Statement step) and
// bridges into the 7-Day Rebuild (Slide 12) — the existing STEP_ORDER /
// RebuildFunnelCard flow in GroundingJournal.tsx already carries that
// invitation through, so no separate wiring was needed for it.
export const DAY3_SLIDES: SlideTiming[] = [
  { slideNumber: 1, startSec: 0, durationSec: 2.5, onScreenText: "Day 3 — Rebuild", narrationText: "Hi, it's Jai. Day 3 — Rebuild." },
  { slideNumber: 2, startSec: 2.5, durationSec: 2.4, onScreenText: "Two days down. Today, we bring it together.", narrationText: "Two days down. Today, we bring it together." },
  { slideNumber: 3, startSec: 4.9, durationSec: 2.0, onScreenText: "Rebuilding doesn't have to be loud.", narrationText: "Rebuilding doesn't have to be loud." },
  { slideNumber: 4, startSec: 6.9, durationSec: 5.5, onScreenText: "Pause. Notice. Reflect. Choose. Rebuild. Today: Rebuild.", narrationText: "Same rhythm, one last piece: pause, notice, reflect, choose, rebuild. Today, we rebuild." },
  { slideNumber: 5, startSec: 12.4, durationSec: 4.9, onScreenText: "Sometimes it looks like choosing one value and carrying it through the day.", narrationText: "Sometimes rebuilding looks like choosing one value, and carrying it through the whole day." },
  { slideNumber: 6, startSec: 17.3, durationSec: 6.7, onScreenText: "What value do I want to carry into today? / How can I stay grounded even when things shift?", narrationText: "This morning, two questions: what value you want to carry into today, and how you'll stay grounded even if things shift." },
  { slideNumber: 7, startSec: 24.0, durationSec: 4.8, onScreenText: "Open Mustard Seed. Answer honestly.", narrationText: "Open the app when you're ready. Same as the last two days — your own words, no wrong answer." },
  { slideNumber: 8, startSec: 28.8, durationSec: 6.3, onScreenText: "Three days of you, all remembered.", narrationText: "Three days of you, all remembered. What you noticed on Day 1, what you named on Day 2 — it's all still here." },
  { slideNumber: 9, startSec: 35.1, durationSec: 4.8, onScreenText: "Where did I notice growth, even in small ways? / How can I keep building from this place of calm awareness?", narrationText: "Tonight, I'll ask where you noticed growth, even small, and how you want to keep building from here." },
  { slideNumber: 10, startSec: 39.8, durationSec: 6.3, onScreenText: "Small is where trust begins. Small is where the seed breaks open.", narrationText: "Small is where trust begins. Small is where consistency starts. Small is where the seed breaks open." },
  { slideNumber: 11, startSec: 46.1, durationSec: 6.4, onScreenText: "Before we close, name what you learned — in three short reflections.", narrationText: "Before we close, I'll ask you to name what you learned — in three short reflections. That becomes your grounding statement." },
  { slideNumber: 12, startSec: 52.5, durationSec: 8.1, onScreenText: "Three days of pausing and noticing. The 7-Day Rebuild turns this into rhythm.", narrationText: "Three days of pausing and noticing. Whenever you're ready, the 7-Day Rebuild turns this into rhythm. Come finish Day 3 with me in the app." },
];

// Days without a per-slide timing map fall back to plain (unsynced) local
// video playback once their video file lands.
export const JOURNAL_AUDIO_SYNC: Partial<Record<string, AudioSync>> = {
  "day1-morning": timedSync("day1", 12, DAY1_SLIDES),
  "day2-morning": timedSync("day2", 12, DAY2_SLIDES),
  "day3-morning": timedSync("day3", 12, DAY3_SLIDES),
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
  3: [ // Rebuild
    "You said the value you wanted to carry today was [morning value answer] — where did you actually see it show up?",
    "You wrote that staying grounded when things shift meant [morning grounded/shift answer] — did anything test that today?",
    "You noticed growth in [evening growth answer] — how does that compare to where you started three days ago?",
    "You said you want to keep building from [evening keep-building answer] — what would keeping that going actually require of you?",
    "Looking back over all three days, what pattern shows up more than once?",
    "What surprised you most about doing this three days in a row?",
    "If you had to name this season in one word, what would it be?",
    "What's one small thing from these three days you don't want to lose once the week gets busy again?",
  ],
};
