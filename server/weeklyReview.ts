import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface HeartbeatDirections {
  clarity: "up" | "stagnant" | "down";
  consistency: "up" | "stagnant" | "down";
  mindset: "up" | "stagnant" | "down";
  adaptation: "up" | "stagnant" | "down";
  courage: "up" | "stagnant" | "down";
}

export interface WeeklyReviewData {
  targetedGoalProgress: {
    hasGoal: boolean;
    goalStatement?: string;
    lastWeekValue?: number | null;
    currentValue?: number | null;
    netChange?: number | null;
    metricType?: string;
  };
  heartbeatDirections: HeartbeatDirections;
  collectiveAnalysis: string;
}

const HEARTBEAT_EVAL_PROMPT = `You are an objective behavioral analyst evaluating a user's accountability data from the past 7 days.

You will receive the user's chat messages from the last 7 days. Based ONLY on behavioral evidence in these messages, evaluate each of the Five Heartbeats.

EVALUATION RULES:
- Emotional language alone does NOT qualify as advancement.
- Declared intention without execution does NOT qualify as advancement.
- Only observable actions, completed tasks, and behavioral patterns count.

HEARTBEAT CRITERIA:

1) Clarity of Vision & Why
↑ Advancement: Goal defined or refined, purpose recommitted, objective clarified
→ Stagnation: No refinement, no confusion introduced
↓ Regression: Goal abandoned, contradictory direction, loss of clarity

2) Small Steps + Consistency
↑ Advancement: Repeated execution across multiple days, follow-through on commitments
→ Stagnation: Minimal or inconsistent action without full drop-off
↓ Regression: Repeated missed commitments, execution collapse

3) Mindset over Method
↑ Advancement: Action taken despite discomfort, reduced excuse behavior, continued execution without perfect conditions
→ Stagnation: Neutral behavioral pattern
↓ Regression: Excuse patterns dominate, avoidance disguised as logic

4) Feedback & Adaptation
↑ Advancement: Strategy adjusted after friction, intelligent modification applied
→ Stagnation: No adaptation required or applied
↓ Regression: Repeated friction with no adjustment

5) Courageous Action
↑ Advancement: Action taken on previously avoided task, initiated difficult step
→ Stagnation: No avoidance addressed
↓ Regression: Backed away from declared action, avoided necessary step

Respond with ONLY a JSON object in this exact format, no other text:
{"clarity":"up|stagnant|down","consistency":"up|stagnant|down","mindset":"up|stagnant|down","adaptation":"up|stagnant|down","courage":"up|stagnant|down"}`;

const ANALYSIS_PROMPT = `You are an objective analyst writing a collective analysis for a weekly accountability review.

You will receive:
1. Targeted goal progress data
2. Heartbeat direction evaluations
3. The user's messages from the past 7 days

Write ONE integrated analysis paragraph. STRICT RULES:
- Maximum 4 sentences
- No step assignment
- No plan creation
- No motivational padding
- No water logic or gamification language
- No therapeutic language
- Tone: Clear, direct, grounded, objective

The analysis must synthesize:
- Targeted goal progress (or lack thereof)
- Overall heartbeat pattern
- Alignment or misalignment between outcome and development

Respond with ONLY the analysis paragraph, no labels or headers.`;

export async function evaluateHeartbeatDirections(
  userMessages: { text: string; sender: string; createdAt: Date | null }[]
): Promise<HeartbeatDirections> {
  const userOnly = userMessages.filter(m => m.sender === "user");

  if (userOnly.length === 0) {
    return {
      clarity: "stagnant",
      consistency: "down",
      mindset: "stagnant",
      adaptation: "stagnant",
      courage: "stagnant",
    };
  }

  const messageLog = userOnly.map(m => {
    const date = m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "unknown";
    return `[${date}] ${m.text}`;
  }).join("\n");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: HEARTBEAT_EVAL_PROMPT },
        { role: "user", content: `USER MESSAGES FROM PAST 7 DAYS:\n\n${messageLog}` },
      ],
      max_tokens: 150,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";
    const parsed = JSON.parse(raw);

    const valid = (v: string) => ["up", "stagnant", "down"].includes(v) ? v as "up" | "stagnant" | "down" : "stagnant" as const;

    return {
      clarity: valid(parsed.clarity),
      consistency: valid(parsed.consistency),
      mindset: valid(parsed.mindset),
      adaptation: valid(parsed.adaptation),
      courage: valid(parsed.courage),
    };
  } catch (error) {
    console.error("Weekly review heartbeat evaluation error:", error);
    return {
      clarity: "stagnant",
      consistency: "stagnant",
      mindset: "stagnant",
      adaptation: "stagnant",
      courage: "stagnant",
    };
  }
}

export async function generateCollectiveAnalysis(
  goalProgress: WeeklyReviewData["targetedGoalProgress"],
  directions: HeartbeatDirections,
  userMessages: { text: string; sender: string; createdAt: Date | null }[]
): Promise<string> {
  const dirSymbol = (d: "up" | "stagnant" | "down") =>
    d === "up" ? "↑" : d === "down" ? "↓" : "→";

  const goalSummary = goalProgress.hasGoal
    ? `Goal: ${goalProgress.goalStatement}. Last week: ${goalProgress.lastWeekValue ?? "N/A"}. This week: ${goalProgress.currentValue ?? "N/A"}. Net change: ${goalProgress.netChange ?? "N/A"}.`
    : "No targeted goal active.";

  const heartbeatSummary = [
    `Clarity: ${dirSymbol(directions.clarity)}`,
    `Consistency: ${dirSymbol(directions.consistency)}`,
    `Mindset: ${dirSymbol(directions.mindset)}`,
    `Adaptation: ${dirSymbol(directions.adaptation)}`,
    `Courage: ${dirSymbol(directions.courage)}`,
  ].join(", ");

  const userOnly = userMessages.filter(m => m.sender === "user");
  const messageLog = userOnly.map(m => {
    const date = m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "unknown";
    return `[${date}] ${m.text}`;
  }).join("\n");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: ANALYSIS_PROMPT },
        {
          role: "user",
          content: `TARGETED GOAL PROGRESS:\n${goalSummary}\n\nHEARTBEAT DIRECTIONS:\n${heartbeatSummary}\n\nUSER MESSAGES (PAST 7 DAYS):\n${messageLog || "(no messages)"}`,
        },
      ],
      max_tokens: 250,
    });

    return response.choices[0]?.message?.content?.trim() || "Insufficient data for analysis this week.";
  } catch (error) {
    console.error("Weekly review collective analysis error:", error);
    return "Insufficient data for analysis this week.";
  }
}
