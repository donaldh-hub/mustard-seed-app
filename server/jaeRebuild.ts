import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export type RebuildInstanceType =
  | "clarity"       // instance 1
  | "consistency"   // instance 2
  | "mindset"       // instance 3
  | "adaptation"    // instance 4
  | "courage"       // instance 5
  | "practice"      // instance 6
  | "integration";  // instance 7

export interface RebuildJaeRequest {
  userName: string;
  instanceNumber: number;
  instanceType: RebuildInstanceType;
  prompts: { prompt: string; response: string }[];
  priorMemory?: Record<string, any>; // relevant fields from earlier instances
  // Day 6 only
  characterTrack?: "male" | "female" | "neutral";
  chapterNumber?: number;
  // Day 7 only
  stageNumber?: number;
  day7GoalPlan?: Record<string, any>;
}

export interface RebuildJaeResponse {
  reflection: string;
  followUpQuestion: string | null;
  // Day 5 only — holds the soft breadcrumb line
  breadcrumb?: string;
  // Day 7 stage synthesis fields
  stageSynthesis?: string;
  // Day 7 final plan (stage 5 response)
  actionPlan?: {
    goalConfirmed: string;
    finalWhy: string;
    ongoingSmallStep: string;
    mindsetPlan: string;
    feedbackLoop: string;
    nextCourageousAction: string;
  };
  // Day 6 chapter: which heartbeat the user identified
  heartbeatIdentified?: string;
}

const HEARTBEAT_CONTEXT: Record<RebuildInstanceType, string> = {
  clarity: "Clarity of Vision & Why — knowing exactly what you're building and why it matters.",
  consistency: "Small Steps + Consistency — progress compounds when small actions are repeated daily.",
  mindset: "Mindset over Method — your thinking determines your execution more than any tactic.",
  adaptation: "Feedback & Adaptation — review what happened, adjust what's needed, and keep moving.",
  courage: "Courageous Action — act even when it's uncomfortable, uncertain, or inconvenient.",
  practice: "Applied Practice — consolidating all five Heartbeats through Jordan's story.",
  integration: "Integration — applying all five Heartbeats to your own goal to produce a concrete plan.",
};

// ─── Jordan's story context for Day 6 chapters ──────────────────────────────
const JORDAN_CHAPTERS: Record<number, { summary: string; heartbeat: string }> = {
  1: {
    summary: "Jordan decides to learn guitar to play one song at their nephew's birthday party in three months. They download five apps, read three books, and sign up for two online courses — but haven't actually touched a guitar yet.",
    heartbeat: "Clarity of Vision & Why",
  },
  2: {
    summary: "Jordan starts practicing 15 minutes every morning before work. Some days the fingers hurt, the chords sound terrible, and they almost skip it — but they show up anyway. Two weeks in, the chord changes are smoother.",
    heartbeat: "Small Steps + Consistency",
  },
  3: {
    summary: "Jordan hits a wall. Compares their progress to YouTube guitarists and feels embarrassed. Considers quitting. Then shifts: stops measuring against professionals, starts measuring against yesterday's version of themselves.",
    heartbeat: "Mindset over Method",
  },
  4: {
    summary: "Jordan gets feedback from a musician friend: stop running through scales, just play songs you like and learn the chords as you go. Jordan adjusts the whole approach and finds practicing actually enjoyable now. The birthday party song comes together.",
    heartbeat: "Feedback & Adaptation and Courageous Action",
  },
};

