// Run: node --experimental-strip-types --test server/rebuildProgress.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeRebuildProgress, type RebuildInstanceLike } from "./rebuildProgress.ts";

const NOW = new Date("2026-10-14T12:00:00Z");
const HOURS = 24;

function days(statuses: string[], completedAt: Record<number, string> = {}): RebuildInstanceLike[] {
  return statuses.map((status, i) => ({
    instanceNumber: i + 1,
    status,
    completedAt: completedAt[i + 1] ?? null,
    lastActivityAt: null,
  }));
}

test("never opened: no rows", () => {
  const s = summarizeRebuildProgress([], NOW, HOURS);
  assert.equal(s.opened, false);
  assert.equal(s.currentDay, null);
  assert.equal(s.finished, false);
  assert.equal(s.day2Started, false);
});

test("fresh start: on Day 1, unlocked", () => {
  const s = summarizeRebuildProgress(days(["unlocked", "locked", "locked", "locked", "locked", "locked", "locked"]), NOW, HOURS);
  assert.equal(s.currentDay, 1);
  assert.equal(s.currentDayStatus, "unlocked");
  assert.deepEqual(s.completedDays, []);
});

test("Day 1 done under 24h ago: Day 2 waiting, with unlock time", () => {
  const rows = days(["completed", "locked", "locked", "locked", "locked", "locked", "locked"], { 1: "2026-10-14T02:00:00Z" });
  const s = summarizeRebuildProgress(rows, NOW, HOURS);
  assert.equal(s.currentDay, 2);
  assert.equal(s.currentDayStatus, "locked");
  assert.equal(s.currentDayUnlocksAt, "2026-10-15T02:00:00.000Z");
  assert.equal(s.day2Started, false);
});

test("gate elapsed but not yet re-fetched: reports unlocked without writing", () => {
  const rows = days(["completed", "locked", "locked", "locked", "locked", "locked", "locked"], { 1: "2026-10-12T02:00:00Z" });
  const s = summarizeRebuildProgress(rows, NOW, HOURS);
  assert.equal(s.currentDayStatus, "unlocked");
  assert.equal(s.days[1].storedStatus, "locked");
  assert.equal(s.currentDayUnlocksAt, null);
  assert.equal(rows[1].status, "locked");
});

test("Day 2 reflection submitted: day2Started", () => {
  const s = summarizeRebuildProgress(days(["completed", "in_progress", "locked", "locked", "locked", "locked", "locked"]), NOW, HOURS);
  assert.equal(s.currentDay, 2);
  assert.equal(s.day2Started, true);
});

test("all seven completed: finished, current is Day 7", () => {
  const s = summarizeRebuildProgress(days(Array(7).fill("completed")), NOW, HOURS);
  assert.equal(s.finished, true);
  assert.equal(s.currentDay, 7);
  assert.equal(s.completedDays.length, 7);
  assert.equal(s.day2Started, true);
});
