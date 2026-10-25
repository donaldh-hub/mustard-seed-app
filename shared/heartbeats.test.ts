// Run: node --experimental-strip-types --test shared/heartbeats.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { heartbeatStanding, heartbeatChatOpener, HEARTBEAT_ORDER, HEARTBEAT_NAMES, HEARTBEAT_WEIGHTS, SHOW_WEIGHTS } from "./heartbeats.ts";

const s = (clarity: number, consistency: number, mindset: number, adaptation: number, courage: number) =>
  ({ clarity, consistency, mindset, adaptation, courage });

test("locked names and loop order", () => {
  assert.deepEqual(HEARTBEAT_ORDER, ["clarity", "consistency", "mindset", "adaptation", "courage"]);
  assert.deepEqual(HEARTBEAT_ORDER.map((k) => HEARTBEAT_NAMES[k]), [
    "Clarity of Vision & Why", "Small Steps + Consistency", "Mindset over Method", "Feedback & Adaptation", "Courageous Action",
  ]);
});

test("weights are config only and hidden", () => {
  assert.equal(SHOW_WEIGHTS, false);
  assert.equal(Object.values(HEARTBEAT_WEIGHTS).reduce((a, b) => a + b, 0), 100);
});

test("one strongest, focus is the saved weakest", () => {
  const r = heartbeatStanding(s(3, 4, 4.5, 4, 4), "clarity");
  assert.deepEqual(r.strongest, ["mindset"]);
  assert.equal(r.focus, "clarity");
  assert.deepEqual(r.tiedWithFocus, []);
});

test("tied strongest: all of them are highlighted", () => {
  assert.deepEqual(heartbeatStanding(s(3, 5, 5, 4, 4), "clarity").strongest, ["consistency", "mindset"]);
});

test("tied lowest: focus stays the saved one, the others are named as tied", () => {
  const r = heartbeatStanding(s(4, 2.5, 5, 2.5, 4), "consistency");
  assert.equal(r.focus, "consistency");
  assert.deepEqual(r.tiedWithFocus, ["adaptation"]);
});

test("all five equal: no strongest", () => {
  const r = heartbeatStanding(s(4, 4, 4, 4, 4), "clarity");
  assert.deepEqual(r.strongest, []);
  assert.equal(r.focus, "clarity");
  assert.deepEqual(r.tiedWithFocus, ["consistency", "mindset", "adaptation", "courage"]);
});

test("no assessment: neutral", () => {
  assert.deepEqual(heartbeatStanding(null, null), { strongest: [], focus: null, tiedWithFocus: [] });
  assert.deepEqual(heartbeatStanding({}, ""), { strongest: [], focus: null, tiedWithFocus: [] });
});

test("no saved weakest (older rows): focus falls back to the lowest score", () => {
  assert.equal(heartbeatStanding(s(4, 3, 5, 4, 4), "").focus, "consistency");
});

test("Jai opener carries the saved score so the user never retypes it", () => {
  const t = heartbeatChatOpener("clarity", s(3, 4, 4.5, 4, 4), "clarity", "Donald");
  assert.match(t, /^Donald, let's talk about Heartbeat 1, Clarity of Vision & Why\./);
  assert.match(t, /3\.0 out of 5\. It's your focus Heartbeat right now\./);
  assert.match(heartbeatChatOpener("mindset", s(3, 4, 4.5, 4, 4), "clarity"), /4\.5 out of 5\. It's your strongest Heartbeat\./);
  assert.match(heartbeatChatOpener("courage", null, null), /haven't taken the assessment yet/);
});
