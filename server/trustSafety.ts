import { Resend } from "resend";
import { storage } from "./storage";
import { type SafetyTriggerCategory, type SafetyTier, type SafetyThreadMessage } from "@shared/schema";
import {
  screenMessage, fallbackScreen, checkInResponse, clarifyReply,
  STAY_WITH_YOU_RESPONSE, RESOURCE_LINE, type SafetyScreen, type ScreenContext,
} from "./safetyClassifier";

// ─── Trust & Safety Agent (Agent 01) ─────────────────────────────────────────
// Screens every inbound Jai / Jio / Jazz turn for crisis language and — on a
// match — halts the normal flow, serves a safe response, logs the event, and
// (for clear risk) alerts the founder. Two tiers:
//   clear    → the locked safe-response script from the "Trust & Safety Final
//              Script" build doc, word for word.
//   check_in → ambiguous distress gets one fixed check-in line with 988.
// This agent detects and routes; it never counsels, diagnoses, or resolves,
// and it never generates its own crisis wording.

// The locked script, split around its one conditional sentence: "I'm letting
// a real person on our end know" is only true when the founder alert actually
// went out, so it's included only then. Every other word is unchanged.
const PRIMARY_BEFORE_ALERT =
  "Thank you for telling me that — it means something that you did. What you're describing is heavier than what I'm built to help with, and you deserve real support right now, not just me. If you're in the US, you can call or text 988 anytime to reach the Suicide & Crisis Lifeline, or text HOME to 741741 for the Crisis Text Line — both are free, and both are staffed by people trained for exactly this. If you're in immediate danger, please call 911 or go to your nearest emergency room. Is there someone near you right now you could also reach out to?";
const PRIMARY_ALERT_SENTENCE =
  "I'm letting a real person on our end know this happened, because that matters more than me handling it alone.";
const PRIMARY_AFTER_ALERT =
  "I'm still here, and we don't have to stop talking — I just didn't want to move past this like it was any other check-in.";

export function primarySafeResponse(alertSent: boolean): string {
  return [PRIMARY_BEFORE_ALERT, alertSent ? PRIMARY_ALERT_SENTENCE : null, PRIMARY_AFTER_ALERT].filter(Boolean).join(" ");
}

export const PRIMARY_SAFE_RESPONSE = primarySafeResponse(true);

export const BACKTRACK_FOLLOWUP_RESPONSE =
  "I hear you, and I'm not going to push. But I also don't want to just drop what you said a minute ago like it didn't happen — it mattered then, even if it's hard to sit with now. 988, or texting HOME to 741741, is there whenever you want it, today or any day. And so am I.";

const CATEGORY_LABELS: Record<SafetyTriggerCategory, string> = {
  passive_ideation: "Passive ideation",
  active_ideation: "Active ideation",
  ideation_with_plan_or_means: "Ideation with plan or means",
  hopelessness_finality: "Hopelessness / finality",
  direct_self_harm: "Direct self-harm statement",
  abuse_in_progress: "Abuse in progress",
  medical_emergency: "Medical emergency",
  disordered_eating: "Disordered eating red flag",
  ambiguous_distress: "Ambiguous distress (check-in)",
};

// A single denial ("never mind", "I'm fine") must not close a clear-risk
// flag. This is the window in which a backtrack after one gets the follow-up
// script instead of silence or the normal Jai response.
const BACKTRACK_WINDOW_MS = 30 * 60 * 1000;

