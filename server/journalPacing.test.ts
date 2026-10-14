// Run: node --experimental-strip-types --test server/journalPacing.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeJournalGate, isEntryBlocked, nextLocalDayAt } from "./journalPacing.ts";

const NY = "America/New_York";
const e = (dayNumber: number, session: string, createdAt: string) => ({ dayNumber, session, createdAt });

test("fresh start: day 1 evening waits on the morning", () => {
  const g = computeJournalGate([], new Date("2026-10-14T12:00:00Z"), NY);
  assert.deepEqual(g.locked, { day: 1, session: "evening" });
  assert.equal(g.unlocksAt, null);
  assert.equal(isEntryBlocked(g, 1, "morning"), false);
  assert.equal(isEntryBlocked(g, 1, "intention"), false);
  assert.equal(isEntryBlocked(g, 1, "evening"), true);
});

test("evening opens 8 hours after the morning", () => {
  const entries = [e(1, "morning", "2026-10-14T11:00:00Z")]; // 7:00 AM New York
  const early = computeJournalGate(entries, new Date("2026-10-14T13:00:00Z"), NY);
  assert.deepEqual(early.locked, { day: 1, session: "evening" });
  assert.equal(early.unlocksAt, "2026-10-14T19:00:00.000Z"); // 3:00 PM New York
  assert.equal(isEntryBlocked(early, 1, "evening"), true);
  assert.equal(isEntryBlocked(early, 2, "morning"), true);

  const later = computeJournalGate(entries, new Date("2026-10-14T19:00:00Z"), NY);
  assert.deepEqual(later.locked, { day: 2, session: "morning" });
  assert.equal(later.unlocksAt, null);
  assert.equal(isEntryBlocked(later, 1, "evening"), false);
});

test("next morning opens at 4 AM local the next day, even after a 9 PM evening", () => {
  const entries = [
    e(1, "morning", "2026-10-14T11:00:00Z"),
    e(1, "evening", "2026-10-15T01:00:00Z"), // 9:00 PM Oct 14 New York
  ];
  const g = computeJournalGate(entries, new Date("2026-10-15T03:00:00Z"), NY);
  assert.deepEqual(g.locked, { day: 2, session: "morning" });
  assert.equal(g.unlocksAt, "2026-10-15T08:00:00.000Z"); // 4:00 AM Oct 15 New York
});

test("an evening entry just after midnight local waits for the following 4 AM", () => {
  const entries = [
    e(1, "morning", "2026-10-14T13:00:00Z"),
    e(1, "evening", "2026-10-15T04:30:00Z"), // 12:30 AM Oct 15 New York
  ];
  const g = computeJournalGate(entries, new Date("2026-10-15T09:00:00Z"), NY);
  assert.equal(g.unlocksAt, "2026-10-16T08:00:00.000Z"); // 4:00 AM Oct 16
});

test("time zone matters: same instant, Los Angeles opens three hours later", () => {
  const entries = [e(1, "morning", "2026-10-14T15:00:00Z"), e(1, "evening", "2026-10-15T02:00:00Z")];
  const g = computeJournalGate(entries, new Date("2026-10-15T03:00:00Z"), "America/Los_Angeles");
  assert.equal(g.unlocksAt, "2026-10-15T11:00:00.000Z"); // 4:00 AM PDT
});

test("DST: 4 AM the day clocks fall back in New York", () => {
  // Nov 1, 2026 is the fall-back date; 4 AM that day is EST (UTC-5).
  assert.equal(nextLocalDayAt(new Date("2026-11-01T01:00:00Z"), 4, NY).toISOString(), "2026-11-01T09:00:00.000Z");
});

test("bad or missing time zone falls back to UTC", () => {
  const entries = [e(1, "morning", "2026-10-14T08:00:00Z"), e(1, "evening", "2026-10-14T20:00:00Z")];
  const g = computeJournalGate(entries, new Date("2026-10-14T21:00:00Z"), "Not/AZone");
  assert.equal(g.unlocksAt, "2026-10-15T04:00:00.000Z");
});

test("all six sessions done: nothing locked, grounding statement allowed", () => {
  const entries = [
    e(1, "morning", "2026-10-10T12:00:00Z"), e(1, "evening", "2026-10-10T22:00:00Z"),
    e(2, "morning", "2026-10-11T12:00:00Z"), e(2, "evening", "2026-10-11T22:00:00Z"),
    e(3, "morning", "2026-10-12T12:00:00Z"), e(3, "evening", "2026-10-12T22:00:00Z"),
  ];
  const g = computeJournalGate(entries, new Date("2026-10-13T12:00:00Z"), NY);
  assert.equal(g.locked, null);
  assert.equal(isEntryBlocked(g, 3, "grounding_statement"), false);
});

test("grounding statement is blocked while day 3 evening is still waiting", () => {
  const entries = [
    e(1, "morning", "2026-10-10T12:00:00Z"), e(1, "evening", "2026-10-10T22:00:00Z"),
    e(2, "morning", "2026-10-11T12:00:00Z"), e(2, "evening", "2026-10-11T22:00:00Z"),
    e(3, "morning", "2026-10-12T12:00:00Z"),
  ];
  const g = computeJournalGate(entries, new Date("2026-10-12T13:00:00Z"), NY);
  assert.deepEqual(g.locked, { day: 3, session: "evening" });
  assert.equal(isEntryBlocked(g, 3, "grounding_statement"), true);
});
