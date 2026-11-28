import OpenAI from "openai";
import { storage } from "./storage";
import { plantGoal } from "./goalPlanting";
import { HEARTBEAT_NAMES } from "./titan";
import { releaseHeldPhotos } from "./photoReview";
import type { Moment, MomentState } from "./momentReader";

// ─── Guided goal setup with Jai ─────────────────────────────────────────────
// A user with no active goal gets one gentle offer: Jai suggests a goal from
// their Memory (journal, chat, entries) and asks — he never creates one on
// his own. If they say yes (or want a different goal), he walks them through
// it one question at a time: wording → why → first small step → optional
// date, then a confirm. Planting uses the same plantGoal() as the Growth tab.
//
// State lives on users.goal_setup. Buttons in Chat send fixed phrases
// (GOAL_SETUP_BUTTONS); typed answers are read by the model.

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export type GoalSetupStage = "offered" | "wording" | "new_goal" | "why" | "why_after" | "step" | "date" | "confirm" | "declined" | "done";

export interface GoalSetupState {
  stage: GoalSetupStage;
  source: "chat" | "journal";
  suggestion: { goal: string; because: string } | null;
  title?: string;
  why?: string;
  step?: string;
  deadline?: string | null;
  checkIn?: string | null;
  lastOfferedAt?: string;
  // A real stake they named in the journal ("you almost got fired"),
  // offered back when Jai asks for the why.
  stake?: string;
  // The why came from their stake, not their answer to the why question.
  whyFromStake?: boolean;
  // A fix Jai proposed for a planted goal, applied on "yes".
  pendingFix?: { title?: string; why?: string };
  // When chat last invited them back to the setup question (once per
  // conversation, never right after anger).
  invitedBackAt?: string;
  // Jai just asked the setup question, so their next message may be the
  // answer. False once the chat moved on (a later line isn't the answer).
  awaiting?: boolean;
  // Set once the goal is planted (right after the why); the "step" stage
  // then fills in its first step.
  plantedGoalId?: string;
}

// Message types Chat renders with buttons under them.
export const GOAL_OFFER_MESSAGE = "goal_offer";
export const GOAL_CONFIRM_MESSAGE = "goal_confirm";

export const GOAL_SETUP_BUTTONS = {
  yes: "Yes, make this my goal",
  different: "Create a different goal",
  start: "Set up my first goal",
  notYet: "Not yet",
  plant: "Plant it",
  change: "Change something",
} as const;

const ACTIVE_STAGES: GoalSetupStage[] = ["offered", "wording", "new_goal", "why", "why_after", "step", "date", "confirm"];

// An email typed into the Name field is never used as a greeting.
const firstName = (name: string | null | undefined) => { const f = (name || "").trim().split(/\s+/)[0] || ""; return f.includes("@") ? "" : f; };
const withName = (name: string, text: string) => (name ? `${name}, ${text.charAt(0).toLowerCase()}${text.slice(1)}` : text);
const stripEnd = (t: string) => t.trim().replace(/[.!\s]+$/, "");

