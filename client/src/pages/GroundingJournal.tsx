import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import JaeAvatar from "@assets/file_000000006e04620e9931a4040836810b_1771384491714.png";
import { renderInlineMarkdown } from "@/lib/inlineMarkdown";
import { getLocalDateStr } from "@/lib/dateUtils";
import { Loader2, ChevronRight, CheckCircle2, ArrowLeft, AlertCircle, Sparkles } from "lucide-react";
import { SyncedVideoPlayer } from "@/components/SyncedVideoPlayer";
import { JOURNAL_VIDEOS, JOURNAL_AUDIO_SYNC } from "@/content/journalContent";

// ── Journal content ──────────────────────────────────────────────────────────

const DAY_THEMES = ["RESET", "REFOCUS", "REBUILD"] as const;

// Builds a one-event .ics file and hands it to the browser, which offers to
// add it to the user's calendar (iPhone, Android, and desktop all accept it).
// No server, email, or push setup needed.
function downloadReminder(at: Date, title: string) {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const url = `${window.location.origin}/journal`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mustard Seed//Grounding Journal//EN",
    "BEGIN:VEVENT",
    `UID:${at.getTime()}-journal@mustardseeddap.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(at)}`,
    `DTEND:${stamp(new Date(at.getTime() + 15 * 60 * 1000))}`,
    `SUMMARY:Mustard Seed: ${title}`,
    `DESCRIPTION:Come back and reflect with Jai. ${url}`,
    `URL:${url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:Mustard Seed: ${title}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  link.download = "mustard-seed-reminder.ics";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

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

// ── Rebuild funnel card ──────────────────────────────────────────────────────
// The Journal is the free on-ramp; this is the bridge into the deeper,
// paid-track 7-Day Rebuild — mirrored on the styling the Rebuild itself uses
// to pitch its own subscription at Day 7, so the two feel like one funnel.

function RebuildFunnelCard({ started, onClick }: { started: boolean; onClick: () => void }) {
  return (
    <div className="bg-[#1a3a2a] rounded-2xl p-5 text-left space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#c8a84b]" />
        <p className="text-xs font-semibold text-[#c8a84b] uppercase tracking-wider">Ready for more?</p>
      </div>
      <p className="text-sm text-white/90 leading-relaxed">
        The 3-Day Journal grounded you. The 7-Day Rebuild turns what you just named into an actual plan —
        five Heartbeats, with Jai walking beside you the whole way.
      </p>
      <Button
        className="w-full rounded-xl h-12 font-bold"
        style={{ background: "linear-gradient(180deg, #F5D060 0%, #E8B828 100%)", color: "#1a1a1a" }}
        onClick={onClick}
      >
        {started ? "Continue the 7-Day Rebuild" : "Start the 7-Day Rebuild"}
        <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
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

  // Powers the "into the 7-Day Rebuild" nudge below — the Journal is the free
  // on-ramp, the Rebuild is the deeper (paid-track) follow-on. Only fetched
  // once the Journal is actually finished, since that's the only place the
  // nudge appears.
  const { data: rebuildData } = useQuery({
    queryKey: ["rebuild", userId],
    queryFn: () => api.getRebuild(userId!),
    enabled: !!userId && !!journalData?.completed,
  });
  const rebuildStarted = (rebuildData?.instances ?? []).some((i: any) => i.status !== "locked");

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
  // Tester accounts can step past a wait screen; holds the step index skipped.
  const [skippedLockIndex, setSkippedLockIndex] = useState<number | null>(null);
  const [planSaving, setPlanSaving] = useState(false);
  // Evening steps where the user came back by the time they chose (+1 water).
  const [keptCommitments, setKeptCommitments] = useState<Record<string, string>>({});

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

  // ── Submit a prompt session → get Jai reflection ─────────────────────────

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

      const result = await api.submitJournalEntry(userId, { dayNumber: day, session, prompts, localDate: getLocalDateStr() });
      setJaeData((prev) => ({ ...prev, [stepId]: result.jae }));
      if (result.commitmentKept) {
        setKeptCommitments((prev) => ({ ...prev, [stepId]: result.commitmentKept!.plannedAt }));
      }
      setCurrentEntryId(result.entry.id);
      // Refresh the pacing gate now, not just at final completion — otherwise
      // a user could click straight from morning into evening in one sitting
      // before the next mount ever re-fetches lockedSession.
      queryClient.invalidateQueries({ queryKey: ["grounding-journal", userId] });
      advance();
    } catch (err) {
      console.error("[JOURNAL] submit error", err);
      // A pacing-gate rejection re-fetches the gate, which swaps in the
      // "not yet" screen; anything else is a real failure.
      queryClient.invalidateQueries({ queryKey: ["grounding-journal", userId] });
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

  const markComplete = async () => {
    if (!userId) return;
    await api.completeGroundingJournal(userId);
    queryClient.invalidateQueries({ queryKey: ["user", userId] });
    queryClient.invalidateQueries({ queryKey: ["grounding-journal", userId] });
  };

  const handleComplete = async () => {
    await markComplete();
    setLocation("/home");
  };

  const handleGoToRebuild = async () => {
    await markComplete().catch(() => {});
    setLocation("/rebuild");
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
                          <img src={JaeAvatar} className="w-6 h-6 rounded-full object-cover" alt="Jai" />
                          <p className="text-xs font-semibold text-primary">Jai reflected</p>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{renderInlineMarkdown(entry.jaeReflection)}</p>
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
            <p className="text-sm text-muted-foreground">Journal complete. Jai carries this forward with you.</p>
          </div>

          <RebuildFunnelCard started={rebuildStarted} onClick={() => setLocation("/rebuild")} />
        </div>
      </div>
    );
  }

  // ── Locked view (pacing gate) ──────────────────────────────────────────────
  // Evening opens 8 hours after that day's morning or at 9 PM local, whichever
  // is first; the next day's morning opens at 4 AM local the day after the
  // previous evening (server/journalPacing.ts). Everything
  // from the locked session onward waits; reflections already earned stay open.

  const locked = journalData?.lockedSession ?? null;
  const lockedStepIndex = locked ? STEP_ORDER.indexOf(`day${locked.day}-${locked.session}` as StepId) : -1;
  const isSessionLocked = lockedStepIndex !== -1 && stepIndex >= lockedStepIndex && skippedLockIndex !== lockedStepIndex;

  if (!journalLoading && locked && isSessionLocked) {
    const unlocksAt = journalData?.unlocksAt ? new Date(journalData.unlocksAt) : null;
    const isEvening = locked.session === "evening";
    const timeText = unlocksAt?.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const dayText = unlocksAt?.toLocaleString(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" });

    // Hand the user's own morning answer back to them — the thing they said
    // they'd give their attention to is what they're accountable to today.
    const morningEntry = isEvening
      ? (journalData?.entries ?? []).find((e: any) => e.dayNumber === locked.day && e.session === "morning")
      : null;
    const morningFocus: string | null =
      morningEntry?.prompts?.find((p: any) => (p?.response ?? "").trim())?.response?.trim() ?? null;

    return (
      <div className="h-full overflow-y-auto bg-background">
        <div className="max-w-lg mx-auto px-5 py-8 pb-24 space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/home")} className="p-2 rounded-xl hover:bg-muted/50">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                3-Day Grounding Journal · Day {locked.day}
              </p>
              <h1 className="font-serif text-xl font-bold text-foreground" data-testid="text-journal-locked-title">
                {isEvening ? "Now go live it." : "Rest well. Tomorrow is ready for you."}
              </h1>
            </div>
          </div>

          {isEvening ? (
            <div className="bg-white rounded-2xl p-6 border border-border/40 shadow-sm space-y-4">
              {morningFocus && (
                <div className="rounded-xl bg-primary/5 border border-primary/15 p-4">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Your focus for today</p>
                  <p className="text-sm text-foreground leading-relaxed" data-testid="text-morning-focus">"{morningFocus}"</p>
                </div>
              )}
              <p className="text-sm text-foreground leading-relaxed">
                You named it. Now give it your day. It doesn't have to go perfectly. It just needs your honest effort,
                one small step at a time. That's the discipline, and it's how the seed grows.
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                {timeText
                  ? <>Your evening reflection opens at <strong>{timeText}</strong>. Come back then and tell Jai how it went. Whatever happened, showing up to reflect counts.</>
                  : <>Your evening reflection opens later today. Come back then and tell Jai how it went. Whatever happened, showing up to reflect counts.</>}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 border border-border/40 shadow-sm text-center space-y-3">
              <p className="text-sm text-foreground leading-relaxed">
                You showed up today, and that matters. This journal moves one day at a time. That's part of the reset.
              </p>
              <p className="text-sm text-muted-foreground" data-testid="text-journal-unlocks-at">
                {dayText ? `Day ${locked.day} opens ${dayText}.` : `Day ${locked.day} opens at 4 AM the day after your evening reflection.`}
              </p>
            </div>
          )}

          {isEvening && (journalData?.reflectionChoices?.length ?? 0) > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm space-y-3" data-testid="card-reflection-plan">
              <p className="text-sm font-semibold text-foreground">When will you come back to reflect?</p>
              <p className="text-xs text-muted-foreground">Pick a time and keep it. Show up by then and you'll earn a bonus drop of water.</p>
              <div className="grid grid-cols-3 gap-2">
                {journalData!.reflectionChoices.map((iso) => {
                  const selected = journalData?.reflectionPlannedAt
                    ? new Date(journalData.reflectionPlannedAt).getTime() === new Date(iso).getTime()
                    : false;
                  return (
                    <button
                      key={iso}
                      disabled={planSaving}
                      onClick={async () => {
                        if (!userId) return;
                        setPlanSaving(true);
                        try {
                          await api.planJournalReflection(userId, locked.day, iso);
                          await queryClient.invalidateQueries({ queryKey: ["grounding-journal", userId] });
                        } catch (err) {
                          console.error("[JOURNAL] plan error", err);
                        } finally {
                          setPlanSaving(false);
                        }
                      }}
                      className={`h-11 rounded-xl border text-sm font-medium transition-colors ${
                        selected ? "bg-primary text-primary-foreground border-primary" : "bg-white text-foreground border-border hover:bg-muted/40"
                      }`}
                      data-testid="btn-reflection-choice"
                    >
                      {new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </button>
                  );
                })}
              </div>
              {journalData?.reflectionPlannedAt && (
                <p className="text-xs text-primary" data-testid="text-reflection-planned">
                  You're coming back at {new Date(journalData.reflectionPlannedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}. Jai will be here.
                </p>
              )}
            </div>
          )}

          {unlocksAt && unlocksAt.getTime() > Date.now() && (
            <Button
              variant="outline"
              className="w-full rounded-xl h-12"
              onClick={() => downloadReminder(isEvening && journalData?.reflectionPlannedAt ? new Date(journalData.reflectionPlannedAt) : unlocksAt, isEvening ? `Day ${locked.day} evening reflection is open` : `Day ${locked.day} of your Grounding Journal is open`)}
              data-testid="btn-add-reminder"
            >
              Add a reminder to my calendar
            </Button>
          )}
          <Button className="w-full rounded-xl h-12" onClick={() => setLocation("/home")}>
            Back to Home
          </Button>
          {journalData?.canSkipWait && (
            <button
              className="w-full text-xs text-muted-foreground underline"
              onClick={() => setSkippedLockIndex(lockedStepIndex)}
              data-testid="btn-tester-skip-wait"
            >
              Skip the wait (tester)
            </button>
          )}
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
                    <li>• Jai will reflect with you after each session</li>
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
                    <SyncedVideoPlayer
                      url={JOURNAL_VIDEOS[stepId]!}
                      audioSync={JOURNAL_AUDIO_SYNC[stepId]}
                      onReady={() => setVideoAcknowledged((prev) => new Set(prev).add(stepId))}
                      comingSoonText="Video coming soon — being recorded now."
                      skipLabel="Skip to reflection"
                    />
                    <Button
                      className="w-full rounded-xl h-12"
                      onClick={() => setVideoAcknowledged((prev) => new Set(prev).add(stepId))}
                    >
                      {(journalData?.entries ?? []).some((e: any) => e.session !== "intention") ? "Continue" : "I'm ready — start the reflection"}
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
                          Jai is reflecting...
                        </>
                      ) : (
                        <>
                          Save & Hear from Jai
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
                    <img src={JaeAvatar} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow" alt="Jai" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Jai M. Seed</p>
                      <p className="text-xs text-muted-foreground">Day {day} — {DAY_THEMES[day - 1]}</p>
                    </div>
                  </div>

                  {keptCommitments[sourceStep] && (
                    <div className="rounded-2xl p-4 bg-blue-50 border border-blue-200 text-sm text-blue-900" data-testid="banner-commitment-kept">
                      <p className="font-semibold">You kept your word. +1 water 💧</p>
                      <p className="text-blue-800/80 mt-0.5">
                        You said {new Date(keptCommitments[sourceStep]).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}, and you showed up. That's discipline.
                      </p>
                      <p className="text-xs text-blue-800/70 mt-2" data-testid="text-rebuild-water-teaser">
                        This 3-day journal is a taste. The 7-Day Rebuild and Premium give you the full experience: a real goal you water every day, cups that fill, and a seed you watch grow.
                      </p>
                    </div>
                  )}

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
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">What Jai noticed</p>
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
                    <img src={JaeAvatar} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow" alt="Jai" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Jai M. Seed</p>
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
                    Your reflections are saved to your Mustard Seed account. Jai will carry this context into your ongoing journey — your first seed is already forming. Up next: the 7-Day Rebuild, where you'll turn this into an Actionable Goal Plan.
                  </p>
                </div>

                <RebuildFunnelCard started={rebuildStarted} onClick={handleGoToRebuild} />

                <button
                  className="w-full text-sm text-muted-foreground hover:text-foreground py-2"
                  onClick={handleComplete}
                >
                  Not yet — enter the Mustard Seed App
                </button>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
