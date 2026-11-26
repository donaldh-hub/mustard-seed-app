// Moment Reader: one shared step before Jai replies in chat. It reads the
// user's last message (with the last few for context) and names ONE primary
// state. It never writes the reply; it tells the reply what to do first.
// The robotic part lives here, in the background; the user only sees the
// reply that comes out of it.

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export const MOMENT_STATES = [
  "engaged", "reported_action", "flat", "doubt", "frustrated_self", "frustrated_at_jai", "overwhelm",
  "sarcasm", "hostile", "quit_talk", "stake", "app_question", "correction",
] as const;
export type MomentState = (typeof MOMENT_STATES)[number];

export interface Moment {
  state: MomentState;
  stake: string; // their words, if they named a real stake ("I almost got fired")
  question: string; // a direct question they asked, if any
  hostileStreak: number; // hostile / at-Jai messages in a row, this one included
}

// Keyword read, used when the AI read fails and to count a hostile streak.
const AT_JAI = /\b(you('?re| are)? (not|never) (\w+ )?(listening|understanding|helping|getting it|here)|you (don'?t|do not|never) (listen|understand|get it)|(gon|going to|gonna) ignore me|ignor(e|ing) me|robot(ic)?|preprogrammed|this app|fuck (you|off)|useless)\b/i;
const AIMED_AT_JAI = /\b(you|u|ya|your|jai|app|robot\w*|preprogrammed|bot)\b/i;
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
  return { state, stake, question: /\?\s*$/.test(t) ? t : "", hostileStreak: hostileStreak(state, previousUserTexts) };
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
      max_tokens: 120,
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
Return JSON: {"state": "...", "stake": "their exact words for the stake or empty", "question": "the direct question they asked or empty"}`,
        },
        { role: "user", content: `Recent chat:\n${transcript || "(none)"}\n\nLAST message: ${text}` },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    let state = (MOMENT_STATES as readonly string[]).includes(parsed.state) ? (parsed.state as MomentState) : byWords.state;
    // "At Jai" needs words aimed at Jai or the app; otherwise it's about their situation.
    if (state === "frustrated_at_jai" && !AIMED_AT_JAI.test(text)) state = "frustrated_self";
    return {
      state,
      stake: typeof parsed.stake === "string" && parsed.stake ? parsed.stake : byWords.stake,
      question: typeof parsed.question === "string" ? parsed.question : byWords.question,
      hostileStreak: hostileStreak(state, previousUserTexts),
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
  frustrated_at_jai: "Stop coaching. Own it in one calm line without defending yourself, in fresh words each time (don't reuse an ownership line you already used). Then ask exactly: \"What am I missing?\" Nothing else. Never tell them a Heartbeat is a gap.",
  overwhelm: "Shrink it. Say they don't have to do it all. Offer a one-line option (\"just tell me one word for today\"). If a Heartbeat fits, it's Small Steps + Consistency.",
  sarcasm: "Take the feeling under the words, plainly. Never praise the words or the effort. One small, easy question.",
  hostile: "Stay calm. No scolding, no comment on language, no coaching. One short line that you're still here.",
  quit_talk: "Name it plainly. Ask what makes the hard days hard, so you can plan for the hard day together. If a Heartbeat fits, it's Mindset over Method.",
  stake: "Say the stake is real, in their words. Treat it as their why. Build one small first step around it. If a Heartbeat fits, it's Clarity of Vision & Why.",
  app_question: "Answer the question plainly and truthfully from what the app actually does (below). Never invent a feature. If you don't know, say so.",
  correction: "One line owning it (\"You're right, I jumped.\"), then ask what they meant. Nothing else.",
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

export function enforceChatRules(reply: string, moment: Moment, recentJai: string[] = []): string {
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
    const ask = wantsControl ? CONTROL : moment.state === "frustrated_at_jai" ? "What am I missing?" : "";
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
  "Fair. I may be missing something.",
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
