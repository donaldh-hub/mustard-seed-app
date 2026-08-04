import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import JaeAvatar from "@assets/file_000000006e04620e9931a4040836810b_1771384491714.png";
import { Loader2, ChevronRight, CheckCircle2, ArrowLeft, AlertCircle, Play } from "lucide-react";

// ── Journal content ──────────────────────────────────────────────────────────

const DAY_THEMES = ["RESET", "REFOCUS", "REBUILD"] as const;

const MORNING_PROMPTS: Record<number, string[]> = {
  1: [
    "What's one thing I can give my attention to today?",
    "How can I move through this day with calm and purpose?",
  ],
  2: [
    "What truly matters to me today?",
    "How can I give myself permission to slow down?",
  ],
  3: [
    "What value do I want to carry into today?",
    "How can I stay grounded even when things shift?",
  ],
};

const EVENING_PROMPTS: Record<number, string[]> = {
  1: [
    "When did I feel most present today?",
    "What moment taught me something about my pace or patience?",
  ],
  2: [
    "What moment brought peace or gratitude today?",
    "What can I release before tomorrow begins?",
  ],
  3: [
    "Where did I notice growth, even in small ways?",
    "How can I keep building from this place of calm awareness?",
  ],
};

const GROUNDING_STATEMENT_PROMPTS = [
  "In three short reflections, share what you've learned:",
  "What you'll keep nurturing:",
  "One thing you're ready to carry forward:",
];

// ── Video URLs — replace with real YouTube unlisted URLs when recorded ───────
// [FLAGGED] One video per day (plays before morning session) + one for grounding.
const JOURNAL_VIDEOS: Partial<Record<string, string>> = {
  "day1-morning":       "PLACEHOLDER_JOURNAL_DAY1_YOUTUBE_URL",
  "day2-morning":       "PLACEHOLDER_JOURNAL_DAY2_YOUTUBE_URL",
  "day3-morning":       "PLACEHOLDER_JOURNAL_DAY3_YOUTUBE_URL",
  "grounding-statement": "PLACEHOLDER_JOURNAL_GROUNDING_YOUTUBE_URL",
};

// ── Step definitions ─────────────────────────────────────────────────────────

type StepId =
  | "intro"
  | `day${1 | 2 | 3}-morning`
  | `day${1 | 2 | 3}-morning-jae`
  | `day${1 | 2 | 3}-evening`
  | `day${1 | 2 | 3}-evening-jae`
  | "grounding-statement"
  | "grounding-statement-jae"
  | "complete";

const STEP_ORDER: StepId[] = [
  "intro",
  "day1-morning", "day1-morning-jae",
  "day1-evening", "day1-evening-jae",
  "day2-morning", "day2-morning-jae",
  "day2-evening", "day2-evening-jae",
  "day3-morning", "day3-morning-jae",
  "day3-evening", "day3-evening-jae",
  "grounding-statement", "grounding-statement-jae",
  "complete",
];

// Maps (dayNumber-session) → the STEP_ORDER index to resume at (next prompt step)
const SESSION_RESUME_STEP: Record<string, number> = {
  "1-intention":          1,  // → day1-morning
  "1-morning":            3,  // → day1-evening
  "1-evening":            5,  // → day2-morning
  "2-morning":            7,  // → day2-evening
  "2-evening":            9,  // → day3-morning
  "3-morning":            11, // → day3-evening
  "3-evening":            13, // → grounding-statement
  "3-grounding_statement": 15, // → complete
};

const SESSION_LABELS: Record<string, string> = {
  morning: "Morning Focus",
  evening: "Evening Reflection",
  grounding_statement: "Grounding Statement",
  intention: "Opening Intention",
};

// ── VideoPlayer ───────────────────────────────────────────────────────────────

