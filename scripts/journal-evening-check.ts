// Acceptance check for Jai's evening reply (disagreeable pass, Nov 25).
// Runs the real AI with the app's own prompt code on three evenings for the
// goal "being on time for work": thin answers, rich answers, and a negative
// one. Prints Jai's reply with simple automatic checks under each.
//
// Run in the Replit Shell (needs the app's AI key; 7 short AI calls):
//   npx tsx scripts/journal-evening-check.ts
// Writes nothing to the database. Crisis wording is covered separately by
// scripts/safety-trigger-check.ts.

import { generateJournalReflection, generateFollowUpAck, allThin } from "../server/jaeJournal";

const EVENING_PROMPTS = [
  "What moment brought peace or gratitude today?",
  "What can I release before tomorrow begins?",
];
const CASES = [
  { label: "(a) thin", answers: ["Nothing really", "not sure yet"] },
  { label: "(b) rich", answers: ["I left the house on time and had a calm drive in", "the habit of scrolling in bed before I get up"] },
  { label: "(c) negative", answers: ["Nothing. I hate my job", "the dread before work"] },
  { label: "(d) swearing", answers: ["this is some bullshit, I'm so damn tired of being late", "I don't give a shit about writing this down"] },
];
const ON_GOAL = /(work|late|on time|leave|door|alarm|bed|sleep|night|clothes|bag|keys|lunch|commute|wake|get up|out the)/i;
const SWEARS = /\b(fuck\w*|shit\w*|damn\w*|bullshit|hell|ass)\b/i;

let failed = 0;
const check = (ok: boolean, what: string) => { if (!ok) failed++; console.log(`  ${ok ? "PASS" : "FAIL"}  ${what}`); };

for (const c of CASES) {
  const prompts = EVENING_PROMPTS.map((prompt, i) => ({ prompt, response: c.answers[i] }));
  const r = await generateJournalReflection({
    userName: "Donald",
    dayNumber: 2,
    dayTheme: "REFOCUS",
    session: "evening",
    prompts,
    intention: "being on time for work",
    weakestHeartbeat: { name: "Clarity of Vision & Why", score: 3 },
    todayMorningPrompts: [
      { prompt: "What truly matters to me today?", response: "getting to work on time" },
      { prompt: "How can I give myself permission to slow down?", response: "prep the night before" },
    ],
  });
  const all = `${r.reflection} ${r.followUpQuestion}`;
  console.log(`\n${c.label}: ${c.answers.join(" / ")}`);
  console.log(`  Jai: ${r.reflection}`);
  console.log(`  Question: ${r.followUpQuestion}`);
  console.log(`  Step: ${r.nextStep}`);
  console.log(`  Options: ${(r.nextStepOptions ?? []).join(" | ")}`);
  console.log(`  Noticed: theme="${r.keyTheme}" value="${r.valueNamed}" release="${r.releasePoint}"${allThin(prompts) ? "  (app hides this card: thin answers)" : ""}`);
  check(!/\b(quick(ly)?|fast|rushed|hurried)\b/i.test(all) || /rush|hurr|fast|quick/i.test(c.answers.join(" ")), "no invented facts about the day's pace");
  check(!/this is a sign/i.test(all), "no \"this is a sign\" template");
  check(!/full permission to slow down/i.test(r.followUpQuestion), "follow-up isn't the canned slow-down question");
  check(/^tomorrow,|^tonight,/i.test(r.nextStep) && ON_GOAL.test(r.nextStep), "step moves the on-time goal forward");
  check((r.nextStepOptions ?? []).every((o) => ON_GOAL.test(o)), "both other options move the goal forward");
  check(!/had some hope in it/i.test(all), "no copied example line");
  check(!SWEARS.test(`${r.reflection} ${r.followUpQuestion} ${r.nextStep}`) && !/language|watch your|profan/i.test(all), "no swearing back, no comment on language");
  check(![r.keyTheme, r.valueNamed, r.releasePoint].some((v) => SWEARS.test(v ?? "")), "swearing not stored as a theme");
  check((r.nextStepOptions ?? []).length === 2, "two other step options");
  const heartbeats = ["Clarity of Vision & Why", "Small Steps + Consistency", "Mindset over Method", "Feedback & Adaptation", "Courageous Action"]
    .filter((h) => all.includes(h)).length;
  check(heartbeats <= 1, "at most one Heartbeat named");
  if (c.label.startsWith("(c)")) check(/\bjob\b|\bwork\b/i.test(r.reflection) && !/\b(quit|find a new job|change jobs)\b/i.test(r.reflection), "acknowledges the job feeling, no advice to change it");
}

