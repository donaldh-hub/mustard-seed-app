// Code-level guards for Jai's journal replies. The prompt asks for these
// rules; the model follows them most of the time, not every time. Each rule
// the acceptance check tests is enforced here after the model replies, so a
// slip is caught on every run instead of most runs.
// Pure functions (no AI client) so they can be unit-tested.

export const HEARTBEATS = ["Clarity of Vision & Why", "Small Steps + Consistency", "Mindset over Method", "Feedback & Adaptation", "Courageous Action"];

const SWEARS = /\b(fuck\w*|shit\w*|damn\w*|bullshit|hell|ass)\b/i;
const TEMPLATES = /this is a sign|mindset shift|key part of moving forward|how the seed grows|that'?s the discipline|had some hope in it|\bthis journal (helps|is here|is about|is meant|is designed|can help)|\bnaming (the |a )?pattern|\b(language|watch your|profan\w*)\b|is a step toward|\bchao(s|tic)\b/i;
const PACE = /\b(quick(ly)?|fast|rushed|hurried)\b/i;
const CHANGE_SITUATION = /\b(quit|find a new job|change jobs|new job)\b/i;
const CANNED_QUESTION = /full permission to slow down/i;
const ANGER_OWNED = /\b(fair|missing|missed|right|hear you|not listening|getting wrong|on me|got (that|it) wrong)\b/i;
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
  return join(sentences(text).filter((s) => !/\bI may be missing something\b/i.test(s) && !SWEARS.test(s) && !TEMPLATES.test(s) && !CHANGE_SITUATION.test(s) && (paceOk || !PACE.test(s))));
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
  formText?: string; // the journal's own question wording
  stepCheck?: { step: string; status: string } | null; // "Last night's step" answer
  latestStep?: string; // the step already set (its size is kept)
}

