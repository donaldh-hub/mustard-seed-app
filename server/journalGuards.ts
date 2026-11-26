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
const JOB_STAKE = /\b((almost|nearly) (got|get|been|getting) (\w+ )?fired|(almost|nearly) lost (my|the) job|(could|might|gonna|going to) (lose|get fired from) (my|the) job|(really )?need (the|those|these|my) (hours|job|paycheck|money))\b/i;
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

export function withStake(reflection: string, answers: string[], priorReflections: string[] = []): string {
  // Named back once: not again if an earlier session already said it.
  if (priorReflections.some((t) => /\b(losing the job|need the (hours|job|paycheck|money)|almost (got )?fired)\b/i.test(t))) return reflection;
  // "work" alone doesn't count: their goal may already be about work.
  const hit = answers.map((a) => a.match(JOB_STAKE)?.[0]).find(Boolean);
  if (!hit || /\b(job|fired|lose|losing|lost|hours|paycheck)\b/i.test(reflection)) return reflection;
  const line = /fired|lost|lose/i.test(hit) ? "You came close to losing the job. That's real." : `You need the ${hit.match(/hours|job|paycheck|money/i)?.[0].toLowerCase() ?? "hours"}. That's real.`;
  return `${reflection.trim()} ${line}`.trim();
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
  draftStatement?: string;
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
  priorSteps?: string[]; // steps Jai set on earlier days
  userAsked?: boolean; // they typed a direct question (answered separately)
  isStatement?: boolean; // Grounding Statement session
  priorReflections?: string[]; // Jai's reflections from earlier sessions
}

