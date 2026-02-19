import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface VisionAnalysisResult {
  labels: string[];
  confidence: number;
  action_type: string;
  proof_level: number;
  water_award: number;
  water_reason: string;
  risk_flags: string[];
  tags: string[];
  next_prompt: string;
}

const VALID_ACTION_TYPES = [
  "gym_activity",
  "outdoor_walk_run",
  "meal_prep_food_choice",
  "scale_or_metrics",
  "hydration",
  "sleep_routine",
  "work_productivity",
  "reflection_journal",
  "unknown_or_irrelevant",
];

export async function analyzePhoto(
  photoUrl: string,
  caption: string,
  targetedGoalTitle: string | null,
  untargetedGoalTitle: string | null,
  userName: string
): Promise<VisionAnalysisResult> {
  const goalContext = [
    targetedGoalTitle ? `Targeted Goal: "${targetedGoalTitle}"` : null,
    untargetedGoalTitle ? `Identity Goal: "${untargetedGoalTitle}"` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const systemPrompt = `You are JAI, an AI accountability coach analyzing photos for verified progress toward the user's goals.
The user's name is ${userName || "friend"}.

${goalContext || "No active goals set."}

TASK: Analyze this photo and determine if it shows REAL, VERIFIED action toward one of the user's goals.

RULES:
1. You must return STRICT JSON matching the exact schema below.
2. confidence is 0.0 to 1.0 — how confident you are the photo shows real goal-aligned action.
3. action_type must be one of: gym_activity, outdoor_walk_run, meal_prep_food_choice, scale_or_metrics, hydration, sleep_routine, work_productivity, reflection_journal, unknown_or_irrelevant
4. proof_level: 0 = no proof, 1 = weak proof (could be anything), 2 = moderate proof (likely action), 3 = strong proof (clear action visible)
5. water_award: 0 = no water, 1 = base action verified, 2 = strong photo proof with clear context
6. Water is ONLY awarded for VERIFIED ACTION aligned with active goals.
7. If the image is irrelevant (random selfies, memes, scenery, pets, unrelated content): action_type = "unknown_or_irrelevant", water_award = 0, add "irrelevant" to risk_flags.
8. If confidence < 0.60: water_award = 0
9. If confidence 0.60-0.74: water_award = 0, ask a clarifying question in next_prompt
10. If confidence >= 0.75 AND action is goal-aligned: award water (1 or 2)
11. next_prompt: Write a short coaching response to the user (2-3 sentences max, plain text, no markdown). If water awarded, acknowledge the action. If not, explain why and suggest how to earn water.

RESPONSE FORMAT (strict JSON only, no markdown fences):
{
  "labels": ["descriptive", "labels", "for", "photo"],
  "confidence": 0.85,
  "action_type": "gym_activity",
  "proof_level": 2,
  "water_award": 1,
  "water_reason": "Photo shows user at gym doing squats, aligned with weight loss goal",
  "risk_flags": [],
  "tags": ["fitness", "gym", "strength"],
  "next_prompt": "That's real work right there. Keep stacking those reps. What's your next session look like?"
}`;

  try {
    const userContent: any[] = [];

    if (photoUrl.startsWith("http")) {
      userContent.push({
        type: "image_url",
        image_url: { url: photoUrl, detail: "low" },
      });
    }

    if (caption) {
      userContent.push({
        type: "text",
        text: `User caption: "${caption}"`,
      });
    } else {
      userContent.push({
        type: "text",
        text: "No caption provided. Analyze the image on its own.",
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_tokens: 500,
      temperature: 0.2,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    const parsed = JSON.parse(cleaned) as VisionAnalysisResult;

    if (!VALID_ACTION_TYPES.includes(parsed.action_type)) {
      parsed.action_type = "unknown_or_irrelevant";
    }
    parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));
    parsed.proof_level = Math.max(0, Math.min(3, Math.round(parsed.proof_level)));

    if (parsed.action_type === "unknown_or_irrelevant") {
      parsed.water_award = 0;
      if (!parsed.risk_flags.includes("irrelevant")) {
        parsed.risk_flags.push("irrelevant");
      }
    }
    if (parsed.confidence < 0.60) {
      parsed.water_award = 0;
    }
    if (parsed.confidence >= 0.60 && parsed.confidence < 0.75) {
      parsed.water_award = 0;
    }

    parsed.water_award = Math.max(0, Math.min(2, Math.round(parsed.water_award)));

    if (!Array.isArray(parsed.labels)) parsed.labels = [];
    if (!Array.isArray(parsed.risk_flags)) parsed.risk_flags = [];
    if (!Array.isArray(parsed.tags)) parsed.tags = [];
    if (!parsed.water_reason) parsed.water_reason = "No reason provided";
    if (!parsed.next_prompt) parsed.next_prompt = "Thanks for sharing. Keep going.";

    return parsed;
  } catch (err) {
    console.error("Vision analysis error:", err);
    return {
      labels: [],
      confidence: 0,
      action_type: "unknown_or_irrelevant",
      proof_level: 0,
      water_award: 0,
      water_reason: "Analysis failed — unable to process image",
      risk_flags: ["analysis_error"],
      tags: [],
      next_prompt: "I wasn't able to analyze that photo. Try uploading a clear image of your progress and I'll review it.",
    };
  }
}
