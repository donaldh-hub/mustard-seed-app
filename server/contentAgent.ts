import OpenAI from "openai";
import { storage } from "./storage";
import { gatePrePublish, LOCKED_MISSION_STATEMENT, LOCKED_IDENTITY_PHRASE } from "./qualitySupervisor";
import type { ContentSourceType, ContentDraft, ContentCalendarEntry } from "@shared/schema";

// ─── Content Repurposing Agent (Agent 05) ────────────────────────────────────
// Turns a video transcript or Rebuild module script into show notes, email
// nudges, and social captions. Everything lands in a drafts queue — nothing
// here ever autopublishes, and every draft is run through Jai Quality
// Supervisor's pre-publish gate before it's marked ready for the founder's
// approval queue, per both this agent's and Phase 2's own constraints.

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const GENERATION_SYSTEM_PROMPT = `You are the Content Repurposing drafting assistant for Mustard Seed, an app built around the companion Jai (a "${LOCKED_IDENTITY_PHRASE}"). You turn one piece of source material (a video transcript or a 7-Day Rebuild module script) into funnel assets. You DRAFT ONLY — nothing you produce is ever published automatically.

Locked rules:
- Whenever you quote the mission statement, use this exact wording, verbatim, no paraphrase: "${LOCKED_MISSION_STATEMENT}"
- Whenever you refer to what Jai is, use "${LOCKED_IDENTITY_PHRASE}" verbatim if you use that specific phrase at all — never substitute "coach," "assistant," "chatbot," or similar.
- Tone: steady, grounded, direct — never hype, never "you got this" style motivational filler, never oversell.
- Mustard Seed is goal-neutral (not just fitness) unless the source material is specifically about a fitness goal.

Produce ONLY a JSON object with this exact shape:
{
  "showNotes": "<a few paragraphs of show notes for this piece of content>",
  "emailNudges": ["<variant 1>", "<variant 2>", "<variant 3, optional>"],
  "socialCaptions": ["<caption 1>", "<caption 2>", "<caption 3>"]
}
emailNudges should have 2 or 3 short variants (subject-line-style opening + 2-4 sentence body each, as one string per variant). socialCaptions should have exactly 3 short captions suitable for a social post.`;

export interface ContentPackDraft {
  showNotes: string;
  emailNudges: string[];
  socialCaptions: string[];
}

async function generateContentPack(sourceExcerpt: string, sourceType: ContentSourceType): Promise<ContentPackDraft> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.6,
    max_tokens: 1200,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: GENERATION_SYSTEM_PROMPT },
      { role: "user", content: `SOURCE TYPE: ${sourceType}\n\nSOURCE MATERIAL:\n${sourceExcerpt}` },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim();
  let parsed: { showNotes?: string; emailNudges?: string[]; socialCaptions?: string[] } = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }
  }

  return {
    showNotes: parsed.showNotes ?? "",
    emailNudges: Array.isArray(parsed.emailNudges) ? parsed.emailNudges : [],
    socialCaptions: Array.isArray(parsed.socialCaptions) ? parsed.socialCaptions : [],
  };
}

/**
 * createContentDraft — the only entry point this agent exposes. Generates
 * the content pack, runs it through the Phase 2 pre-publish gate, and
 * persists everything either way (a blocked draft is still visible for
 * revision, not discarded). Status is "pending_review" only if the quality
 * gate passed; otherwise "blocked_needs_revision" with the cited rule
 * attached, and it does NOT reach the normal approval queue until re-run.
 */
export async function createContentDraft(sourceExcerpt: string, sourceType: ContentSourceType): Promise<ContentDraft> {
  const pack = await generateContentPack(sourceExcerpt, sourceType);
  const combinedText = [pack.showNotes, ...pack.emailNudges, ...pack.socialCaptions].join("\n\n");

  const qualityResult = await gatePrePublish(combinedText, "content_repurposing");

  return storage.createContentDraft({
    sourceType,
    sourceExcerpt: sourceExcerpt.slice(0, 4000),
    showNotes: pack.showNotes,
    emailNudges: pack.emailNudges,
    socialCaptions: pack.socialCaptions,
    qualityCheckPassed: qualityResult.passed,
    qualityCheckDetail: {
      ruleBroken: qualityResult.ruleBroken,
      quotedLine: qualityResult.quotedLine,
      explanation: qualityResult.explanation,
      checkedAgainstApprovedGuide: qualityResult.checkedAgainstApprovedGuide,
    },
    status: qualityResult.passed ? "pending_review" : "blocked_needs_revision",
    reviewNote: null,
    reviewedAt: null,
  });
}

export async function listContentDrafts(status?: string): Promise<ContentDraft[]> {
  return storage.getContentDrafts(status);
}

/**
 * reviewContentDraft — the founder's decision, and the ceiling of what this
 * agent can do to a draft. "approved" does not publish anything anywhere —
 * there's no real publish target wired into this codebase yet, so approval
 * just marks the copy ready to hand off manually. Only drafts that passed
 * the quality gate can be approved; a blocked draft has to be regenerated
 * (createContentDraft again) rather than approved past the flag.
 */
export async function reviewContentDraft(
  id: string,
  decision: "approved" | "rejected",
  note?: string
): Promise<ContentDraft | undefined> {
  const draft = await storage.getContentDraft(id);
  if (!draft) return undefined;
  if (decision === "approved" && !draft.qualityCheckPassed) {
    throw new Error("Cannot approve a draft that's still blocked on a quality flag — regenerate it first.");
  }
  return storage.updateContentDraft(id, { status: decision, reviewNote: note ?? null, reviewedAt: new Date() });
}

export async function addCalendarEntry(
  title: string,
  notes: string,
  plannedDate?: string,
  contentDraftId?: string
): Promise<ContentCalendarEntry> {
  return storage.createCalendarEntry({
    title,
    notes: notes ?? "",
    plannedDate: plannedDate ?? null,
    status: "idea",
    contentDraftId: contentDraftId ?? null,
  });
}

export async function listCalendarEntries(): Promise<ContentCalendarEntry[]> {
  return storage.getCalendarEntries();
}

export async function updateCalendarEntryStatus(
  id: string,
  status: "idea" | "drafted" | "approved"
): Promise<ContentCalendarEntry | undefined> {
  return storage.updateCalendarEntry(id, { status });
}
