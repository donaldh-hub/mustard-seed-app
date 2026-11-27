// Moment Reader: one shared step before Jai replies in chat. It reads the
// user's last message (with the last few for context) and names ONE primary
// state. It never writes the reply; it tells the reply what to do first.
// The robotic part lives here, in the background; the user only sees the
// reply that comes out of it.

import OpenAI from "openai";
import { goalClauseFrom } from "./goalSetup";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export const MOMENT_STATES = [
  "engaged", "reported_action", "flat", "doubt", "frustrated_self", "frustrated_at_jai", "overwhelm",
  "sarcasm", "hostile", "quit_talk", "stake", "app_question", "correction",
] as const;
export type MomentState = (typeof MOMENT_STATES)[number];

// Tension meter: how upset they are, read from the theme of the last few
// messages, not one line. green = frustrated but working with Jai; yellow =
// moderately upset; red = very upset. Self-harm is handled separately by the
// safety screen and is never decided here.
export type Tension = "green" | "yellow" | "red";
// What they're trying to get done, inferred even from fragments.
export const MOMENT_INTENTS = ["none", "finish_goal", "goal_status", "change_goal", "pause", "vent", "ask_help"] as const;
export type MomentIntent = (typeof MOMENT_INTENTS)[number];

export interface Moment {
  state: MomentState;
  tension: Tension;
  intent: MomentIntent;
  stake: string; // their words, if they named a real stake ("I almost got fired")
  question: string; // a direct question they asked, if any
  hostileStreak: number; // hostile / at-Jai messages in a row, this one included
}

