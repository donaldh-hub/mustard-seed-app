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
  action_points?: number;
  water_reason: string;
  risk_flags: string[];
  tags: string[];
  next_prompt: string;
}

// POSITIONING NOTE: Mustard Seed is goal-neutral and growth-centered.
// Fitness is one example, not the product category.
// Photo validation must evaluate alignment with the USER'S STATED GOAL — not assume fitness activity.
const VALID_ACTION_TYPES = [
  "physical_activity",       // fitness, walking, sports, movement-based goals
  "creative_progress",       // writing, art, design, music, craft
  "learning_and_study",      // notes, books, courses, certifications, practice work
  "home_and_space",          // cleaning, organizing, decluttering, home projects
  "financial_action",        // budget sheets, bills paid, savings tracker, financial records
  "business_or_work",        // products, orders, websites, logos, customer work, inventory
  "garden_and_nature",       // seeds, soil, tools, planted beds, sprouts, fertilizer, watering
  "health_and_wellness",     // meal prep, hydration, sleep, mental health, nutrition
  "faith_and_reflection",    // journaling, prayer, spiritual study, gratitude practice
  "relationship_and_family", // parenting routines, relationship goals, community action
  "metrics_and_tracking",    // before/after, measurements, completed checklists, logged data
  "reflection_journal",      // written reflection, notes on progress, planning documents
  "unknown_or_irrelevant",   // selfies, memes, scenery unrelated to any goal
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

  const systemPrompt = `You are analyzing photos for verified progress toward the user's stated goal. You are NOT a coach. You observe and classify — nothing more.
The user's name is ${userName || "friend"}.

${goalContext || "No active goals set."}

CORE PRINCIPLE: Mustard Seed is goal-neutral. It is NOT a fitness app. The user's goal could be fitness, gardening, writing, budgeting, business, cleaning, studying, parenting, faith, or anything else. Your job is to determine whether this photo shows evidence of aligned action toward THEIR SPECIFIC STATED GOAL — not to evaluate fitness activity.

TASK: Analyze this photo and determine if it shows REAL, VERIFIED action toward one of the user's goals.

THE QUESTION YOU ARE ANSWERING:
"Does this photo reasonably support the user's stated goal, WHY, or next step?"
NOT: "Does this photo show fitness activity?"

GOAL-AWARE EVIDENCE EXAMPLES:
- Fitness goal: gym equipment, walking trail, completed workout, meal prep, running shoes
- Gardening goal: seeds, soil, fertilizer, watering can, planted bed, cleared weeds, sprout growth
- Writing goal: draft page, notebook, laptop with text, word count, outline, writing desk
- Budgeting goal: budget sheet, expense list, paid bill, savings tracker, financial notes
- Business goal: product sample, packaging, website update, logo draft, inventory organized
- Cleaning goal: before/after room, organized drawer, supplies gathered, laundry folded
- Study goal: notes, textbook, completed practice problems, course progress
- Faith goal: journal entry, scripture notes, study plan, prayer notes

RULES:
1. You must return STRICT JSON matching the exact schema below.
2. confidence is 0.0 to 1.0 — how confident you are the photo shows real goal-aligned action toward THIS USER'S SPECIFIC GOAL.
3. action_type must be one of: physical_activity, creative_progress, learning_and_study, home_and_space, financial_action, business_or_work, garden_and_nature, health_and_wellness, faith_and_reflection, relationship_and_family, metrics_and_tracking, reflection_journal, unknown_or_irrelevant
4. proof_level: 0 = no proof, 1 = weak proof (could be anything), 2 = moderate proof (likely aligned action), 3 = strong proof (clear goal-aligned action visible)
5. water_award: 0 = no water, 1 = base action verified, 2 = strong photo proof with clear goal alignment
6. Water is ONLY awarded for VERIFIED ACTION aligned with the user's active goal.
7. If the image is irrelevant (random selfies, memes, unrelated scenery, pets with no goal connection): action_type = "unknown_or_irrelevant", water_award = 0, add "irrelevant" to risk_flags.
8. If confidence < 0.60: water_award = 0
9. If confidence 0.60-0.74: water_award = 0, ask a clarifying question in next_prompt
10. If confidence >= 0.75 AND action is goal-aligned: award water (1 or 2)
11. next_prompt: Write a short grounded response (2-3 sentences max, plain text, no markdown). Acknowledge the specific action factually. Connect it to their goal. No praise, no motivation, no coaching language. If photo is unclear or irrelevant, redirect without punishment: "This doesn't show the work yet. What would show progress toward your goal?"

BANNED in next_prompt: "Great job", "Keep it up", "Well done", "Amazing", "Proud of you", "Keep going", "You got this", any motivational filler.

RESPONSE FORMAT (strict JSON only, no markdown fences):
{
  "labels": ["descriptive", "labels", "for", "photo"],
  "confidence": 0.85,
  "action_type": "garden_and_nature",
  "proof_level": 3,
  "water_award": 1,
  "water_reason": "Photo shows fertilizer and seeds — aligned with the user's gardening goal",
  "risk_flags": [],
  "tags": ["gardening", "seeds", "fertilizer"],
  "next_prompt": "That fertilizer and those seeds are in the right direction. What's the next step once you get them in the ground?"
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

    console.log(`[VISION] Starting analysis for ${photoUrl.substring(0, 80)}...`);
    const startTime = Date.now();

    const ANALYSIS_TIMEOUT = 45000;
    const analysisPromise = openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_tokens: 500,
      temperature: 0.2,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Vision analysis timed out after 45s")), ANALYSIS_TIMEOUT)
    );

    const response = await Promise.race([analysisPromise, timeoutPromise]);
    console.log(`[VISION] Analysis completed in ${Date.now() - startTime}ms`);

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
