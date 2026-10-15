// Run: node --experimental-strip-types --test server/showUpStreak.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeShowUpStreak } from "./showUpStreak.ts";

const T = "2026-10-15";

test("no activity: 0", () => {
  assert.deepEqual(computeShowUpStreak([], T), { current: 0, previous: 0, activeToday: false });
});

test("Donald's case: active yesterday and today (journal only) → 2", () => {
  const s = computeShowUpStreak(["2026-10-14", "2026-10-15"], T);
  assert.equal(s.current, 2);
  assert.equal(s.activeToday, true);
});

test("several entries the same day count once", () => {
  assert.equal(computeShowUpStreak(["2026-10-15", "2026-10-15", "2026-10-15"], T).current, 1);
});

test("active through yesterday, not yet today: still alive", () => {
  const s = computeShowUpStreak(["2026-10-12", "2026-10-13", "2026-10-14"], T);
  assert.equal(s.current, 3);
  assert.equal(s.activeToday, false);
});

test("missed yesterday: streak is 0, previous run remembered", () => {
  const s = computeShowUpStreak(["2026-10-11", "2026-10-12", "2026-10-13"], T);
  assert.equal(s.current, 0);
  assert.equal(s.previous, 3);
});

test("new streak today after a gap: current 1, previous = old run", () => {
  const s = computeShowUpStreak(["2026-10-10", "2026-10-11", "2026-10-15"], T);
  assert.equal(s.current, 1);
  assert.equal(s.previous, 2);
});

test("month boundary", () => {
  assert.equal(computeShowUpStreak(["2026-09-30", "2026-10-01"], "2026-10-01").current, 2);
});

test("future-dated and malformed dates are ignored", () => {
  assert.equal(computeShowUpStreak(["2026-10-16", "bad", "2026-10-15"], T).current, 1);
});