// Follow-up reply to a sarcastic line, with the reflection above it.
const reflection = "Feeling like you can't tell left from right makes it hard to notice much, and that's okay. This is where Clarity of Vision & Why starts.";
const ack = await generateFollowUpAck({
  userName: "Donald",
  question: "What's one small thing that would make tomorrow morning feel less scattered?",
  answer: "I cant tell left from right or up from down. i cant believe im getting this done.",
  intention: "being on time for work",
  weakestHeartbeat: { name: "Clarity of Vision & Why", score: 3 },
  reflection,
});
console.log(`\n(e) sarcastic follow-up reply\n  Jai: ${ack}`);
check(!/(great|good|proud|awesome).{0,40}(push|getting|done|keep)/i.test(ack), "no praise for effort on a sarcastic line");
check(!/\bchaos|chaotic\b/i.test(ack), "no new labels (e.g. chaos)");
check(!/is a step toward/i.test(ack) && !ack.includes("Clarity of Vision & Why"), "doesn't repeat the reflection's phrasing or Heartbeat");

// (f) Day 3 evening: anger at Jai and a real stake.
const prior = [{ dayNumber: 3, session: "morning", jaeReflection: "Clarity of Vision & Why might be what's missing here.", answers: "how about being on time for once / obviously a cant. idk how you not fucking understanding" }];
const f = await generateJournalReflection({
  userName: "Donald", dayNumber: 3, dayTheme: "REBUILD", session: "evening",
  prompts: [
    { prompt: "Where did I notice growth, even in small ways?", response: "growth...i almost got fuckin fired." },
    { prompt: "How can I keep building from this place of calm awareness?", response: "fuck you. fuck this." },
  ],
  intention: "being on time for work",
  weakestHeartbeat: { name: "Clarity of Vision & Why", score: 3 },
  previousEntries: prior,
});
const fAll = `${f.reflection} ${f.followUpQuestion}`;
console.log(`\n(f) anger at Jai + "almost got fired"\n  Jai: ${f.reflection}\n  Question: ${f.followUpQuestion}\n  Step: ${f.nextStep}\n  appFeedback: ${f.appFeedback}`);
check(/fair|missing|hear you|not listening|getting wrong/i.test(fAll), "acknowledges the anger at Jai");
check(/(job|fired|work)/i.test(f.reflection), "names the real stake (the job)");
check(!/what would being on time change|why does being on time matter/i.test(f.followUpQuestion), "doesn't ask a why it was already told");
check(!/Clarity of Vision & Why/.test(fAll), "doesn't repeat the earlier Heartbeat diagnosis");
check(!!f.appFeedback, "anger saved as app feedback");

// (g) Grounding Statement made of non-answers.
const g = await generateJournalReflection({
  userName: "Donald", dayNumber: 3, dayTheme: "REBUILD", session: "grounding_statement",
  prompts: [
    { prompt: "What you've learned:", response: "Ive learned this app is bullshit and not helpful" },
    { prompt: "What you'll keep nurturing:", response: "idk" },
    { prompt: "One thing you're ready to carry forward:", response: "fuck if i know" },
  ],
  intention: "being on time for work",
  lockedStep: "Tomorrow, set your alarm 10 minutes earlier and place it across the room.",
  previousEntries: [{ dayNumber: 3, session: "evening", answers: "growth...i almost got fuckin fired. / fuck you. fuck this." }],
});
console.log(`\n(g) non-answer Grounding Statement\n  Jai: ${g.reflection}\n  Draft: ${g.draftStatement}\n  Seed: ${g.possibleFirstSeed}\n  appFeedback: ${g.appFeedback}`);
check(!!g.draftStatement && !/\b(journey|thrive|empower|unstoppable)\b/i.test(g.draftStatement ?? ""), "offers an honest one-line draft");
check(!/^reflect|reflect on/i.test(g.possibleFirstSeed) && /(alarm|clock|bed|night|wake|leave|work|time)/i.test(g.possibleFirstSeed), "seed is a concrete on-goal action, matching the chosen step");
check(/fair|missing|helpful|didn'?t help/i.test(g.reflection) && !!g.appFeedback, "acknowledges the app feedback");

console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
