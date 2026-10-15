// Acceptance check for photo proof → water. Runs the real vision model and
// the same water rules the app uses on photos you drop into .photo-tests/
// (git-ignored), and prints Jai's reply + the water result for each.
//
// 1. In Replit, make a folder named .photo-tests and drag photos into it,
//    named <goal>-<what>-<camera|gallery>.<jpg|png>, for example:
//      business-namelist-camera.jpg   (a list you just wrote, photo taken today)
//      business-logo-gallery.png      (your old logo file)
//      business-pet-camera.jpg        (your pet / any random object)
//      business-meme-gallery.png      (a meme or random screenshot)
//      writing-page-camera.jpg   writing-pet-camera.jpg
//      gardening-bed-camera.jpg  gardening-pet-camera.jpg
//    "camera" = a photo you took today (treated like the in-app camera);
//    "gallery" = an existing file (needs a capture date of today to count).
// 2. Run:  npx tsx scripts/photo-proof-check.ts
// Writes nothing to the database; sends nothing anywhere but the AI check.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { analyzePhoto } from "../server/visionAnalysis";
import { assessFreshness, decidePhotoWater } from "../server/photoProof";
import { photoReplyText } from "../server/photoReview";
import { readExifCaptureTime } from "../client/src/lib/photoMeta";

const GOALS: Record<string, { title: string; why: string; memory: string[] }> = {
  business: {
    title: "Find a name for my business",
    why: "I want something that's mine",
    memory: ["Journal Day 3 evening: I wrote some names down / keep one place for my name ideas", "Journal intention: come up with a name for my business"],
  },
  writing: {
    title: "Finish the first chapter of my book",
    why: "I've carried this story for ten years",
    memory: ["Journal intention: finish the first chapter of my book", "Journal Day 2 evening: the quiet hour before everyone woke up"],
  },
  gardening: {
    title: "Start a vegetable garden this spring",
    why: "teach my daughter where food comes from",
    memory: ["Journal intention: start a vegetable garden this spring", "Chat: we bought tomato seedlings"],
  },
};

const dir = path.resolve(".photo-tests");
if (!fs.existsSync(dir)) {
  console.log(`No .photo-tests folder. Make one and add photos (see the top of this file).`);
  process.exit(0);
}
const files = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
const tz = "America/New_York";
const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
const seen = new Set<string>();

for (const f of files) {
  const [goalKey] = f.split("-");
  const goal = GOALS[goalKey];
  if (!goal) { console.log(`skip ${f}: name must start with business-, writing-, or gardening-`); continue; }
  const source = /-camera\./i.test(f) ? "camera" : "gallery";
  const buf = fs.readFileSync(path.join(dir, f));
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  const capturedAt = readExifCaptureTime(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  // A "camera" test photo stands in for an in-app capture: its time is now.
  const lastModified = source === "camera" ? Date.now() : fs.statSync(path.join(dir, f)).mtimeMs;
  const freshness = assessFreshness({ source, lastModified, capturedAt, localDate, timeZone: tz });
  const mime = /\.png$/i.test(f) ? "image/png" : /\.webp$/i.test(f) ? "image/webp" : "image/jpeg";
  const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;

  console.log(`\n▶ ${f}  (${source}, capture date: ${capturedAt ? new Date(capturedAt).toLocaleString() : "none"}, freshness: ${freshness})`);
  for (const hasGoal of [false, true]) {
    const analysis = await analyzePhoto(dataUrl, "", hasGoal ? goal.title : null, null, "Donald", hasGoal ? { goalWhy: goal.why, recentMemory: goal.memory } : {});
    const duplicate = hasGoal && seen.has(hash);
    const decision = decidePhotoWater({
      hasGoal, duplicate, confidence: analysis.confidence, relevant: analysis.action_type !== "unknown_or_irrelevant",
      evidence: analysis.evidence_type ?? "unknown", needsContext: analysis.needs_context === true, freshness,
    });
    console.log(`  ${hasGoal ? `goal "${goal.title}"` : "no goal"}: ${decision.result.toUpperCase()} · water ${decision.water} · confidence ${analysis.confidence} · ${analysis.evidence_type} · ${analysis.action_type}`);
    console.log(`    reason: ${decision.reason}`);
    console.log(`    Jai: ${photoReplyText(decision, analysis)}`);
  }
  // Same image again with a goal → already counted.
  if (!seen.has(hash)) {
    seen.add(hash);
    const again = decidePhotoWater({ hasGoal: true, duplicate: true, confidence: 1, relevant: true, evidence: "fresh_output", needsContext: false, freshness });
    console.log(`  same image again: ${again.result.toUpperCase()} · water ${again.water}`);
  }
}
console.log("\nDone.");
