// Acceptance check for guided goal setup and Jai's chat (Final PR). Calls the
// real AI with the same code the app uses and prints the actual outputs.
//
// Run in the Replit Shell (~25 short AI calls):
//   npx tsx scripts/goal-setup-check.ts
// Writes nothing to the database.

import { suggestGoalFromLines, interpret } from "../server/goalSetup";
import { generateDepthResponse } from "../server/jaeCoach";

const say = (label: string, text: string) => console.log(`  ${label}: ${text}`);
const check = (ok: boolean, msg: string) => console.log(`  ${ok ? "✓" : "⚠"} ${msg}`);

const MEMORY = {
  business: [
    "Journal intention (their goal for the 3 days): come up with a name for my business",
    "Journal Day 3 evening: I wrote some names down / keep one place for my name ideas",
    "Journal Day 3 morning: consistency / I think I have a good idea then I don't write it down or forget",
    "Chat: i still dont have names",
  ],
  writing: [
    "Journal intention (their goal for the 3 days): finish the first chapter of my book",
    "Journal Day 2 evening: the quiet hour before everyone woke up / the idea every draft must be perfect",
    "Chat: I wrote a page today",
  ],
  gardening: [
    "Journal intention (their goal for the 3 days): start a vegetable garden this spring",
    "Journal Day 1 morning: measuring where the beds go / not overthinking it",
    "Chat: we bought tomato seedlings",
  ],
};

console.log("\n══ Goal suggestion from Memory ══");
for (const [type, lines] of Object.entries(MEMORY)) {
  const s = await suggestGoalFromLines(lines);
  console.log(`\n▶ ${type}`);
  say("Jai", s ? `Over the last 3 days you kept coming back to ${s.because}. Want me to set that up as your first goal, or would you rather start with a different one?` : "(no suggestion)");
  say("goal", s?.goal ?? "");
  check(!!s, "suggested a goal from their own words");
}

console.log("\n══ Reading typed answers (one question at a time) ══");
const typed: [string, string, string, string][] = [
  ["offered", "Want me to set that up as your first goal, or would you rather start with a different one?", "yeah let's do it", "yes"],
  ["offered", "Want me to set that up as your first goal, or would you rather start with a different one?", "actually I'd rather work on getting my book done", "different"],
  ["offered", "Want me to set that up as your first goal, or would you rather start with a different one?", "maybe later, I'm tired", "not_yet"],
  ["wording", "Here's how I'd word it: Find a name for my business. Does that sound like you, or how would you say it?", "pick a name for my bakery", "answer"],
  ["why", "Why does find a name for my business matter to you?", "what do you mean by why?", "question"],
  ["why", "Why does find a name for my business matter to you?", "I want something that's mine for my kids", "answer"],
  ["date", "Want a target date or a check-in day? Or just say skip.", "end of next month", "answer"],
  ["date", "Want a target date or a check-in day? Or just say skip.", "no date", "skip"],
];
for (const [stage, q, a, want] of typed) {
  const r = await interpret(stage as any, q, a);
  console.log(`\n▶ [${stage}] "${a}"`);
  say("read as", `${r.intent}${r.value ? ` → ${r.value}` : ""}${r.reply ? ` (Jai: ${r.reply})` : ""}`);
  check(r.intent === want || (want === "skip" && r.intent === "answer" && !r.value), `expected ${want}`);
}

console.log("\n══ Jai helps with the goal itself + uses recent Memory ══");
const CHATS = [
  { type: "business", goal: "Find a name for my business", why: "something that's mine", msg: "i still dont have names", memory: ["Grounding Journal Day 3 evening: I wrote some names down / keep one place for my name ideas"] },
  { type: "business (brainstorm yes)", goal: "Find a name for my business", why: "something that's mine", msg: "yes let's brainstorm some name directions. it's a small bakery for busy parents", memory: [] },
  { type: "writing", goal: "Finish the first chapter of my book", why: "I've carried this story for years", msg: "I'm stuck on chapter one", memory: [] },
  { type: "gardening", goal: "Start a vegetable garden", why: "teach my daughter", msg: "not sure what to plant first", memory: [] },
];
for (const c of CHATS) {
  const r = await generateDepthResponse(c.msg, {
    userName: "Donald",
    targetedGoalTitle: c.goal,
    targetedGoalWhy: c.why,
    streak: 1,
    recentMessages: [],
    recentMemory: c.memory,
  });
  console.log(`\n▶ ${c.type}: "${c.msg}"`);
  say("Jai", r.text.replace(/\n/g, " ⏎ "));
  if (c.type === "business") check(!/have you tried (jotting|writing)/i.test(r.text), "doesn't ask about writing names down (Memory shows it happened)");
  if (c.type.includes("brainstorm")) check(/^Your step:/m.test(r.text), "brainstorm ends with one 'Your step:' line");
}
console.log("\nDone.");
