// Run: npx tsx --test server/journalGuards.test.ts
// Each case is a real reply that failed Donald's journal-evening-check run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { enforceReflectionRules, enforceAckRules, type ReflectionFields, type GuardInput } from "./journalGuards.ts";

const base: ReflectionFields = {
  reflection: "", followUpQuestion: "", keyTheme: "", releasePoint: "", valueNamed: "",
  possibleFirstSeed: "", nextStep: "Tomorrow, set your alarm 10 minutes earlier.", nextStepOptions: ["Tomorrow, lay out your clothes.", "Tonight, pack your bag."], appFeedback: "",
};
const input: GuardInput = { answers: [], priorAnswers: [], namedBefore: [], angerAtJai: false, angerLine: "", lockedStep: null, isEvening: true };

test("canned slow-down question is replaced", () => {
  const r = enforceReflectionRules({ ...base, reflection: "Being tired of being late is real.", followUpQuestion: "If you gave yourself full permission to slow down tomorrow, what would you do differently?" }, { ...input, answers: ["this is some bullshit, I'm so damn tired of being late"] });
  assert.doesNotMatch(r.followUpQuestion, /permission to slow down/);
  assert.ok(r.followUpQuestion.length > 10);
});

test("anger at Jai + job stake: owned, stake named, no why question", () => {
  const r = enforceReflectionRules(
    { ...base, reflection: "It sounds like these days have been tough, and the frustration is real.", followUpQuestion: "What would being on time change for you?" },
    { ...input, answers: ["growth...i almost got fuckin fired.", "fuck you. fuck this."], angerAtJai: true, angerLine: "User pushed back on Jai or the app: fuck you. fuck this." },
  );
  assert.match(r.reflection, /^Fair\. I may be missing something\./);
  assert.match(r.reflection, /losing the job/);
  assert.equal(r.followUpQuestion, "What am I missing?");
  assert.ok(r.appFeedback);
});

test("anger flagged only by the model still gets owned", () => {
  const r = enforceReflectionRules({ ...base, reflection: "Let's keep going.", followUpQuestion: "What's next?" }, { ...input, angerAtJai: true });
  assert.match(r.reflection, /^Fair\./);
  assert.ok(r.appFeedback);
});

test("swearing, templates, pace words and 'quit' are dropped", () => {
  const r = enforceReflectionRules({ ...base, reflection: "This shit is hard. This is a sign of growth. You rushed out the door. Hating your job is heavy. Maybe quit. You want to be on time." }, { ...input, answers: ["Nothing. I hate my job", "the dread before work"] });
  assert.doesNotMatch(r.reflection, /shit|this is a sign|rushed|quit/i);
  assert.match(r.reflection, /job/);
});

test("job feeling acknowledged when the model skips it", () => {
  const r = enforceReflectionRules({ ...base, reflection: "Mornings feel heavy right now." }, { ...input, answers: ["Nothing. I hate my job", "the dread before work"] });
  assert.match(r.reflection, /job/);
});

test("only one Heartbeat, never one named in an earlier session", () => {
  const r = enforceReflectionRules(
    { ...base, reflection: "Clarity of Vision & Why is missing. Small Steps + Consistency helps. Mindset over Method too.", followUpQuestion: "How does Courageous Action fit?" },
    { ...input, namedBefore: ["Clarity of Vision & Why"] },
  );
  const all = `${r.reflection} ${r.followUpQuestion}`;
  const named = ["Clarity of Vision & Why", "Small Steps + Consistency", "Mindset over Method", "Feedback & Adaptation", "Courageous Action"].filter((h) => all.includes(h));
  assert.ok(named.length <= 1, all);
  assert.ok(!named.includes("Clarity of Vision & Why"));
});

test("swearing never stored as a theme", () => {
  const r = enforceReflectionRules({ ...base, reflection: "Ok.", keyTheme: "bullshit lateness", valueNamed: "being on time" }, input);
  assert.equal(r.keyTheme, "");
  assert.equal(r.valueNamed, "being on time");
});

test("reflective seed falls back to the chosen step", () => {
  const r = enforceReflectionRules({ ...base, reflection: "Fair. I may be missing something.", possibleFirstSeed: "Reflect on what matters" }, { ...input, isEvening: false, lockedStep: "Tomorrow, set your alarm 10 minutes earlier and place it across the room." });
  assert.equal(r.possibleFirstSeed, "Set your alarm 10 minutes earlier and place it across the room.");
});

test("evening step always starts with Tomorrow/Tonight", () => {
  const r = enforceReflectionRules({ ...base, reflection: "Ok.", nextStep: "Set your alarm earlier." }, input);
  assert.match(r.nextStep, /^(Tomorrow|Tonight),/);
});

test("follow-up reply: no effort talk, no repeated Heartbeat", () => {
  const reflection = "Feeling like you can't tell left from right makes it hard to notice much, and that's okay. This is where Clarity of Vision & Why starts.";
  assert.equal(enforceAckRules("Feeling disoriented can be overwhelming. Your focus on Clarity of Vision & Why is a starting point.", reflection), "Feeling disoriented can be overwhelming.");
  assert.equal(enforceAckRules("It sounds like everything feels upside down right now, and you're surprised you're managing to get through it. That's real.", reflection), "It sounds like everything feels upside down right now. That's real.");
  assert.doesNotMatch(enforceAckRules("Left and right feel mixed up. Getting it done anyway was an achievement in itself.", reflection), /achievement/);
});
