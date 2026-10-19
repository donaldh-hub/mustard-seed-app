import OpenAI from "openai";
import { storage } from "./storage";
import { plantGoal } from "./goalPlanting";
import { HEARTBEAT_NAMES } from "./titan";
import { releaseHeldPhotos } from "./photoReview";

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

export type GoalSetupStage = "offered" | "wording" | "new_goal" | "why" | "step" | "date" | "confirm" | "declined" | "done";

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

const ACTIVE_STAGES: GoalSetupStage[] = ["offered", "wording", "new_goal", "why", "step", "date", "confirm"];

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
  return suggestGoalFromLines(lines);
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
          content: `From this person's own records, find the ONE thing they keep coming back to that would make a good first goal. Use their words and their goal — never invent one. If nothing clearly points to a goal, return {"goal": "", "because": ""}.
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
  await saveState(userId, { stage: "offered", source, suggestion, lastOfferedAt: new Date().toISOString() });
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
  why: (s: GoalSetupState) => `${whyQuestion(s.title)} That's your Clarity of Vision & Why, the reason you'll come back to on the hard days.`,
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
  const t = stripEnd((title ?? "").replace(/^i\s+(want|need|would like|will|'?m going|am going|plan)\s+to\s+/i, ""));
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
): Promise<GoalSetupReply | null> {
  const user = await storage.getUser(userId);
  if (!user) return null;
  const state = getState(user);
  if (!state || !ACTIVE_STAGES.includes(state.stage)) return null;
  const plantedStepOpen = state.stage === "step" && !!state.plantedGoalId;
  if (!plantedStepOpen && (await storage.getActiveGoals(userId)).length > 0) {
    await saveState(userId, null);
    return null;
  }

  const ask = (next: GoalSetupState, prefix = ""): GoalSetupReply => ({
    text: `${prefix}${questionFor(next.stage, next)}`,
    messageType: next.stage === "confirm" ? GOAL_CONFIRM_MESSAGE : next.stage === "offered" ? GOAL_OFFER_MESSAGE : "text",
  });
  const move = async (next: GoalSetupState, prefix = "") => {
    await saveState(userId, next);
    return ask(next, prefix);
  };

  const r = await interpret(state.stage, questionFor(state.stage, state), text);

  if (r.intent === "not_yet") {
    await saveState(userId, { ...state, stage: "declined" });
    return { text: "No pressure at all. When you're ready, I'm here, and we can set it up in a couple of minutes.", messageType: "text" };
  }
  const comeBack = (lead: string): GoalSetupReply => ({
    text: `${lead} ${RETURN_TO[state.stage]?.(state) ?? questionFor(state.stage, state)}`.trim(),
    messageType: "text",
  });
  if (r.intent === "app_help") return comeBack(APP_GUIDE);
  if (r.intent === "off_topic") {
    // At the offer, let the normal conversation answer; the offer comes back
    // at the next chat open. Mid-setup, answer briefly, then come back.
    if (state.stage === "offered") {
      await saveState(userId, { ...state, stage: "declined" });
      return null;
    }
    return comeBack(r.reply || "Thanks for telling me.");
  }
  if (r.intent === "question") {
    return r.reply ? comeBack(r.reply) : ask(state);
  }

  switch (state.stage) {
    case "offered": {
      if (r.intent === "yes" && state.suggestion) return move({ ...state, stage: "wording", title: state.suggestion.goal });
      if (r.intent === "different" && r.value) return move({ ...state, stage: "why", title: r.value });
      if (r.intent === "answer" && r.value && r.value.split(" ").length >= 2) return move({ ...state, stage: "why", title: r.value });
      return move({ ...state, stage: "new_goal" });
    }
    case "wording": {
      if (r.intent === "different") return move({ ...state, stage: r.value ? "why" : "new_goal", title: r.value || state.title });
      const title = r.intent === "answer" && r.value ? r.value : state.title ?? state.suggestion?.goal ?? "";
      return move({ ...state, stage: "why", title });
    }
    case "new_goal": {
      if (!r.value) return ask(state);
      return move({ ...state, stage: "why", title: r.value });
    }
    case "why":
      return plantAfterWhy(userId, user.name, { ...state, why: r.intent === "skip" ? "" : r.value || text.trim() }, opts);
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
      return plant(userId, user.name, state, opts);
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
  const why = state.why ? `\n\nWhy it matters: ${toYou(stripEnd(state.why))}` : "";
  if (step) {
    return { ...planted, text: `${planted.text.replace("I'll ask you about it next time.", "That's the step you set in your journal, and I'll ask you about it next time.")}${why}` };
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
  };
}
