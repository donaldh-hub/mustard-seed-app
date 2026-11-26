// Code-level guards for Jai's journal replies. The prompt asks for these
// rules; the model follows them most of the time, not every time. Each rule
// the acceptance check tests is enforced here after the model replies, so a
// slip is caught on every run instead of most runs.
// Pure functions (no AI client) so they can be unit-tested.

export const HEARTBEATS = ["Clarity of Vision & Why", "Small Steps + Consistency", "Mindset over Method", "Feedback & Adaptation", "Courageous Action"];

const SWEARS = /\b(fuck\w*|shit\w*|damn\w*|bullshit|hell|ass)\b/i;
const TEMPLATES = /this is a sign|had some hope in it|\b(language|watch your|profan\w*)\b|is a step toward|\bchao(s|tic)\b/i;
const PACE = /\b(quick(ly)?|fast|rushed|hurried)\b/i;
const CHANGE_SITUATION = /\b(quit|find a new job|change jobs|new job)\b/i;
const CANNED_QUESTION = /full permission to slow down/i;
const ANGER_OWNED = /\b(fair|missing|hear you|not listening|getting wrong)\b/i;
const JOB_STAKE = /\b((almost|nearly) (got|get|been|getting) (\w+ )?fired|(almost|nearly) lost (my|the) job|(could|might|gonna|going to) (lose|get fired from) (my|the) job)\b/i;
const JOB_FEELING = /\b(hate|can'?t stand|dread\w*|sick of)\b.{0,30}\b(job|work)\b|\b(job|work)\b.{0,20}\b(sucks|is awful|is miserable)\b/i;
const WHY_QUESTION = /^(why\b|what would .{0,60}change|why does .{0,60}matter)/i;
const EFFORT = /\b(managing|manage to|get(ting)? through|push(ing)? through|keep (going|pushing)|impressive|proud of you|achievement|in itself|great job|well done|that takes (strength|courage))\b/i;

export function sentences(text: string): string[] {
  return (text ?? "").match(/[^.!?]+[.!?]*/g) ?? (text ? [text] : []);
}
const join = (parts: string[]) => parts.join("").replace(/\s+/g, " ").trim();

// Drops sentences that break a rule. `paceOk` is true when the user's own
// words mention rushing, so Jai may too.
function clean(text: string, paceOk: boolean): string {
  return join(sentences(text).filter((s) => !SWEARS.test(s) && !TEMPLATES.test(s) && !CHANGE_SITUATION.test(s) && (paceOk || !PACE.test(s))));
}

export function withStake(reflection: string, answers: string[]): string {
  if (!answers.some((a) => JOB_STAKE.test(a)) || /\b(job|fired|work)\b/i.test(reflection)) return reflection;
  return `${reflection.trim()} You came close to losing the job. That's real.`.trim();
}

// Drops any part of a reply that comments on effort or coping.
export function withoutEffort(reply: string): string {
  const kept = sentences(reply).map((sentence) => {
    if (!EFFORT.test(sentence)) return sentence;
    const head = sentence.split(/,\s*(?:and|but)\s+/i)[0];
    return head !== sentence && !EFFORT.test(head) ? `${head.replace(/\s+$/, "")}.` : "";
  });
  const out = join(kept);
  return out.length < 20 ? "" : out;
}

export interface ReflectionFields {
  reflection: string;
  followUpQuestion: string;
  keyTheme: string;
  releasePoint: string;
  valueNamed: string;
  possibleFirstSeed: string;
  nextStep: string;
  nextStepOptions: string[];
  appFeedback: string;
}

export interface GuardInput {
  answers: string[]; // this session's answers
  priorAnswers: string[]; // earlier sessions' answers
  namedBefore: string[]; // Heartbeats named in earlier sessions
  angerAtJai: boolean; // model flag or word match
  angerLine: string; // word-match summary for app feedback ("" if none)
  lockedStep?: string | null;
  isEvening: boolean;
}

export function enforceReflectionRules<T extends ReflectionFields>(r: T, g: GuardInput): T {
  const all = [...g.answers, ...g.priorAnswers];
  const paceOk = /rush|hurr|fast|quick/i.test(g.answers.join(" "));
  let reflection = clean(r.reflection, paceOk);
  let question = CANNED_QUESTION.test(r.followUpQuestion) ? "" : clean(r.followUpQuestion, paceOk);

  // At most one Heartbeat across reflection + question, and none already named before.
  let kept: string | null = null;
  const oneHeartbeat = (text: string) => join(sentences(text).filter((s) => {
    const names = HEARTBEATS.filter((h) => s.includes(h));
    if (!names.length) return true;
    if (names.some((h) => g.namedBefore.includes(h)) || names.length > 1) return false;
    if (kept === null) { kept = names[0]; return true; }
    return names[0] === kept; // same Heartbeat again is fine; a second one is not
  }));
  reflection = oneHeartbeat(reflection);
  question = oneHeartbeat(question);

  // A stake they named is named back; a job feeling is acknowledged.
  reflection = withStake(reflection, all);
  if (JOB_FEELING.test(g.answers.join(" ")) && !/\b(job|work)\b/i.test(reflection)) {
    reflection = `${reflection} That feeling about your job is real, and it's okay to name it.`.trim();
  }
  // Never ask a why they already answered with a stake.
  if (all.some((a) => JOB_STAKE.test(a)) && WHY_QUESTION.test(question)) question = "";

  // Anger at Jai: own it first, ask what's missing, save it as feedback.
  let appFeedback = r.appFeedback;
  if (g.angerAtJai) {
    if (!ANGER_OWNED.test(sentences(reflection)[0] ?? "")) reflection = `Fair. I may be missing something. ${reflection}`.trim();
    if (!ANGER_OWNED.test(question) && !/\bhelp\b/i.test(question)) question = "What am I missing?";
    if (!appFeedback) appFeedback = g.angerLine || "User pushed back on Jai or the app.";
  }

  if (!reflection) reflection = "Thank you for writing this down. I'm here with you in it.";
  if (!question) question = "What's one small thing that would make tomorrow a little easier?";

  // Swearing is a tone signal, never a stored theme.
  const tag = (v: string) => (SWEARS.test(v ?? "") ? "" : v);

  // The first seed is a concrete action; fall back to the step they chose.
  let seed = r.possibleFirstSeed;
  if (g.lockedStep && (!seed || /^reflect|reflect on|explore|understand/i.test(seed))) {
    seed = g.lockedStep.replace(/^(tomorrow|tonight),\s*/i, "").replace(/^./, (c) => c.toUpperCase());
  }

  // Evening step: "Tomorrow, …" or "Tonight, …", no swearing.
  let nextStep = r.nextStep;
  let options = r.nextStepOptions.filter((o) => !SWEARS.test(o));
  if (g.isEvening) {
    const ok = (s: string) => /^(tomorrow|tonight),/i.test(s) && !SWEARS.test(s);
    if (!ok(nextStep)) {
      const swap = options.find(ok);
      if (swap) { options = options.filter((o) => o !== swap); nextStep = swap; }
      else if (nextStep && !SWEARS.test(nextStep)) nextStep = `Tomorrow, ${nextStep.replace(/^./, (c) => c.toLowerCase())}`;
    }
  }

  return {
    ...r,
    reflection,
    followUpQuestion: question,
    keyTheme: tag(r.keyTheme),
    releasePoint: tag(r.releasePoint),
    valueNamed: tag(r.valueNamed),
    possibleFirstSeed: seed,
    nextStep,
    nextStepOptions: options,
    appFeedback,
  };
}

// Follow-up reply: no swearing, templates, effort talk, or repeats of the
// reflection (sentences or a Heartbeat it already named).
export function enforceAckRules(reply: string, reflection?: string | null): string {
  let out = join(sentences(reply).filter((s) => !SWEARS.test(s) && !TEMPLATES.test(s) && !CHANGE_SITUATION.test(s)));
  if (reflection) {
    const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
    const seen = new Set(sentences(reflection).map(norm).filter((t) => t.length > 12));
    const named = HEARTBEATS.filter((h) => reflection.includes(h));
    out = join(sentences(out).filter((s) => !seen.has(norm(s)) && !named.some((h) => s.includes(h))));
  }
  return withoutEffort(out);
}
