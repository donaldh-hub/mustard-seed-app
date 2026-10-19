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
    // Their own answers that session (reference only, for the growth arc),
    // the follow-up exchange, and an evening's step.
    answers?: string;
    followUp?: string | null;
    nextStep?: string | null;
  }[];
  // Evening only: this morning's follow-up question and their answer — often
  // where they set today's small step.
  todayMorningFollowUp?: { question: string; answer: string } | null;
  // Grounding statement only: the last step Jai locked in.
  lockedStep?: string | null;
  // Only populated for evening sessions — that day's own morning prompts +
  // responses, needed to fill the follow-up bank's morning-side placeholders.
  todayMorningPrompts?: { prompt: string; response: string }[];
  // The user's weakest Heartbeat from their assessment (full locked name +
  // score out of 5), so Jai can connect what they write to it.
  weakestHeartbeat?: { name: string; score: number } | null;
  // What they wrote as their opening intention for the 3 days (their goal).
  intention?: string | null;
  // Morning only: the small step Jai suggested last night, if any.
  yesterdayStep?: string | null;
}

export interface JournalJaeResponse {
  reflection: string;
  followUpQuestion: string;
  keyTheme: string;
  releasePoint: string;
  valueNamed: string;
  possibleFirstSeed: string;
  // Morning only: a short, clean paraphrase of what they'll focus on today,
  // shown back to them on the wait screen instead of their raw text.
  focusSummary: string;
  // Jai's own pre-writing decisions (not stored): the question it detected
  // and whether it saw a gap in the weakest Heartbeat. Printed by
  // scripts/journal-jai-check.ts.
  userQuestion?: string;
  heartbeatGap?: boolean;
  // Evening only: one small goal-linked step for tomorrow (saved, then asked
  // about the next morning), and whether frustration rose since the morning.
  nextStep: string;
  frustrationRose?: boolean;
  // Jai's decisions behind the Day 3 coaching: an action they took that
  // lives out a Heartbeat (named in the reflection), and a short optional
  // invitation to photograph a physical action for their Memory.
  heartbeatInAction?: string;
  photoInvite: string;
}

export const HEARTBEAT_ACTIONS = `- completed a step they set earlier → Small Steps + Consistency
- named or sharpened their why, or who it's for → Clarity of Vision & Why
- changed their approach after something didn't work → Feedback & Adaptation
- did something despite fear, doubt, or discomfort → Courageous Action
- reframed a belief about themselves or the work → Mindset over Method`;

// The question the journal asks at the top of the next morning about last
// night's step. Its answer rides along as an extra prompt (always last, so
// the follow-up bank's morning[0]/morning[1] indexes don't shift).
export const STEP_CHECK_PREFIX = "Last night's step:";

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
    evening[0] ? `Name the growth you see since Day 1 yourself, then ask what helped it happen ${words(evening[0])}.` : "",
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
        `Day ${e.dayNumber} ${e.session}: Theme="${e.keyTheme ?? "—"}", Value="${e.valueNamed ?? "—"}", Release="${e.releasePoint ?? "—"}"` +
        (e.answers ? ` [their words: ${e.answers}]` : "") +
        (e.followUp ? ` [follow-up: ${e.followUp}]` : "") +
        (e.nextStep ? ` [step Jai set: ${e.nextStep}]` : "")
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

  const isEvening = ctx.session === "evening";
  const stepCheck = ctx.prompts.find((p) => p.prompt.startsWith(STEP_CHECK_PREFIX));
  const morningStepBlock = ctx.session === "morning" && (ctx.yesterdayStep || stepCheck)
    ? `
Last night you suggested this small step for today (reference only): ${ctx.yesterdayStep ?? stepCheck!.prompt.slice(STEP_CHECK_PREFIX.length).trim()}
${stepCheck ? `They answered whether they did it: ${stepCheck.response}. Acknowledge it in ONE short sentence near the start of "reflection" (after answering any direct question). Did it → name it as real progress toward their goal, and as Small Steps + Consistency in action (that exact name). Partly or not yet → grace, no shame; showing up today still counts, and the step can be smaller. Don't ask about it again.` : `They haven't said whether they did it. Don't assume either way.`}
`
    : "";
  const eveningStepBlock = isEvening
    ? `