// Keyword read, used when the AI read fails and to count a hostile streak.
const AT_JAI = /\b(you('?re| are)? (not|never) (\w+ )?(listening|understanding|helping|getting it|here)|you (don'?t|do not|never) (listen|understand|get it)|(gon|going to|gonna) ignore me|ignor(e|ing) me|robot(ic)?|preprogrammed|this app|fuck (you|off)|useless)\b/i;
const AIMED_AT_JAI = /\b(you|u|ya|your|jai|app|robot\w*|preprogrammed|bot)\b|\bthis (is|feels|seems) (so )?(useless|stupid|pointless|dumb|garbage|trash|a waste)/i;
const HOSTILE_ONLY = /^\W*(fuck (you|off|this|it)|f(u|\*)?ck off|stfu|shut up|whatever|bs|bullshit)\W*(fuck (you|this|it)\W*)*$/i;
const CORRECTION = /\b(i (didn'?t|did not|never) (say|mean|said)|that'?s not what i (said|meant)|you('?re| are) (wrong|twisting)|wtf (are )?you talking about|not what i meant)\b/i;
const QUIT = /\b(i('?m| am)? (gonna|going to|might|may)( just)? (quit|give up|stop)|i quit\b|give up\b|what'?s the point)/i;
const OVERWHELM = /\b(too much|a lot of (questions|stuff)|overwhelm\w*|can'?t keep up|drowning|everything at once)\b/i;
const DOUBT = /\b(don'?t see how|doesn'?t (help|work)|pointless|won'?t (fix|change|help)|what good)\b/i;
const FLAT = /^\W*(idk|i don'?t know|nothing( really)?|not sure|meh|ok|okay|fine|havent tried|haven'?t tried|no)\W*$/i;
const SARCASM = /\bcan'?t believe i'?m\b|\byeah right\b|\bsure,? (jan|buddy)\b|\bwow,? (great|thanks)\b/i;
const STAKE = /\b((almost|nearly) (got|get|been|getting) (\w+ )?fired|(almost|nearly) lost (my|the) job|(could|might) lose (my|the) job|doctor (said|told)|kids? (need|depend))/i;
const APP_Q = /\?\s*$|^(why|what|how|where|can|do|does|is|are) /i;
const SELF = /\b(i('?m| am) (so )?(tired|sick) of|mad at myself|i keep (failing|messing))\b/i;

export function readMomentByWords(text: string, previousUserTexts: string[] = []): Moment {
  const t = (text ?? "").trim();
  let state: MomentState = "engaged";
  if (CORRECTION.test(t)) state = "correction";
  else if (HOSTILE_ONLY.test(t)) state = "hostile";
  else if (AT_JAI.test(t)) state = "frustrated_at_jai";
  else if (STAKE.test(t)) state = "stake";
  else if (QUIT.test(t)) state = "quit_talk";
  else if (OVERWHELM.test(t)) state = "overwhelm";
  else if (DOUBT.test(t)) state = "doubt";
  else if (SARCASM.test(t)) state = "sarcasm";
  else if (SELF.test(t)) state = "frustrated_self";
  else if (FLAT.test(t)) state = "flat";
  else if (APP_Q.test(t)) state = "app_question";
  const stake = t.match(STAKE)?.[0] ?? "";
  const streak = hostileStreak(state, previousUserTexts);
  const ask = /\?\s*$/.test(t) || DIRECT_ASK.test(t);
  return { state, tension: tensionFor(state, streak), intent: DIRECT_ASK.test(t) ? "ask_help" : intentByWords(t), stake, question: ask ? t : "", hostileStreak: streak };
}

function tensionFor(state: MomentState, streak: number): Tension {
  if (state === "hostile" || streak >= 2) return "red";
  if (["frustrated_at_jai", "frustrated_self", "overwhelm", "doubt", "quit_talk", "sarcasm", "correction"].includes(state)) return "yellow";
  return "green";
}
// "plant the damn thing", "now set the goal", "lock it in", "make it official".
const FINISH_GOAL = /\b(plant|set|lock in|save|finish setting up|finish the setup)\b.{0,25}\b(goal|it|this|that|thing)\b|\b(finish|plant|set( it)? up|make|lock in|just do)\b.{0,25}\bgoal\b|\b(lock|set) it in\b|\bmake it official\b|\bgoal\b.{0,15}\b(done|finished)\b/i;
const GOAL_STATUS = /\b(what happened to|where'?s|where is|did you (save|plant)|is there|do i (have|even have))\b.{0,20}\bgoal\b/i;
function intentByWords(t: string): MomentIntent {
  if (FINISH_GOAL.test(t)) return "finish_goal";
  if (GOAL_STATUS.test(t)) return "goal_status";
  if (/\b(pause|stop|take a break|not now|later)\b/i.test(t) && t.split(/\s+/).length <= 6) return "pause";
  return "none";
}

function hostileStreak(state: MomentState, previousUserTexts: string[]): number {
  if (state !== "hostile" && state !== "frustrated_at_jai") return 0;
  let n = 1;
  for (const prev of [...previousUserTexts].reverse()) {
    if (HOSTILE_ONLY.test(prev.trim()) || AT_JAI.test(prev)) n++;
    else break;
  }
  return n;
}

export async function readMoment(text: string, recent: { sender: string; text: string }[]): Promise<Moment> {
  const previousUserTexts = recent.filter((m) => m.sender === "user").map((m) => m.text).slice(-4);
  const byWords = readMomentByWords(text, previousUserTexts);
  try {
    const transcript = recent.slice(-6).map((m) => `${m.sender === "user" ? "User" : "Jai"}: ${m.text}`).join("\n");
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      max_tokens: 160,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You read the user's LAST message in a coaching chat with Jai and name ONE primary state. You never write a reply.
States:
- engaged: a real answer, update or thought
- reported_action: they say they did a specific thing toward their goal
- flat: thin or empty ("idk", "nothing really", "havent tried")
- doubt: doubts the process helps ("I don't see how writing this fixes anything")
- frustrated_self: frustrated with themselves or their situation. Swearing about their situation ("this is some bullshit, I'm so damn tired of being late") is frustrated_self, NOT frustrated_at_jai
- frustrated_at_jai: complaint, blame or insult aimed at Jai or the app ("you're not listening", "robotic", "you just gon ignore me?")
- overwhelm: too much, a lot, can't keep up
- sarcasm: exasperated or sarcastic ("i cant believe im getting this done")
- hostile: profanity or insult with no other content ("fuck off")
- quit_talk: says they may quit or give up
- stake: names a real stake ("I almost got fired", a health scare)
- app_question: asks how the app or Jai works, or what it saves
- correction: says Jai got them wrong ("I didn't say that")
Swearing alone is a tone signal, not hostility, if there is other content. If a stake appears anywhere in the message, choose stake unless the message is a correction or aimed at Jai.
People type the way they talk, often in fragments, often already upset before they arrived. Infer; don't wait for clear context.
Also read:
- "tension": the overall heat of the recent conversation's theme (not just this line): "green" (frustrated or flat but still working with Jai), "yellow" (moderately upset: repeated frustration, sarcasm, doubt, feeling unheard), "red" (very upset: hostile, insulting, ready to quit on Jai, several angry lines in a row).
- "intent": what they're trying to get done: "finish_goal" (wants the goal set up or planted now, e.g. "finish my damn goal"), "goal_status" (asks where their goal is), "change_goal", "pause" (wants to stop for now), "vent" (needs to be heard, no task), "ask_help" (wants a suggestion), or "none".
Return JSON: {"state": "...", "tension": "green|yellow|red", "intent": "...", "stake": "their exact words for the stake or empty", "question": "the direct question they asked or empty"}`,
        },
        { role: "user", content: `Recent chat:\n${transcript || "(none)"}\n\nLAST message: ${text}` },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    let state = (MOMENT_STATES as readonly string[]).includes(parsed.state) ? (parsed.state as MomentState) : byWords.state;
    // "At Jai" needs words aimed at Jai or the app; otherwise it's about their situation.
    if (state === "frustrated_at_jai" && !AIMED_AT_JAI.test(text)) state = "frustrated_self";
    const streak = hostileStreak(state, previousUserTexts);
    const order: Tension[] = ["green", "yellow", "red"];
    const aiTension: Tension = order.includes(parsed.tension) ? parsed.tension : byWords.tension;
    // The meter never reads cooler than the words themselves.
    const tension = order[Math.max(order.indexOf(aiTension), order.indexOf(tensionFor(state, streak)))];
    // "finish_goal" acts (it plants the goal), so only their own words set it.
    const aiIntent: MomentIntent = (MOMENT_INTENTS as readonly string[]).includes(parsed.intent) && parsed.intent !== "finish_goal" ? parsed.intent : "none";
    const intent: MomentIntent = byWords.intent !== "none" ? byWords.intent : aiIntent;
    return {
      state,
      tension,
      intent,
      stake: typeof parsed.stake === "string" && parsed.stake ? parsed.stake : byWords.stake,
      // "just tell me what to buy first" is a question even without "?".
      question: byWords.question || (typeof parsed.question === "string" ? parsed.question : ""),
      hostileStreak: streak,
    };
  } catch (err) {
    console.warn("[MOMENT] AI read failed; using word read:", err instanceof Error ? err.message : err);
    return byWords;
  }
}

// States where a canned branch (log confirmations, obstacle lines, goal
// status) must step aside so the reply answers the moment.
export const ANSWER_THE_MOMENT: ReadonlySet<MomentState> = new Set([
  "correction", "frustrated_at_jai", "hostile", "app_question", "overwhelm", "quit_talk", "sarcasm", "doubt", "flat",
]);

// What the reply must do for each state. Heartbeat named only where it fits.
export const PLAYBOOK: Record<MomentState, string> = {
  engaged: "Respond to what they actually said, in their words. One question or one small step tied to their goal.",
  reported_action: "Name the specific thing they did (only what they said they did). One short question about what helped, or what's next.",
  flat: "Say a flat day is okay. Ask a smaller, easier question. If a Heartbeat fits, it's Small Steps + Consistency.",
  doubt: "Agree honestly that writing alone won't fix it. Say in one line what it's for (seeing the pattern so the next step is the right one). Ask for one concrete thing. If a Heartbeat fits, it's Mindset over Method.",
  frustrated_self: "Reflect the frustration as proof this matters to them. No pep talk. Offer one small step. If a Heartbeat fits, it's Small Steps + Consistency.",
  frustrated_at_jai: "Stop coaching. Never open with \"Fair. I may be missing something.\" Your first sentence reuses a few of their exact words and owns it, e.g. \"you said that already\" -> \"You're right, I did say that already.\"; \"this is useless\" -> \"If this feels useless right now, that's on me.\"; \"you sound like a fortune cookie\" -> \"Fair, I've been sounding like a fortune cookie.\" Then ask one question: what you're missing, or something more specific to what they said. Fresh words every time. Never call it confusion, never \"sorry for any confusion\", never name a Heartbeat.",
  overwhelm: "Shrink it. Say they don't have to do it all. Offer a one-line option (\"just tell me one word for today\"). If a Heartbeat fits, it's Small Steps + Consistency.",
  sarcasm: "Take the feeling under the words, plainly. Never praise the words or the effort. One small, easy question.",
  hostile: "Stay calm. One or two short sentences in your own words: you heard them, you're still here. No scolding, no comment on language, no coaching, no goal talk.",
  quit_talk: "Name it plainly. Ask what makes the hard days hard, so you can plan for the hard day together. If a Heartbeat fits, it's Mindset over Method.",
  stake: "Say the stake is real, in their words. Treat it as their why. Build one small first step around it. If a Heartbeat fits, it's Clarity of Vision & Why.",
  app_question: "Answer the question plainly and truthfully from what the app actually does (below). Never invent a feature. If you don't know, say so.",
  correction: "Own it in one line in your own words (you jumped, misread, or assumed), say plainly what you actually heard if it helps, then ask what they meant. Two or three sentences. Nothing else.",
};

export const APP_FACTS = `What the app actually does (answer app questions only from this):
- Jai saves journal answers, check-ins, goal steps and photos so it can remember the goal and notice patterns. All of it shows in Memory (the calendar tab).
- There's no way to delete a single entry yet. Profile > Export My Data downloads everything.
- Growth shows goals and the tree; water comes from real actions toward a goal.
- Home shows today's step and the Weekly Review when a week of real actions is in.
- Profile shows the name, the main struggle, and settings.`;

// Hard rules applied to the chat reply after the model writes it.
const LEDGER = /\b(logged|on the record|lost this round|you delivered|day \d+)\b/i;
const SWEARS = /\b(fuck\w*|shit\w*|damn\w*|bullshit|ass)\b/i;
const HEARTBEATS = ["Clarity of Vision & Why", "Small Steps + Consistency", "Mindset over Method", "Feedback & Adaptation", "Courageous Action"];
const PRAISE = /\b(great job|well done|proud of you|impressive|amazing|awesome|nice work|good job|that'?s a win|keep pushing|push through)\b/i;

export function opener(text: string): string {
  return (text ?? "").toLowerCase().replace(/[^a-z' ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 4).join(" ");
}

export function enforceChatRules(reply: string, moment: Moment, recentJai: string[] = [], userText = ""): string {
  const tired = TIRED.test(userText);
  const recentOpeners = recentJai.slice(-5).map(opener);
  const parts = (reply ?? "").split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim());
  let heartbeat: string | null = null;
  const kept = parts.filter((s) => {
    if (LEDGER.test(s) || SWEARS.test(s)) return false;
    if (moment.state !== "reported_action" && moment.state !== "engaged" && PRAISE.test(s)) return false;
    if (/\bis a gap\b/i.test(s) && (moment.state === "frustrated_at_jai" || moment.state === "hostile")) return false;
    const names = HEARTBEATS.filter((h) => s.includes(h));
    if (names.length > 1) return false;
    if (names.length === 1) {
      if (moment.state === "frustrated_at_jai" || moment.state === "hostile" || moment.state === "correction") return false;
      if (heartbeat && heartbeat !== names[0]) return false;
      heartbeat = names[0];
    }
    return true;
  });
  let out = kept.join(" ").replace(/\s+/g, " ").trim();
  const sents = () => out.split(/(?<=[.!?])\s+/).filter(Boolean);
  const used = (line: string) => recentJai.some((t) => t.includes(line)) || recentOpeners.includes(opener(line));
  const freshOwn = () => OWN_LINES.find((l) => !used(l)) ?? OWN_LINES[recentJai.length % OWN_LINES.length];
  const offeredControl = recentJai.slice(-3).some((t) => t.includes(CONTROL));
  const askedMissing = recentJai.slice(-1).some((t) => /what am i missing\?/i.test(t));
  if (moment.state === "frustrated_at_jai" || moment.state === "hostile") {
    // Own it first, in words not used this session.
    const first = sents()[0] ?? "";
    const owned = OWNED.test(first) && first.length > 8 && !used(first) && !/missing something/i.test(first);
    const rest = sents().slice(1).filter((s) => !/\?$/.test(s) && !OWNED.test(s) && !/let me know|missing something/i.test(s));
    const hostileLine = HOSTILE_LINES.find((l) => !used(l)) ?? HOSTILE_LINES[recentJai.length % HOSTILE_LINES.length];
    const own = moment.state === "hostile" ? hostileLine : owned ? first : freshOwn();
    // One calm line (+ one plain line for a complaint), then one question.
    const wantsControl = moment.hostileStreak >= 2 && !offeredControl && (askedMissing || moment.state === "hostile");
    const body = moment.state === "hostile" || wantsControl ? [own] : [own, ...rest.slice(0, 1)];
    // Worn out: offer to stop, ask nothing.
    const ask = tired ? (/\b(stop|break|pause|rest)\b/i.test(body.join(" ")) ? "" : "We can stop here for tonight.") : wantsControl ? CONTROL : moment.state === "frustrated_at_jai" ? "What am I missing?" : "";
    out = [...body, ask].filter(Boolean).join(" ");
  } else {
    // A stake they named is named back, in plain words, once.
    if ((moment.state === "stake" || moment.stake) && !/\b(job|fired|work|lose|losing|real)\b/i.test(out)) {
      out = `${JOB_WORDS.test(moment.stake) ? "You came close to losing the job. That's real." : "That's a real stake."} ${out}`;
    }
    // Not aimed at Jai: no apology or "what am I missing" (that's for complaints about Jai).
    out = sents().filter((s) => !/what am i missing|missing something/i.test(s)).join(" ");
  }
  return out.replace(/\s+/g, " ").trim();
}

const HOSTILE_LINES = [
  "I'm still here.",
  "Heard. I'm not going anywhere.",
  "Okay. I'm here when you want to pick it back up.",
  "Understood. No pressure from me right now.",
];
const JOB_WORDS = /\b(fired|job|work|boss)\b/i;
const CONTROL = "Want to keep going, keep it short, or pause for today?";
const OWNED = /\b(fair|missing|hear you|my fault|i jumped|you'?re right|not ignoring|got that wrong|on me|still here)\b/i;
const OWN_LINES = [
  "That's on me. I'm not getting it right yet.",
  "You're right to call that out.",
  "Okay. I hear that this isn't landing.",
  "I got that wrong, and I'd rather fix it than defend it.",
  "Fair point. I'm still here.",
  "I hear you. This isn't working for you right now.",
  "That's fair. I'd rather hear it than have you sit with it.",
  "Understood. I'm not going anywhere.",
  "You don't owe me patience. I'm still here.",
];

// ─── Checking a draft reply (the AI writes; code only checks) ──────────────
const STOP = new Set("the a an and or but so to of in on at for with my me i im i'm you your it is are was be this that what how why just not dont don't do did".split(" "));
const contentWords = (t: string) => (t.toLowerCase().match(/[a-z']{4,}/g) ?? []).filter((w) => !STOP.has(w) && !/^(fuck|shit|damn|bullshit)/.test(w));
const sentencesOf = (t: string) => (t ?? "").split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
const OWNS = /\b(fair|right|missed|miss|on me|hear you|heard|wrong|my bad|not ignoring|still here|jumped|misread|assumed|apolog|sorry)\b/i;

export interface ReplyCheckContext {
  userText: string;
  recentJai: string[]; // Jai's messages this session, oldest first
  afterSafety?: boolean; // the last Jai message was a crisis-resources message
  afterSafetyText?: string; // what they said that led to it
  goalPlanted?: boolean; // a goal record exists
  currentStep?: string; // the step already set (its size is kept)
  theirWords?: string; // their recent messages, joined
}

// Drops sentences that are never okay, whatever the state.
export function cleanChatReply(reply: string, moment: Moment, userText: string, theirWords = ""): string {
  const said = `${userText} ${theirWords}`.toLowerCase();
  return sentencesOf(reply).filter((s) =>
    !LEDGER.test(s) && !SWEARS.test(s)
    && !/\bthis (journal|app) (helps|is here|is about|is meant|is designed|can help)\b/i.test(s)
    // Feelings only in their words ("annoyed", not "overwhelmed").
    && !((s.match(FEELING_WORDS)?.[0] ?? "") && !said.includes((s.match(FEELING_WORDS)?.[0] ?? "").toLowerCase().slice(0, 6)))
    && !(/\bconfus/i.test(s) && !/\bconfus/i.test(userText))
    && !/sorry for any/i.test(s)
    && !(moment.state !== "reported_action" && moment.state !== "engaged" && PRAISE.test(s))
  ).join(" ").replace(/\s+/g, " ").trim();
}

// What's wrong with a draft, in plain words the model can fix on a retry.
export function checkChatReply(reply: string, moment: Moment, c: ReplyCheckContext): string[] {
  const problems: string[] = [];
  const sents = sentencesOf(reply);
  const questions = sents.filter((s) => /\?$/.test(s));
  const first = sents[0] ?? "";
  const heartbeats = HEARTBEATS.filter((h) => reply.includes(h));
  const userWords = contentWords(c.userText);
  const atJai = moment.state === "frustrated_at_jai" || moment.state === "hostile";
  if (!reply) problems.push("the reply is empty");
  if (heartbeats.length > 1) problems.push("name at most one Heartbeat");
  if (atJai && heartbeats.length) problems.push("don't name a Heartbeat to someone upset with you");
  if (questions.length > 1) problems.push("ask only one question");
  if (sents.length > 5) problems.push("keep it to 2-4 short sentences");
  const seenOpeners = c.recentJai.map(opener);
  if (seenOpeners.includes(opener(reply)) && !c.afterSafety) problems.push(`don't start with "${opener(reply)}", you already used that opening`);
  for (const s of sents) {
    if (s.split(/\s+/).length >= 5 && c.recentJai.some((t) => t.includes(s))) problems.push(`don't repeat "${s}", you already said it`);
  }
  if (moment.state === "frustrated_at_jai") {
    if (!OWNS.test(first)) problems.push("start by owning it in one calm line");
    if (userWords.length && !userWords.some((w) => reply.toLowerCase().includes(w))) problems.push(`use their words (e.g. "${userWords.slice(0, 3).join('", "')}")`);
    if (questions.length !== 1 || !/\?$/.test(sents[sents.length - 1] ?? "")) problems.push("end with exactly one question");
    if (sents.length > 3) problems.push("keep it to three sentences or fewer");
  }
  if (moment.state === "hostile") {
    if (sents.length > 2) problems.push("one or two short sentences only");
    if (/\b(goal|step|heartbeat)\b/i.test(reply)) problems.push("no coaching or goal talk right now");
  }
  if (/\bI may be missing something\b/i.test(reply)) problems.push("don't use the stock line \"I may be missing something\"; say what you actually missed, in their words");
  if (!atJai && /what am i missing|missing something/i.test(reply)) problems.push("they're not upset with you; don't apologize or ask what you're missing");
  if (moment.state === "correction" && (!OWNS.test(reply) || !questions.length)) problems.push("own that you got it wrong and ask what they meant");
  if ((moment.state === "stake" || moment.stake) && !atJai) {
    const stakeWords = contentWords(moment.stake);
    if (!/\b(job|fired|work|hours|lose|losing|rent|paycheck)\b/i.test(reply) && !stakeWords.some((w) => reply.toLowerCase().includes(w))) problems.push(`name their stake back plainly: "${moment.stake}"`);
  }
  if (moment.tension === "red" && moment.state !== "app_question" && moment.intent !== "finish_goal" && moment.intent !== "goal_status") {
    if (sents.length > 3) problems.push("very upset: two or three short sentences at most");
    if (/\b(your step|try (setting|laying|doing)|tonight,? (set|lay|try|do)|tomorrow,? (set|lay|try|do))\b/i.test(reply)) problems.push("very upset: no steps or tasks right now");
  }
  if ((moment.tension !== "green" || TIRED.test(c.userText)) && /\b(tonight|before bed|this evening)\b.{0,60}\b(cook\w*|laundry|prep\w*|clean\w*|pack\w*|lay(ing)? out|set(ting)? out|plan\w*)\b/i.test(reply) && !/\b(instead|skip|drop|less|lighter|smaller)\b/i.test(reply)) {
    problems.push("they're upset or stretched: don't add tasks to their evening; make it smaller or take something off");
  }
  // A direct ask ("just tell me", "yes or no") gets the answer first.
  if (moment.question && DIRECT_ASK.test(c.userText)) {
    if (/\?$/.test(first)) problems.push("they asked you to just tell them: answer in your FIRST sentence with one clear answer; don't turn it into a question");
    if (/\byes or no\b/i.test(c.userText) && !/^(yes|no|it depends)\b/i.test(first)) problems.push('they asked yes or no: start with "Yes." or "No." (or "It depends on …")');
  }
  if (/\bhow (do|did|does|would|might) (you|that|this|it) (feel|make you feel)|\bfeel more\b|\bhow are you feeling\b/i.test(reply) && FEEL_PUSHBACK_CHAT.test(`${c.userText} ${c.recentJai.length ? c.theirWords ?? "" : ""}`)) problems.push("they hate being told how to feel: ask about the action or the situation, never their feelings");
  if (/^(yes|no)[.,!]?\s+it depends\b/i.test(reply)) problems.push('don\'t say "Yes/No. It depends": pick one with a reason, or start with "It depends on …"');
  if (/\bwhat do you mean\b/i.test(reply) && goalClauseFrom(c.userText)) problems.push("they stated their goal clearly; don't ask what they mean");
  if (c.goalPlanted === false && /\b(it'?s planted|is planted|planted it|is set( up)?|it'?s set|locked in|your goal is now|as your goal|goal is saved)\b/i.test(reply)) {
    problems.push("no goal is planted yet: don't say or imply it is; say it isn't set up yet and offer to plant it now");
  }
  // One question, never one already asked or answered.
  for (const q of questions) {
    if (c.recentJai.slice(-6).some((t) => sentencesOf(t).some((p) => /\?$/.test(p) && sameQuestion(p, q)))) problems.push(`don't ask again: "${q}" was already asked`);
  }
  // Exhausted or "you keep asking": offer to stop, ask nothing.
  if (TIRED.test(c.userText) && questions.length && !/\b(stop|pause|rest|leave it|come back)\b/i.test(reply)) problems.push("they're worn out: offer to stop for tonight and don't ask anything");
  // Keep the step's size: never more minutes than the step already set.
  const stepMin = Number((c.currentStep ?? "").match(/(\d+)\s*min/i)?.[1] ?? 0);
  const replyMin = Math.max(0, ...[...reply.matchAll(/(\d+)\s*min/gi)].map((m) => Number(m[1])));
  if (stepMin && replyMin > stepMin && !/\b(more|longer|bigger|harder)\b/i.test(c.userText)) problems.push(`keep their step at ${stepMin} minutes; don't make it bigger`);
  if (/how did (it|that|the step) go|did you (do|get to|try) (it|the step)/i.test(reply) && c.currentStep && /^tomorrow/i.test(c.currentStep)) problems.push("don't ask how the step went before its day");
  if (c.afterSafety) {
    if (/\b988\b|741741/.test(reply)) problems.push("don't repeat the crisis resources");
    if (sents.length > 3 || !questions.length) problems.push("two or three sentences: own it, say what you heard, ask what they meant");
    if (c.afterSafetyText && !/\byou (said|wrote|told me)\b|\bwhen you said\b/i.test(reply)) problems.push(`say plainly what you heard and why you responded that way (e.g. "When you said '${c.afterSafetyText.slice(0, 60)}', I took it as…")`);
  }
  return problems;
}

export const TENSION_GUIDE: Record<Tension, string> = {
  green: "Tension: GREEN (frustrated or flat, still working with you). Normal coaching: name what they said, one small step or one question tied to their goal.",
  yellow: "Tension: YELLOW (moderately upset). Acknowledge the feeling first, in their words. Make any ask smaller. Never add new tasks to their day. No offers, no lists.",
  red: "Tension: RED (very upset). No coaching, no goal talk, no steps. Own it or stay present in one or two short sentences. Offer control (keep going, keep it short, or pause) if you haven't recently.",
};

const TIRED = /\b(exhausted|so tired|i'?m tired|worn out|too much|asks? (me )?(too much|so much)|keeps? asking (me )?(for )?more|enough questions|leave me alone|i'?m done for (today|tonight))\b/i;
function sameQuestion(a: string, b: string): boolean {
  const w = (t: string) => (t.toLowerCase().match(/[a-z']{4,}/g) ?? []).filter((x) => !STOP.has(x));
  const A = w(a), B = new Set(w(b));
  if (A.length < 3) return false;
  return A.filter((x) => B.has(x)).length / Math.min(A.length, B.size || 1) >= 0.6;
}

// "just tell me what to buy first", "answer it", "yes or no".
export const DIRECT_ASK = /^(do i|should i|is it|can i)\b|\b(just tell me|tell me what|answer (it|me|the question)|yes or no|what do i (buy|do|need|use|get) first|which (one|is better|first)|soil or seeds)\b/i;
const FEELING_WORDS = /\b(overwhelm\w*|stress\w*|anxi\w*|discourag\w*|hopeless\w*|defeat\w*|depress\w*|burn(ed|t) out)\b/i;

const FEEL_PUSHBACK_CHAT = /\b(hate|don'?t like|stop|quit) (being told|telling me) how (to|i) feel|\bstop asking (me )?how i feel|\bdon'?t tell me how (to|i) feel/i;