// ─── Jai check-in follow-up question bank ───────────────────────────────────
// 8 candidates per instance (mirrors client/src/content/rebuildContent.ts —
// duplicated server-side per this file's existing pattern of not importing
// client content, same as HEARTBEAT_CONTEXT/JORDAN_CHAPTERS above). Jai picks
// 1-2 relevant to what the user actually wrote; never the full list, never a
// fixed order. Bracketed tokens must be filled from real prior memory, or the
// question skipped if that memory isn't available yet.
const FOLLOWUP_QUESTIONS: Record<number, string[]> = {
  1: [
    "Which part of your why feels truest right now — not the version you'd say out loud to someone else, but the one underneath it?",
    "If this goal disappeared tomorrow, would the why still matter to you?",
    "Who else, if anyone, is tied up in this why?",
    "What would change about how you show up today if you kept this why in view?",
    "Is there a fear hiding inside this why that you haven't said out loud yet?",
    "Where did this why already show up for you this past week?",
    "When you pictured who you'd become by reaching this goal, what surprised you about that answer?",
    "What would it cost you to keep living as if this goal didn't matter?",
  ],
  2: [
    "What almost talked you out of choosing [non-negotiable minimum] as your minimum?",
    "Honestly — is [non-negotiable minimum] small enough to survive a genuinely bad day?",
    "What's the earliest point in your day this could realistically happen?",
    "What's broken a similar streak for you before?",
    "Who or what will remind you to do this when motivation drops?",
    "If you miss a day, what will you do instead of quitting on the whole thing?",
    "How does this action actually connect back to your why?",
    "What would seven straight days of this prove to you?",
  ],
  3: [
    "Where has that story shown up in other parts of your life, not just this goal?",
    "What would you say to a friend who told you that exact story about themselves?",
    "Is [reframed truth] still honest, or did it swing too far the other way?",
    "What's the earliest moment you could catch that story starting, next time?",
    "Who taught you to believe the original version of that story?",
    "What would it mean about you if [reframed truth] were the real one all along?",
    "How does this belief connect to the why you named on Day 1?",
    "What's one piece of evidence from this week that already contradicts the old story?",
  ],
  4: [
    "What did you expect versus what's actually happened so far?",
    "Where have you been treating a result as a verdict on you instead of information?",
    "Is [chosen adjustment] a real change, or the same approach with more effort?",
    "What pattern keeps showing up across what's working and what isn't?",
    "What would you try differently if failing at it were completely fine?",
    "Does this adjustment still honor the why you named on Day 1?",
    "What's one thing that's working, even partially, that you almost overlooked?",
    "If [chosen adjustment] held for 30 days, what would it build?",
  ],
  5: [
    "What's the actual worst case if you do this, and could you survive it?",
    "What has avoiding [avoided action] already cost you?",
    "Is this the smallest true step, or are you hiding inside a bigger plan?",
    "Who's affected if you don't take this step?",
    "What do you already know that makes this less risky than it feels?",
    "What would it mean about you if you took this step and it didn't go perfectly?",
    "How does this connect to the belief you shifted on Day 3?",
    "What's stopping you from doing this today instead of 'soon'?",
  ],
  6: [
    "Which chapter of Jordan's story felt closest to something you're actually living right now?",
    "What made that Heartbeat easier to spot in Jordan's story than in your own life?",
    "You named [hardest heartbeat] as the hardest one for you — what does a hard day around that actually look like?",
    "If you were narrating your own week like Jordan's story, what would this chapter be called?",
    "Which Heartbeat came easiest to spot for you, and why do you think that one stands out?",
    "What would it take for [hardest heartbeat] to move even a little this week?",
    "Where did you see a version of Jordan's turning point show up for you, even in a small way?",
    "Now that you've spotted all five in someone else's story — which one do you trust yourself with least right now?",
  ],
  7: [
    "Looking at the whole week, which day's work are you most likely to actually keep using?",
    "What changed about your why between Day 1 and today — even slightly?",
    "Is [ongoing small step] still small enough to survive a bad week, or has it crept up?",
    "What pattern from this week do you most want to protect going forward?",
    "Which Heartbeat are you proudest of this week, and which one still needs the most attention?",
    "If nothing else from this week stuck, what's the one thing you'd want to keep?",
    "What would thirty more days of this same plan actually build?",
    "Is this still the right goal, or is something else calling to you now?",
  ],
};

function followUpBlock(instanceNumber: number): string {
  const questions = FOLLOWUP_QUESTIONS[instanceNumber];
  if (!questions) return "";
  return `
Optional follow-up bank for this instance — a menu, not a script:
${questions.map((q) => `- ${q}`).join("\n")}

If (and only if) one of these is genuinely relevant to what they just wrote, use it (adapted to their words) as your "followUpQuestion" value instead of writing a new one from scratch. Otherwise ignore this bank entirely and write your own grounded question as usual.
- Never use more than one of these in a single reply, and never list several — pick at most one.
- Any bracketed token like [non-negotiable minimum] must be replaced with the user's actual saved value from the context above. If that value isn't available, don't use that question.
- It should read as your own natural next question, not a quiz prompt.`;
}

function jordanPronoun(track: "male" | "female" | "neutral") {
  if (track === "male") return { subject: "he", object: "him", possessive: "his" };
  if (track === "female") return { subject: "she", object: "her", possessive: "her" };
  return { subject: "they", object: "them", possessive: "their" };
}

// ─── Main generation function ────────────────────────────────────────────────

