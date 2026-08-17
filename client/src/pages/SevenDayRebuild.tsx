import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronRight, CheckCircle2, Lock, Play, ArrowLeft, Loader2, AlertCircle,
} from "lucide-react";
import JaeAvatar from "@assets/file_000000006e04620e9931a4040836810b_1771384491714.png";
import {
  REBUILD_INSTANCES,
  REBUILD_AUDIO_SYNC,
  REBUILD_OVERVIEW_VIDEO_URL,
  REBUILD_OVERVIEW_AUDIO_URL,
  DAY7_STAGES,
  JORDAN_CHAPTERS,
  jordanText,
  WELCOME_BACK_GAP_HOURS,
  SUBSCRIPTION_NUDGE_INSTANCES,
  type CharacterTrack,
  type RebuildAudioSync,
} from "@/content/rebuildContent";

// ─── Types ────────────────────────────────────────────────────────────────────

type View = "overview" | "instance" | "subscription";
type Phase =
  | "welcome-back"
  | "video"
  | "jai"
  | "day5-followup"
  | "day6-character"
  | "day6-chapters"
  | "day7-stages"
  | "complete";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  locked: "Locked",
  unlocked: "Ready",
  in_progress: "In Progress",
  completed: "Complete",
};

function instanceHasGap(lastActivityAt: string | null): boolean {
  if (!lastActivityAt) return false;
  const gapMs = Date.now() - new Date(lastActivityAt).getTime();
  return gapMs > WELCOME_BACK_GAP_HOURS * 60 * 60 * 1000;
}

function injectMemory(question: string, priorMemory: Record<string, any>): string {
  return question
    .replace("{day1Why}", priorMemory.whyStatement ?? "your stated why")
    .replace("{day2Min}", priorMemory.nonNegotiableMinimum ?? "your non-negotiable minimum")
    .replace("{day3Reframe}", priorMemory.reframedTruth ?? "your reframed truth")
    .replace("{day4Adjustment}", priorMemory.chosenAdjustment ?? "your chosen adjustment")
    .replace("{day5Action}", priorMemory.committed24hrStep ?? "the action you named");
}

// ─── Video Player ─────────────────────────────────────────────────────────────
// Real animation files are silent — narration lives as separate mp3 clips.
// "timed" sync fires each clip when the video's playhead crosses its scripted
// start time; "sequential" (no timing map exists) just chains clips back to
// back alongside the video's own pacing. If narration outlasts the video
// (a couple of days self-flag this in their own scripts), the video holds its
// last frame while remaining clips keep playing to completion.