function VideoPlayer({ url, onReady }: { url: string; onReady: () => void }) {
  const isPlaceholder = url.startsWith("PLACEHOLDER");

  if (isPlaceholder) {
    return (
      <div className="w-full aspect-video bg-[#1a3a2a] rounded-2xl flex flex-col items-center justify-center gap-4 text-white">
        <Play className="w-12 h-12 text-[#c8a84b] opacity-80" />
        <p className="text-sm text-stone-300 text-center px-6">
          Video coming soon — being recorded now.
        </p>
        <Button
          variant="outline"
          className="text-white border-white/30 hover:bg-white/10 mt-2"
          onClick={onReady}
        >
          Skip to reflection
        </Button>
      </div>
    );
  }

  const embedUrl = url.includes("youtube.com/watch")
    ? url.replace("watch?v=", "embed/")
    : url.includes("youtu.be/")
    ? url.replace("youtu.be/", "www.youtube.com/embed/")
    : url;

  return (
    <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-lg">
      <iframe
        src={embedUrl}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Session video"
      />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GroundingJournal() {
  const userId = useStore((s) => s.userId);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: journalData, isLoading: journalLoading } = useQuery({
    queryKey: ["grounding-journal", userId],
    queryFn: () => api.getGroundingJournal(userId!),
    enabled: !!userId,
  });

  const [stepIndex, setStepIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [jaeData, setJaeData] = useState<Record<string, any>>({});
  const [followUpText, setFollowUpText] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const [intention, setIntention] = useState("");
  const [videoAcknowledged, setVideoAcknowledged] = useState<Set<string>>(new Set());

  const hasResumed = useRef(false);

  const stepId = STEP_ORDER[stepIndex];

  // ── Resume from partial completion ────────────────────────────────────────

  useEffect(() => {
    if (hasResumed.current || !journalData || journalData.completed) return;
    hasResumed.current = true;

    const entries: any[] = journalData.entries ?? [];
    if (entries.length === 0) return;

    // Reconstruct jaeData from saved entries
    const restoredJae: Record<string, any> = {};
    entries.forEach((entry) => {
      let stepKey: string;
      if (entry.session === "grounding_statement") {
        stepKey = "grounding-statement";
      } else if (entry.session === "morning" || entry.session === "evening") {
        stepKey = `day${entry.dayNumber}-${entry.session}`;
      } else {
        return; // intention — no jae step
      }
      restoredJae[stepKey] = {
        reflection: entry.jaeReflection,
        followUpQuestion: entry.jaeFollowUpQuestion,
        keyTheme: entry.keyTheme,
        valueNamed: entry.valueNamed,
        releasePoint: entry.releasePoint,
        possibleFirstSeed: entry.possibleFirstSeed,
      };
    });
    setJaeData(restoredJae);

    // Advance to the step after the furthest completed session
    let maxNextStep = 0;
    entries.forEach((entry) => {
      const key = `${entry.dayNumber}-${entry.session}`;
      const nextStep = SESSION_RESUME_STEP[key] ?? 0;
      if (nextStep > maxNextStep) maxNextStep = nextStep;
    });
    if (maxNextStep > 0) setStepIndex(maxNextStep);
  }, [journalData]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const advance = () => setStepIndex((i) => i + 1);

  const currentPrompts = (): string[] => {
    if (stepId === "intro") return [];
    if (stepId === "grounding-statement") return GROUNDING_STATEMENT_PROMPTS;
    const match = stepId.match(/^day(\d)-(morning|evening)$/);
    if (!match) return [];
    const day = parseInt(match[1]);
    const session = match[2] as "morning" | "evening";
    return session === "morning" ? MORNING_PROMPTS[day] : EVENING_PROMPTS[day];
  };

  const responseKey = (prompt: string) => `${stepId}::${prompt}`;

  const allAnswered = () => {
    const prompts = currentPrompts();
    if (prompts.length === 0) return true;
    return prompts.every((p) => (responses[responseKey(p)] ?? "").trim().length > 0);
  };

  const dayOf = (id: StepId): 1 | 2 | 3 => {
    const match = id.match(/^day(\d)/);
    return match ? (parseInt(match[1]) as 1 | 2 | 3) : 1;
  };

  const sessionOf = (id: StepId): "morning" | "evening" | "grounding_statement" => {
    if (id.includes("morning")) return "morning";
    if (id.includes("evening")) return "evening";
    return "grounding_statement";
  };

  const stepHasVideo = (id: string) => !!JOURNAL_VIDEOS[id];
  const videoIsReady = (id: string) => videoAcknowledged.has(id);

  // ── Save opening intention then advance ───────────────────────────────────

  const handleIntentionSubmit = async () => {
    if (!userId || !intention.trim() || saving) return;
    setSaving(true);
    try {
      await api.submitJournalEntry(userId, {
        dayNumber: 1,
        session: "intention" as any,
        prompts: [{ prompt: "Before you begin — write one gentle intention:", response: intention.trim() }],
      });
    } catch {
      // Non-fatal — persist failure doesn't block the user
    } finally {
      setSaving(false);
    }
    advance();
  };

  // ── Submit a prompt session → get Jae reflection ─────────────────────────

  const handleSubmitSession = async () => {
    if (!userId || saving) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const prompts = currentPrompts().map((p) => ({
        prompt: p,
        response: responses[responseKey(p)] ?? "",
      }));

      const isGrounding = stepId === "grounding-statement";
      const day = isGrounding ? 3 : dayOf(stepId as StepId);
      const session = isGrounding ? "grounding_statement" : sessionOf(stepId as StepId);

      const result = await api.submitJournalEntry(userId, { dayNumber: day, session, prompts });
      setJaeData((prev) => ({ ...prev, [stepId]: result.jae }));
      setCurrentEntryId(result.entry.id);
      advance();
    } catch (err) {
      console.error("[JOURNAL] submit error", err);
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Save optional follow-up response then advance ─────────────────────────

  const handleSaveFollowUp = async () => {
    setFollowUpError(null);
    if (!userId || !currentEntryId || !followUpText.trim()) {
      setFollowUpText("");
      advance();
      return;
    }
    try {
      await api.saveJournalFollowUp(userId, currentEntryId, followUpText.trim());
    } catch {
      setFollowUpError("Couldn't save your response — tap Continue to proceed anyway.");
    }
    setFollowUpText("");
    advance();
  };

  // ── Mark journal complete + navigate ──────────────────────────────────────

  const handleComplete = async () => {
    if (!userId) return;
    await api.completeGroundingJournal(userId);
    queryClient.invalidateQueries({ queryKey: ["user", userId] });
    queryClient.invalidateQueries({ queryKey: ["grounding-journal", userId] });
    setLocation("/home");
  };

  // ── Progress indicator ────────────────────────────────────────────────────

  const totalPromptSteps = 8;
  const promptStepsDone = STEP_ORDER.slice(0, stepIndex).filter(
    (s) => !s.endsWith("-jae") && s !== "complete"
  ).length;
  const progress = Math.min(100, Math.round((promptStepsDone / totalPromptSteps) * 100));

  // ── Completed read-only view ──────────────────────────────────────────────

  if (!journalLoading && journalData?.completed) {
    const entries: any[] = journalData.entries ?? [];
    const dayGroups: Record<number, any[]> = {};
    entries.forEach((e) => {
      if (e.session === "intention") return; // don't surface intention entries
      if (!dayGroups[e.dayNumber]) dayGroups[e.dayNumber] = [];
      dayGroups[e.dayNumber].push(e);
    });
    const DAY_THEME_LABELS = ["RESET", "REFOCUS", "REBUILD"];

    return (
      <div className="h-full overflow-y-auto bg-background">
        <div className="max-w-lg mx-auto px-5 py-8 pb-24 space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/home")} className="p-2 rounded-xl hover:bg-muted/50">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">3-Day Grounding Journal</p>
              <h1 className="font-serif text-xl font-bold text-foreground">Your Reflections</h1>
            </div>
          </div>

          {[1, 2, 3].map((day) => {
            const dayEntries = dayGroups[day] ?? [];
            if (dayEntries.length === 0) return null;
            return (
              <div key={day} className="space-y-3">
                <p className="text-xs font-bold text-primary uppercase tracking-widest">
                  Day {day} — {DAY_THEME_LABELS[day - 1]}
                </p>
                {dayEntries.map((entry: any) => (
                  <div key={entry.id} className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm space-y-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {SESSION_LABELS[entry.session] ?? entry.session}
                    </p>

                    {Array.isArray(entry.prompts) && entry.prompts.length > 0 && (
                      <div className="space-y-3">
                        {entry.prompts.map((p: any, i: number) => (
                          <div key={i} className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">{p.prompt}</p>
                            <p className="text-sm text-foreground leading-relaxed">{p.response}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {entry.jaeReflection && (
                      <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 space-y-2">
                        <div className="flex items-center gap-2">
                          <img src={JaeAvatar} className="w-6 h-6 rounded-full object-cover" alt="Jae" />
                          <p className="text-xs font-semibold text-primary">Jae reflected</p>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{entry.jaeReflection}</p>
                        {/* Only show first seed on grounding_statement entries */}
                        {entry.session === "grounding_statement" && entry.possibleFirstSeed && (
                          <div className="mt-2 bg-white rounded-lg p-3 border border-primary/20">
                            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Your First Seed</p>
                            <p className="text-sm font-medium text-foreground">{entry.possibleFirstSeed}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {entry.userFollowUpResponse && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Your follow-up</p>
                        <p className="text-sm text-foreground leading-relaxed">{entry.userFollowUpResponse}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}

          <div className="text-center py-4">
            <CheckCircle2 className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Journal complete. Jae carries this forward with you.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-lg mx-auto px-5 py-8 pb-24">

        {/* Header */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">3-Day Grounding Journal</p>
          <div className="w-full bg-primary/10 rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={stepId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >

            {/* ── INTRO ── */}
            {stepId === "intro" && (
              <div className="space-y-6">
                <div className="text-center space-y-3 pt-4">
                  <p className="text-3xl">🌱</p>
                  <h1 className="font-serif text-2xl font-bold text-foreground">3-Day Grounding Journal</h1>
                  <p className="text-sm text-muted-foreground italic">Find your footing. Regain your focus. Rebuild your calm.</p>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-border/50 shadow-sm space-y-3">
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    "You don't have to be perfect to begin again. Every time you pause, notice, and choose what matters — that's rebuilding. Let's start small and steady."
                  </p>
                  <p className="text-xs text-muted-foreground text-right">— Donald H.</p>
                </div>

                <div className="bg-primary/5 rounded-2xl p-5 border border-primary/15 space-y-2">
                  <p className="text-sm font-semibold text-foreground">How this works:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Each morning, set your focus for the day</li>
                    <li>• Each evening, reflect with honesty and grace</li>
                    <li>• Jae will reflect with you after each session</li>
                    <li>• Awareness is progress. Showing up counts.</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Before you begin — write one gentle intention:
                  </label>
                  <p className="text-xs text-muted-foreground italic">Over the next three days, I'm grounding myself in...</p>
                  <Textarea
                    placeholder="..."
                    value={intention}
                    onChange={(e) => setIntention(e.target.value)}
                    className="resize-none rounded-xl min-h-[80px]"
                  />
                </div>

                <Button
                  className="w-full rounded-xl h-12"
                  disabled={!intention.trim() || saving}
                  onClick={handleIntentionSubmit}
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Begin Day 1 — RESET
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}

            {/* ── PROMPT STEP (morning / evening / grounding-statement) ── */}
            {!stepId.endsWith("-jae") && stepId !== "intro" && stepId !== "complete" && (
              <div className="space-y-6">
                {/* Day header */}
                {stepId !== "grounding-statement" && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary uppercase tracking-widest">
                        Day {dayOf(stepId as StepId)} — {DAY_THEMES[dayOf(stepId as StepId) - 1]}
                      </span>
                    </div>
                    <h2 className="font-serif text-xl font-bold text-foreground capitalize">
                      {sessionOf(stepId as StepId)} {stepId.includes("morning") ? "Focus" : "Reflection"}
                    </h2>
                  </div>
                )}

                {stepId === "grounding-statement" && (
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-primary uppercase tracking-widest">Final Reflection</span>
                    <h2 className="font-serif text-xl font-bold text-foreground">Grounding Statement</h2>
                    <p className="text-sm text-muted-foreground">You've done three days of honest work. Describe what you've learned and what you'll keep nurturing.</p>
                  </div>
                )}

                {/* Video (if applicable and not yet dismissed) */}
                {stepHasVideo(stepId) && !videoIsReady(stepId) && (
                  <div className="space-y-4">
                    <VideoPlayer
                      url={JOURNAL_VIDEOS[stepId]!}
                      onReady={() => setVideoAcknowledged((prev) => new Set(prev).add(stepId))}
                    />
                    <Button
                      className="w-full rounded-xl h-12"
                      onClick={() => setVideoAcknowledged((prev) => new Set(prev).add(stepId))}
                    >
                      I'm ready — start the reflection
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                )}

                {/* Prompts (shown after video or if no video) */}
                {(!stepHasVideo(stepId) || videoIsReady(stepId)) && (
                  <>
                    <div className="space-y-5">
                      {currentPrompts().map((prompt, i) => (
                        <div key={i} className="space-y-2">
                          <label className="text-sm font-medium text-foreground leading-snug">{prompt}</label>
                          <Textarea
                            placeholder="Take your time..."
                            value={responses[responseKey(prompt)] ?? ""}
                            onChange={(e) =>
                              setResponses((prev) => ({ ...prev, [responseKey(prompt)]: e.target.value }))
                            }
                            className="resize-none rounded-xl min-h-[90px]"
                          />
                        </div>
                      ))}
                    </div>

                    <Button
                      className="w-full rounded-xl h-12"
                      disabled={!allAnswered() || saving}
                      onClick={handleSubmitSession}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Jae is reflecting...
                        </>
                      ) : (
                        <>
                          Save & Hear from Jae
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </>
                      )}
                    </Button>
                    {submitError && (
                      <div className="flex items-center gap-1.5 text-red-600 text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{submitError}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── JAE REFLECTION STEP (morning / evening) ── */}
            {stepId.endsWith("-jae") && stepId !== "grounding-statement-jae" && (() => {
              const sourceStep = stepId.replace("-jae", "") as StepId;
              const jae = jaeData[sourceStep];
              const day = dayOf(sourceStep as StepId);
              const isLastStepOfDay = sourceStep.includes("evening");
              const isDay3Evening = sourceStep === "day3-evening";

              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <img src={JaeAvatar} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow" alt="Jae" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Jae M. Seed</p>
                      <p className="text-xs text-muted-foreground">Day {day} — {DAY_THEMES[day - 1]}</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm space-y-4">
                    <p className="text-sm text-foreground leading-relaxed">{jae?.reflection}</p>
                    {jae?.followUpQuestion && (
                      <p className="text-sm font-medium text-primary">{jae.followUpQuestion}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Your response (optional)</label>
                    <Textarea
                      placeholder="..."
                      value={followUpText}
                      onChange={(e) => setFollowUpText(e.target.value)}
                      className="resize-none rounded-xl min-h-[80px]"
                    />
                  </div>

                  {followUpError && (
                    <div className="flex items-center gap-1.5 text-amber-600 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{followUpError}</span>
                    </div>
                  )}

                  <Button className="w-full rounded-xl h-12" onClick={handleSaveFollowUp}>
                    {isDay3Evening
                      ? "Continue to Final Reflection"
                      : isLastStepOfDay
                      ? `Day ${day} Complete — Continue to Day ${day + 1}`
                      : "Continue to Evening Reflection"}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>

                  {isLastStepOfDay && jae?.keyTheme && (
                    <div className="bg-primary/5 rounded-xl px-4 py-3 border border-primary/15">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">What Jae noticed</p>
                      <p className="text-sm text-foreground">Theme: <span className="font-medium">{jae.keyTheme}</span></p>
                      {jae.valueNamed && <p className="text-sm text-foreground">Value: <span className="font-medium">{jae.valueNamed}</span></p>}
                      {jae.releasePoint && <p className="text-sm text-foreground">Ready to release: <span className="font-medium">{jae.releasePoint}</span></p>}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── GROUNDING STATEMENT JAE ── */}
            {stepId === "grounding-statement-jae" && (() => {
              const jae = jaeData["grounding-statement"];
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <img src={JaeAvatar} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow" alt="Jae" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Jae M. Seed</p>
                      <p className="text-xs text-muted-foreground">Your first seed</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm space-y-4">
                    <p className="text-sm text-foreground leading-relaxed">{jae?.reflection}</p>
                    {jae?.possibleFirstSeed && (
                      <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Your Possible First Seed</p>
                        <p className="text-sm font-medium text-foreground">{jae.possibleFirstSeed}</p>
                      </div>
                    )}
                    {jae?.followUpQuestion && (
                      <p className="text-sm font-medium text-primary">{jae.followUpQuestion}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Your response (optional)</label>
                    <Textarea
                      placeholder="..."
                      value={followUpText}
                      onChange={(e) => setFollowUpText(e.target.value)}
                      className="resize-none rounded-xl min-h-[80px]"
                    />
                  </div>

                  {followUpError && (
                    <div className="flex items-center gap-1.5 text-amber-600 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{followUpError}</span>
                    </div>
                  )}

                  <Button className="w-full rounded-xl h-12" onClick={handleSaveFollowUp}>
                    Continue to the Mustard Seed App
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              );
            })()}

            {/* ── COMPLETE ── */}
            {stepId === "complete" && (
              <div className="space-y-6 text-center py-8">
                <div className="flex justify-center">
                  <CheckCircle2 className="w-16 h-16 text-primary" />
                </div>
                <div className="space-y-2">
                  <h2 className="font-serif text-2xl font-bold text-foreground">You've grounded yourself.</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Three days of pausing, noticing, and choosing what matters. That's rebuilding.
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm text-left space-y-2">
                  <p className="text-sm font-semibold text-foreground">What's next</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Your reflections are saved to your Mustard Seed account. Jae will carry this context into your ongoing journey — your first seed is already forming.
                  </p>
                </div>
                <Button className="w-full rounded-xl h-12" onClick={handleComplete}>
                  Enter the Mustard Seed App
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