export async function generateRebuildReflection(
  req: RebuildJaeRequest
): Promise<RebuildJaeResponse> {
  const heartbeatDesc = HEARTBEAT_CONTEXT[req.instanceType];
  const responseBlock = req.prompts
    .map((p) => `Prompt: ${p.prompt}\nResponse: ${p.response}`)
    .join("\n\n");

  // ── Day 6: chapter identification ──────────────────────────────────────────
  if (req.instanceType === "practice" && req.chapterNumber !== undefined) {
    const chapter = JORDAN_CHAPTERS[req.chapterNumber];
    const pronoun = jordanPronoun(req.characterTrack ?? "neutral");
    const systemPrompt = `You are Jai — calm, warm, encouraging — inside the Mustard Seed app.

The user is playing the "Heartbeat Spotter" game for Day 6. You just told them about a chapter from Jordan's story:

Chapter ${req.chapterNumber}: "${chapter.summary.replace(/they/g, pronoun.subject).replace(/them/g, pronoun.object).replace(/their/g, pronoun.possessive)}"

The correct Heartbeat in this chapter is: ${chapter.heartbeat}.

The user's answer: "${req.prompts[0]?.response ?? ""}"

Rules:
- If they got it right (or close), affirm briefly and explain WHY this chapter shows that Heartbeat — 2 sentences.
- If they missed it, don't make them feel wrong. Gently reveal which Heartbeat it was and why — 2-3 sentences.
- Keep it conversational, not a lecture.
- End with a one-line bridge to the next chapter OR (if chapter 4) to the final bridge question.

Respond ONLY with valid JSON: { "reflection": "...", "followUpQuestion": null, "heartbeatIdentified": "..." }`;

    return callOpenAI(systemPrompt, responseBlock, {
      reflection: "Good thinking — that's exactly what's happening here.",
      followUpQuestion: null,
      heartbeatIdentified: chapter.heartbeat,
    });
  }

  // ── Day 7: stage synthesis ──────────────────────────────────────────────────
  if (req.instanceType === "integration" && req.stageNumber !== undefined) {
    const isFinalStage = req.stageNumber === 5;
    const systemPrompt = `You are Jai — calm, grounded, warm — inside the Mustard Seed app.

${req.userName} is in Day 7 of the 7-Day Rebuild: the integration stage. They are building their Actionable Goal Plan.

This is Stage ${req.stageNumber} of 5.
${isFinalStage ? "This is the final synthesis — bring everything together into a completed plan." : "Reflect on this stage's input, then gently bridge to the next stage."}

Prior plan context: ${JSON.stringify(req.day7GoalPlan ?? {})}

Their response to this stage: ${responseBlock}

Rules:
- Be brief: 2-3 sentences of reflection.
- Reference something specific they said — don't be generic.
- ${isFinalStage ? "End with something grounding — they just built something real." : "End with a one-line forward-pointing bridge to the next stage."}
- Sound like a coach who has been with them all week, not a first session.
${isFinalStage ? followUpBlock(7) : ""}

Respond ONLY with valid JSON: { "reflection": "...", "followUpQuestion": null, "stageSynthesis": "..." }`;

    return callOpenAI(systemPrompt, responseBlock, {
      reflection: "You're building something real here.",
      followUpQuestion: null,
      stageSynthesis: "",
    });
  }

  // ── Instances 1–5: standard reflection ────────────────────────────────────
  const priorSummary = req.priorMemory
    ? Object.entries(req.priorMemory)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")
    : "";

  const isCourage = req.instanceType === "courage";

  const systemPrompt = `You are Jai — calm, grounded, warm, honest — inside the Mustard Seed app.

${req.userName} is on Instance ${req.instanceNumber} of the 7-Day Rebuild. Today's Heartbeat: ${heartbeatDesc}

${priorSummary ? `Context from earlier instances:\n${priorSummary}\n` : ""}

Your job:
1. Reflect on what they actually wrote — 2-3 sentences. Reference something specific.
2. Ask exactly one grounded follow-up question (unless this is the synthesis step).
3. Sound like someone who has been with them all week, not a stranger.

Rules:
- No generic encouragement. Be specific to what they said.
- No multiple questions. One only.
- No clinical language, no guru-speak.
- Grace without excuses.
${isCourage ? "- This Heartbeat is about doing, not just planning. Your reflection should honor both the naming AND gently hold space for the follow-up action." : ""}

${isCourage ? `After the reflection and question, add a short breadcrumb line (property: "breadcrumb") — something like: "What you're building here is worth continuing past this week. We'll talk about that soon — for now, just notice what you just did." Keep it warm, no price mention, no hard CTA.` : ""}
${followUpBlock(req.instanceNumber)}

Respond ONLY with valid JSON:
{
  "reflection": "...",
  "followUpQuestion": "...",
  ${isCourage ? '"breadcrumb": "...",' : ""}
}`;

  return callOpenAI(systemPrompt, responseBlock, {
    reflection: "I see you showing up — that matters.",
    followUpQuestion: "What feels most true to you from what you just wrote?",
    ...(isCourage ? { breadcrumb: "What you're building here is worth continuing past this week. We'll talk about that soon." } : {}),
  });
}

async function callOpenAI(
  systemPrompt: string,
  userContent: string,
  fallback: RebuildJaeResponse
): Promise<RebuildJaeResponse> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.7,
      max_tokens: 600,
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}
