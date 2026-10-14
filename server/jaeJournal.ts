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
  // Only populated for evening sessions — that day's own morning prompts +
  // responses, needed to fill the follow-up bank's morning-side placeholders.
  todayMorningPrompts?: { prompt: string; response: string }[];
}

export interface JournalJaeResponse {
  reflection: string;
  followUpQuestion: string;
  keyTheme: string;
  releasePoint: string;
  valueNamed: string;
  possibleFirstSeed: string;
}

// ─── Jai check-in follow-up question bank ───────────────────────────────────
// Mirrors client/src/content/journalContent.ts's JOURNAL_FOLLOWUP_QUESTIONS
// (duplicated here for actual use, same pattern jaeRebuild.ts already follows
// for its own content). Only surfaced at the EVENING session of each day,
// once both that day's morning and evening prompts are answered — the first
// four questions reference the user's own saved answers (skipped, not shown
// blank, if an answer isn't available); the rest are generic.
function journalFollowUpQuestions(dayNumber: 1 | 2 | 3, morning: string[], evening: string[]): string[] {
  // The user's own answers ride along in [their words: …] as reference only —
  // the prompt below tells Jai to paraphrase them, never quote them.
  const words = (t: string) => `[their words: ${t}]`;
  if (dayNumber === 1) {
    return [
      morning[0] ? `Ask what pulled their attention away today, if anything, from what they set out to focus on ${words(morning[0])}.` : "",
      morning[1] ? `Ask how close the day came to the calm they described this morning ${words(morning[1])}.` : "",
      evening[0] ? `Ask what made that moment different from the rest of the day ${words(evening[0])}.` : "",
      evening[1] ? `Ask whether what they noticed about themselves has shown up before, or is new ${words(evening[1])}.` : "",
      "If tomorrow started exactly like today ended, what would you want to carry forward?",
      "What almost kept you from sitting down and answering these questions today?",
      "Where in today did you notice yourself rushing, even a little?",
      "What would \"enough\" have looked like today, if you'd let it be enough?",
    ].filter(Boolean);
  }
  if (dayNumber === 2) {
    return [
      morning[0] ? `Ask whether today's actual time matched what they said mattered, or got pulled somewhere else ${words(morning[0])}.` : "",
      morning[1] ? `Ask what got in the way of slowing down the way they hoped, if anything ${words(morning[1])}.` : "",
      evening[0] ? `Ask what made that moment of peace safe enough to notice ${words(evening[0])}.` : "",
      evening[1] ? `Ask how long what they're ready to let go of has been sitting with them ${words(evening[1])}.` : "",
      "What's the difference between what deserved your energy today and what actually got it?",
      "If you gave yourself full permission to slow down tomorrow, what would you do differently?",
      "What's one thing today that felt urgent but wasn't actually important?",
      "What would it look like to protect tomorrow's energy before the day starts, not after it's already gone?",
    ].filter(Boolean);
  }
  return [
    morning[0] ? `Ask where they actually saw the value they chose show up today ${words(morning[0])}.` : "",
    morning[1] ? `Ask whether anything tested how they planned to stay grounded today ${words(morning[1])}.` : "",
    evening[0] ? `Ask how the growth they noticed compares to where they started three days ago ${words(evening[0])}.` : "",
    evening[1] ? `Ask what keeping that going would actually require of them ${words(evening[1])}.` : "",
    "Looking back over all three days, what pattern shows up more than once?",
    "What surprised you most about doing this three days in a row?",
    "If you had to name this season in one word, what would it be?",
    "What's one small thing from these three days you don't want to lose once the week gets busy again?",
  ].filter(Boolean);
}

function followUpBlock(dayNumber: 1 | 2 | 3, morning: string[], evening: string[]): string {
  const questions = journalFollowUpQuestions(dayNumber, morning, evening);
  if (questions.length === 0) return "";
  return `
Optional follow-up bank for tonight's check-in — a menu, not a script:
${questions.map((q) => `- ${q}`).join("\n")}

If (and only if) one of these is genuinely relevant to what they just wrote, turn it into your "followUpQuestion" in your own voice instead of writing a new one from scratch. Otherwise ignore this bank entirely and write your own grounded question as usual.
- Text in [their words: …] is the user's raw answer, for your reference only. Never copy it or put it in quotation marks — refer to it in your own clean paraphrase.
- Never use more than one of these in a single reply, and never list several — pick at most one.
- It should read as your own natural next question, not a quiz prompt.`;
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

  const eveningFollowUp =
    ctx.session === "evening"
      ? followUpBlock(
          ctx.dayNumber,
          (ctx.todayMorningPrompts ?? []).map((p) => p.response),
          ctx.prompts.map((p) => p.response)
        )
      : "";

  const systemPrompt = `You are Jai — a calm, grounded, and encouraging accountability partner inside the Mustard Seed app.

You are guiding ${ctx.userName} through the 3-Day Grounding Journal.
Today is Day ${ctx.dayNumber} (${ctx.dayTheme}), ${ctx.session} session.

${prevSummary ? `Context from previous sessions:\n${prevSummary}\n` : ""}

Your job is to:
1. Reflect briefly on what the user actually wrote — do not add new ideas they didn't mention.
2. Ask exactly one grounded, open-ended follow-up question.
3. Extract: key theme, what they named as a value, what they are ready to release, and if Day 3 final, a possible first seed.

Rules:
- Sound like a wise friend, not a therapist or life coach.
- Never quote the user's words back to them, and never use quotation marks around what they wrote. Paraphrase what they said in your own warm, natural words (their typos and shorthand disappear in your phrasing).
- Don't repeat the journal prompt's wording back to them (for example "most present", "pace or patience", "calm and purpose"). Instead, name the specific insight they gave, in plain words. Example: if they wrote that they got more done because they didn't feel rushed, say something like "not rushing is what made you productive," not "you reflected on your pace or patience."
- Keep reflection to 2-4 sentences max.
- Never ask multiple questions. One question only.
- Avoid clinical or robotic language.
- Help them notice patterns, name what matters, release shame.
- If this is the grounding_statement session: help them identify a possible first seed — a single small action that could grow from what they've named.
${eveningFollowUp}

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
