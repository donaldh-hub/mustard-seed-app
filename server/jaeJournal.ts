import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface JournalSessionContext {
  userName: string;
  dayNumber: 1 | 2 | 3;
  dayTheme: "RESET" | "REFOCUS" | "REBUILD";
  session: "intention" | "morning" | "evening" | "grounding_statement";
  prompts: { prompt: string; response: string }[];
  previousEntries?: {
    dayNumber: number;
    session: string;
    keyTheme?: string | null;
    valueNamed?: string | null;
    releasePoint?: string | null;
    jaeReflection?: string | null;
  }[];
}

export interface JournalJaeResponse {
  reflection: string;
  followUpQuestion: string;
  keyTheme: string;
  releasePoint: string;
  valueNamed: string;
  possibleFirstSeed: string;
}

export async function generateJournalReflection(
  ctx: JournalSessionContext
): Promise<JournalJaeResponse> {
  const prevSummary = (ctx.previousEntries ?? [])
    .map(
      (e) =>
        `Day ${e.dayNumber} ${e.session}: Theme="${e.keyTheme ?? "—"}", Value="${e.valueNamed ?? "—"}", Release="${e.releasePoint ?? "—"}"`
    )
    .join("\n");

  const responseBlock = ctx.prompts
    .map((p) => `Prompt: ${p.prompt}\nResponse: ${p.response}`)
    .join("\n\n");

  const systemPrompt = `You are Jae — a calm, grounded, and encouraging accountability partner inside the Mustard Seed app.

You are guiding ${ctx.userName} through the 3-Day Grounding Journal.
Today is Day ${ctx.dayNumber} (${ctx.dayTheme}), ${ctx.session} session.

${prevSummary ? `Context from previous sessions:\n${prevSummary}\n` : ""}

Your job is to:
1. Reflect briefly on what the user actually wrote — do not add new ideas they didn't mention.
2. Ask exactly one grounded, open-ended follow-up question.
3. Extract: key theme, what they named as a value, what they are ready to release, and if Day 3 final, a possible first seed.

Rules:
- Sound like a wise friend, not a therapist or life coach.
- Keep reflection to 2-4 sentences max.
- Never ask multiple questions. One question only.
- Avoid clinical or robotic language.
- Help them notice patterns, name what matters, release shame.
- If this is the grounding_statement session: help them identify a possible first seed — a single small action that could grow from what they've named.

Respond ONLY with valid JSON in this exact shape:
{
  "reflection": "...",
  "followUpQuestion": "...",
  "keyTheme": "...",
  "releasePoint": "...",
  "valueNamed": "...",
  "possibleFirstSeed": "..."
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Here are my responses:\n\n${responseBlock}` },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return {
      reflection: parsed.reflection ?? "",
      followUpQuestion: parsed.followUpQuestion ?? "",
      keyTheme: parsed.keyTheme ?? "",
      releasePoint: parsed.releasePoint ?? "",
      valueNamed: parsed.valueNamed ?? "",
      possibleFirstSeed: parsed.possibleFirstSeed ?? "",
    };
  } catch {
    return {
      reflection: "I see you showing up for yourself — that matters.",
      followUpQuestion: "What feels most true to you from what you just wrote?",
      keyTheme: "",
      releasePoint: "",
      valueNamed: "",
      possibleFirstSeed: "",
    };
  }
}
