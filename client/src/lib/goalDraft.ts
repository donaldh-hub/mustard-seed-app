// A goal worded with Jai but not planted yet (mirrors isDraft in
// server/goalSetup.ts), so Home and Profile can say "Goal in progress".
export function draftGoalTitle(user: any): string | null {
  const s = user?.goalSetup;
  if (!s || !s.title) return null;
  const draft = ["why", "date", "confirm"].includes(s.stage) || (s.stage === "step" && !s.plantedGoalId);
  return draft ? String(s.title) : null;
}
