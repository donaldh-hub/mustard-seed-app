import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const WATER_PER_CUP = 50;

const STAGE_CUP_REQUIREMENTS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 8,
};

export interface WaterResult {
  awarded: boolean;
  amount: number;
  reason: string;
}

export async function evaluateWater(
  userMessage: string,
  goalTitle: string,
  goalType: string,
  isPremiumUser: boolean = false
): Promise<WaterResult> {
  const fallback = evaluateWaterFallback(userMessage);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You evaluate whether a user message represents REAL ACTION taken toward their goal.

GOAL: "${goalTitle}" (${goalType})

RULES:
- Water is awarded ONLY for measurable action the user has ALREADY DONE.
- Action means: completed, executed, tracked, practiced, scheduled, built, walked, ran, lifted, wrote, cooked, prepped, submitted, shipped, logged, set up, bought, attended, etc.
- NOT awarded for: talking about action, planning to act, thinking, venting, emotions, asking questions, being on the fence, general conversation.

If they TALK about it → no water.
If they DID it → water.

Respond ONLY with valid JSON:
{"awarded": true/false, "amount": 1, "reason": "brief explanation"}

Amount is always 1 for a base action. Use 2 only if the user provides photo proof with clear context.`,
        },
        { role: "user", content: userMessage },
      ],
      max_tokens: 100,
      temperature: 0.1,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      let amount = parsed.awarded ? 1 : 0;
      if (parsed.amount === 2) amount = 2;

      if (isPremiumUser && parsed.awarded) {
        amount = applyPremiumWeighting(userMessage, amount, goalType);
      }

      return {
        awarded: !!parsed.awarded,
        amount,
        reason: parsed.reason || "",
      };
    }
    return fallback;
  } catch (err) {
    console.error("Water evaluation AI error, using fallback:", err);
    return fallback;
  }
}

function applyPremiumWeighting(message: string, baseAmount: number, goalType: string): number {
  const msg = message.toLowerCase();
  let multiplier = 1.0;

  const difficultPatterns = /\b(hard|difficult|scared|afraid|uncomfortable|exhausting|painful|pushed myself|out of my comfort|first time|never done|challenging|struggled)\b/i;
  if (difficultPatterns.test(msg)) {
    multiplier += 0.5;
  }

  const couragePatterns = /\b(confronted|stood up|spoke up|asked for|reached out|published|shared publicly|applied|pitched|presented|cold.?call|initiated|risked|vulnerable)\b/i;
  if (couragePatterns.test(msg)) {
    multiplier += 0.5;
  }

  return Math.min(Math.round(baseAmount * multiplier), 3);
}

function evaluateWaterFallback(userMessage: string): WaterResult {
  const msg = userMessage.toLowerCase();
  const actionPatterns =
    /\b(done|did it|completed|finished|accomplished|walked|ran|trained|lifted|wrote|read|practiced|prepped|tracked|logged|set up|started|scheduled|bought|meal.?prep|submitted|shipped|cooked|attended|exercised|meditated|studied|cleaned|organized|built|created|applied|delivered|called|emailed|sent|posted|recorded|measured)\b/i;

  if (actionPatterns.test(msg)) {
    return { awarded: true, amount: 1, reason: "Action keyword detected" };
  }
  return { awarded: false, amount: 0, reason: "No action detected" };
}

export function computeGrowthUpdate(
  currentWaterEvents: number,
  currentCupsFilled: number,
  currentSeedStage: number,
  waterAmount: number
): {
  waterEvents: number;
  cupsFilled: number;
  seedStage: number;
  cupJustFilled: boolean;
  stageAdvanced: boolean;
  preResetFillPercent: number;
} {
  let waterEvents = currentWaterEvents + waterAmount;
  let cupsFilled = currentCupsFilled;
  let seedStage = currentSeedStage;
  let cupJustFilled = false;
  let stageAdvanced = false;
  const preResetFillPercent = Math.round((waterEvents / WATER_PER_CUP) * 100);

  while (waterEvents >= WATER_PER_CUP) {
    waterEvents -= WATER_PER_CUP;
    cupsFilled += 1;
    cupJustFilled = true;

    const nextStage = seedStage + 1;
    const cupsNeeded = STAGE_CUP_REQUIREMENTS[nextStage];
    if (cupsNeeded !== undefined && cupsFilled >= cupsNeeded) {
      seedStage = nextStage;
      stageAdvanced = true;
    }
  }

  return { waterEvents, cupsFilled, seedStage, cupJustFilled, stageAdvanced, preResetFillPercent };
}

export const SEED_STAGE_INFO: Record<number, { name: string; description: string }> = {
  0: { name: "Dormant Seed", description: "Seed intact, fully underground" },
  1: { name: "Germination", description: "Seed cracks open, slight internal glow" },
  2: { name: "Primary Root", description: "One visible root extends downward" },
  3: { name: "Root Expansion", description: "Root network becomes visible underground" },
  4: { name: "Soil Pressure", description: "Soil mounds upward, energy building" },
  5: { name: "Sprout Emergence", description: "Green sprout breaks through soil" },
  6: { name: "Early Plant", description: "Stem strengthens, first leaves form" },
};

export const CUP_IDENTITY_STATEMENTS: Record<number, string> = {
  25: "I STARTED",
  50: "I CAN'T QUIT NOW",
  75: "I'M FINISHING THIS",
  100: "I FOLLOW THROUGH",
};