export function enforceReflectionRules<T extends ReflectionFields>(r: T, g: GuardInput): T {
  const all = [...g.answers, ...g.priorAnswers];
  const paceOk = /rush|hurr|fast|quick/i.test(g.answers.join(" "));
  // Never credit the form's own question to them ("Your question about…"),
  // and never reuse a line from an earlier session's reflection.
  let reflection = clean(r.reflection, paceOk);
  // Feelings only in their words: never "overwhelmed" (etc.) unless they said it.
  reflection = withoutInventedFeelings(reflection, all);
  // No invented reasons ("Health is the reason" when they said "my doctor said so").
  reflection = withoutInventedReasons(reflection, all);
  // Own the miss: if they didn't do it, the first sentence says so in their words.
  const missed = g.answers.map((a) => a.split(/(?<=[.!?])\s+/).find((x) => MISS.test(x))).find(Boolean)
    ?? (g.stepCheck && /^(not yet|partly|no)\b/i.test(g.stepCheck.status) ? `${g.stepCheck.status.toLowerCase()} on last night's step` : "");
  if (missed && !MISS_NAMED.test(sentences(reflection)[0] ?? "")) {
    reflection = `You said it plainly: ${missed.trim().replace(/[.!]+$/, "").replace(/^./, (c) => c.toLowerCase())}. ${reflection}`.trim();
  }
  const priorSentences = (g.priorReflections ?? []).flatMap((t) => sentences(t));
  const fresh = join(sentences(reflection).filter((s) => !priorSentences.some((p) => sameLine(p, s))));
  if (fresh) reflection = fresh;
  if (!g.userAsked) reflection = join(sentences(reflection).filter((s) => !/\byour question\b/i.test(s)));
  let question = CANNED_QUESTION.test(r.followUpQuestion) ? "" : clean(r.followUpQuestion, paceOk);
  // They said they hate being told how to feel: ask about the action, never the feeling.
  if (FEEL_PUSHBACK.test(all.join(" ")) && /\bfeel\w*|emotion/i.test(question)) question = "What's the next thing you'll actually do, even a small one?";

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
    if (!ANGER_OWNED.test(sentences(reflection)[0] ?? "")) reflection = `You're right, I missed something there. ${reflection}`.trim();
    if (!ANGER_OWNED.test(question) && !/\bhelp\b/i.test(question)) question = "What am I missing?";
    if (!appFeedback) appFeedback = g.angerLine || "User pushed back on Jai or the app.";
  }

  if (!reflection) reflection = "Thank you for writing this down. I'm here with you in it.";
  if (!question) question = "What's one small thing that would make tomorrow a little easier?";

  // Swearing is a tone signal, never a stored theme.
  const tag = (v: string) => (SWEARS.test(v ?? "") ? "" : v);

  // The first seed comes from what they'll keep nurturing and carry forward
  // (their Grounding Statement answers), else their chosen step; never a
  // research task or an invented one.
  let seed = r.possibleFirstSeed;
  const [, nurture = "", carry = ""] = g.isStatement ? g.answers : [];
  const realAnswer = (a: string) => a.trim().split(/\s+/).length >= 2 && !/\b(idk|don'?t know|if i know|not sure|nothing|no idea|whatever|who knows|dunno)\b/i.test(a) && !SWEARS.test(a.replace(/\b(damn|shit)\b/gi, ""));
  const fromFields = [carry, nurture].filter(realAnswer);
  const seedWords = new Set(fromFields.join(" ").toLowerCase().match(/[a-z]{4,}/g) ?? []);
  const seedFromThem = !!seed && (seed.toLowerCase().match(/[a-z]{4,}/g) ?? []).some((w) => seedWords.has(w)) && !RESEARCH.test(seed);
  const locked = g.lockedStep ? g.lockedStep.replace(/^(tomorrow|tonight),\s*/i, "").replace(/^./, (c) => c.toUpperCase()) : "";
  if (g.isStatement && !seedFromThem) {
    // Their carry-forward / nurture answer when it reads as an action, else
    // the step they chose; never a non-answer or research.
    const actionField = fromFields.find((a) => /\b(grow|keep|plant|water|finish|write|walk|run|do|make|build|clean|cook|save|practice|pushups?|read|leave|get|start|prep\w*|stretch|lift)\b/i.test(a));
    seed = actionField ? actionField.trim().replace(/^./, (c) => c.toUpperCase()).replace(/[.!]*$/, ".") : (locked || seed);
    if (RESEARCH.test(seed) && locked) seed = locked;
  } else if (!g.isStatement && g.lockedStep) {
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
  // Theme, Value and Release only from phrases they wrote: most of the words
  // must be theirs, and never a word they said sarcastically ("peace? lol").
  const sarcastic = sarcasticWords(all);
  const theirStems = new Set([...theirWords].filter((w) => !sarcastic.has(w)).map((w) => w.slice(0, 5)));
  const fromThem = (v: string) => {
    if (!v) return true;
    const ws = (v.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !NOTICE_STOP.has(w));
    if (!ws.length) return false;
    return ws.filter((w) => theirStems.has(w.slice(0, 5))).length / ws.length >= 0.5;
  };
  // Never the form's own wording as their value ("calm" from "calm awareness").
  const formWords = new Set(((g.formText ?? "").toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !["what", "where", "when", "your", "today", "this", "that", "have", "with", "from", "about", "tomorrow", "small", "ways"].includes(w)));
  const fromForm = (v: string) => (v.toLowerCase().match(/[a-z]{4,}/g) ?? []).some((w) => formWords.has(w));
  // Negation: "I'm NOT releasing the book" can never become "ready to release the book".
  const negated = new Set(g.answers.flatMap((a) => [...a.matchAll(/\b(not|never|no longer|stop|won'?t|don'?t|isn'?t|aren'?t|can'?t)\b([^.!?]{0,60})/gi)].flatMap((m) => m[2].toLowerCase().match(/[a-z]{4,}/g) ?? [])));
  const contradicts = (v: string) => (v.toLowerCase().match(/[a-z]{4,}/g) ?? []).some((w) => negated.has(w) && !["releasing", "release", "letting", "go"].includes(w));

  // "Yes, I did it": name the specific thing.
  if (g.stepCheck && /^yes/i.test(g.stepCheck.status)) {
    const step = g.stepCheck.step.replace(/^(tomorrow|tonight),?\s*/i, "").replace(/[.!]+$/, "");
    const key = (step.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !["your", "with", "before", "after", "minutes", "minute"].includes(w));
    if (step && !key.some((w) => reflection.toLowerCase().includes(w))) {
      reflection = `You said you'd ${step.charAt(0).toLowerCase() + step.slice(1)}, and you did. ${reflection}`.trim();
    }
  }
  // Minutes in the text match the step that's set (5 stays 5).
  reflection = keepStepSize(reflection, r.nextStep || g.latestStep || "");

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
    valueNamed: fromThem(r.valueNamed) && !fromForm(r.valueNamed) ? tag(r.valueNamed) : "",
    releasePoint: contradicts(r.releasePoint) || !fromThem(r.releasePoint) ? "" : tag(r.releasePoint),
    keyTheme: fromThem(r.keyTheme) ? tag(r.keyTheme) : "",
    possibleFirstSeed: seed,
    nextStep,
    // No lifted alternates ("reflect on what calm means for you").
    nextStepOptions: options.filter((o) => !/\breflect\b|\bwhat .{0,25} means\b/i.test(o) && !(formWords.size && /\bcalm\b/i.test(o) && !theirWords.has("calm"))),
    appFeedback,
  };
}

// Follow-up reply: no swearing, templates, effort talk, or repeats of the
// reflection (sentences or a Heartbeat it already named).
export function enforceAckRules(reply: string, reflection?: string | null, answer = ""): string {
  reply = withoutInventedFeelings(reply, [answer]);
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

// Any "N minutes" larger than the set step's minutes becomes the step's.
export function keepStepSize(text: string, step: string): string {
  const m = Number((step ?? "").match(/(\d+)\s*min/i)?.[1] ?? 0);
  if (!m) return text;
  return (text ?? "").replace(/(\d+)(\s*-?\s*min(ute)?s?)/gi, (all, n, rest) => (Number(n) > m ? `${m}${rest}` : all));
}

export const RESEARCH = /\b(research|plan|planning|look up|read (up )?about|list|explore|find out|learn about|think about|sketch|look into|brainstorm|reflect)\b/i;
// Feeling words Jai may only use if they used them first.
const FEELINGS = /\b(overwhelm\w*|stress\w*|anxi\w*|discourag\w*|hopeless\w*|defeat\w*|sad(ness)?|depress\w*|frustrat\w*|burn(ed|t) out)\b/i;
export function withoutInventedFeelings(text: string, theirs: string[]): string {
  const said = theirs.join(" ").toLowerCase();
  return join(sentences(text).filter((s) => {
    const m = s.match(FEELINGS);
    if (!m) return true;
    const stem = m[0].toLowerCase().slice(0, 6);
    return said.includes(stem);
  }));
}

const NOTICE_STOP = new Set(["with", "that", "this", "from", "about", "your", "their", "into", "being", "feeling", "need", "idea", "sense", "finding"]);
// Words said with a sarcastic marker ("peace? lol", "gratitude? lol",
// "calm? sure", "yeah right") are never read as sincere.
export function sarcasticWords(answers: string[]): Set<string> {
  const out = new Set<string>();
  for (const a of answers) {
    for (const m of a.matchAll(/([a-z' ]{2,40})\?+\s*(lol|lmao|haha|sure|right|ok|okay|whatever|ugh)\b/gi)) for (const w of m[1].toLowerCase().match(/[a-z]{4,}/g) ?? []) out.add(w);
    for (const m of a.matchAll(/\b(yeah right|sure|lol)\b[^.!?]{0,30}/gi)) for (const w of m[0].toLowerCase().match(/[a-z]{4,}/g) ?? []) out.add(w);
  }
  return out;
}
const REASON_LINE = /\b(is the reason|is your reason|your reason is|the reason is|is what drives you|is your why|that'?s your why)\b/i;
export function withoutInventedReasons(text: string, theirs: string[]): string {
  const stems = new Set((theirs.join(" ").toLowerCase().match(/[a-z]{4,}/g) ?? []).map((w) => w.slice(0, 5)));
  return join(sentences(text).filter((s) => {
    if (!REASON_LINE.test(s)) return true;
    const ws = (s.toLowerCase().replace(REASON_LINE, "").match(/[a-z]{4,}/g) ?? []).filter((w) => !["your", "that", "this", "with"].includes(w));
    return ws.length > 0 && ws.filter((w) => stems.has(w.slice(0, 5))).length / ws.length >= 0.5;
  }));
}
export const MISS = /\b(never went|didn'?t (go|do it|do that|make it|get to it|write|walk|show|try)|skipped|sat in the car|bailed|missed it|no,? i didn'?t|not yet|blew it off|stayed home)\b/i;
const MISS_NAMED = /\b(didn'?t|never|skipped|not yet|missed|car|bailed|stayed home|you said it plainly)\b/i;
export const FEEL_PUSHBACK = /\b(hate|don'?t like|stop|quit) (being told|telling me) how (to|i) feel|\bstop asking (me )?how i feel|\bdon'?t tell me how (to|i) feel|\bnot (being )?lectured\b/i;
