// Pacing gate for the 3-Day Grounding Journal. Kept free of imports so
// `node --test` can run journalPacing.test.ts without dependencies.
//
//   - Evening opens EVENING_DELAY_HOURS after that day's morning entry, or at
//     EVENING_OPENS_BY_HOUR local time that same day, whichever comes first —
//     so a day's reflection follows a day actually lived, but a late-starting
//     day can still be reflected on before bed. A morning saved after
//     EVENING_OPENS_BY_HOUR opens the evening right away.
//   - The next day's morning opens at NEXT_DAY_OPENS_HOUR (local time) on the
//     calendar day after the previous evening entry, so a 9 PM reflection
//     still leaves tomorrow's morning session open in the morning.
//
// Sessions run in order: day1 morning → day1 evening → day2 morning → … →
// day3 evening → grounding statement. The gate reports the first session
// that can't be started yet; it and everything after it are locked.

export const EVENING_DELAY_HOURS = 8;
export const EVENING_OPENS_BY_HOUR = 21;
export const NEXT_DAY_OPENS_HOUR = 4;

export type JournalSession = "morning" | "evening";

export interface JournalEntryLike {
  dayNumber: number;
  session: string;
  createdAt: Date | string | null;
}

export interface JournalGate {
  // The first session that can't be started yet, or null when nothing is locked.
  locked: { day: 1 | 2 | 3; session: JournalSession } | null;
  // When it opens. null when it's waiting on an earlier session instead.
  unlocksAt: string | null;
}

const ORDER: Array<{ day: 1 | 2 | 3; session: JournalSession }> = [
  { day: 1, session: "morning" },
  { day: 1, session: "evening" },
  { day: 2, session: "morning" },
  { day: 2, session: "evening" },
  { day: 3, session: "morning" },
  { day: 3, session: "evening" },
];

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Offset (ms) of `timeZone` from UTC at `instant`: local wall time minus UTC.
function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

// The instant that is `hour`:00 local time, `dayOffset` calendar days after
// `from`'s local date in `timeZone`. Re-checks the offset once so DST changes
// land right.
export function localDayAt(from: Date, dayOffset: number, hour: number, timeZone: string): Date {
  const local = new Date(from.getTime() + tzOffsetMs(from, timeZone));
  const wallMs = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dayOffset, hour);
  let guess = wallMs - tzOffsetMs(new Date(wallMs), timeZone);
  guess = wallMs - tzOffsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

export function nextLocalDayAt(from: Date, hour: number, timeZone: string): Date {
  return localDayAt(from, 1, hour, timeZone);
}

function earliest(entries: JournalEntryLike[], day: number, session: string): Date | null {
  let best: Date | null = null;
  for (const e of entries) {
    if (e.dayNumber !== day || e.session !== session || !e.createdAt) continue;
    const t = new Date(e.createdAt);
    if (Number.isNaN(t.getTime())) continue;
    if (!best || t < best) best = t;
  }
  return best;
}

export function eveningOpensAt(morningAt: Date, timeZone: string): Date {
  const tz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  return new Date(Math.min(
    morningAt.getTime() + EVENING_DELAY_HOURS * 60 * 60 * 1000,
    localDayAt(morningAt, 0, EVENING_OPENS_BY_HOUR, tz).getTime(),
  ));
}

// ── Reflection commitment ────────────────────────────────────────────────────
// After the morning, the user picks when they'll come back: the time the
// evening opens (rounded up to the quarter hour), or one or two hours later.
// Reflecting by the chosen time + KEPT_GRACE_MINUTES keeps the commitment and
// earns a bonus water entry.

export const REFLECTION_CHOICE_COUNT = 3;
export const KEPT_GRACE_MINUTES = 60;

export function reflectionChoices(opensAt: Date): Date[] {
  const quarter = 15 * 60 * 1000;
  const first = Math.ceil(opensAt.getTime() / quarter) * quarter;
  return Array.from({ length: REFLECTION_CHOICE_COUNT }, (_, i) => new Date(first + i * 60 * 60 * 1000));
}

export function isCommitmentKept(plannedAt: Date | string | null, eveningAt: Date): boolean {
  if (!plannedAt) return false;
  const planned = new Date(plannedAt).getTime();
  if (Number.isNaN(planned)) return false;
  return eveningAt.getTime() <= planned + KEPT_GRACE_MINUTES * 60 * 1000;
}

// Test accounts (comma-separated emails in JOURNAL_PACING_SKIP_EMAILS) still
// see every wait screen but may skip past it, so a full walkthrough doesn't
// take three days.
export function isPacingTester(email: string | null | undefined, list: string | undefined): boolean {
  if (!email || !list) return false;
  const wanted = email.trim().toLowerCase();
  return list.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).includes(wanted);
}

export function computeJournalGate(entries: JournalEntryLike[], now: Date, timeZone: string): JournalGate {
  const tz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  for (let i = 1; i < ORDER.length; i++) {
    const step = ORDER[i];
    const prev = ORDER[i - 1];
    const prevDoneAt = earliest(entries, prev.day, prev.session);
    if (!prevDoneAt) return { locked: step, unlocksAt: null };
    const opensAt = step.session === "evening"
      ? eveningOpensAt(prevDoneAt, tz)
      : nextLocalDayAt(prevDoneAt, NEXT_DAY_OPENS_HOUR, tz);
    if (now < opensAt) return { locked: step, unlocksAt: opensAt.toISOString() };
  }
  return { locked: null, unlocksAt: null };
}

// Whether a new entry for (day, session) is blocked by the gate. The opening
// intention and day 1 morning are never blocked; the grounding statement
// (sent as day 3) waits until all six sessions are open.
export function isEntryBlocked(gate: JournalGate, day: number, session: string): boolean {
  if (!gate.locked) return false;
  if (session === "intention") return false;
  const lockedIdx = ORDER.findIndex((s) => s.day === gate.locked!.day && s.session === gate.locked!.session);
  if (session === "grounding_statement") return true;
  const idx = ORDER.findIndex((s) => s.day === day && s.session === session);
  return idx === -1 ? false : idx >= lockedIdx;
}
