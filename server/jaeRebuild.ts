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
    const systemPrompt = `You are Jae — calm, warm, encouraging — inside the Mustard Seed app.

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
    const systemPrompt = `You are Jae — calm, grounded, warm — inside the Mustard Seed app.

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

  const systemPrompt = `You are Jae — calm, grounded, warm, honest — inside the Mustard Seed app.

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
