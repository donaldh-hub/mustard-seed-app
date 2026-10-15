import { storage } from "./storage";

// Jai's once-a-day opening line in Chat, for users with an active goal: the
// most recent step on record, asked about — never a generic quote. (Users
// with no goal get the guided goal offer instead; see goalSetup.ts.)

const stripEnd = (t: string) => t.trim().replace(/[.!\s]+$/, "");
const lowerFirst = (t: string) => (/^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);

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
  if (statement?.possibleFirstSeed) {
    candidates.push({ at: time(statement.createdAt), text: `You finished your 3-Day Journal. Your first seed was ${lowerFirst(stripEnd(statement.possibleFirstSeed))}. Did you start it yet?` });
  }
  const lastEvening = journal.filter((e) => e.session === "evening" && e.nextStep).sort((a, b) => time(b.createdAt) - time(a.createdAt))[0];
  if (lastEvening?.nextStep) {
    candidates.push({ at: time(lastEvening.createdAt), text: `Your last small step was ${lowerFirst(stripEnd(lastEvening.nextStep))}. Did you get to it?` });
  }

  const latest = candidates.sort((a, b) => b.at - a.at)[0];
  return hi(latest ? latest.text : `What's one small thing you can do for ${lowerFirst(stripEnd(goal.title))} today?`);
}
