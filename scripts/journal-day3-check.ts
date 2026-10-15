// Acceptance check for the Day 3 changes: Heartbeat in action, growth arc,
// photo invite, and locking the next step. Calls the real AI with the same
// code the app uses and prints Jai's actual outputs.
//
// Run in the Replit Shell (~12 short AI calls):
//   npx tsx scripts/journal-day3-check.ts
// Writes nothing to the database.

import { generateJournalReflection } from "../server/jaeJournal";

const say = (label: string, text: string) => console.log(`  ${label}: ${text}`);
const check = (ok: boolean, msg: string) => console.log(`  ${ok ? "✓" : "⚠"} ${msg}`);
const FULL_NAMES = ["Clarity of Vision & Why", "Small Steps + Consistency", "Mindset over Method", "Feedback & Adaptation", "Courageous Action"];

const MORNING3 = ["What value do I want to carry into today?", "How can I stay grounded even when things shift?"];
const EVENING3 = ["Where did I notice growth, even in small ways?", "How can I keep building from this place of calm awareness?"];
const pair = (qs: string[], as: string[]) => qs.map((prompt, i) => ({ prompt, response: as[i] }));

const GOALS = [
  {
    type: "business",
    intention: "come up with a name for my business",
    day1: { answers: "figuring out the name for my business / i dont have any of that. thats the problem", theme: "Feeling stuck on the name" },
    day2: { answers: "the name / worrying about the perfect name", theme: "Letting go of perfect" },
    morning: ["consistency", "I think I have a good idea then I don't write it down or forget"],
    morningQ: "What's one small way you could catch those ideas before they slip away today?",
    stepSet: "start writing the names down",
    done: ["I wrote some names down", "keep one place for my name ideas"],
    notDone: ["I didn't write any down, the day got away from me", "I don't know"],
  },
  {
    type: "writing",
    intention: "finish the first chapter of my book",
    day1: { answers: "writing one page before work / i skipped again", theme: "Stop-start writing" },
    day2: { answers: "the quiet morning hour / the idea every draft must be perfect", theme: "Quiet mornings work" },
    morning: ["showing up", "write before I check my phone"],
    morningQ: "What's one small thing you'll do to protect that writing time today?",
    stepSet: "write one page before 7am",
    done: ["I wrote a page and a half this morning before anyone woke up", "write at the kitchen table every morning"],
    notDone: ["I didn't write today, I scrolled instead", "not sure"],
  },
  {
    type: "gardening",
    intention: "start a vegetable garden this spring",
    day1: { answers: "measuring where the beds go / not overthinking it", theme: "Getting started" },
    day2: { answers: "watering seedlings with my daughter / rushing everything", theme: "Slowing down" },
    morning: ["patience", "do one bed at a time"],
    morningQ: "What's one small piece of the garden you'll touch today?",
    stepSet: "plant the tomato seedlings in the first bed",
    done: ["we planted the tomatoes in the first bed", "keep a little notebook of what I plant and when"],
    notDone: ["it rained and I didn't plant anything", "maybe tomorrow"],
  },
];

for (const g of GOALS) {
  console.log(`\n══ ${g.type.toUpperCase()}: ${g.intention} ══`);
  const base = {
    userName: "Donald",
    weakestHeartbeat: { name: "Small Steps + Consistency", score: 2.7 },
    intention: g.intention,
    dayNumber: 3 as const,
    dayTheme: "REBUILD" as const,
    session: "evening" as const,
    previousEntries: [
      { dayNumber: 1, session: "morning", keyTheme: g.day1.theme, answers: g.day1.answers },
      { dayNumber: 2, session: "evening", keyTheme: g.day2.theme, answers: g.day2.answers },
      { dayNumber: 3, session: "morning", keyTheme: "", answers: g.morning.join(" / ") },
    ],
    todayMorningPrompts: pair(MORNING3, g.morning),
    todayMorningFollowUp: { question: g.morningQ, answer: g.stepSet },
  };

  const done = await generateJournalReflection({ ...base, prompts: pair(EVENING3, g.done) });
  console.log(`\n▶ Set "${g.stepSet}" this morning → tonight: "${g.done[0]}"`);
  say("Jai", done.reflection);
  say("question", done.followUpQuestion);
  say("photo invite", done.photoInvite || "(none)");
  say("next step", done.nextStep);
  check(FULL_NAMES.some((n) => done.reflection.includes(n)), `names a Heartbeat in action (${done.heartbeatInAction || "none"})`);
  check(/day 1|day one|two days|three days|first day|started|at the start|earlier this week/i.test(done.reflection), "states the arc itself");
  check(!/compare/i.test(done.followUpQuestion), "lighter question (no 'compare')");
  check(!!done.photoInvite, "invites an optional photo");
  check(!!done.nextStep, "locks one next step");

  const missed = await generateJournalReflection({ ...base, prompts: pair(EVENING3, g.notDone) });
  console.log(`\n▶ Set "${g.stepSet}" this morning → tonight: "${g.notDone[0]}"`);
  say("Jai", missed.reflection);
  say("question", missed.followUpQuestion);
  say("photo invite", missed.photoInvite || "(none)");
  say("next step", missed.nextStep);
  check(!/should have|failed|disappoint/i.test(missed.reflection), "grace, no shame words");
  check(!missed.photoInvite, "no photo invite when nothing was done");
}
console.log("\nDone.");