const BACKTRACK_PHRASES =
  /\b(never ?mind|forget (it|that|i said)|i('m| am) fine|i didn'?t mean (it|that)|i was (just )?(joking|kidding)|ignore (that|what i said)|not a big deal|i'?m ok(ay)?( now)?|drop it|it'?s nothing)\b/i;

// A check-in (not a clear-risk flag) is asked at most once per this window.
const CHECK_IN_GAP_MS = 24 * 60 * 60 * 1000;

// Rows logged before tiering have no tier; they were all full-script flags.
const isClearFlag = (e: { tier?: string | null }) => !e.tier || e.tier === "clear";

async function screen(text: string, recent: ScreenContext): Promise<SafetyScreen | null> {
  try {
    return await screenMessage(text, recent);
  } catch (err) {
    console.error("[TRUST_SAFETY] Classifier call failed, falling back to keyword safety net:", err);
    return fallbackScreen(text);
  }
}

async function sendFounderAlert(userId: string, category: SafetyTriggerCategory, triggeringMessage: string, surface: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const alertTo = process.env.FOUNDER_ALERT_EMAIL;

  if (!apiKey || !alertTo) {
    console.warn(
      "[TRUST_SAFETY] Founder alert NOT sent — set RESEND_API_KEY and FOUNDER_ALERT_EMAIL to enable real alert delivery. " +
      `(would have alerted for user ${userId}, category "${category}")`
    );
    return false;
  }

  const fromEmail = process.env.FROM_EMAIL || "noreply@mustardseeddap.com";

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: alertTo,
      subject: `Trust & Safety alert — ${CATEGORY_LABELS[category]}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1c1917; font-size: 18px; margin-bottom: 8px;">A Trust &amp; Safety flag just fired</h2>
          <p style="color: #57534e; font-size: 14px; line-height: 1.6;">
            <strong>User:</strong> ${userId}<br/>
            <strong>Category:</strong> ${CATEGORY_LABELS[category]}<br/>
            <strong>Surface:</strong> ${surface}<br/>
            <strong>Time:</strong> ${new Date().toISOString()}
          </p>
          <p style="color: #57534e; font-size: 14px; line-height: 1.6; border-left: 3px solid #A15A3A; padding-left: 12px;">
            "${triggeringMessage.replace(/</g, "&lt;")}"
          </p>
          <p style="color: #57534e; font-size: 13px; line-height: 1.6;">
            Jai already served the locked safe-response script to the user. This alert is so a real person follows up — please check in directly.
          </p>
        </div>
      `,
    });
    if (error) {
      console.error("[TRUST_SAFETY] Resend alert error:", error.name, error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error("[TRUST_SAFETY] Founder alert unexpected error:", err?.message || err);
    return false;
  }
}

export interface SafetyEvaluation {
  triggered: boolean;
  isBacktrackFollowUp: boolean;
  category: SafetyTriggerCategory | null;
  tier: SafetyTier | null;
  responseText: string | null;
  eventId: string | null;
}

const NOT_TRIGGERED: SafetyEvaluation = {
  triggered: false, isBacktrackFollowUp: false, category: null, tier: null, responseText: null, eventId: null,
};

async function logClearFlag(
  userId: string, category: SafetyTriggerCategory, text: string, surface: string,
): Promise<{ eventId: string; responseText: string }> {
  const event = await storage.createSafetyEvent({
    userId, category, responseType: "primary", triggeringMessage: text, surface, alertSent: false, tier: "clear",
  });
  const alertSent = await sendFounderAlert(userId, category, text, surface).catch((err) => {
    console.error("[TRUST_SAFETY] Founder alert threw unexpectedly:", err);
    return false;
  });
  if (alertSent) {
    await storage.updateSafetyEvent(event.id, { alertSent: true }).catch(() => {});
  }
  return { eventId: event.id, responseText: primarySafeResponse(alertSent) };
}

/**
 * evaluateMessage — runs on every inbound Jai/Jio/Jazz message BEFORE any
 * normal response generation. Callers must short-circuit and return
 * `responseText` verbatim as the reply when `triggered` is true, skipping
 * every other branch of that turn's handling.
 */
