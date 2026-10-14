// Read-only summary of where a user is in the 7-Day Rebuild, for the admin
// route. Mirrors the lazy 24-hour unlock gate in routes.ts
// (applyRebuildUnlockGate) without writing anything: a day whose stored status
// is still "locked" but whose gate has elapsed is reported as "unlocked".
// Kept free of imports so `node --test` can run rebuildProgress.test.ts
// without dependencies.

export type RebuildDayStatus = "locked" | "unlocked" | "in_progress" | "completed";

export interface RebuildInstanceLike {
  instanceNumber: number;
  status: string;
  completedAt: Date | string | null;
  lastActivityAt: Date | string | null;
}

export interface RebuildProgressSummary {
  // false when the user has never opened /rebuild (no rows exist yet)
  opened: boolean;
  // The day the user is on: the first day not yet completed, or the last day
  // once all are completed. null when the Rebuild was never opened.
  currentDay: number | null;
  currentDayStatus: RebuildDayStatus | null;
  // When currentDay is still waiting on the 24-hour gate, when it opens.
  currentDayUnlocksAt: string | null;
  completedDays: number[];
  finished: boolean;
  // A day counts as started once the user submits a reflection for it
  // (status in_progress) or completes it.
  day2Started: boolean;
  days: Array<{
    day: number;
    status: RebuildDayStatus;
    storedStatus: string;
    completedAt: string | null;
    lastActivityAt: string | null;
  }>;
}

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function summarizeRebuildProgress(
  instances: RebuildInstanceLike[],
  now: Date,
  unlockHours: number,
): RebuildProgressSummary {
  const sorted = [...instances].sort((a, b) => a.instanceNumber - b.instanceNumber);
  const byNumber = new Map(sorted.map((i) => [i.instanceNumber, i]));
  const gateMs = unlockHours * 60 * 60 * 1000;

  const unlocksAtFor = (day: number): Date | null => {
    const prev = byNumber.get(day - 1);
    if (!prev || prev.status !== "completed" || !prev.completedAt) return null;
    const completedMs = new Date(prev.completedAt).getTime();
    return Number.isNaN(completedMs) ? null : new Date(completedMs + gateMs);
  };

  const days = sorted.map((i) => {
    let status = i.status as RebuildDayStatus;
    if (status === "locked") {
      const unlocksAt = unlocksAtFor(i.instanceNumber);
      if (unlocksAt && now.getTime() >= unlocksAt.getTime()) status = "unlocked";
    }
    return {
      day: i.instanceNumber,
      status,
      storedStatus: i.status,
      completedAt: toIso(i.completedAt),
      lastActivityAt: toIso(i.lastActivityAt),
    };
  });

  const completedDays = days.filter((d) => d.status === "completed").map((d) => d.day);
  const firstOpen = days.find((d) => d.status !== "completed");
  const current = firstOpen ?? days[days.length - 1] ?? null;
  const waitingUnlock = current && current.status === "locked" ? unlocksAtFor(current.day) : null;
  const day2 = days.find((d) => d.day === 2);

  return {
    opened: days.length > 0,
    currentDay: current?.day ?? null,
    currentDayStatus: current?.status ?? null,
    currentDayUnlocksAt: waitingUnlock ? waitingUnlock.toISOString() : null,
    completedDays,
    finished: days.length > 0 && !firstOpen,
    day2Started: !!day2 && (day2.status === "in_progress" || day2.status === "completed"),
    days,
  };
}