Tonight, end with ONE small next step ("nextStep"):
- One sentence that starts with "Tomorrow, ". Concrete, doable in 5–10 minutes, tied directly to their goal${ctx.weakestHeartbeat ? ` and, where it fits, to ${ctx.weakestHeartbeat.name}` : ""}. Examples by goal: business name → "Tomorrow, write 3 words that describe who your business serves." Writing → "Tomorrow, write for 10 minutes before you open your phone." Gardening → "Tomorrow, check the soil on your tomato plants and water only the dry ones."
- Never a list, never two steps, never vague ("reflect more", "keep going").
- Don't repeat the step inside "reflection" — it is shown on its own.
- Build the step from THEIR words today: tonight's answers, what they said they'd focus on this morning, or their answer to this morning's follow-up question. If they named a change they want (e.g. not staying up all night doom scrolling), the step IS that change, made small and concrete in your own words (e.g. "Tomorrow, put your phone on the charger by 10:30 PM."), not a different idea of yours. Only suggest your own step when they named nothing usable.
- If they named their own next step tonight (e.g. "keep one place for my ideas"), lock THAT one in instead of inventing a new one: confirm it in your own words, made small and concrete. It may start with "Tonight, " if it fits tonight (e.g. "Tonight, pick the one place you'll keep your name ideas.").
- If they say a step they set earlier (this morning, or last night's) did NOT happen: grace first, no shame, and make "nextStep" smaller than the one they missed.
- Compare this morning's answers with tonight's. If frustration, discouragement, or overwhelm ROSE across the day, set "frustrationRose": true, name the shift in "reflection" with grace in one sentence (e.g. "This morning had some hope in it; tonight feels heavier, and that's real."), and make "nextStep" SMALLER: 2–5 minutes, almost too easy.
`
    : "";

  const morningFollowUpBlock = isEvening && ctx.todayMorningFollowUp
    ? `
This morning you asked: ${ctx.todayMorningFollowUp.question}
They answered (reference only, never quote it): ${ctx.todayMorningFollowUp.answer}
If that answer set a step for today, check tonight's words for whether they did it. If it named a change they want, build tomorrow's "nextStep" from it.
`
    : "";
  const priorDays = (ctx.previousEntries ?? []).some((e) => e.dayNumber < ctx.dayNumber);
  const arcBlock = isEvening && priorDays
    ? `
Growth arc: before your question, state in ONE sentence the arc you see from the earlier days to tonight, using what they actually wrote (e.g. "Two days ago this felt stuck. Tonight you took action."). Name the growth yourself — don't make them do the work of comparing. Then your "followUpQuestion" should be lighter (e.g. what helped, or what they want to keep), never "how does this compare to where you started?".
`
    : "";
  const actionBlock = ctx.session === "grounding_statement" ? "" : `
Heartbeat in action — when their words show they DID something (not just thought about it), name the Heartbeat it lives out, by its exact full name, in one sentence. Example: "You said you'd write the names down, and you did. That's Small Steps + Consistency working for you."
${HEARTBEAT_ACTIONS}
Only when it actually happened. Put the full name you used in "heartbeatInAction" ("" if none).

Photo proof — if they report a physical, visible action (wrote a list, planted, wrote pages, built something), set "photoInvite" to one short, optional, no-pressure line inviting a photo for their Memory, e.g. "Want to snap a photo of your list? It'll go in your Memory." Otherwise "". Don't put this line in "reflection".
`;
  const groundingBlock = ctx.session === "grounding_statement" && ctx.lockedStep
    ? `
The last small step you and they locked in (reference only): ${ctx.lockedStep}
Let their possible first seed build on that step where it fits.
`
    : "";

  const systemPrompt = `You are Jai — a calm, grounded, and encouraging accountability partner inside the Mustard Seed app.

You are guiding ${ctx.userName} through the 3-Day Grounding Journal.
Today is Day ${ctx.dayNumber} (${ctx.dayTheme}), ${ctx.session} session.

${prevSummary ? `Context from previous sessions:\n${prevSummary}\n` : ""}
${ctx.intention ? `Their intention for these 3 days (their goal, in their own words — reference only, never quote it): ${ctx.intention}\n` : ""}
${ctx.weakestHeartbeat ? `Their assessment: weakest Heartbeat is ${ctx.weakestHeartbeat.name} (${ctx.weakestHeartbeat.score}/5).\n` : ""}

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
- If they ask a direct question or doubt the process (e.g. "how does this help me…?"), answer it first in one plain sentence that links this journal to their goal${ctx.weakestHeartbeat ? " and their weakest Heartbeat" : ""}, then reflect. Never ignore the question.
- Read their goal carefully. Starting something new is not changing something that exists — never assume a name, plan, or result already exists unless they said so. If the goal is a task (e.g. "come up with a name"), gently frame it: the task is the what; this journal is about the why underneath it.
${ctx.weakestHeartbeat ? `- What a gap sounds like, by Heartbeat — Clarity of Vision & Why: not knowing what it's for, who it's for, or why ("I don't have any of that", "I'm not sure"). Small Steps + Consistency: skipping, stopping and starting, "again", all-or-nothing, waiting for a big push. Mindset over Method: hunting for the perfect method or tool, harsh self-talk. Feedback & Adaptation: repeating what didn't work, not adjusting. Courageous Action: avoiding, putting off the uncomfortable step, waiting until ready.
- When their words show a gap in ${ctx.weakestHeartbeat.name} (for example "I don't have any of that"), name it gently by that exact full name and link it to their goal, with grace and accountability and no shame. Example tone for a business-name goal with low Clarity of Vision & Why: "That's why the name won't come yet. A name follows clarity. Let's find what the business is for first." Only do this when their words actually point to it.
- Always write a Heartbeat's full name exactly (Clarity of Vision & Why, Small Steps + Consistency, Mindset over Method, Feedback & Adaptation, Courageous Action) — never shorten it.
${ctx.dayNumber === 1 && ctx.session === "morning" ? `- This is their first session since the assessment. Even without a gap, if what they wrote today naturally connects to ${ctx.weakestHeartbeat.name} (${ctx.weakestHeartbeat.score}/5), link it in ONE sentence by that exact full name, as the Heartbeat these three days help them strengthen, never as a flaw. If it would feel forced, leave it out.
` : ""}` : ""}${eveningFollowUp}${morningStepBlock}${morningFollowUpBlock}${arcBlock}${actionBlock}${groundingBlock}${eveningStepBlock}

Before writing, decide two things and put them FIRST in your JSON:
- "userQuestion": if they asked you a direct question or doubted whether this helps (any "?" or "does this…", "how does this…", "is this really…"), restate it in a few plain words; otherwise "". If it is not "", the FIRST sentence of "reflection" must answer it directly — how this journal serves their goal — before anything else.
- "heartbeatGap": ${ctx.weakestHeartbeat ? `true if their words today show a gap in ${ctx.weakestHeartbeat.name} (see what a gap sounds like above), else false. If true, "reflection" must name ${ctx.weakestHeartbeat.name} by that exact full name and link it to their goal, gently.` : `always false.`}

Respond ONLY with valid JSON in this exact shape:
{
  "userQuestion": "...",
  "heartbeatGap": false,
  "heartbeatInAction": "",${isEvening ? `
  "frustrationRose": false,` : ""}
  "reflection": "...",
  "followUpQuestion": "...",
  "keyTheme": "...",
  "releasePoint": "...",
  "valueNamed": "...",
  "possibleFirstSeed": "...",
  "focusSummary": "...",
  "photoInvite": ""${isEvening ? `,
  "nextStep": "Tomorrow, ..."` : ""}
}
${ctx.session === "morning" ? `"focusSummary": one short sentence (max 15 words), second person, clean grammar, paraphrasing what they said they'll give their attention to today. Never copy their words. If they were unsure, say so kindly (e.g. "You're still finding today's focus — and that's okay.").` : `"focusSummary": "" (morning sessions only).`}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Here are my responses:\n\n${responseBlock}` },
    ],
    temperature: 0.7,
    max_tokens: 800,
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
      focusSummary: ctx.session === "morning" ? (parsed.focusSummary ?? "") : "",
      userQuestion: typeof parsed.userQuestion === "string" ? parsed.userQuestion : "",
      heartbeatGap: parsed.heartbeatGap === true,
      nextStep: isEvening && typeof parsed.nextStep === "string" ? parsed.nextStep.trim() : "",
      frustrationRose: parsed.frustrationRose === true,
      heartbeatInAction: typeof parsed.heartbeatInAction === "string" ? parsed.heartbeatInAction : "",
      photoInvite: ctx.session !== "grounding_statement" && typeof parsed.photoInvite === "string" ? parsed.photoInvite.trim() : "",
    };
  } catch {
    return {
      reflection: "I see you showing up for yourself — that matters.",
      followUpQuestion: "What feels most true to you from what you just wrote?",
      keyTheme: "",
      releasePoint: "",
      valueNamed: "",
      possibleFirstSeed: "",
      focusSummary: "",
      nextStep: "",
      photoInvite: "",
    };
  }
}

// Short reply to the user's optional follow-up answer: 1–2 sentences, no new
// question, paraphrased (never quoted). Returns "" if the call fails.
// Said when the model call fails or returns nothing, so an answered
// follow-up is never met with silence before the wait screen.
export const FOLLOW_UP_ACK_FALLBACK = "Thank you for naming that. I'll hold onto it, and we'll build on it together.";

export async function generateFollowUpAck(ctx: {
  userName: string;
  question: string;
  answer: string;
  intention?: string | null;
  weakestHeartbeat?: { name: string; score: number } | null;
}): Promise<string> {
  const system = `You are Jai — a calm, grounded accountability partner in the Mustard Seed app.
${ctx.userName} just answered your follow-up question in their 3-Day Grounding Journal.
${ctx.intention ? `Their goal for these 3 days (reference only, never quote it): ${ctx.intention}\n` : ""}${ctx.weakestHeartbeat ? `Their weakest Heartbeat: ${ctx.weakestHeartbeat.name} (${ctx.weakestHeartbeat.score}/5).\n` : ""}
Reply in 1–2 short sentences that acknowledge what they said and affirm the step. Rules:
- Paraphrase in your own words; never quote them or use quotation marks around their words.
- Do not ask a question. Do not give advice lists.
- If they asked you something, answer it plainly in one sentence.
- If you name a Heartbeat, use its full name exactly.
- Grace and accountability, no shame. Plain text only.`;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Your question: ${ctx.question}\nMy answer: ${ctx.answer}` },
      ],
      temperature: 0.6,
      max_tokens: 120,
    });
    const reply = (completion.choices[0]?.message?.content ?? "").trim().replace(/^"|"$/g, "");
    if (!reply) console.warn("[JOURNAL] follow-up ack came back empty; using fallback");
    return reply || FOLLOW_UP_ACK_FALLBACK;
  } catch (err) {
    console.error("[JOURNAL] follow-up ack failed; using fallback:", err instanceof Error ? err.message : err);
    return FOLLOW_UP_ACK_FALLBACK;
  }
}