// Their own words said back by Jai: "my clothes" → "your clothes".
function toYou(t: string): string {
  return t.replace(/\bI'm\b/g, "you're").replace(/\bI am\b/g, "you are").replace(/\bI\b/g, "you")
    .replace(/\bmyself\b/gi, "yourself").replace(/\bmy\b/gi, "your").replace(/\bme\b/gi, "you");
}

// Worded and confirmed, not planted yet: shown as "Goal in progress".
export function isDraft(s: GoalSetupState): boolean {
  return !!s.title && (["why", "date", "confirm"].includes(s.stage) || (s.stage === "step" && !s.plantedGoalId));
}

function getState(user: { goalSetup?: unknown }): GoalSetupState | null {
  const s = user.goalSetup as GoalSetupState | null | undefined;
  return s && typeof s === "object" && "stage" in s ? s : null;
}

async function saveState(userId: string, state: GoalSetupState | null) {
  await storage.updateUser(userId, { goalSetup: state } as any);
}

// ─── Suggestion from Memory ──────────────────────────────────────────────────

export async function suggestGoalFromMemory(userId: string): Promise<{ goal: string; because: string } | null> {
  const [journal, entries, messages] = await Promise.all([
    storage.getGroundingJournalEntries(userId),
    storage.getEntries(userId),
    storage.getMessages(userId),
  ]);
  const lines: string[] = [];
  for (const e of [...journal].sort((a, b) => +new Date(b.createdAt ?? 0) - +new Date(a.createdAt ?? 0))) {
    const answers = ((e.prompts as { response: string }[]) ?? []).map((p) => p.response).filter(Boolean).join(" / ");
    if (e.session === "intention") lines.push(`Journal intention (their goal for the 3 days): ${answers}`);
    else lines.push(`Journal Day ${e.dayNumber} ${e.session}: ${answers}${e.userFollowUpResponse ? ` / ${e.userFollowUpResponse}` : ""}${e.possibleFirstSeed ? ` / first seed: ${e.possibleFirstSeed}` : ""}`);
  }
  for (const m of messages.filter((m) => m.sender === "user").slice(-10)) lines.push(`Chat: ${m.text}`);
  for (const e of entries.slice(0, 8)) if (e.summary) lines.push(`Memory: ${e.summary}`);
  const s = await suggestGoalFromLines(lines);
  // Never a reflection exercise as a goal: fall back to their own intention.
  const intention = ((journal.find((e) => e.session === "intention")?.prompts as { response?: string }[] | undefined)?.[0]?.response ?? "").trim();
  // Their own journal goal is the title ("being on time for work" -> "Be on
  // time for work"), never Jai's step text.
  if (intention) return { goal: goalFromIntention(intention), because: s?.because || lowerFirst(stripEnd(intention)) };
  return s;
}

/** The model step of suggestGoalFromMemory, on plain record lines. */
export async function suggestGoalFromLines(lines: string[]): Promise<{ goal: string; because: string } | null> {
  if (lines.length === 0) return null;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      max_tokens: 120,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `From this person's own records, find the ONE thing they keep coming back to that would make a good first goal. Use their words and their goal — never invent one. The goal must be an action they can do and show (e.g. "Get to work on time"), never a thinking task ("Reflect on…", "Explore why…", "Understand…"). Their journal intention is usually the goal. If nothing clearly points to a goal, return {"goal": "", "because": ""}.
"goal": first person, plain, under 14 words, no quotes (e.g. "Find a name for my business"). If their journal intention names the outcome this serves (e.g. being on time for work), keep that outcome in the goal: "Build a night routine so I'm on time for work".
"because": a short phrase completing "you kept coming back to …", in second person (e.g. "finding a name for your business").
Respond ONLY with JSON: {"goal": "...", "because": "..."}`,
        },
        { role: "user", content: lines.slice(0, 30).join("\n").slice(0, 4000) },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    const goal = typeof parsed.goal === "string" ? stripEnd(parsed.goal.replace(/["“”]/g, "")) : "";
    const because = typeof parsed.because === "string" ? stripEnd(parsed.because.replace(/["“”]/g, "")) : "";
    return goal && because ? { goal, because } : null;
  } catch {
    return null;
  }
}

// ─── Offer ───────────────────────────────────────────────────────────────────

function offerText(name: string, source: "chat" | "journal", suggestion: GoalSetupState["suggestion"]): string {
  if (suggestion) {
    const when = source === "journal" ? "Over the last 3 days" : "Lately";
    return withName(name, `${when} you kept coming back to ${suggestion.because}. Want me to set that up as your first goal, or would you rather start with a different one?`);
  }
  return withName(name, "Your water, your seed, and our check-ins all grow from a goal. Want to plant your first one together? It takes a couple of minutes.");
}

/** Posts Jai's goal offer into Chat and opens the setup. */
export async function startGoalSetup(userId: string, source: "chat" | "journal") {
  const user = await storage.getUser(userId);
  if (!user) return null;
  // A goal already worded and on its way (Home shows "Goal in progress"):
  // pick it back up instead of starting over.
  const current = getState(user);
  if (current && isDraft(current)) {
    return storage.createMessage({ userId, text: RETURN_TO[current.stage]?.(current) ?? questionFor(current.stage, current), sender: "jae" });
  }
  const suggestion = await suggestGoalFromMemory(userId);
  const stake = await journalStake(userId);
  // Tapping "Plant" after the journal already said yes: go straight to the
  // wording instead of asking again.
  if (source === "journal" && suggestion) {
    const next: GoalSetupState = { stage: "wording", source, suggestion, title: suggestion.goal, stake, awaiting: true, lastOfferedAt: new Date().toISOString() };
    await saveState(userId, next);
    return storage.createMessage({ userId, text: QUESTIONS.wording(next), sender: "jae" });
  }
  await saveState(userId, { stage: "offered", source, suggestion, stake, awaiting: true, lastOfferedAt: new Date().toISOString() });
  return storage.createMessage({
    userId,
    text: offerText(firstName(user.name), source, suggestion),
    sender: "jae",
    messageType: GOAL_OFFER_MESSAGE,
  });
}

/**
 * Whether a no-goal user should get the offer when they open Chat. Once per
 * login session (the caller tracks that); never while a setup is under way.
 */
export async function shouldOfferGoalSetup(userId: string): Promise<boolean> {
  const [user, goals] = await Promise.all([storage.getUser(userId), storage.getActiveGoals(userId)]);
  if (!user || goals.length > 0) return false;
  const state = getState(user);
  if (!state) return true;
  return state.stage === "declined" || state.stage === "offered" || state.stage === "done";
}

// ─── Reading their answer ────────────────────────────────────────────────────

type Intent = "yes" | "different" | "not_yet" | "change" | "skip" | "answer" | "question" | "app_help" | "off_topic";

function buttonIntent(text: string): Intent | null {
  const t = text.trim().toLowerCase().replace(/[.!]+$/, "");
  if (t === GOAL_SETUP_BUTTONS.yes.toLowerCase() || t === GOAL_SETUP_BUTTONS.plant.toLowerCase()) return "yes";
  if (t === GOAL_SETUP_BUTTONS.different.toLowerCase() || t === GOAL_SETUP_BUTTONS.start.toLowerCase()) return "different";
  if (t === GOAL_SETUP_BUTTONS.notYet.toLowerCase()) return "not_yet";
  if (t === GOAL_SETUP_BUTTONS.change.toLowerCase()) return "change";
  if (t === "skip") return "skip";
  return null;
}

export async function interpret(stage: GoalSetupStage, question: string, answer: string): Promise<{ intent: Intent; value: string; reply: string }> {
  const button = buttonIntent(answer);
  if (button) return { intent: button, value: "", reply: "" };
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      max_tokens: 160,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Jai is helping someone set up their first goal, one question at a time. Classify their reply to Jai's question.
intent:
- "yes": agrees / accepts what Jai proposed ("yes", "sounds good", "that's it")
- "different": wants a different goal than the one suggested
- "not_yet": wants to stop or do this later ("not now", "maybe later", "no thanks")
- "change": wants to edit what was summarized
- "skip": skips an optional question
- "answer": actually answers the question (put the answer in "value")
- "question": asks Jai something about this question (put a one-sentence plain answer in "reply")
- "app_help": asks how the app works or what to do now ("how do I use this?", "what happens now?", "what is Growth?")
- "off_topic": talks about something unrelated to setting up the goal (put a short, warm 1–2 sentence reply to what they said in "reply", in Jai's calm voice: no advice lists, no question)
"value": for "answer" (or "different" when they name the new goal) — their answer, cleaned up but in their words, no quotes. For a goal: first person, under 12 words. For a date question: a calendar date as YYYY-MM-DD if they gave one (assume the next occurrence; today is ${new Date().toISOString().slice(0, 10)}), otherwise their check-in wording (e.g. "Sundays").
Respond ONLY with JSON: {"intent": "...", "value": "", "reply": ""}`,
        },
        { role: "user", content: `Stage: ${stage}\nJai asked: ${question}\nThey replied: ${answer}` },
      ],
    });
    const p = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    const intents: Intent[] = ["yes", "different", "not_yet", "change", "skip", "answer", "question", "app_help", "off_topic"];
    return {
      intent: intents.includes(p.intent) ? p.intent : "answer",
      value: typeof p.value === "string" ? stripEnd(p.value.replace(/["“”]/g, "")) : "",
      reply: typeof p.reply === "string" ? p.reply.trim() : "",
    };
  } catch {
    // If the model is down, treat what they typed as their answer.
    return { intent: "answer", value: stripEnd(answer), reply: "" };
  }
}

// ─── The questions ───────────────────────────────────────────────────────────

const QUESTIONS = {
  wording: (s: GoalSetupState) => `Here's how I'd word it: ${s.suggestion?.goal ?? s.title}. Does that sound like you, or how would you say it?`,
  new_goal: () => "What do you want to work toward? Say it in your own words. One goal is plenty.",
  why: (s: GoalSetupState) => `${whyQuestion(s.title)}${s.stake ? ` Earlier you said ${s.stake}. Is that part of it?` : ""} That's your Clarity of Vision & Why, the reason you'll come back to on the hard days.`,
  step: () => "What's one small first step you could take this week, something that takes 10 minutes or less? That's where Small Steps + Consistency starts.",
  date: () => "Last one, and it's optional: want a target date or a check-in day? You can say something like by November 30, or check in Sundays. Or just say skip.",
  confirm: (s: GoalSetupState) => [
    "Here's your goal.",
    `Goal: ${s.title}`,
    s.why ? `Why: ${s.why}` : "",
    s.step ? `First step: ${s.step}` : "",
    s.deadline ? `Target date: ${formatDate(s.deadline)}` : "",
    s.checkIn ? `Check-in: ${s.checkIn}` : "",
    "Ready to plant it?",
  ].filter(Boolean).join("\n"),
} as const;

// Short versions, for coming back to a question after answering something
// else (never the same words as the full question).
const RETURN_TO: Partial<Record<GoalSetupStage, (s: GoalSetupState) => string>> = {
  offered: () => "Whenever you're ready, we can set up your first goal together.",
  wording: (s) => `Whenever you're ready, tell me if ${s.suggestion?.goal ?? s.title} sounds right, or how you'd say it.`,
  new_goal: () => "Whenever you're ready, tell me the goal you want to work toward.",
  why: (s) => `Whenever you're ready, back to your goal: ${lowerFirst(whyQuestion(s.title))}`,
  step: () => "Whenever you're ready, back to your goal: what's one small first step you could take this week?",
  date: () => "Whenever you're ready, back to your goal: want a target date or check-in day, or should we skip it?",
  confirm: () => "Whenever you're ready, tell me if you want to plant it or change something.",
};

// Only what really exists in the app (checked against the screens). Used
// when someone asks how to use it, mid-setup.
export const APP_GUIDE = "Here's how it works. Home is your daily snapshot: your focus Heartbeat, your goal, your Water Level (how many of the last 7 days you showed up), and your Seed Stage. Growth is where your goals live, and where you can log progress on them. Memory is a calendar of what actually happened: your reflections, your steps, and the times you kept your word. Profile shows your five Heartbeat scores and your settings. And this chat is where you tell me what you did, ask me anything, or tell me what's in the way. Water comes from real action, not intention.";

// Goals are worded as actions ("Establish a nighttime routine") or as
// things ("Better sleep", "Writing my book"); ask "why" so either reads right.
export function whyQuestion(title: string | undefined): string {
  if (title && !isGoalClause(title)) return "Why does this goal matter to you?";
  const t = toYou(stripEnd((title ?? "").replace(/^i\s+(want|need|would like|will|'?m going|am going|plan)\s+to\s+/i, "")));
  if (!t) return "Why does this goal matter to you?";
  const first = t.split(/\s+/)[0].toLowerCase();
  const thing = /ing$/.test(first) || ["a", "an", "the", "my", "our", "more", "less", "better", "healthier", "consistent"].includes(first);
  return thing ? `Why does ${lowerFirst(t)} matter to you?` : `Why does it matter to you to ${lowerFirst(t)}?`;
}

function lowerFirst(t: string) {
  return /^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}
function formatDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
function questionFor(stage: GoalSetupStage, s: GoalSetupState): string {
  switch (stage) {
    case "offered": return offerText("", s.source, s.suggestion);
    case "wording": return QUESTIONS.wording(s);
    case "new_goal": return QUESTIONS.new_goal();
    case "why": return QUESTIONS.why(s);
    case "why_after": return whyQuestion(s.title);
    case "step": return QUESTIONS.step();
    case "date": return QUESTIONS.date();
    case "confirm": return QUESTIONS.confirm(s);
    default: return "";
  }
}

export interface GoalSetupReply {
  text: string;
  messageType: string;
  plantedGoalId?: string;
  // The whole setup is done (goal planted and its first step in).
  finished?: boolean;
}

/**
 * Handles a chat message while a goal setup is open. Returns Jai's reply,
 * or null when no setup is open (or they changed the subject), so the
 * normal chat flow answers instead.
 */
export async function handleGoalSetupTurn(
  userId: string,
  text: string,
  opts: { localDate?: string; userTimezone?: string },
  moment?: Moment,
): Promise<GoalSetupReply | null> {
  const user = await storage.getUser(userId);
  if (!user) return null;
  const state = getState(user);
  if (!state || !ACTIVE_STAGES.includes(state.stage)) return null;
  const plantedStepOpen = (state.stage === "step" || state.stage === "why_after") && !!state.plantedGoalId;
  if (!plantedStepOpen && (await storage.getActiveGoals(userId)).length > 0) {
    await saveState(userId, null);
    return null;
  }

  const ask = (next: GoalSetupState, prefix = ""): GoalSetupReply => ({
    text: `${prefix}${questionFor(next.stage, next)}`,
    messageType: next.stage === "confirm" ? GOAL_CONFIRM_MESSAGE : next.stage === "offered" ? GOAL_OFFER_MESSAGE : "text",
  });
  const move = async (next: GoalSetupState, prefix = "") => {
    await saveState(userId, { ...next, awaiting: true });
    return ask(next, prefix);
  };

  // Anger, complaints, corrections, questions and the like are answered by
  // the normal chat (Moment Reader), not by the setup script. The setup
  // question waits; Jai invites them back once, when it fits.
  // "finish my damn goal": plant it now with what we have; no more questions.
  if (moment?.intent === "finish_goal" && (state.title || state.suggestion?.goal) && state.stage !== "step") {
    const title = state.title || state.suggestion!.goal;
    const stake = moment.stake ? toYou(moment.stake.toLowerCase().replace(/^i\b/, "I")) : state.stake;
    const why = state.why || (stake ? asTheySaidIt(stripSwears(stake)) : "");
    return plantAfterWhy(userId, user.name, { ...state, title, why, whyFromStake: !state.why && !!why }, opts);
  }
  // A later line isn't the answer to a question asked a while ago.
  // ...unless it's plainly the why ("money, and I'm sick of saying I'll finish it").
  const lateWhy = (state.stage === "why" || state.stage === "why_after") && WHY_MARKER.test(text) && !!cleanWhy(text);
  if (state.awaiting === false && !buttonIntent(text) && !lateWhy) return null;
  if (moment && STEP_ASIDE.has(moment.state) && !(state.stage === "why" && moment.stake)) {
    await saveState(userId, { ...state, awaiting: false });
    return null;
  }

  const r = await interpret(state.stage, questionFor(state.stage, state), text);

  if (r.intent === "not_yet") {
    await saveState(userId, { ...state, stage: "declined" });
    return { text: "No pressure at all. When you're ready, I'm here, and we can set it up in a couple of minutes.", messageType: "text" };
  }
  const comeBack = (lead: string): GoalSetupReply => ({
    text: `${lead} ${RETURN_TO[state.stage]?.(state) ?? questionFor(state.stage, state)}`.trim(),
    messageType: "text",
  });
  void comeBack;
  if (r.intent === "app_help" || r.intent === "question" || r.intent === "off_topic" || AT_JAI.test(text)) {
    // The chat answers; the setup question waits and is invited back once.
    // At the offer, it comes back at the next chat open instead.
    await saveState(userId, { ...state, stage: state.stage === "offered" ? "declined" : state.stage, awaiting: false });
    return null;
  }

  switch (state.stage) {
    case "offered": {
      if (r.intent === "yes" && state.suggestion) return move({ ...state, stage: "wording", title: state.suggestion.goal });
      if (r.intent === "different" && r.value) return move({ ...state, stage: "why", title: r.value });
      if (r.intent === "answer" && r.value && r.value.split(" ").length >= 2) return move({ ...state, stage: "why", title: r.value });
      return move({ ...state, stage: "new_goal" });
    }
    case "wording": {
      if (r.intent === "different" && r.value) return move({ ...state, stage: "why", title: r.value });
      if (r.intent === "different" || /^\s*(no|nah|nope|not really)\b/i.test(text)) {
        await saveState(userId, { ...state, stage: "new_goal", awaiting: true });
        return { text: "Okay. How would you say it, in your own words?", messageType: "text" };
      }
      const title = r.intent === "answer" && r.value ? r.value : state.title ?? state.suggestion?.goal ?? "";
      return move({ ...state, stage: "why", title });
    }
    case "new_goal": {
      if (!r.value) return ask(state);
      return move({ ...state, stage: "why", title: r.value });
    }
    case "why": {
      const said = r.intent === "skip" ? "" : whyFrom(text, state.title);
      const stake = moment?.stake ? toYou(moment.stake.toLowerCase().replace(/^i\b/, "I")) : state.stake;
      // An angry line or "finish my goal" isn't a why: use the stake they
      // already named (no extra question), or leave it for later.
      const why = said || (stake ? asTheySaidIt(stripSwears(stake)) : "");
      return plantAfterWhy(userId, user.name, { ...state, why, whyFromStake: !said && !!why }, opts);
    }
    case "why_after": {
      const w = r.intent === "skip" ? "" : whyFrom(text, state.title);
      if (!w && r.intent !== "skip") {
        return { text: "I didn't catch the reason yet. In a few words, why does it matter to you?", messageType: "text" };
      }
      if (w) await storage.updateGoal(state.plantedGoalId!, { emotionalWhy: w } as any).catch(() => {});
      const saved = w ? `Saved. Your why: "${w}".` : "No problem. You can add it anytime on Growth.";
      if (state.step) {
        await saveState(userId, { ...state, stage: "done", why: w });
        return { text: saved, messageType: "text", finished: true };
      }
      await saveState(userId, { ...state, stage: "step", why: w, awaiting: true });
      return { text: `${saved}\n\n${QUESTIONS.step()}`, messageType: "text" };
    }
    case "step": {
      const step = r.intent === "skip" ? "" : r.value || text.trim();
      if (state.plantedGoalId) return saveFirstStep(userId, { ...state, step }, opts);
      return move({ ...state, stage: "date", step });
    }
    case "date": {
      if (r.intent === "skip" || r.intent === "yes" || !r.value) return move({ ...state, stage: "confirm", deadline: null, checkIn: null });
      const isDate = /^\d{4}-\d{2}-\d{2}$/.test(r.value);
      return move({ ...state, stage: "confirm", deadline: isDate ? r.value : null, checkIn: isDate ? null : r.value });
    }
    case "confirm": {
      if (r.intent === "change" || r.intent === "different" || r.intent === "answer") {
        return move({ ...state, stage: "wording", suggestion: state.title ? { goal: state.title, because: "" } : state.suggestion }, "No problem, let's walk it again. ");
      }
      const planted = await plant(userId, user.name, state, opts);
      return { ...planted, finished: !!planted.plantedGoalId };
    }
  }
  return null;
}

async function plant(
  userId: string,
  name: string | null | undefined,
  state: GoalSetupState,
  opts: { localDate?: string; userTimezone?: string },
): Promise<GoalSetupReply> {
  const assessment = await storage.getLatestAssessment(userId).catch(() => undefined);
  const heartbeat = (HEARTBEAT_NAMES as Record<string, string>)[assessment?.weakestHeartbeat ?? ""] ?? "Small Steps + Consistency";
  const title = state.title ?? "";
  const planted = await plantGoal(userId, {
    goalType: "targeted",
    title,
    emotionalWhy: state.why ?? "",
    focusArea: heartbeat,
    deadline: state.deadline ?? null,
    microHabit: state.step ?? "",
    localDate: opts.localDate,
    userTimezone: opts.userTimezone,
  });
  if (!planted.ok) {
    return { text: planted.message, messageType: "text" };
  }
  // The first step goes in Memory too, so Jai can ask about it next time.
  if (state.step) {
    await storage.createEntry({
      userId,
      goalId: planted.goal.id,
      date: opts.localDate || new Date().toLocaleDateString("en-CA"),
      summary: `First step for your goal (${title}): ${state.step}${state.checkIn ? ` (check-in: ${state.checkIn})` : ""}`,
      mood: "neutral",
      ...(opts.userTimezone ? { userTimezone: opts.userTimezone } : {}),
    }).catch(() => {});
  }
  await saveState(userId, { ...state, stage: "done" });
  // Planting is today's check-in; the daily opening ("did you get to your
  // step?") waits until tomorrow.
  await storage.updateUser(userId, { lastDailyEncouragementSentAt: new Date() } as any);
  const first = firstName(name);
  const stepLine = state.step ? ` Your first step: ${toYou(lowerFirst(stripEnd(state.step)))}. I'll ask you about it next time.` : "";
  // A photo shared before there was a goal gets checked against it now.
  const released = await releaseHeldPhotos(userId, opts.localDate || new Date().toLocaleDateString("en-CA")).catch((err) => {
    console.error("[GOAL_SETUP] held photo release error:", err);
    return 0;
  });
  const photoLine = released > 0 ? " The photo you shared earlier counts toward it too, so your seed got water for that as well." : "";
  return {
    text: `${first ? `${first}, it's planted. ` : "It's planted. "}🌱 Your first goal: ${title}. It just got its first drop of water.${stepLine}${photoLine}`,
    messageType: "text",
    plantedGoalId: planted.goal.id,
  };
}

// The newest step they set in the 3-Day Journal ("Tomorrow, …" dropped),
// used as the goal's first step so it stays in their own words.
async function journalStep(userId: string): Promise<string> {
  const journal = await storage.getGroundingJournalEntries(userId).catch(() => []);
  // Their first seed (from the Grounding Statement) is the first step; else
  // the newest step they set.
  const seed = (journal.find((e) => e.session === "grounding_statement")?.possibleFirstSeed ?? "").trim();
  if (seed) return stripEnd(seed.replace(/^(tomorrow|tonight),?\s*/i, "")).replace(/^./, (c) => c.toUpperCase());
  const last = journal.filter((e) => e.session === "evening" && e.nextStep)
    .sort((a, b) => b.dayNumber - a.dayNumber)[0]?.nextStep ?? "";
  const rest = stripEnd(last.replace(/^(tomorrow|tonight),?\s*/i, ""));
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : "";
}

/**
 * The why is in: plant the goal now (first water and Memory come from
 * plantGoal), then close with a short summary and one first step: their
 * journal step if they set one, otherwise one last question for it.
 */
async function plantAfterWhy(
  userId: string,
  name: string | null | undefined,
  state: GoalSetupState,
  opts: { localDate?: string; userTimezone?: string },
): Promise<GoalSetupReply> {
  const step = await journalStep(userId);
  const planted = await plant(userId, name, { ...state, step }, opts);
  if (!planted.plantedGoalId) return planted;
  const why = state.why
    ? `\n\nWhy it matters: "${stripEnd(state.why)}"${state.whyFromStake ? " (from what you told me earlier; you can change it on Growth)" : ""}`
    : "";
  if (!state.why) {
    // Ask once; their next line is saved as the why (see "why_after").
    await saveState(userId, { ...state, stage: "why_after", step, plantedGoalId: planted.plantedGoalId, awaiting: true });
    const base = step ? planted.text.replace("I'll ask you about it next time.", "That's the step you set in your journal, and I'll ask you about it next time.") : planted.text;
    return { ...planted, text: `${base}\n\nOne thing before you go: ${lowerFirst(whyQuestion(state.title))} A few words is plenty, and I'll save it with your goal.` };
  }
  if (step) {
    return { ...planted, finished: true, text: `${planted.text.replace("I'll ask you about it next time.", "That's the step you set in your journal, and I'll ask you about it next time.")}${why}` };
  }
  await saveState(userId, { ...state, stage: "step", plantedGoalId: planted.plantedGoalId });
  return { ...planted, text: `${planted.text}${why}\n\n${QUESTIONS.step()}` };
}

/** Saves the first step on a goal planted before the step was asked. */
async function saveFirstStep(
  userId: string,
  state: GoalSetupState,
  opts: { localDate?: string; userTimezone?: string },
): Promise<GoalSetupReply> {
  if (state.step) {
    await storage.updateGoal(state.plantedGoalId!, { microHabit: state.step } as any).catch(() => {});
    await storage.createEntry({
      userId,
      goalId: state.plantedGoalId!,
      date: opts.localDate || new Date().toLocaleDateString("en-CA"),
      summary: `First step for your goal (${state.title}): ${state.step}`,
      mood: "neutral",
      ...(opts.userTimezone ? { userTimezone: opts.userTimezone } : {}),
    }).catch(() => {});
  }
  await saveState(userId, { ...state, stage: "done" });
  return {
    text: state.step
      ? `Got it. Your first step: ${toYou(lowerFirst(stripEnd(state.step)))}. I'll ask you about it next time.`
      : "That's okay. When a first step comes to you, just tell me and I'll hold onto it.",
    messageType: "text",
    finished: true,
  };
}

// Goals are actions, not thinking tasks.
const REFLECTIVE = /^(reflect|explore|understand|think( about)?|figure out|learn (why|more)|consider|discover|journal about)\b/i;
// "being on time for work" -> "Be on time for work".
// Doubt tails are cut ("finish my book. honestly not sure why i bother" ->
// "Finish my book"), swearing removed, "I want to" dropped.
export function goalFromIntention(intention: string): string {
  let t = stripSwears(intention ?? "").split(/[.!?;]|,?\s+(?:but|honestly|idk|not sure|though|lol|tbh|i guess|i think|whatever)\b|\s+-\s+/i)[0] ?? "";
  t = stripEnd(t.trim()).replace(/^(i (really )?(want|need|would like|wanna|am trying|'?m trying|plan) to|my goal is( to)?|to)\s+/i, "");
  t = t.replace(/^being\b/i, "be").replace(/^getting\b/i, "get").replace(/^finishing\b/i, "finish").replace(/^writing\b/i, "write").replace(/^starting\b/i, "start");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Anger aimed at Jai or the app during setup.
const AT_JAI = /\b(fuck (you|off)|ignor(e|ing) me|you('?re| are)? not (\w+ )?(listening|helping|here)|robot(ic)?|glitch|dumb ?ass)\b/i;

// A real stake named in the journal, e.g. "i almost got fuckin fired" ->
// "you almost got fuckin fired".
const STAKE = /\bi (almost|nearly|could have|was about to) (got |get |been |be )?(\w+ )?(fired|let go|evicted)\b|\bi (almost|nearly) lost (my|the) (job|house|place)\b|\bi (really )?need (the|those|these|my) (hours|job|money|paycheck)\b|\bi can'?t (afford to )?lose (this|my|the) job\b/i;
export async function journalStake(userId: string): Promise<string | undefined> {
  const journal = await storage.getGroundingJournalEntries(userId).catch(() => []);
  const chat = (await storage.getMessages(userId).catch(() => [])).filter((m) => m.sender === "user").map((m) => m.text);
  for (const e of [...journal, { prompts: chat.map((response) => ({ response })), userFollowUpResponse: "" } as any]) {
    const texts = [...((e.prompts as { response?: string }[]) ?? []).map((p) => p.response ?? ""), e.userFollowUpResponse ?? ""];
    for (const t of texts) {
      const m = STAKE.exec(t);
      if (m) return toYou(m[0].toLowerCase().replace(/^i\b/, "I"));
    }
  }
  return undefined;
}

// States the setup script never answers; the chat does (see momentReader).
const STEP_ASIDE: ReadonlySet<MomentState> = new Set<MomentState>([
  "frustrated_at_jai", "hostile", "correction", "app_question", "overwhelm", "quit_talk", "doubt", "sarcasm",
]);

const SWEAR_WORDS = /\b(fuck\w*|f\*+k\w*|shit\w*|damn\w*|goddamn|bullshit|ass(hole)?|hell|crap|bitch\w*)\b/gi;
export function stripSwears(t: string): string {
  return t.replace(SWEAR_WORDS, "").replace(/\s{2,}/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
}
// A why worth saving: their words, swearing removed, not anger at Jai, not
// just the goal said again ("finish my damn goal"), not "idk".
export function cleanWhy(raw: string): string {
  const t = stripSwears(stripEnd(raw ?? ""));
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 2) return "";
  if (AT_JAI.test(raw) || /\b(this app|you('?re| are)|fuck (you|this|off))\b/i.test(raw)) return "";
  if (/\bgoal\b/i.test(t) && words.length <= 5) return "";
  if (/^(idk|i don'?t know|not sure|whatever|nothing|because)\b/i.test(t)) return "";
  return t;
}

// Setup in progress with no goal planted: what chat needs to stay honest and
// to invite them back once, at a calm moment.
export async function pendingSetupForChat(userId: string, calm: boolean): Promise<{ stage: string; title?: string; question: string; mayInviteBack: boolean } | undefined> {
  const user = await storage.getUser(userId);
  const state = user ? getState(user) : null;
  if (!state || !ACTIVE_STAGES.includes(state.stage) || state.plantedGoalId) return undefined;
  const recent = state.invitedBackAt && Date.now() - new Date(state.invitedBackAt).getTime() < 12 * 60 * 60 * 1000;
  const mayInviteBack = calm && !recent;
  // If chat invites them back, their next line may be the answer.
  await saveState(userId, { ...state, awaiting: mayInviteBack, ...(mayInviteBack ? { invitedBackAt: new Date().toISOString() } : {}) });
  return { stage: state.stage, title: state.title, question: questionFor(state.stage, state).replace(/ That's your .*$/, ""), mayInviteBack };
}

// ─── Plant from chat ("plant the damn thing", "now set the goal") ─────────
const WHY_MARKER = /\b(because|cuz|cause|money|so i|so that|for my|for the|i need|need the|sick of|tired of|matters|my (kids?|family|son|daughter|job))\b/i;

/**
 * Plants the goal right now, from what they've already said: the goal they
 * stated (this message, the setup in progress, or their journal), and a why
 * from their own reasons or stake (never an angry line). Returns null if a
 * goal already exists or there's nothing to plant.
 */
export async function plantFromChat(
  userId: string,
  text: string,
  recentUserTexts: string[],
  stakeFromMoment: string,
  opts: { localDate?: string; userTimezone?: string },
): Promise<GoalSetupReply | null> {
  const user = await storage.getUser(userId);
  if (!user || (await storage.getActiveGoals(userId)).length > 0) return null;
  const state = getState(user);
  // A goal named in this message ("plant the damn thing. finish the book").
  // The clearest goal clause: this message first, then their recent lines.
  const named = (text.match(/\b(?:my (?:real |actual )?goal is|goal:|the goal is)\s+(?:to\s+)?([^.!?\n]+)/i)?.[1] ?? "").trim();
  // The wording Jai just proposed wins over anything else in a plant
  // instruction ("plant the damn goal. stop asking me if it sounds like me").
  const proposed = state && ["wording", "why", "new_goal", "confirm"].includes(state.stage) ? (state.title || state.suggestion?.goal || "") : "";
  const stated = (named ? goalClauseFrom(text) : "") || proposed || goalClauseFrom(text) || recentUserTexts.slice(-6).reverse().map(goalClauseFrom).find(Boolean) || "";
  let title = stated || (state?.title && isGoalClause(state.title) ? state.title : "");
  if (!title) {
    // Their own goal field (the journal intention) is the title when it reads
    // as a goal ("start a small vegetable garden i guess" -> "Start a small
    // vegetable garden").
    const journal = await storage.getGroundingJournalEntries(userId).catch(() => []);
    const intention = ((journal.find((e) => e.session === "intention")?.prompts as { response?: string }[] | undefined)?.[0]?.response ?? "").trim();
    const fromField = intention ? goalFromIntention(intention) : "";
    if (fromField && isGoalClause(fromField)) title = fromField;
  }
  if (!title) {
    // Not clear: propose one line and ask yes or no before planting.
    const suggestion = await suggestGoalFromMemory(userId).catch(() => null);
    const proposal = suggestion?.goal ? goalFromIntention(suggestion.goal) : "";
    if (!proposal) return null;
    const base: GoalSetupState = state ?? { stage: "wording", source: "chat", suggestion: null, lastOfferedAt: new Date().toISOString() };
    await saveState(userId, { ...base, stage: "wording", title: proposal, suggestion: { goal: proposal, because: "" }, awaiting: true });
    return { text: `Here's how I'd word it: ${proposal}. Plant it like that? Say yes, or tell me how you'd say it.`, messageType: "text" };
  }
  title = goalFromIntention(title.replace(/\s+(because|cause|cuz|since|so that)\b.*$/i, ""));
  if (!title) return null;
  const said = state?.why || recentUserTexts.slice(-6).reverse().map((t) => (WHY_MARKER.test(t) ? cleanWhy(t) : "")).find(Boolean) || "";
  const stake = stakeFromMoment ? toYou(stakeFromMoment.toLowerCase().replace(/^i\b/, "I")) : (state?.stake ?? (await journalStake(userId)));
  const why = said || (stake ? asTheySaidIt(stripSwears(stake)) : "");
  const base: GoalSetupState = state ?? { stage: "why", source: "chat", suggestion: null, lastOfferedAt: new Date().toISOString() };
  return plantAfterWhy(userId, user.name, { ...base, stage: "why", title, why, whyFromStake: !said && !!why }, opts);
}

// ─── Goal clauses, reasons, retitling ───────────────────────────────────────
const META = /^(i mean|no\b|nah\b|nope\b|that'?s not|not\b|like i said|i said|exactly|ok\b|okay\b|so\b|listen\b|look\b|bro\b|ugh\b|whatever\b)|\b(exactly what i said|what i said|i just said|you know what i mean)\b/i;
const GOAL_VERB = /\b(grow|keep|plant|finish|write|start|be|get|lose|run|walk|save|build|learn|read|cook|clean|stop|quit|eat|sleep|wake|train|lift|exercise|work out|practice|launch|open|make|pay|organize|show up|leave|go|do|play|study|meditate|journal|drink|cut|track)\b/i;
export function isGoalClause(x: string): boolean {
  const t = (x ?? "").trim();
  if (!t || /\?\s*$/.test(t) || META.test(t)) return false;
  if (/\b(asking me|ask me|sounds like|tell me|told me|you|jai|this app)\b/i.test(t)) return false;
  if (/\b(plant|set|lock|save)\b.{0,25}\b(goal|it|this|that|thing)\b/i.test(t)) return false;
  const words = t.split(/\s+/);
  // "finish my (damn) goal" is a request, not a goal.
  if (/\b(goal|it|thing|this|that)\s*$/i.test(t.replace(/[.!]+$/, "")) && words.length <= 5) return false;
  return words.length >= 3 && words.length <= 16 && GOAL_VERB.test(t) && !/\b(you|this app|jai)\b/i.test(t);
}
// "plant the damn goal. grow three tomato plants and keep them alive." ->
// "Grow three tomato plants and keep them alive"; also "my goal is X".
export function goalClauseFrom(text: string): string {
  const named = (text ?? "").match(/\b(?:my (?:real |actual )?goal is|goal:|the goal is)\s+(?:to\s+)?([^.!?\n]+)/i)?.[1];
  // Their own words after "my goal is" count even without a verb.
  if (named && named.trim().split(/\s+/).length >= 2 && !META.test(named.trim()) && !/\?/.test(named)) return goalFromIntention(named);
  for (const part of (text ?? "").split(/(?<=[.!?])\s+|\n+/)) {
    const c = goalFromIntention(part);
    if (isGoalClause(c)) return c;
  }
  return "";
}
// The reason in their words ("why: money. I'm tired of paying $5 a pound"),
// never the goal said again.
export function whyFrom(text: string, title?: string): string {
  const raw = (text ?? "").replace(/^\s*(why( it matters)?|because|cuz|cause)\s*[:,-]?\s*/i, "").trim().replace(/[.!\s]+$/, "");
  // Validated by cleanWhy (not anger, not "idk"), but kept exactly as typed.
  if (!cleanWhy(raw)) return "";
  const w = raw;
  const tw = new Set((title ?? "").toLowerCase().match(/[a-z]{4,}/g) ?? []);
  const ww = w.toLowerCase().match(/[a-z]{4,}/g) ?? [];
  if (tw.size && ww.length && ww.filter((x) => tw.has(x)).length / ww.length >= 0.6) return "";
  return w;
}

/**
 * "That's not my goal, my goal is X" / "change my goal to X" / "my why is Y":
 * fixes the planted goal (and its Memory chip) and says what changed. When
 * they only say it's wrong, proposes the fix and applies it on "yes".
 */
export async function fixGoalFromChat(userId: string, text: string, recentUserTexts: string[]): Promise<string | null> {
  const goals = await storage.getActiveGoals(userId);
  const goal = goals[0];
  if (!goal) return null;
  const user = await storage.getUser(userId);
  const state = user ? getState(user) : null;
  const apply = async (title?: string, why?: string) => {
    const patch: Record<string, string> = {};
    if (title) patch.title = title;
    if (why !== undefined) patch.emotionalWhy = why;
    await storage.updateGoal(goal.id, patch as any);
    if (title) {
      const chip = (await storage.getEntries(userId)).find((e) => e.summary === `Goal planted: ${goal.title}`);
      if (chip) await storage.updateEntry(chip.id, { summary: `Goal planted: ${title}` }).catch(() => {});
    }
    if (state?.pendingFix) await saveState(userId, { ...state, pendingFix: undefined });
    return [title ? `Your goal is now: ${title}.` : "", why ? `Your why: "${stripEnd(why)}".` : ""].filter(Boolean).join(" ");
  };
  // "yes" to a proposed fix.
  if (state?.pendingFix && /^\s*(yes|yeah|yep|yup|do it|sure|ok(ay)?|fix it|please)\b/i.test(text)) {
    return `Done. ${await apply(state.pendingFix.title, state.pendingFix.why)}`;
  }
  const newTitle = /\b(not my goal|change (my|the) goal|goal (title )?(is|should be) wrong|wrong goal|retitle|rename (my|the) goal|my (real |actual )?goal is)\b/i.test(text) ? goalClauseFrom(text) : "";
  const whyMatch = text.match(/\b(?:my why is|why should be|change (?:my|the) why to)\s+([^\n]+)/i)?.[1];
  const newWhy = whyMatch ? whyFrom(whyMatch, newTitle || goal.title) : "";
  if (newTitle || newWhy) return `Done. ${await apply(newTitle || undefined, newWhy || undefined)}`;
  // "you got my goal title wrong and saved my why wrong": propose the fix.
  const titleWrong = /\b(goal|title)\b.{0,30}\b(wrong|not right|messed up|incorrect)\b|\bwrong (goal|title)\b/i.test(text);
  const whyWrong = /\bwhy\b.{0,30}\b(wrong|not right|messed up|incorrect)\b/i.test(text);
  if (!titleWrong && !whyWrong) return null;
  const pTitle = titleWrong ? recentUserTexts.slice(-10).reverse().map(goalClauseFrom).find((x) => x && x !== goal.title) : undefined;
  const pWhy = whyWrong ? recentUserTexts.slice(-10).reverse().map((t) => (/\b(why|because|cuz|money|tired of|sick of|need)\b/i.test(t) ? whyFrom(t, pTitle || goal.title) : "")).find(Boolean) : undefined;
  if (!pTitle && !pWhy) {
    return titleWrong ? "Tell me your goal the way you'd say it, and I'll change it right now." : "Tell me why it matters in your words, and I'll save that instead.";
  }
  if (state) await saveState(userId, { ...state, pendingFix: { title: pTitle, why: pWhy } });
  else await saveState(userId, { stage: "done", source: "chat", suggestion: null, pendingFix: { title: pTitle, why: pWhy } } as GoalSetupState);
  const parts = [pTitle ? `change your goal to "${pTitle}"` : "", pWhy ? `save your why as "${stripEnd(pWhy)}"` : ""].filter(Boolean).join(" and ");
  return `You're right. Want me to ${parts}? Say yes and I'll fix it.`;
}

// A stake kept for the question in second person ("you need the hours") is
// saved as a why the way they said it ("I need the hours"), every word.
function asTheySaidIt(t: string): string {
  return t.replace(/\byou're\b/gi, "I'm").replace(/\byou are\b/gi, "I am").replace(/\byourself\b/gi, "myself").replace(/\byour\b/gi, "my").replace(/\byou\b/gi, "I");
}
