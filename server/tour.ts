import { storage } from "./storage";
import { startGoalSetup } from "./goalSetup";

// ─── App tour + Main Struggle offer (Donald, Oct 20) ────────────────────────
// After the 3-Day Journal, Jai offers two buttons: a short tour of the app or
// planting the first goal. The tour can also be asked for any time ("show me
// around"). One idea per message, Next / Skip the rest. Where the tour is up
// to is read from Jai's last message type, so it needs no stored state.
//
// Every line describes a real screen (checked against Home, Progress,
// Calendar, Profile and Chat). Keep it that way if a screen changes.

export const TOUR_WELCOME = "tour_welcome";
export const TOUR_STEP = "tour_step_"; // + 1..5
export const TOUR_END = "tour_end";
export const STRUGGLE_OFFER = "struggle_offer";

export const TOUR_BUTTONS = {
  showMe: "Show me around",
  plant: "Plant my first goal",
  explore: "I'll explore",
  next: "Next",
  skipRest: "Skip the rest",
  yesPlant: "Yes, let's do it",
  notYet: "Not yet",
  saveStruggle: "Yes, save it",
  notQuite: "Not quite",
} as const;

const STEPS = [
  "Home is your daily snapshot: your focus Heartbeat, your goal, your Water Level, and your Seed Stage. Water Level shows how many of the last 7 days you showed up. Most days start here.",
  "Growth is where your goals live. You can see your progress there and log what you did. Water is earned through action, not intention.",
  "Memory is a calendar of real days. Your reflections and steps land there so you can see what actually happened.",
  "Profile shows your five Heartbeat scores, your focus, and your settings.",
  "This chat is where I'm with you. Tell me what you did, ask me anything, or tell me what's in the way. One honest step at a time.",
];

const firstName = (name: string | null | undefined) => {
  const f = (name || "").trim().split(/\s+/)[0] || "";
  return f.includes("@") ? "" : f;
};
const norm = (t: string) => t.trim().toLowerCase().replace(/[.!?]+$/, "");
const lowerFirst = (t: string) => (/^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);
const ASK_FOR_TOUR = /^(show me around|(give me|take me on|can i get|i want) (a|the) tour|(app )?tour|how does (this|the app) work)$/;

type Out = { text: string; messageType: string };

/** Jai's welcome after the journal (once): tour or first goal, their pick. */
export async function postJournalWelcome(userId: string) {
  const [user, messages, goals] = await Promise.all([
    storage.getUser(userId), storage.getMessages(userId), storage.getActiveGoals(userId),
  ]);
  if (!user || messages.some((m) => m.messageType === TOUR_WELCOME)) return null;
  const name = firstName(user.name);
  const next = goals.length > 0
    ? "Want a quick tour of how the app works?"
    : "Want a quick tour of how the app works, or should we plant your first goal?";
  return storage.createMessage({
    userId,
    text: `${name ? `Welcome in, ${name}.` : "Welcome in."} You finished the 3-Day Journal. ${next}`,
    sender: "jae",
    messageType: TOUR_WELCOME,
  });
}

function step(n: number, prefix = ""): Out {
  return { text: `${prefix}${STEPS[n - 1]}`, messageType: `${TOUR_STEP}${n}` };
}

async function tourEnd(userId: string): Promise<Out[]> {
  const goals = await storage.getActiveGoals(userId);
  if (goals.length === 0) return [{ text: "That's the tour. Ready to plant your first goal?", messageType: TOUR_END }];
  const end: Out = { text: "That's the tour. Ask me for it again any time.", messageType: "text" };
  const struggle = await struggleOffer(userId);
  return struggle ? [end, struggle] : [end];
}

/**
 * Once, after the journal: Jai names what kept getting in the way and asks
 * before saving it as their Main Struggle. null if already asked, already
 * set, or the journal named nothing.
 */
