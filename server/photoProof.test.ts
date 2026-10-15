// Run: node --experimental-strip-types --test server/photoProof.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { assessFreshness, decidePhotoWater, type PhotoDecisionInput } from "./photoProof.ts";

const NY = "America/New_York";
const today = "2026-10-14";
const at = (iso: string) => new Date(iso).getTime();

test("freshness: camera capture is fresh; anything dated before today is old", () => {
  assert.equal(assessFreshness({ source: "camera", lastModified: at("2026-10-15T01:05:00Z"), localDate: today, timeZone: NY }), "fresh");
  assert.equal(assessFreshness({ source: "camera", lastModified: at("2026-09-20T15:00:00Z"), localDate: today, timeZone: NY }), "old");
});

test("freshness: gallery file needs a capture date of today", () => {
  // Donald's logo: from Downloads, saved last month, no capture date.
  assert.equal(assessFreshness({ source: "gallery", lastModified: at("2026-09-18T12:00:00Z"), localDate: today, timeZone: NY }), "old");
  assert.equal(assessFreshness({ source: "gallery", lastModified: at("2026-10-14T20:00:00Z"), localDate: today, timeZone: NY }), "unverified");
  assert.equal(assessFreshness({ source: "gallery", capturedAt: at("2026-10-14T18:00:00Z"), lastModified: at("2026-10-14T18:00:00Z"), localDate: today, timeZone: NY }), "fresh");
  assert.equal(assessFreshness({ source: "gallery", capturedAt: at("2026-10-12T18:00:00Z"), localDate: today, timeZone: NY }), "old");
});

test("freshness: 9 PM in New York is still today even though it's tomorrow in UTC", () => {
  assert.equal(assessFreshness({ source: "gallery", capturedAt: at("2026-10-15T01:00:00Z"), localDate: today, timeZone: NY }), "fresh");
});

const base: PhotoDecisionInput = { hasGoal: true, duplicate: false, confidence: 0.9, relevant: true, evidence: "fresh_output", needsContext: false, freshness: "fresh" };

test("approved: goal-aligned fresh work, captured today → 1 water", () => {
  assert.deepEqual(decidePhotoWater(base).result, "approved");
  assert.equal(decidePhotoWater(base).water, 1);
});

test("no goal → held, 0 water (the live-test loophole)", () => {
  const d = decidePhotoWater({ ...base, hasGoal: false, evidence: "finished_artifact", freshness: "old" });
  assert.equal(d.result, "held_no_goal");
  assert.equal(d.water, 0);
});

test("duplicate image → 0 water before anything else", () => {
  assert.equal(decidePhotoWater({ ...base, duplicate: true }).result, "duplicate");
  assert.equal(decidePhotoWater({ ...base, duplicate: true }).water, 0);
});

test("confidence bands: <0.60 reject, 0.60–0.74 clarify + hold, 0.75+ can approve", () => {
  assert.equal(decidePhotoWater({ ...base, confidence: 0.59 }).result, "rejected");
  assert.equal(decidePhotoWater({ ...base, confidence: 0.6 }).result, "held_clarify");
  assert.equal(decidePhotoWater({ ...base, confidence: 0.74 }).result, "held_clarify");
  assert.equal(decidePhotoWater({ ...base, confidence: 0.75 }).result, "approved");
});

test("finished artifact (logo, design, screenshot, stock/AI) → ask 'did you make or change this today?', hold", () => {
  const d = decidePhotoWater({ ...base, evidence: "finished_artifact" });
  assert.equal(d.result, "held_clarify");
  assert.equal(d.clarify, "did_today");
  assert.equal(d.water, 0);
});

test("old or unverified gallery file → clarify + hold, even for real work", () => {
  assert.equal(decidePhotoWater({ ...base, freshness: "old" }).result, "held_clarify");
  assert.equal(decidePhotoWater({ ...base, freshness: "unverified" }).result, "held_clarify");
});

test("meme / pet / unrelated → rejected", () => {
  assert.equal(decidePhotoWater({ ...base, evidence: "meme_or_unrelated" }).result, "rejected");
  assert.equal(decidePhotoWater({ ...base, relevant: false }).result, "rejected");
});

test("thin goal context → one discovery question, hold", () => {
  const d = decidePhotoWater({ ...base, needsContext: true, confidence: 0.7 });
  assert.equal(d.result, "held_clarify");
  assert.equal(d.clarify, "context");
});