export function enforceReflectionRules<T extends ReflectionFields>(r: T, g: GuardInput): T {
  const all = [...g.answers, ...g.priorAnswers];
  const paceOk = /rush|hurr|fast|quick/i.test(g.answers.join(" "));
  // Never credit the form's own question to them ("Your question about…"),
  // and never reuse a line from an earlier session's reflection.
  let reflection = clean(r.reflection, paceOk);
  const priorSentences = (g.priorReflections ?? []).flatMap((t) => sentences(t));
  const fresh = join(sentences(reflection).filter((s) => !priorSentences.some((p) => sameLine(p, s))));
  if (fresh) reflection = fresh;
  if (!g.userAsked) reflection = join(sentences(reflection).filter((s) => !/\byour question\b/i.test(s)));
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
  reflection = withStake(reflection, all, g.priorReflections ?? []);
  if (JOB_FEELING.test(g.answers.join(" ")) && !/\b(job|work)\b/i.test(reflection)) {
    reflection = `${reflection} That feeling about your job is real, and it's okay to name it.`.trim();
  }
  // Never ask a why they already answered with a stake, or call it unclear.
  if (all.some((a) => JOB_STAKE.test(a))) {
    if (WHY_QUESTION.test(question)) question = "";
    reflection = join(sentences(reflection).filter((s) => !/\b(without (clarity|a clear)|unclear why|why (this|it) matters)\b/i.test(s)));
  }

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

  // The first seed is their goal's chosen step, never a new invented task.
  let seed = r.possibleFirstSeed;
  if (g.lockedStep) {
    seed = g.lockedStep.replace(/^(tomorrow|tonight),\s*/i, "").replace(/^./, (c) => c.toUpperCase());
  }

  // Evening step: "Tomorrow, …" or "Tonight, …", no swearing, not a repeat of
  // an earlier day's step, and no added evening task when they're overloaded.
  let nextStep = r.nextStep;
  let options = r.nextStepOptions.filter((o) => !SWEARS.test(o));
  if (g.isEvening) {
    const prior = g.priorSteps ?? [];
    const overloaded = OVERLOAD.test(g.answers.join(" "));
    const bad = (s: string) => prior.some((p) => similarStep(p, s)) || (overloaded && addsEveningTask(s));
    if (nextStep && bad(nextStep)) {
      const swap = options.find((o) => !bad(o));
      if (swap) { options = [nextStep, ...options.filter((o) => o !== swap)].filter((o) => !prior.some((p) => similarStep(p, o))).slice(0, 2); nextStep = swap; }
    }
    options = options.filter((o) => !prior.some((p) => similarStep(p, o)));
    const ok = (s: string) => /^(tomorrow|tonight),/i.test(s) && !SWEARS.test(s);
    if (!ok(nextStep)) {
      const swap = options.find(ok);
      if (swap) { options = options.filter((o) => o !== swap); nextStep = swap; }
      else if (nextStep && !SWEARS.test(nextStep)) nextStep = `Tomorrow, ${nextStep.replace(/^./, (c) => c.toLowerCase())}`;
    }
  }

  // Values only from their own words (never the form's wording or Jai's pick).
  const theirWords = new Set(all.join(" ").toLowerCase().match(/[a-z]{4,}/g) ?? []);
  const fromThem = (v: string) => !v || (v.toLowerCase().match(/[a-z]{4,}/g) ?? []).some((w) => theirWords.has(w));

  // Grounding Statement draft keeps the hard truths and an honest "not sure".
  let draftStatement = r.draftStatement;
  if (g.isStatement && draftStatement) {
    const said = g.answers.join(" ");
    if (/\b(but|though)\b.{0,12}\b(hard|tough|difficult)\b/i.test(said) && !/\b(hard|tough|difficult)\b/i.test(draftStatement)) {
      draftStatement = draftStatement.replace(/[.!]?\s*$/, ", and it's hard.");
    }
    if (g.answers.some((a) => /^\s*(not sure|idk|i don'?t know)\b/i.test(a)) && !/not sure|don'?t know/i.test(draftStatement)) {
      draftStatement = `I'm not sure yet what I've learned. ${draftStatement}`;
    }
  }

  return {
    ...r,
    ...(r.draftStatement !== undefined ? { draftStatement } : {}),
    reflection,
    followUpQuestion: question,
    keyTheme: tag(r.keyTheme),
    releasePoint: tag(r.releasePoint),
    valueNamed: fromThem(r.valueNamed) ? tag(r.valueNamed) : "",
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

const OVERLOAD = /\b(work (runs?|ran|goes|went) late|get off (work )?late|overload\w*|too much|no time|exhausted|cook(ing)?|laundry|shower(ing)?|chores)\b/i;
const STEP_STOP = new Set(["tomorrow", "tonight", "your", "with", "before", "after", "minutes", "minute", "make", "the", "that", "this", "from", "into", "will", "just", "earlier", "than", "usual"]);
// Two steps are the same idea if they share two key words ("alarm" + "set").
export function similarStep(a: string, b: string): boolean {
  const words = (t: string) => new Set((t.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !STEP_STOP.has(w)));
  const A = words(a), B = words(b);
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared >= 2 || (A.has("alarm") && B.has("alarm"));
}

// Two lines say the same thing if most of their words match ("Some days
// don't hand you a bright spot…" vs "…a clear insight…").
export function sameLine(a: string, b: string): boolean {
  const words = (t: string) => (t.toLowerCase().match(/[a-z']{3,}/g) ?? []);
  const A = words(a), B = new Set(words(b));
  if (A.length < 5 || B.size < 5) return false;
  const shared = A.filter((w) => B.has(w)).length;
  return shared / Math.min(A.length, B.size) >= 0.7;
}

// A step that lands on their evening ("Tomorrow, set out your clothes
// tonight", "before bed"), unless it takes something off.
export function addsEveningTask(step: string): boolean {
  return /^tonight,|\btonight\b|the night before|at night|before (bed|you go to bed|going to bed)|this evening|when you get home/i.test(step) && !/\b(skip|less|instead|drop|one minute|take .* off)\b/i.test(step);
}
export function isOverloaded(answers: string[]): boolean {
  return OVERLOAD.test(answers.join(" "));
}
