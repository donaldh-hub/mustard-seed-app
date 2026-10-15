// The Consistency Streak: consecutive calendar days the user showed up.
// "Showed up" means any saved entry that day — a journal session, a verified
// action, a goal planted — the same days "Days active" counts, so the two
// numbers can never disagree. Kept free of imports so `node --test` can run
// showUpStreak.test.ts without dependencies.
//
// A streak is still alive if the user showed up today OR yesterday (today
// isn't over yet). Dates are local calendar days (YYYY-MM-DD), as entries
// store them.

export interface ShowUpStreak {
  current: number;
  // Length of the run before the current one (or the last run, when the
  // current streak is 0). Lets the UI say "New streak begins today."
  previous: number;
  activeToday: boolean;
}

function shiftDay(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

function runEndingAt(days: Set<string>, end: string): number {
  let n = 0;
  while (days.has(shiftDay(end, -n))) n++;
  return n;
}

export function computeShowUpStreak(dates: Iterable<string>, today: string): ShowUpStreak {
  const days = new Set<string>();
  for (const d of dates) if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today) days.add(d);

  const activeToday = days.has(today);
  const yesterday = shiftDay(today, -1);
  const end = activeToday ? today : days.has(yesterday) ? yesterday : null;
  const current = end ? runEndingAt(days, end) : 0;

  // The run before this one: the latest active day before the current run
  // (or before today, when there is no current run).
  const before = end ? shiftDay(end, -current) : today;
  let previous = 0;
  const earlier = Array.from(days).filter((d) => d < before).sort();
  if (earlier.length > 0) previous = runEndingAt(days, earlier[earlier.length - 1]);

  return { current, previous, activeToday };
}
