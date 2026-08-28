import { storage } from "./storage";
import type { SupportOutcome, SupportEscalationReason } from "@shared/schema";

// ─── Support & Onboarding Agent (Agent 03) ───────────────────────────────────
// Answers "how do I..." questions from an approved response library ONLY —
// no improvised answers, ever. Refunds, account deletion, and payment
// disputes always route to a human; distress language is Trust & Safety's
// job (server/trustSafety.ts), which runs before this agent on every surface
// that calls it. Logs every inquiry so a weekly report can show where users
// get stuck.

export interface SupportLibraryEntry {
  id: string;
  question: string;
  patterns: RegExp[];
  answer: string;
}

// Starter library — 10 entries covering the real, current app surface (tab
// names and navigation match jaeCoach.ts's own NAVIGATION HONESTY section,
// so Support and Jai never contradict each other). Flagged for founder
// review: edit/expand this list as real support questions come in.
export const SUPPORT_RESPONSE_LIBRARY: SupportLibraryEntry[] = [
  {
    id: "retake-assessment",
    question: "How do I retake the Five Heartbeats assessment?",
    patterns: [/retake.*assessment/i, /redo.*assessment/i, /assessment again/i, /new assessment/i],
    answer: "You can retake the assessment any time from your Profile tab — it updates your stage and heartbeat focus without touching your goals or journal history.",
  },
  {
    id: "set-a-goal",
    question: "Where do I set or change a goal?",
    patterns: [/where.*(set|plant|change|add).*goal/i, /how.*(set|plant|start).*goal/i],
    answer: "Goals live on the Growth tab — that's where you plant a new goal and track it over time.",
  },
  {
    id: "find-journal-entries",
    question: "Where can I see my past journal entries?",
    patterns: [/where.*(journal|entries|memor)/i, /find.*(journal|past entries)/i, /see.*journal/i],
    answer: "Your journal entries and memories are on the Calendar tab.",
  },
  {
    id: "start-rebuild",
    question: "How do I start the 7-Day Rebuild?",
    patterns: [/start.*rebuild/i, /7.?day rebuild/i, /begin.*rebuild/i],
    answer: "The 7-Day Rebuild unlocks as a banner on your Home tab once you finish the 3-Day Grounding Journal — tap that banner to begin.",
  },
  {
    id: "start-grounding-journal",
    question: "Where do I find the 3-Day Grounding Journal?",
    patterns: [/grounding journal/i, /3.?day journal/i],
    answer: "The Grounding Journal banner is always visible on your Home tab — tap it to start or continue.",
  },
  {
    id: "reset-password",
    question: "How do I reset my password?",
    patterns: [/reset.*password/i, /forgot.*password/i, /can'?t (log ?in|sign ?in)/i],
    answer: "Tap \"Forgot password?\" on the sign-in screen and we'll email you a reset link — it's good for one hour.",
  },
  {
    id: "change-email",
    question: "How do I change the email on my account?",
    patterns: [/change.*email/i, /update.*email/i, /wrong email/i],
    answer: "Email changes on your account go through a quick request right now so we can confirm it's really you — send us your new email address and we'll help you switch it over.",
  },
  {
    id: "subscription-price",
    question: "How much does Mustard Seed cost / what's included in my plan?",
    patterns: [/how much.*(cost|price)/i, /what.*plan.*include/i, /pricing/i, /subscription.*cost/i],
    answer: "Mustard Seed is $14.99/month after your free assessment and journal. Your Profile tab shows your current plan and status.",
  },
  {
    id: "see-progress",
    question: "Where do I see my streak or Water Level?",
    patterns: [/where.*(streak|water level)/i, /see.*(streak|progress|water)/i],
    answer: "Your streak, Water Level, and overall progress are on your Home tab.",
  },
  {
    id: "app-stuck-loading",
    question: "The app isn't loading or I'm stuck on a screen.",
    patterns: [/(not|isn'?t|won'?t) (loading|working)/i, /stuck on/i, /frozen/i, /blank screen/i],
    answer: "First try fully closing the app and reopening it, or logging out and back in — that clears most stuck-screen issues. If it's still stuck after that, tell us exactly what screen you're on and we'll take a look.",
  },
];

// Escalation is deterministic and pattern-based, not model-judged — these
// are financial/legal-sensitive categories where a fixed, auditable rule set
// is more trustworthy than an LLM's best guess. False positives here just
// mean a routine question gets a human reply instead of a library one, which
// is always the safe direction to err in.
const ESCALATION_PATTERNS: { reason: SupportEscalationReason; re: RegExp }[] = [
  { reason: "refund", re: /\b(refund|money back|reimburse|charged (me )?(for|and) (no|didn'?t))\b/i },
  { reason: "account_deletion", re: /\b(delete (my )?account|remove (my )?(account|data)|close (my )?account)\b/i },
  { reason: "payment_dispute", re: /\b(dispute|chargeback|fraudulent charge|unauthorized charge|didn'?t authorize)\b/i },
];

const ESCALATION_MESSAGES: Record<SupportEscalationReason, string> = {
  refund: "Refund requests go straight to a real person on our team rather than through me — I've flagged this so someone follows up with you directly.",
  account_deletion: "Account deletion isn't something I can process myself — I've flagged this for our team to handle it with you directly.",
  payment_dispute: "A payment dispute needs a real person, not me — I've flagged this for our team to look into and follow up with you.",
};

const UNHANDLED_MESSAGE =
  "I don't have a saved answer for that one yet, so I don't want to guess — I've flagged it for a person on our team to follow up with you.";

export interface SupportResult {
  outcome: SupportOutcome;
  answer: string;
  libraryEntryId: string | null;
  escalationReason: SupportEscalationReason | null;
}

function matchEscalation(text: string): SupportEscalationReason | null {
  for (const { reason, re } of ESCALATION_PATTERNS) {
    if (re.test(text)) return reason;
  }
  return null;
}

function matchLibraryEntry(text: string): SupportLibraryEntry | null {
  for (const entry of SUPPORT_RESPONSE_LIBRARY) {
    if (entry.patterns.some((re) => re.test(text))) return entry;
  }
  return null;
}

/**
 * classifySupportInquiry — the only entry point this agent exposes. Callers
 * (e.g. a support endpoint) are expected to run Trust & Safety's
 * evaluateMessage() first and short-circuit on a crisis flag before ever
 * reaching this function, per the job description's escalation order.
 */
export async function classifySupportInquiry(userId: string, text: string): Promise<SupportResult> {
  const escalationReason = matchEscalation(text);
  if (escalationReason) {
    await storage.createSupportInquiry({
      userId, text, outcome: "escalated", libraryEntryId: null, escalationReason,
    });
    return { outcome: "escalated", answer: ESCALATION_MESSAGES[escalationReason], libraryEntryId: null, escalationReason };
  }

  const entry = matchLibraryEntry(text);
  if (entry) {
    await storage.createSupportInquiry({
      userId, text, outcome: "library", libraryEntryId: entry.id, escalationReason: null,
    });
    return { outcome: "library", answer: entry.answer, libraryEntryId: entry.id, escalationReason: null };
  }

  await storage.createSupportInquiry({
    userId, text, outcome: "unhandled", libraryEntryId: null, escalationReason: null,
  });
  return { outcome: "unhandled", answer: UNHANDLED_MESSAGE, libraryEntryId: null, escalationReason: null };
}

export interface WeeklyStuckReport {
  windowDays: number;
  totalInquiries: number;
  byOutcome: Record<SupportOutcome, number>;
  topLibraryEntries: { id: string; question: string; count: number }[];
  topUnhandledCount: number;
  escalationsByReason: Record<SupportEscalationReason, number>;
}

/**
 * generateWeeklyStuckReport — "reports weekly where users get stuck in
 * onboarding," built entirely from logged support inquiries. No scheduler
 * exists in this codebase (same gap noted in Phase 2), so this runs
 * on-demand via the admin endpoint rather than on a real weekly timer.
 */
export async function generateWeeklyStuckReport(windowDays = 7): Promise<WeeklyStuckReport> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const inquiries = await storage.getSupportInquiriesSince(since);

  const byOutcome: Record<SupportOutcome, number> = { library: 0, escalated: 0, unhandled: 0 };
  const escalationsByReason: Record<SupportEscalationReason, number> = {
    refund: 0, account_deletion: 0, payment_dispute: 0,
  };
  const libraryCounts = new Map<string, number>();

  for (const inq of inquiries) {
    byOutcome[inq.outcome as SupportOutcome] = (byOutcome[inq.outcome as SupportOutcome] ?? 0) + 1;
    if (inq.outcome === "library" && inq.libraryEntryId) {
      libraryCounts.set(inq.libraryEntryId, (libraryCounts.get(inq.libraryEntryId) ?? 0) + 1);
    }
    if (inq.outcome === "escalated" && inq.escalationReason) {
      const reason = inq.escalationReason as SupportEscalationReason;
      escalationsByReason[reason] = (escalationsByReason[reason] ?? 0) + 1;
    }
  }

  const topLibraryEntries = Array.from(libraryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => {
      const entry = SUPPORT_RESPONSE_LIBRARY.find((e) => e.id === id);
      return { id, question: entry?.question ?? id, count };
    });

  return {
    windowDays,
    totalInquiries: inquiries.length,
    byOutcome,
    topLibraryEntries,
    topUnhandledCount: byOutcome.unhandled,
    escalationsByReason,
  };
}
