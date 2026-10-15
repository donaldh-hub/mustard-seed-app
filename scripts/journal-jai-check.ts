// Acceptance check for Jai's 3-Day Grounding Journal voice (Day 1).
// Calls the real AI with the same prompt code the app uses, for 3 goal types
// × 2 users (weak Clarity of Vision & Why, weak Small Steps + Consistency),
// and prints Jai's morning reflection, evening reflection, and follow-up
// reply, with simple automatic checks under each.
//
// Run in the Replit Shell (it needs the app's AI key; ~18 short AI calls):
//   npx tsx scripts/journal-jai-check.ts
// Writes nothing to the database.

import { generateJournalReflection, generateFollowUpAck } from "../server/jaeJournal";

const USERS = [
  { label: "weak Clarity", weakestHeartbeat: { name: "Clarity of Vision & Why", score: 3 } },
  { label: "weak Small Steps", weakestHeartbeat: { name: "Small Steps + Consistency", score: 2.7 } },
];

const GOALS = [
  {
    type: "business",
    intention: "come up with a name for my business",
    morning: ["figuring out the name for my business", "i dont have any of that. thats the problem"],
    evening: ["when i was driving home i felt calm", "how does this help me find a name for my business?"],
    followUp: "i guess i dont know who its for yet",
  },
  {
    type: "writing",
    intention: "finish the first chapter of my book",
    morning: ["writing at least one page before work", "keep my phone in the other room"],
    evening: ["the 20 minutes i wrote this morning felt good", "i skipped tonights pages becuase i was tired again"],
    followUp: "maybe i write in the morning only",
  },
  {
    type: "gardening",
    intention: "start a vegetable garden this spring",
    morning: ["planning where the garden beds go", "not overthinking it"],
    evening: ["measuring the yard with my daughter", "is three days of journaling really going to help me grow tomatoes?"],
    followUp: "i want her to help me plant",
  },
];

const PROMPTS = {
  morning: ["What's one thing I can give my attention to today?", "How can I move through this day with calm and purpose?"],
  evening: ["When did I feel most present today?", "What moment taught me something about my pace or patience?"],
};

const words = (t: string) => t.toLowerCase().replace(/[^a-z' ]/g, " ").split(/\s+/).filter(Boolean);
// True if Jai copied a run of 6+ of the user's words in a row.
function copiesUser(reply: string, userTexts: string[]): boolean {
  const r = " " + words(reply).join(" ") + " ";
  return userTexts.some((t) => {
    const w = words(t);
    for (let i = 0; i + 6 <= w.length; i++) if (r.includes(" " + w.slice(i, i + 6).join(" ") + " ")) return true;
    return false;
  });
}
const SHORT_NAMES = /\b(clarity|consistency|mindset|adaptation)\b(?! of vision| over method)/i;
function nameCheck(reply: string): string {
  const full = ["Clarity of Vision & Why", "Small Steps + Consistency", "Mindset over Method", "Feedback & Adaptation", "Courageous Action"];
  const usedFull = full.filter((n) => reply.includes(n));
  const stripped = full.reduce((t, n) => t.split(n).join(""), reply);
  const short = SHORT_NAMES.test(stripped);
  return `${usedFull.length ? `names ${usedFull.join(", ")}` : "names no Heartbeat"}${short ? " | ⚠ possible shortened Heartbeat name" : ""}`;
}

async function main() {
  for (const user of USERS) {
    for (const goal of GOALS) {
      console.log(`\n══════ ${goal.type.toUpperCase()} goal · ${user.label} ══════`);
      console.log(`Intention: ${goal.intention}`);
      const base = { userName: "Donald", dayNumber: 1 as const, dayTheme: "RESET" as const, weakestHeartbeat: user.weakestHeartbeat, intention: goal.intention };
      const intentionEntry = { dayNumber: 1, session: "intention" };

      const mPrompts = PROMPTS.morning.map((p, i) => ({ prompt: p, response: goal.morning[i] }));
      const m = await generateJournalReflection({ ...base, session: "morning", prompts: mPrompts, previousEntries: [intentionEntry] });
      console.log(`\n— MORNING —\nJai: ${m.reflection}\nFollow-up: ${m.followUpQuestion}\nFocus card: ${m.focusSummary}`);
      console.log(`  checks: ${copiesUser(m.reflection + " " + m.followUpQuestion + " " + m.focusSummary, goal.morning) ? "⚠ copies user text" : "paraphrases ✓"} | ${nameCheck(m.reflection + " " + m.followUpQuestion)}`);

      const ack = await generateFollowUpAck({ userName: "Donald", question: m.followUpQuestion, answer: goal.followUp, intention: goal.intention, weakestHeartbeat: user.weakestHeartbeat });
      console.log(`Your follow-up: ${goal.followUp}\nJai's reply: ${ack}`);
      console.log(`  checks: ${ack ? "reply ✓" : "⚠ no reply"} | ${(ack.match(/[.!?](\s|$)/g) ?? []).length <= 2 ? "1–2 sentences ✓" : "⚠ longer than 2 sentences"} | ${ack.includes("?") ? "⚠ asks a question" : "no question ✓"} | ${copiesUser(ack, [goal.followUp]) ? "⚠ copies user text" : "paraphrases ✓"}`);

      const ePrompts = PROMPTS.evening.map((p, i) => ({ prompt: p, response: goal.evening[i] }));
      const e = await generateJournalReflection({
        ...base, session: "evening", prompts: ePrompts, todayMorningPrompts: mPrompts,
        previousEntries: [intentionEntry, { dayNumber: 1, session: "morning", keyTheme: m.keyTheme, valueNamed: m.valueNamed, releasePoint: m.releasePoint }],
      });
      console.log(`\n— EVENING —\nJai: ${e.reflection}\nFollow-up: ${e.followUpQuestion}\nWhat Jai noticed: Theme=${e.keyTheme} · Value=${e.valueNamed} · Release=${e.releasePoint}`);
      const asked = goal.evening.some((t) => t.includes("?"));
      console.log(`  checks: ${copiesUser(e.reflection + " " + e.followUpQuestion, goal.evening) ? "⚠ copies user text" : "paraphrases ✓"} | ${nameCheck(e.reflection + " " + e.followUpQuestion)}${asked ? " | user asked a question: read the first sentence — does it answer it?" : ""}`);
    }
  }
}

main().catch((err) => {
  console.error("Failed:", err?.message || err);
  process.exit(1);
});