// The question asked first for "I don't want to be here anymore".
const HERE_CHECK_MARK = "do you mean you're done with the app";
export const HERE_CHECK = "When you say you don't want to be here anymore, do you mean you're done with the app, or done with this goal, or is it something bigger? If it's something bigger, 988 is there anytime, or 911 in an emergency.";
// "kill all three tomatoes", "this garden is killing me": about the task,
// not explicit risk words.
const TASK_KILL = /\bkill(ing|ed)?\s+(all\s+|every\s+|my\s+|the\s+|three\s+|\w+\s+){0,3}(tomato\w*|plants?|seedlings?|garden|crops?|everything|it)\b|\b(this|the|my)\s+\w+(\s+\w+)?\s+is\s+killing\s+me\b|\bkilling it\b/gi;
function withoutTaskKill(t: string): string { return t.replace(TASK_KILL, " "); }
const ABOUT_TASK = /\b(app|this app|the app|journal|goal|chat|you|jai|work|job|this|it|garden|plants?|book|writing|gym|workout|school|class)\b/i;
function namesTopicFrom(answer: string, before: string): boolean {
  const skip = new Set(["want", "here", "anymore", "dont", "don't", "honestly", "really", "just", "that", "this", "with", "about"]);
  const words = (before.toLowerCase().match(/[a-z']{4,}/g) ?? []).filter((w) => !skip.has(w));
  return words.some((w) => new RegExp(`\\b${w.slice(0, 5)}`, "i").test(answer));
}
const BARE_HERE = /\b(don'?t|do not|dont) (want|wan|wanna)( to)? be here\b/i;
const EXPLICIT_RISK = /\b(die|dying|dead|kill|suicid\w*|end (it all|my life|things)|hurt (myself|me)|wake up|alive|exist|overdose|jump)\b/i;
const BIGGER = /\b(bigger|yes|yeah|yep|life|living|everything|all of it|myself|both|idk|i don'?t know|not sure|maybe|kind of|kinda|heavier)\b/i;

export async function evaluateMessage(
  userId: string,
  text: string,
  recentMessages: { sender: string; text: string }[],
  surface: "chat" | "grounding_journal" | "rebuild" = "chat"
): Promise<SafetyEvaluation> {
  const recentEvents = await storage.getRecentSafetyEvents(userId, new Date(Date.now() - BACKTRACK_WINDOW_MS));
  const openPrimaryFlag = recentEvents.find((e) => e.responseType === "primary" && isClearFlag(e));

  // Their answer to "done with the app, this goal, or something bigger?":
  // the app or the goal gets a normal reply; bigger, yes, unsure, or anything
  // unclear gets the full resources message.
  const lastJai = [...recentMessages].reverse().find((m) => m.sender !== "user")?.text ?? "";
  if (lastJai.includes(HERE_CHECK_MARK)) {
    // About the app, the goal, or whatever they named before ("the garden").
    const before = [...recentMessages].reverse().find((m) => m.sender === "user")?.text ?? "";
    const aboutApp = (ABOUT_TASK.test(text) || namesTopicFrom(text, before)) && !BIGGER.test(text) && !EXPLICIT_RISK.test(text);
    if (aboutApp) return NOT_TRIGGERED;
    // Pushback on the question itself ("where did that come from?") gets a
    // plain answer from Jai, not the full message.
    if (/\b(where did (that|this) come from|why (are|did) you (ask|say)|what do you mean|what was that|huh|wtf)\b/i.test(text) && !BIGGER.test(text) && !EXPLICIT_RISK.test(text)) return NOT_TRIGGERED;
    const screenedReply = await screen(text, []).catch(() => null);
    const { eventId, responseText } = await logClearFlag(userId, screenedReply?.category ?? ("passive_ideation" as SafetyTriggerCategory), text, surface);
    return { triggered: true, isBacktrackFollowUp: false, category: screenedReply?.category ?? ("passive_ideation" as SafetyTriggerCategory), tier: "clear", responseText, eventId };
  }

  // "I don't want to be here anymore", bare or inside a complaint, first time
  // or repeated: ask first, every time (Donald, Nov 26). Checked by its
  // words before any screening, so nothing can route around it. Explicit
  // words (die, kill myself, end my life, suicide...) still get the full
  // message right away.
  if (BARE_HERE.test(text) && !EXPLICIT_RISK.test(withoutTaskKill(text))) {
    const event = await storage.createSafetyEvent({
      userId, category: "passive_ideation" as SafetyTriggerCategory, responseType: "primary", triggeringMessage: text, surface, alertSent: false, tier: "check_in",
    });
    return { triggered: true, isBacktrackFollowUp: false, category: "passive_ideation" as SafetyTriggerCategory, tier: "check_in", responseText: HERE_CHECK, eventId: event.id };
  }

  if (openPrimaryFlag && BACKTRACK_PHRASES.test(text)) {
    const event = await storage.createSafetyEvent({
      userId,
      category: openPrimaryFlag.category,
      responseType: "backtrack_followup",
      triggeringMessage: text,
      surface,
      alertSent: false,
      tier: "clear",
    });
    return {
      triggered: true,
      isBacktrackFollowUp: true,
      category: openPrimaryFlag.category as SafetyTriggerCategory,
      tier: "clear",
      responseText: BACKTRACK_FOLLOWUP_RESPONSE,
      eventId: event.id,
    };
  }

  let result = await screen(text, recentMessages);
  if (!result) return NOT_TRIGGERED;
  // The full message goes out once per risk statement. Right after one,
  // a line flagged only because of the context before it ("hello", "where
  // did that come from?") gets a normal reply. Saying the risk words again
  // still gets the full message every time.
  // (Also right after the ask-first question or a check-in.)
  if (openPrimaryFlag || recentEvents.some((e) => e.responseType === "primary")) {
    const alone = await screen(text, []);
    if (!alone) return NOT_TRIGGERED;
    result = alone;
  }

  // "I don't want to be here anymore" with no other context: ask first
  // (Donald, Nov 26). Explicit wording (die, kill myself, end my life,
  // suicide, don't want to wake up) still gets the full message right away.
  if (result.category === "passive_ideation" && BARE_HERE.test(text) && !EXPLICIT_RISK.test(text)) {
    const event = await storage.createSafetyEvent({
      userId, category: result.category, responseType: "primary", triggeringMessage: text, surface, alertSent: false, tier: "check_in",
    });
    return { triggered: true, isBacktrackFollowUp: false, category: result.category, tier: "check_in", responseText: HERE_CHECK, eventId: event.id };
  }

  if (result.tier === "check_in") {
    // The "is it the task or something heavier?" question at most once a
    // day: asked and answered, it isn't asked again.
    const lastDay = await storage.getRecentSafetyEvents(userId, new Date(Date.now() - CHECK_IN_GAP_MS));
    if (lastDay.some((e) => e.tier === "check_in")) return NOT_TRIGGERED;
    // Never on a complaint about Jai or the app ("so you just gon ignore me?").
    if (/\b(ignor(e|ing) me|not listening|robot(ic)?|glitch|this app|you('?re| are) not (here|helping))\b/i.test(text)) return NOT_TRIGGERED;
    // Doubting the process ("why should I even keep doing this") is doubt,
    // answered by Jai, not a risk check-in.
    if (/\b(keep doing this|keep (going|trying) with this|why (should|would) i (even )?(keep|bother|try)|what'?s the point of (this|the app|journaling|writing))\b/i.test(text) && !/\b(life|living|alive|myself|die|anymore|exist)\b/i.test(text)) return NOT_TRIGGERED;
    // Logged for the admin view; no founder email for a check-in.
    const event = await storage.createSafetyEvent({
      userId, category: result.category, responseType: "primary", triggeringMessage: text, surface, alertSent: false, tier: "check_in",
    });
    return {
      triggered: true, isBacktrackFollowUp: false, category: result.category, tier: "check_in",
      responseText: checkInResponse(result.phrase, result.topic), eventId: event.id,
    };
  }

  const { eventId, responseText } = await logClearFlag(userId, result.category, text, surface);
  return { triggered: true, isBacktrackFollowUp: false, category: result.category, tier: "clear", responseText, eventId };
}

export type SafetyReplyOutcome = "clarified_no_risk" | "still_unclear" | "escalated";

/**
 * The user's reply after a safety response (journal). Always returns a Jai
 * response: a warm acknowledgment if they clearly say there's no risk, the
 * stay-with-you line if it's unclear, or the full script if risk rose.
 * Records the outcome on the original event.
 */
export async function evaluateSafetyReply(
  userId: string,
  ctx: {
    eventId: string | null;
    tier: SafetyTier;
    thread: SafetyThreadMessage[];
    triggerText: string;
    reply: string;
    goal?: string | null;
    surface: "grounding_journal" | "rebuild" | "chat";
  },
): Promise<{ outcome: SafetyReplyOutcome; responseText: string }> {
  const lastJai = [...ctx.thread].reverse().find((m) => m.from === "jae")?.text ?? "";
  const recent: ScreenContext = [
    { sender: "user", text: ctx.triggerText },
    ...ctx.thread.map((m) => ({ sender: m.from === "user" ? "user" : "jae", text: m.text })),
  ];
  let outcome: SafetyReplyOutcome;
  let responseText: string;

  const result = await screen(ctx.reply, recent);
  if (lastJai.includes(HERE_CHECK_MARK) && !EXPLICIT_RISK.test(ctx.reply)) {
    // Journal answer to the ask-first question: the app or the goal is a
    // normal answer; bigger, unsure, or unclear gets the full message.
    const aboutApp = (ABOUT_TASK.test(ctx.reply) || namesTopicFrom(ctx.reply, ctx.triggerText)) && !BIGGER.test(ctx.reply);
    const pushback = /\b(where did (that|this) come from|why (are|did) you (ask|say)|what do you mean|what was that|huh|wtf)\b/i.test(ctx.reply) && !BIGGER.test(ctx.reply);
    if (aboutApp || pushback) {
      outcome = "clarified_no_risk";
      responseText = aboutApp
        ? "Thank you for telling me. That's about this, not something bigger, and I hear it. We can keep it small from here."
        : "I asked because you wrote that you don't want to be here anymore, and I'd rather check than guess. If it's about this journal or your goal, we can keep going, smaller.";
      if (ctx.eventId) await storage.updateSafetyEvent(ctx.eventId, { outcome }).catch(() => {});
      return { outcome, responseText };
    }
    outcome = "escalated";
    responseText = (await logClearFlag(userId, result?.category ?? ("passive_ideation" as SafetyTriggerCategory), ctx.reply, ctx.surface)).responseText;
    if (ctx.eventId) await storage.updateSafetyEvent(ctx.eventId, { outcome }).catch(() => {});
    return { outcome, responseText };
  }
  if (result?.tier === "clear") {
    outcome = "escalated";
    responseText = (await logClearFlag(userId, result.category, ctx.reply, ctx.surface)).responseText;
  } else if (ctx.tier === "clear" && BACKTRACK_PHRASES.test(ctx.reply) && ctx.reply.trim().split(/\s+/).length <= 6) {
    // A bare "never mind" after a clear-risk flag doesn't close it.
    outcome = "still_unclear";
    responseText = BACKTRACK_FOLLOWUP_RESPONSE;
  } else {
    const c = await clarifyReply({ triggerText: ctx.triggerText, safetyResponse: lastJai, reply: ctx.reply, goal: ctx.goal });
    if (c.clarity === "no_risk") {
      outcome = "clarified_no_risk";
      responseText = ctx.tier === "clear" ? `${c.ack} ${RESOURCE_LINE}` : c.ack;
    } else {
      outcome = "still_unclear";
      responseText = STAY_WITH_YOU_RESPONSE;
    }
  }

  if (ctx.eventId) {
    await storage.updateSafetyEvent(ctx.eventId, { outcome }).catch(() => {});
  }
  return { outcome, responseText };
}
