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
  assert.match(r.reflection, /^You.re right, I missed something there\./);
  assert.match(r.reflection, /losing the job/);
  assert.equal(r.followUpQuestion, "What am I missing?");
  assert.ok(r.appFeedback);
});

test("anger flagged only by the model still gets owned", () => {
  const r = enforceReflectionRules({ ...base, reflection: "Let's keep going.", followUpQuestion: "What's next?" }, { ...input, angerAtJai: true });
  assert.match(r.reflection, /^You.re right/);
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
  const r = enforceReflectionRules({ ...base, reflection: "Ok.", keyTheme: "bullshit lateness", valueNamed: "being on time" }, { ...input, answers: ["I want to be on time"] });
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
  assert.equal(enforceAckRules("Left and right feel mixed up right now. Your focus on Clarity of Vision & Why is a starting point.", reflection), "Left and right feel mixed up right now.");
  // "overwhelming" only if they said it.
  assert.doesNotMatch(enforceAckRules("Feeling disoriented can be overwhelming. Left and right feel mixed up right now.", reflection, "I cant tell left from right"), /overwhelm/);
  assert.equal(enforceAckRules("It sounds like everything feels upside down right now, and you're surprised you're managing to get through it. That's real.", reflection), "It sounds like everything feels upside down right now. That's real.");
  assert.doesNotMatch(enforceAckRules("Left and right feel mixed up. Getting it done anyway was an achievement in itself.", reflection), /achievement/);
});

test("value only from their words, never the form's wording", () => {
  const r = enforceReflectionRules({ ...base, reflection: "Ok.", valueNamed: "calm awareness" }, { ...input, answers: ["work runs late", "idk"] });
  assert.equal(r.valueNamed, "");
});

test("a step from an earlier day isn't repeated; overloaded evenings get no new task", () => {
  const r = enforceReflectionRules(
    { ...base, reflection: "Ok.", nextStep: "Tomorrow, set your alarm 10 minutes earlier.", nextStepOptions: ["Tonight, cook lunch and lay out clothes.", "Tomorrow, keep your keys in your coat pocket so they go out the door with you."] },
    { ...input, answers: ["work runs late and I still gotta cook, laundry, shower"], priorSteps: ["Tomorrow, set an alarm 10 minutes earlier than usual."] },
  );
  assert.doesNotMatch(r.nextStep, /alarm/i);
  assert.doesNotMatch(r.nextStep, /^Tonight/i);
  assert.ok(!r.nextStepOptions.some((o) => /alarm/i.test(o)));
});

test("form's own question is never credited to them", () => {
  const r = enforceReflectionRules({ ...base, reflection: "Your question about slowing down is a good one. Mornings feel rushed." }, { ...input, answers: ["rushed"] });
  assert.doesNotMatch(r.reflection, /your question/i);
});

test("statement draft keeps 'but it's hard' and an honest 'not sure'", () => {
  const r = enforceReflectionRules(
    { ...base, reflection: "Ok.", draftStatement: "I want to reduce doom scrolling." },
    { ...input, isEvening: false, isStatement: true, answers: ["not sure", "more less doom scrolling. but its hard", "idk"] },
  );
  assert.match(r.draftStatement ?? "", /hard/);
  assert.match(r.draftStatement ?? "", /not sure/i);
});

test("first seed always matches the chosen step", () => {
  const r = enforceReflectionRules({ ...base, reflection: "Ok.", possibleFirstSeed: "Create a simple nighttime checklist for work prep" }, { ...input, isEvening: false, lockedStep: "Tomorrow, put your phone on the charger by 10:30 PM." });
  assert.equal(r.possibleFirstSeed, "Put your phone on the charger by 10:30 PM.");
});

test("a line from an earlier session isn't reused", () => {
  const r = enforceReflectionRules(
    { ...base, reflection: "Some days don't hand you a clear insight, and that's okay to say out loud. Reducing doom scrolling is a real step." },
    { ...input, isEvening: false, priorReflections: ["Some days don't hand you a bright spot, and that's okay to say out loud."] },
  );
  assert.doesNotMatch(r.reflection, /some days/i);
  assert.match(r.reflection, /doom scrolling/);
});

test("'I'm NOT releasing the book' never becomes 'ready to release the book'", () => {
  const r = enforceReflectionRules({ ...base, reflection: "Ok.", releasePoint: "letting go of the book", valueNamed: "finishing the book" }, { ...input, answers: ["I'm NOT releasing the book. Stop asking me to let go."] });
  assert.equal(r.releasePoint, "");
  assert.equal(r.valueNamed, "finishing the book");
});

test("the form's own wording is never their value", () => {
  const r = enforceReflectionRules({ ...base, reflection: "Ok.", valueNamed: "calm" }, { ...input, answers: ["calm awareness? what is that"], formText: "How can I keep building from this place of calm awareness?" });
  assert.equal(r.valueNamed, "");
});

test("'Yes, I did it' names the step; minutes match the set step", () => {
  const r = enforceReflectionRules(
    { ...base, reflection: "Nice work keeping at it. Try 10 minutes tomorrow.", nextStep: "Tomorrow, write for 5 minutes without editing." },
    { ...input, stepCheck: { step: "Tomorrow, write one sentence before bed.", status: "Yes, I did it" } },
  );
  assert.match(r.reflection, /write one sentence before bed, and you did/);
  assert.doesNotMatch(r.reflection, /10 minutes/);
});

test("sarcasm isn't sincere; Release/Theme never invented", () => {
  const r = enforceReflectionRules(
    { ...base, reflection: "Ok.", keyTheme: "Finding peace", releasePoint: "The need for external validation", valueNamed: "gratitude" },
    { ...input, answers: ["peace? lol. the gym parking lot", "gratitude? lol"] },
  );
  assert.equal(r.keyTheme, "");
  assert.equal(r.releasePoint, "");
  assert.equal(r.valueNamed, "");
});

test("no invented reason; the miss is named first in their words", () => {
  const r = enforceReflectionRules(
    { ...base, reflection: "You noticed the real challenge is getting through the door. Health is the reason." },
    { ...input, answers: ["never went. sat in the car outside, annoyed", "my doctor said so"] },
  );
  assert.match(r.reflection, /^You said it plainly: never went/);
  assert.doesNotMatch(r.reflection, /Health is the reason/);
});

test("after 'i hate being told how to feel', the question is about the action", () => {
  const r = enforceReflectionRules(
    { ...base, reflection: "Ok.", followUpQuestion: "What might help you feel more at ease when you approach the gym door?" },
    { ...input, answers: ["i hate being told how to feel"] },
  );
  assert.doesNotMatch(r.followUpQuestion, /feel/i);
});