function VideoPlayer({
  url,
  audioSync,
  onReady,
}: {
  url: string;
  audioSync?: RebuildAudioSync;
  onReady: () => void;
}) {
  const isPlaceholder = url.startsWith("PLACEHOLDER");
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [started, setStarted] = useState(false);
  const playedRef = useRef<Set<number>>(new Set());

  function playClip(n: number) {
    if (!audioSync || !audioRef.current || playedRef.current.has(n)) return;
    playedRef.current.add(n);
    audioRef.current.src = audioSync.clipUrl(n);
    audioRef.current.play().catch(() => {});
  }

  function handleStart() {
    setStarted(true);
    videoRef.current?.play().catch(() => {});
    if (audioSync) playClip(1);
  }

  function handleTimeUpdate() {
    if (!audioSync || audioSync.mode !== "timed" || !audioSync.slides) return;
    const t = videoRef.current?.currentTime ?? 0;
    for (const slide of audioSync.slides) {
      if (t >= slide.startSec && !playedRef.current.has(slide.slideNumber)) {
        playClip(slide.slideNumber);
        break;
      }
    }
  }

  function handleAudioEnded() {
    if (!audioSync) return;
    const nextClip = playedRef.current.size + 1;
    if (nextClip > audioSync.clipCount) return;
    // Sequential mode always chains immediately. Timed mode only chains here
    // once the video itself has stopped advancing (ended, or narration is
    // known to outlast it) — otherwise handleTimeUpdate drives the pacing.
    const videoDone = videoRef.current?.ended ?? false;
    if (audioSync.mode === "sequential" || videoDone || audioSync.timingMismatch) {
      playClip(nextClip);
    }
  }

  if (isPlaceholder) {
    return (
      <div className="w-full aspect-video bg-[#1a3a2a] rounded-2xl flex flex-col items-center justify-center gap-4 text-white">
        <Play className="w-12 h-12 text-[#c8a84b] opacity-80" />
        <p className="text-sm text-stone-300 text-center px-6">
          Video coming soon — slide deck is being recorded.
        </p>
        <Button
          variant="outline"
          className="text-white border-white/30 hover:bg-white/10 mt-2"
          onClick={onReady}
        >
          Skip to Jai conversation
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-lg relative bg-black">
      <video
        ref={videoRef}
        src={url}
        muted
        playsInline
        controls={started}
        className="w-full h-full object-contain"
        onTimeUpdate={handleTimeUpdate}
      />
      {audioSync && <audio ref={audioRef} onEnded={handleAudioEnded} />}
      {!started && (
        <button
          onClick={handleStart}
          className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/30 transition-colors text-white"
          aria-label="Play video"
        >
          <span className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <Play className="w-8 h-8 ml-1" fill="currentColor" />
          </span>
        </button>
      )}
    </div>
  );
}

// ─── Overview video (single video + single combined narration track) ──────────

function OverviewVideo() {
  const isPlaceholder = REBUILD_OVERVIEW_VIDEO_URL.startsWith("PLACEHOLDER");
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [started, setStarted] = useState(false);

  if (isPlaceholder) {
    return (
      <div className="w-full aspect-video bg-[#1a3a2a] rounded-2xl flex flex-col items-center justify-center gap-3 text-white">
        <Play className="w-10 h-10 text-[#c8a84b] opacity-80" />
        <p className="text-sm text-stone-300 text-center px-6">Overview video coming soon.</p>
      </div>
    );
  }

  function handleStart() {
    setStarted(true);
    videoRef.current?.play().catch(() => {});
    audioRef.current?.play().catch(() => {});
  }

  return (
    <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-lg relative bg-black">
      <video ref={videoRef} src={REBUILD_OVERVIEW_VIDEO_URL} muted playsInline controls={started} className="w-full h-full object-contain" />
      <audio ref={audioRef} src={REBUILD_OVERVIEW_AUDIO_URL} />
      {!started && (
        <button
          onClick={handleStart}
          className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/30 transition-colors text-white"
          aria-label="Play overview video"
        >
          <span className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <Play className="w-8 h-8 ml-1" fill="currentColor" />
          </span>
        </button>
      )}
    </div>
  );
}

// ─── Jai message bubble ───────────────────────────────────────────────────────

function JaeBubble({ text }: { text: string }) {
  return (
    <div className="flex gap-3 items-start">
      <img src={JaeAvatar} className="w-9 h-9 rounded-full object-cover border-2 border-white shadow shrink-0" alt="Jai" />
      <div className="bg-white rounded-2xl rounded-tl-sm p-4 border border-border/40 shadow-sm flex-1">
        <p className="text-sm text-foreground leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SevenDayRebuild() {
  const userId = useStore((s) => s.userId);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: rebuildData, isLoading } = useQuery({
    queryKey: ["rebuild", userId],
    queryFn: () => api.getRebuild(userId!),
    enabled: !!userId,
  });

  const [view, setView] = useState<View>("overview");
  const [currentInstanceNum, setCurrentInstanceNum] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("video");

  // Jai conversation state
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [jaeReply, setJaeReply] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Day 6
  const [characterTrack, setCharacterTrack] = useState<CharacterTrack>("neutral");
  const [chapterIndex, setChapterIndex] = useState(0);
  const [chapterJaeReplies, setChapterJaeReplies] = useState<any[]>([]);

  // Day 7
  const [day7StageIndex, setDay7StageIndex] = useState(0);
  const [day7Memory, setDay7Memory] = useState<Record<string, any>>({});
  const [day7StagesCompleted, setDay7StagesCompleted] = useState<Record<number, boolean>>({});

  // Memory accumulator (filled as user answers, sent on complete)
  const [memoryData, setMemoryData] = useState<Record<string, any>>({});

  const instances: any[] = rebuildData?.instances ?? [];
  const lastActivityAt = rebuildData?.lastRebuildActivityAt ?? null;
  const currentConfig = REBUILD_INSTANCES.find((c) => c.instanceNumber === currentInstanceNum);

  // Build prior memory from completed instances
  const priorMemory: Record<string, any> = {};
  instances
    .filter((i) => i.status === "completed")
    .forEach((i) => Object.assign(priorMemory, i.memoryData ?? {}));

  // ── Enter an instance ──────────────────────────────────────────────────────

  function enterInstance(n: number) {
    const inst = instances.find((i) => i.instanceNumber === n);
    if (!inst || inst.status === "locked") return;

    setCurrentInstanceNum(n);
    setView("instance");
    setResponses({});
    setJaeReply(null);
    setError(null);
    setChapterIndex(0);
    setChapterJaeReplies([]);
    setDay7StageIndex(0);
    setDay7Memory({});
    setMemoryData({});

    // Determine starting phase
    const hasGap = instanceHasGap(lastActivityAt);
    if (hasGap && (inst.status === "in_progress" || inst.status === "completed")) {
      setPhase("welcome-back");
    } else if (inst.status === "completed") {
      setPhase("complete");
    } else {
      setPhase("video");
    }

    // Restore Day 7 stage progress
    if (n === 7 && inst.day7Stages) {
      setDay7StagesCompleted(inst.day7Stages);
      const nextStage = DAY7_STAGES.findIndex((s) => !inst.day7Stages[s.stageNumber]);
      setDay7StageIndex(nextStage >= 0 ? nextStage : DAY7_STAGES.length);
    }

    // Restore Day 6 character track
    if (n === 6 && inst.memoryData?.characterTrack) {
      setCharacterTrack(inst.memoryData.characterTrack);
    }
  }

  // ── Submit Jai questions (instances 1–5) ──────────────────────────────────

  async function handleReflect() {
    if (!userId || !currentConfig || saving) return;
    setSaving(true);
    setError(null);
    try {
      const prompts = currentConfig.questions.map((q) => ({
        prompt: q,
        response: responses[q] ?? "",
      }));

      const { jae } = await api.rebuildReflect(userId, currentInstanceNum!, { prompts });
      setJaeReply(jae);

      // Save user responses to memory
      const newMemory: Record<string, any> = {};
      currentConfig.memoryFields.forEach((field, i) => {
        newMemory[field] = prompts[i]?.response ?? "";
      });
      if (currentInstanceNum === 5) newMemory.followUpStatus = "pending";
      setMemoryData(newMemory);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Complete an instance ──────────────────────────────────────────────────

  async function handleComplete(extraMemory?: Record<string, any>) {
    if (!userId) return;
    setSaving(true);
    try {
      const finalMemory = { ...memoryData, ...(extraMemory ?? {}) };
      await api.rebuildComplete(userId, currentInstanceNum!, { memoryData: finalMemory });
      queryClient.invalidateQueries({ queryKey: ["rebuild", userId] });

      // [FLAGGED] Subscription paywall appears immediately after Day 7 closing message.
      // Default: set view to "subscription" after Day 7. Move this block to change placement.
      if (currentInstanceNum === 7) {
        setView("subscription");
      } else {
        setPhase("complete");
      }
    } catch {
      setError("Could not save progress. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Day 6: submit a chapter answer ───────────────────────────────────────

  async function handleChapterSubmit() {
    if (!userId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const chapter = JORDAN_CHAPTERS[chapterIndex];
      const answer = responses[`chapter-${chapterIndex}`] ?? "";
      const { jae } = await api.rebuildReflect(userId, 6, {
        prompts: [{ prompt: chapter.prompt, response: answer }],
        characterTrack,
        chapterNumber: chapter.number,
      });
      setChapterJaeReplies((prev) => [...prev, { chapterNumber: chapter.number, jae }]);

      if (chapterIndex < JORDAN_CHAPTERS.length - 1) {
        setChapterIndex((i) => i + 1);
      } else {
        // All chapters done — move to bridge question
        setPhase("jai");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Day 6: submit bridge question ────────────────────────────────────────

  async function handleDay6BridgeSubmit() {
    if (!userId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const bridgeQ = currentConfig!.questions[4];
      const answer = responses[bridgeQ] ?? "";
      const { jae } = await api.rebuildReflect(userId, 6, {
        prompts: [{ prompt: bridgeQ, response: answer }],
        characterTrack,
      });
      setJaeReply(jae);
      setMemoryData({
        characterTrack,
        chapterAnswers: JORDAN_CHAPTERS.map((_, i) => responses[`chapter-${i}`] ?? ""),
        hardestHeartbeat: answer,
      });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Day 7: submit a stage (get Jai response) ─────────────────────────────

  async function handleDay7StageSubmit() {
    if (!userId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const stage = DAY7_STAGES[day7StageIndex];
      const answer = responses[`stage-${stage.stageNumber}`] ?? "";
      const { jae } = await api.rebuildReflect(userId, 7, {
        prompts: [{ prompt: stage.question, response: answer }],
        stageNumber: stage.stageNumber,
        day7GoalPlan: day7Memory,
      });

      const newDay7Memory = { ...day7Memory, [stage.memoryField]: answer };
      setDay7Memory(newDay7Memory);

      const newStagesCompleted = { ...day7StagesCompleted, [stage.stageNumber]: true };
      setDay7StagesCompleted(newStagesCompleted);

      setJaeReply(jae);
      // User sees Jai's response, then clicks advance (handleDay7StageAdvance)
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Day 7: advance after reading Jai's response ───────────────────────────

  async function handleDay7StageAdvance() {
    if (!userId || saving) return;
    setSaving(true);
    try {
      // Persist incremental progress (server guards against premature completion)
      await api.rebuildComplete(userId, 7, {
        memoryData: day7Memory,
        day7Stages: day7StagesCompleted,
      }).catch(() => {});

      if (day7StageIndex < DAY7_STAGES.length - 1) {
        setDay7StageIndex((i) => i + 1);
        setJaeReply(null);
      } else {
        await handleComplete(day7Memory);
      }
    } catch {
      setError("Could not save progress. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Day 5 follow-up check-in ─────────────────────────────────────────────

  async function handleDay5Followup(status: "confirmed" | "not_done") {
    if (!userId) return;
    await api.rebuildDay5Followup(userId, status).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ["rebuild", userId] });
    setPhase("complete");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // ── Subscription screen (after Day 7) ─────────────────────────────────────
  // [FLAGGED] This is the default placement (immediately after Day 7 closing message).
  // To move it, change where setView("subscription") is called in handleComplete.
  if (view === "subscription") {
    return (
      <div className="h-full overflow-y-auto bg-background">
        <div className="max-w-lg mx-auto px-5 py-12 flex flex-col items-center text-center gap-6">
          <div className="text-5xl">🌳</div>
          <div className="space-y-2">
            <h1 className="font-serif text-2xl font-bold text-foreground">You kept the promise.</h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              Seven instances. Five Heartbeats. One plan that's actually yours. That's the Rebuild.
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-border/40 shadow-sm w-full text-left space-y-3">
            <p className="font-semibold text-foreground">What comes next:</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Jai will keep walking with you — daily coaching, photo progress, memory that carries
              forward, weekly reviews. Everything you've built this week is the foundation.
            </p>
            <p className="text-sm text-muted-foreground">
              Subscribe to keep growing. Cancel anytime.
            </p>
          </div>
          <Button
            className="w-full rounded-full h-12 text-base font-bold"
            style={{ background: "linear-gradient(180deg, #F5D060 0%, #E8B828 100%)", color: "#1a1a1a" }}
            onClick={async () => {
              try {
                const { url } = await api.createStripeCheckout(userId!);
                if (url) window.location.href = url;
              } catch {
                setLocation("/profile");
              }
            }}
          >
            Keep Growing — Subscribe
          </Button>
          <button
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setLocation("/home")}
          >
            Maybe later
          </button>
        </div>
      </div>
    );
  }

  // ── Overview ───────────────────────────────────────────────────────────────
  if (view === "overview") {
    return (
      <div className="h-full overflow-y-auto bg-background">
        <div className="max-w-lg mx-auto px-5 py-8 pb-24 space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/home")} className="p-2 rounded-xl hover:bg-muted/50">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">7-Day Rebuild</p>
              <h1 className="font-serif text-xl font-bold text-foreground">Your Journey</h1>
            </div>
          </div>

          {/* Overview video — shown only before the program has been started */}
          {!instances.some((i) => i.status !== "locked") && (
            <OverviewVideo />
          )}

          {/* Day 5 follow-up prompt if pending */}
          {(() => {
            const inst5 = instances.find((i) => i.instanceNumber === 5);
            const followUpStatus = (inst5?.memoryData as any)?.followUpStatus;
            if (inst5?.status === "completed" && followUpStatus === "pending") {
              return (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <img src={JaeAvatar} className="w-8 h-8 rounded-full object-cover" alt="Jai" />
                    <p className="text-sm font-semibold text-amber-800">Jai checking in</p>
                  </div>
                  <p className="text-sm text-amber-900">
                    On Day 5, you committed to taking a specific action in 24 hours. Did you do it?
                  </p>
                  <div className="flex gap-3">
                    <Button size="sm" className="flex-1 rounded-xl" onClick={() => handleDay5Followup("confirmed")}>
                      Yes, I did it
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 rounded-xl" onClick={() => handleDay5Followup("not_done")}>
                      Not yet
                    </Button>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Instance cards */}
          <div className="space-y-3">
            {REBUILD_INSTANCES.map((config) => {
              const inst = instances.find((i) => i.instanceNumber === config.instanceNumber);
              const status: string = inst?.status ?? "locked";
              const isLocked = status === "locked";
              const isComplete = status === "completed";
              const isActive = status === "unlocked" || status === "in_progress";

              return (
                <motion.button
                  key={config.instanceNumber}
                  disabled={isLocked}
                  onClick={() => enterInstance(config.instanceNumber)}
                  whileTap={!isLocked ? { scale: 0.98 } : undefined}
                  className={`w-full text-left rounded-2xl p-5 border transition-all ${
                    isLocked
                      ? "bg-muted/30 border-border/30 opacity-60 cursor-not-allowed"
                      : isComplete
                      ? "bg-primary/5 border-primary/20"
                      : "bg-white border-border/40 shadow-sm hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                        isComplete ? "bg-primary text-primary-foreground"
                          : isActive ? "bg-[#c8a84b] text-stone-900"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {isComplete ? <CheckCircle2 className="w-5 h-5" /> : config.instanceNumber}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground leading-tight">{config.title}</p>
                        {config.heartbeat && (
                          <p className="text-xs text-muted-foreground mt-0.5">{config.heartbeat}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${
                        isComplete ? "text-primary" : isActive ? "text-[#8a6f1f]" : "text-muted-foreground"
                      }`}>
                        {STATUS_LABEL[status]}
                      </span>
                      {isLocked && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                      {!isLocked && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Instance view ──────────────────────────────────────────────────────────
  if (!currentConfig) return null;

  const isCourage = currentConfig.type === "courage";
  const isPractice = currentConfig.type === "practice";
  const isIntegration = currentConfig.type === "integration";

  const allAnswered = currentConfig.questions.slice(0, 3).every(
    (q) => (responses[q] ?? "").trim().length > 1
  );

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-lg mx-auto px-5 py-8 pb-24 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => { setView("overview"); setCurrentInstanceNum(null); }} className="p-2 rounded-xl hover:bg-muted/50">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">7-Day Rebuild</p>
            <h1 className="font-serif text-lg font-bold text-foreground leading-tight">{currentConfig.title}</h1>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={phase + (isPractice ? `-ch${chapterIndex}` : "") + (isIntegration ? `-st${day7StageIndex}` : "")}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="space-y-5"
          >

            {/* ── Welcome back ── */}
            {phase === "welcome-back" && (
              <div className="space-y-5">
                <JaeBubble text={`Welcome back — good to see you. You're picking up right where you left off, with ${currentConfig.title}. Life happens, and that's exactly what this is built for. No catching up to do, no penalty for the gap. Let's keep going.`} />
                <Button className="w-full rounded-xl h-12" onClick={() => setPhase("video")}>
                  Continue <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}

            {/* ── Video phase ── */}
            {phase === "video" && (
              <div className="space-y-5">
                <p className="text-sm text-muted-foreground">{currentConfig.subtitle}</p>
                <VideoPlayer
                  url={currentConfig.videoUrl}
                  audioSync={REBUILD_AUDIO_SYNC[currentConfig.instanceNumber]}
                  onReady={() => setPhase(isPractice ? "day6-character" : isIntegration ? "day7-stages" : "jai")}
                />
                <Button
                  className="w-full rounded-xl h-12"
                  onClick={() => setPhase(isPractice ? "day6-character" : isIntegration ? "day7-stages" : "jai")}
                >
                  {isPractice ? "Choose Jordan's look →" : isIntegration ? "Start building your plan →" : "I'm ready — talk to Jai"}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}

            {/* ── Day 6: character choice ── */}
            {phase === "day6-character" && (
              <div className="space-y-5">
                <JaeBubble text="One thing's different this time: you get to choose. How would you like to picture Jordan for Season 2?" />
                <div className="grid grid-cols-3 gap-3">
                  {(["male", "female", "neutral"] as CharacterTrack[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setCharacterTrack(t)}
                      className={`rounded-xl py-3 text-sm font-medium border transition-all capitalize ${
                        characterTrack === t
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-white border-border hover:border-primary/40"
                      }`}
                    >
                      {t === "neutral" ? "Neutral (they/them)" : t === "male" ? "He / Him" : "She / Her"}
                    </button>
                  ))}
                </div>
                <Button
                  className="w-full rounded-xl h-12"
                  onClick={() => {
                    setMemoryData((m) => ({ ...m, characterTrack }));
                    setPhase("day6-chapters");
                  }}
                >
                  Start Jordan's story <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}

            {/* ── Day 6: chapters ── */}
            {phase === "day6-chapters" && (() => {
              const chapter = JORDAN_CHAPTERS[chapterIndex];
              const prevReply = chapterJaeReplies[chapterIndex - 1];
              return (
                <div className="space-y-5">
                  <div className="bg-[#1a3a2a]/5 rounded-xl p-4 border border-[#1a3a2a]/10">
                    <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
                      Chapter {chapter.number} of {JORDAN_CHAPTERS.length}
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">
                      {jordanText(chapter.story, characterTrack)}
                    </p>
                  </div>

                  {prevReply && (
                    <JaeBubble text={prevReply.jae?.reflection ?? ""} />
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{chapter.prompt}</label>
                    <Textarea
                      placeholder="Which Heartbeat do you see here?"
                      value={responses[`chapter-${chapterIndex}`] ?? ""}
                      onChange={(e) => setResponses((r) => ({ ...r, [`chapter-${chapterIndex}`]: e.target.value }))}
                      className="resize-none rounded-xl min-h-[80px]"
                    />
                  </div>

                  {error && <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}

                  <Button
                    className="w-full rounded-xl h-12"
                    disabled={!(responses[`chapter-${chapterIndex}`] ?? "").trim() || saving}
                    onClick={handleChapterSubmit}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {chapterIndex < JORDAN_CHAPTERS.length - 1 ? "Next chapter" : "Bridge question"}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              );
            })()}

            {/* ── Jai conversation (instances 1–5 + Day 6 bridge) ── */}
            {phase === "jai" && (
              <div className="space-y-5">
                {!jaeReply ? (
                  <>
                    {/* Day 6 bridge question */}
                    {isPractice ? (
                      <div className="space-y-4">
                        <JaeBubble text="You've followed Jordan through all four chapters. Now one question — this one's about you." />
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">
                            {currentConfig.questions[4]}
                          </label>
                          <Textarea
                            placeholder="Be honest..."
                            value={responses[currentConfig.questions[4]] ?? ""}
                            onChange={(e) => setResponses((r) => ({ ...r, [currentConfig.questions[4]]: e.target.value }))}
                            className="resize-none rounded-xl min-h-[90px]"
                          />
                        </div>
                        {error && <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}
                        <Button
                          className="w-full rounded-xl h-12"
                          disabled={!(responses[currentConfig.questions[4]] ?? "").trim() || saving}
                          onClick={handleDay6BridgeSubmit}
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Save & Hear from Jai <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    ) : (
                      // Instances 1–5: all 3 questions at once
                      <div className="space-y-5">
                        {currentConfig.questions.map((q, i) => (
                          <div key={i} className="space-y-2">
                            <label className="text-sm font-medium text-foreground leading-snug">{q}</label>
                            <Textarea
                              placeholder="Take your time..."
                              value={responses[q] ?? ""}
                              onChange={(e) => setResponses((r) => ({ ...r, [q]: e.target.value }))}
                              className="resize-none rounded-xl min-h-[85px]"
                            />
                          </div>
                        ))}
                        {error && <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}
                        <Button
                          className="w-full rounded-xl h-12"
                          disabled={!allAnswered || saving}
                          onClick={handleReflect}
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Save & Hear from Jai <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  // Jai has responded
                  <div className="space-y-5">
                    <JaeBubble text={jaeReply.reflection ?? ""} />
                    {jaeReply.followUpQuestion && (
                      <p className="text-sm font-medium text-primary px-1">{jaeReply.followUpQuestion}</p>
                    )}
                    {/* Day 5 breadcrumb nudge */}
                    {isCourage && jaeReply.breadcrumb && (
                      <div className="bg-[#1a3a2a]/5 rounded-xl p-4 border border-[#1a3a2a]/10">
                        <p className="text-sm text-foreground/80 italic leading-relaxed">{jaeReply.breadcrumb}</p>
                      </div>
                    )}
                    {error && <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}
                    <Button
                      className="w-full rounded-xl h-12"
                      disabled={saving}
                      onClick={() => handleComplete()}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {currentInstanceNum === 6 ? "Day 6 Complete" : `Day ${currentInstanceNum} Complete`}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ── Day 7: stages ── */}
            {phase === "day7-stages" && (() => {
              if (day7StageIndex >= DAY7_STAGES.length) {
                return (
                  <div className="space-y-5 text-center py-6">
                    <CheckCircle2 className="w-14 h-14 text-primary mx-auto" />
                    <h2 className="font-serif text-xl font-bold">Your plan is built.</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">Every stage complete. You have something concrete to carry forward.</p>
                    <Button className="w-full rounded-xl h-12" disabled={saving} onClick={() => handleComplete()}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Finish the Rebuild <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                );
              }

              const stage = DAY7_STAGES[day7StageIndex];
              const questionText = injectMemory(stage.question, { ...priorMemory, ...day7Memory });

              return (
                <div className="space-y-5">
                  {/* Stage progress */}
                  <div className="flex gap-1.5">
                    {DAY7_STAGES.map((s) => (
                      <div key={s.stageNumber} className={`h-1.5 flex-1 rounded-full ${
                        day7StagesCompleted[s.stageNumber] ? "bg-primary" : s.stageNumber === stage.stageNumber ? "bg-primary/40" : "bg-muted"
                      }`} />
                    ))}
                  </div>

                  <div>
                    <p className="text-xs font-bold text-primary uppercase tracking-wider">{stage.title}</p>
                    <p className="text-xs text-muted-foreground">{stage.heartbeat}</p>
                  </div>

                  {!jaeReply ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground leading-snug">{questionText}</label>
                        <Textarea
                          placeholder="Take your time..."
                          value={responses[`stage-${stage.stageNumber}`] ?? ""}
                          onChange={(e) => setResponses((r) => ({ ...r, [`stage-${stage.stageNumber}`]: e.target.value }))}
                          className="resize-none rounded-xl min-h-[100px]"
                        />
                      </div>
                      {error && <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}
                      <Button
                        className="w-full rounded-xl h-12"
                        disabled={!(responses[`stage-${stage.stageNumber}`] ?? "").trim() || saving}
                        onClick={handleDay7StageSubmit}
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Save & Hear from Jai <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-5">
                      <JaeBubble text={jaeReply.stageSynthesis ?? jaeReply.reflection ?? ""} />
                      {error && <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}
                      <Button
                        className="w-full rounded-xl h-12"
                        disabled={saving}
                        onClick={handleDay7StageAdvance}
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {day7StageIndex < DAY7_STAGES.length - 1 ? "Next stage" : "Finish Rebuild"}
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Instance complete ── */}
            {phase === "complete" && (
              <div className="space-y-5 text-center py-6">
                <CheckCircle2 className="w-14 h-14 text-primary mx-auto" />
                <div className="space-y-2">
                  <h2 className="font-serif text-xl font-bold text-foreground">{currentConfig.title} — done.</h2>
                  <p className="text-sm text-muted-foreground">{currentConfig.subtitle}</p>
                </div>
                {currentInstanceNum! < REBUILD_INSTANCES.length && (
                  <p className="text-xs text-muted-foreground">
                    Day {currentInstanceNum! + 1} is now unlocked.
                  </p>
                )}
                <Button className="w-full rounded-xl h-12" onClick={() => { setView("overview"); setCurrentInstanceNum(null); }}>
                  Back to overview <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
