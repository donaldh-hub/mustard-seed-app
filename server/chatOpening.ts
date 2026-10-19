import { storage } from "./storage";

// Jai's once-a-day opening line in Chat, for users with an active goal: the
// most recent step on record, asked about — never a generic quote. (Users
// with no goal get the guided goal offer instead; see goalSetup.ts.)

const stripEnd = (t: string) => t.trim().replace(/[.!\s]+$/, "");
const lowerFirst = (t: string) => (/^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);
// Journal steps are stored as "Tomorrow, …"; asked about later, that word goes.
const stepText = (t: string) => lowerFirst(stripEnd(t.replace(/^(tomorrow|tonight),?\s*/i, "")));
const DAY = 24 * 3600000;
const STEP_ASK_AFTER_MS = 8 * 3600000;

export async function buildOpeningLine(userId: string): Promise<string | null> {
  const [user, goals, commitments, journal] = await Promise.all([
    storage.getUser(userId),
    storage.getActiveGoals(userId),
    storage.getPendingCommitments(userId),
    storage.getGroundingJournalEntries(userId),
  ]);
  const goal = goals.find((g) => g.goalType === "targeted") ?? goals[0];
  if (!user || !goal) return null;
  const name = (user.name || "").trim().split(/\s+/)[0];
  const hi = (t: string) => (name ? `${name}, ${t.charAt(0).toLowerCase()}${t.slice(1)}` : t);

  type Candidate = { at: number; text: string };
  const candidates: Candidate[] = [];
  const time = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : 0);

  const commitment = commitments[0];
  if (commitment) {
    candidates.push({ at: time(commitment.createdAt), text: `Last time you said you'd ${lowerFirst(stripEnd(commitment.action))}. Did you get to it?` });
  }
  if (goal.microHabit) {
    candidates.push({ at: time(goal.createdAt), text: `Your first step for ${lowerFirst(stripEnd(goal.title))} was ${lowerFirst(stripEnd(goal.microHabit))}. How did it go?` });
  }
  const statement = journal.find((e) => e.session === "grounding_statement");
  const lastEvening = journal.filter((e) => e.session === "evening" && e.nextStep).sort((a, b) => time(b.createdAt) - time(a.createdAt))[0];
  // After the journal, the Day 3 step (what they planned for the next day)
  // is asked about ahead of the first seed.
  if (lastEvening?.nextStep) {
    const at = Math.max(time(lastEvening.createdAt), time(statement?.createdAt));
    candidates.push({ at, text: `You planned to ${stepText(lastEvening.nextStep)}. Did you get to it?` });
  } else if (statement?.possibleFirstSeed) {
    candidates.push({ at: time(statement.createdAt), text: `You finished your 3-Day Journal. Your first seed was ${lowerFirst(stripEnd(statement.possibleFirstSeed))}. Did you start it yet?` });
  }

  const latest = candidates.sort((a, b) => b.at - a.at)[0];
  return hi(latest ? latest.text : `What's one small thing you can do for ${lowerFirst(stripEnd(goal.title))} today?`);
}

// For a user with no goal yet: once, the next day, ask about the step they
// set on the journal's Day 3 evening. null if there's nothing to ask, it's
// too soon, or the daily opening already went out after the journal.
export async function buildJournalStepLine(userId: string, lastOpeningAt: Date | null, now = new Date()): Promise<string | null> {
  const [user, journal] = await Promise.all([storage.getUser(userId), storage.getGroundingJournalEntries(userId)]);
  if (!user) return null;
  const day3 = journal.find((e) => e.dayNumber === 3 && e.session === "evening" && e.nextStep);
  const statement = journal.find((e) => e.session === "grounding_statement");
  if (!day3?.nextStep || !day3.createdAt || !statement?.createdAt) return null;
  const doneAt = new Date(day3.createdAt).getTime();
  if (now.getTime() - doneAt < STEP_ASK_AFTER_MS || now.getTime() - doneAt > 7 * DAY) return null;
  if (lastOpeningAt && lastOpeningAt.getTime() >= new Date(statement.createdAt).getTime()) return null;
  const name = (user.name || "").trim().split(/\s+/)[0];
  const text = `You finished your 3-Day Journal, and you planned to ${stepText(day3.nextStep)}. Did you get to it?`;
  return name && !name.includes("@") ? `${name}, ${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
}