export async function struggleOffer(userId: string): Promise<Out | null> {
  const [user, messages, journal] = await Promise.all([
    storage.getUser(userId), storage.getMessages(userId), storage.getGroundingJournalEntries(userId),
  ]);
  if (!user || (user.struggles?.length ?? 0) > 0) return null;
  if (messages.some((m) => m.messageType === STRUGGLE_OFFER)) return null;
  const release = [...journal]
    .filter((e) => (e.releasePoint ?? "").trim())
    .sort((a, b) => b.dayNumber - a.dayNumber || (b.session === "evening" ? 1 : 0) - (a.session === "evening" ? 1 : 0))[0]?.releasePoint;
  if (!release) return null;
  return {
    text: `One more thing. Over the three days, what kept getting in the way looked like ${lowerFirst(release.trim().replace(/[.!\s]+$/, ""))}. Want me to save that as your main struggle on your Profile? It helps me know what to watch for.`,
    messageType: STRUGGLE_OFFER,
  };
}

/** Called after the guided goal setup finishes (goal planted, step in). */
export async function postStruggleOffer(userId: string) {
  const offer = await struggleOffer(userId);
  return offer ? storage.createMessage({ userId, text: offer.text, sender: "jae", messageType: offer.messageType }) : null;
}

/**
 * Handles a chat message that belongs to the tour (a tour button, or asking
 * for the tour). Returns the messages Jai sends, or null for normal chat.
 */
export async function handleTourTurn(userId: string, text: string) {
  const t = norm(text);
  const messages = await storage.getMessages(userId);
  const lastJai = [...messages].reverse().find((m) => m.sender === "jae");
  const lastType = lastJai?.messageType ?? "";
  const B = Object.fromEntries(Object.entries(TOUR_BUTTONS).map(([k, v]) => [k, norm(v)])) as Record<keyof typeof TOUR_BUTTONS, string>;
  const user = await storage.getUser(userId);
  const source = user?.groundingJournalCompleted ? "journal" : "chat";

  let out: Out[] | null = null;
  let plantNow = false;

  if (t === B.showMe || ASK_FOR_TOUR.test(t)) {
    out = [step(1, lastType === TOUR_WELCOME ? "" : "Here's a quick tour, one screen at a time. ")];
  } else if (lastType.startsWith(TOUR_STEP)) {
    const n = parseInt(lastType.slice(TOUR_STEP.length), 10) || 1;
    if (t === B.next) out = n < STEPS.length ? [step(n + 1)] : await tourEnd(userId);
    else if (t === B.skipRest) out = await tourEnd(userId);
  } else if (lastType === TOUR_WELCOME) {
    if (t === B.plant) plantNow = true;
    else if (t === B.explore) out = [{ text: "Sounds good. I'm right here whenever you need me.", messageType: "text" }];
  } else if (lastType === TOUR_END) {
    if (t === B.yesPlant) plantNow = true;
    else if (t === B.notYet) {
      out = [{ text: "No pressure. When you're ready, tap Plant my first goal on Home, or just tell me.", messageType: "text" }];
      const s = await struggleOffer(userId);
      if (s) out.push(s);
    }
  } else if (lastType === STRUGGLE_OFFER) {
    if (t === B.saveStruggle) {
      const release = /looked like (.+?)\. Want me to save/.exec(lastJai?.text ?? "")?.[1] ?? "";
      if (release) await storage.updateUser(userId, { struggles: [release] } as any);
      out = [{ text: "Saved. It's on your Profile now, and I'll keep an eye out for it with you.", messageType: "text" }];
    } else if (t === B.notQuite) {
      out = [{ text: "Got it, I won't save that. If you want to name it in your own words later, just tell me.", messageType: "text" }];
    }
  }

  if (plantNow) {
    const offer = await startGoalSetup(userId, source);
    return offer ? [offer] : null;
  }
  if (!out) return null;
  const created = [];
  for (const o of out) created.push(await storage.createMessage({ userId, text: o.text, sender: "jae", messageType: o.messageType }));
  return created;
}
