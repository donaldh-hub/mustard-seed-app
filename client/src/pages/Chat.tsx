import { useState, useRef, useEffect, useCallback, Fragment } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Send, Plus, Camera, Image, X, Droplets, Loader2, RotateCcw, Ban, Sprout, PenLine, CheckCircle2, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import { useUpload, type UploadPhase } from "@/hooks/use-upload";
import { persistImage, restoreImage, clearImage } from "@/lib/imageStore";
import JaeAvatar from "@assets/file_000000006e04620e9931a4040836810b_1771384491714.png";

function MiniWaterCup({ fillPercent, animating }: { fillPercent: number; animating: boolean }) {
  const clamped = Math.max(0, Math.min(fillPercent, 100));
  return (
    <div className="relative w-7 h-9" data-testid="mini-water-cup">
      <div className="absolute inset-0 rounded-b-lg rounded-t-sm border-2 border-blue-300/60 bg-blue-50/30 overflow-hidden">
        <motion.div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500 to-blue-400 rounded-b-md"
          animate={{ height: `${clamped}%` }}
          transition={{ duration: animating ? 0.6 : 0.3, ease: "easeOut" }}
          data-testid="mini-water-fill"
        />
        {animating && (
          <motion.div
            className="absolute inset-0 bg-blue-300/30"
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
          />
        )}
      </div>
      <Droplets className="absolute -bottom-0.5 -right-0.5 w-3 h-3 text-blue-500" />
    </div>
  );
}

const QUICK_GOALS = [
  { label: "Write a Book", command: "save: my goal is to write a book" },
  { label: "Lose Weight", command: "save: my goal is to lose weight" },
  { label: "Build a Business", command: "save: my goal is to build a business" },
  { label: "Get in Shape", command: "save: my goal is to get in shape" },
  { label: "Improve Discipline", command: "save: my goal is to improve my discipline" },
];

const WELCOME_TEXT = `Welcome. I'm glad you're here.

I'm Jae — your accountability partner. My job is to help you turn small actions into real growth.

Around here we plant goals like seeds. Every action you take adds water and helps that seed grow.

To plant your first goal, type:

save: my goal is ...

Example:
save: my goal is to write a book

Or choose one below to get started.

What seed are we planting today?`;

const CREATE_OWN_TEXT = `Great. Your goal does NOT have to be one of the quick-start options.

Type your goal like this:

save: my goal is ...

Example:
save: my goal is to learn Spanish`;

const stageEmoji: Record<string, string> = { seed: "🌱", sprout: "🌿", growth: "🌳", bloom: "🌸" };

const PHASE_LABELS: Record<UploadPhase, string> = {
  IDLE: "",
  PREPARING: "Preparing image...",
  PRESIGNING: "Connecting...",
  UPLOADING_DIRECT: "Uploading...",
  UPLOADING_PROXY: "Uploading...",
  CONFIRMED_STORED: "Photo stored. Analyzing...",
  ANALYZING: "Jae is reviewing your photo...",
  MEMORY_SAVING: "Saving to journal...",
  COMPLETE_SUCCESS: "Done!",
  FAILED: "",
  CANCELED: "",
};

// ---------------------------------------------------------------------------
// Detects past-tense action language in IO/RW messages to trigger nudge card.
// Only fires for texts that TITAN may have under-classified as IO/RW despite
// containing clear completed-action signals.
// ---------------------------------------------------------------------------
function looksLikeCompletedAction(text: string): boolean {
  return /\b(wrote|finished|completed|submitted|published|ran|walked|worked out|worked on|studied|practiced|built|created|made|did|sent|called|started|launched|shipped|fixed|recorded|posted|exercised|meditated|reviewed|organized|cleaned|cooked|prepared|trained|applied|scheduled|attended|joined|went to|showed up|hit the gym|got done|done with|got through|woke up|signed up|paid|reached out|showed up)\b/i.test(text);
}

// Inline Reward Card — shown after a VA/AR message earns AP + optional water
type ProgressFeedback = {
  completedUnits: number;
  targetUnits: number;
  percentComplete: number;
  feedbackText: string;
  momentumBoostActive?: boolean;
};

function RewardCard({
  ap, waterAwarded, progressFeedback, onDismiss,
}: { ap: number; waterAwarded: boolean; progressFeedback?: ProgressFeedback | null; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25 }}
      className="ml-12 mt-1 mb-2 space-y-1"
      data-testid="card-reward"
    >
      <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 shadow-sm">
        <Zap className="w-3.5 h-3.5 text-green-600 shrink-0" />
        <span className="text-xs font-semibold text-green-800">
          +{ap} AP earned{waterAwarded ? " · 💧 Water added" : ""}
        </span>
        <button
          onClick={onDismiss}
          className="ml-1 flex items-center gap-1 text-[11px] text-green-700 hover:text-green-900 font-medium transition-colors"
          data-testid="button-reward-dismiss"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Got it
        </button>
      </div>
      {progressFeedback && (
        <motion.div
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.2 }}
          className="flex flex-col gap-1"
          data-testid="card-progress-feedback"
        >
          <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 shadow-sm max-w-xs">
            <Sprout className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-900 leading-snug">{progressFeedback.feedbackText}</p>
          </div>
          {progressFeedback.momentumBoostActive && (
            <div
              className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 shadow-sm max-w-xs"
              data-testid="badge-momentum-boost"
            >
              <Zap className="w-3 h-3 text-amber-500 shrink-0" />
              <span className="text-[11px] font-medium text-amber-800">
                Momentum boost active — early progress grows faster.
              </span>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

// Inline Nudge Card — shown after IO/RW messages that look like completed actions
function NudgeCard({
  onConfirm, onSkip, isLoading,
}: { onConfirm: () => void; onSkip: () => void; isLoading: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25 }}
      className="ml-12 mt-1 mb-2"
      data-testid="card-nudge"
    >
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 shadow-sm">
        <p className="text-[11px] text-amber-800 mb-2 font-medium flex items-center gap-1.5">
          <Droplets className="w-3 h-3 text-blue-500 shrink-0" />
          Want to log this progress and earn water?
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-full font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            data-testid="button-nudge-confirm"
          >
            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            Log Progress
          </button>
          <button
            onClick={onSkip}
            disabled={isLoading}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            data-testid="button-nudge-skip"
          >
            Skip
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Chat() {
  const userId = useStore((s) => s.userId);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [input, setInput] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [showCreateOwn, setShowCreateOwn] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{ file: File; url: string } | null>(null);
  const [waterAnimating, setWaterAnimating] = useState(false);
  const [localFillPercent, setLocalFillPercent] = useState<number | null>(null);
  const [inlineCards, setInlineCards] = useState<Record<string,
    | { type: "reward"; ap: number; waterAwarded: boolean; progressFeedback?: ProgressFeedback | null }
    | { type: "nudge"; text: string }
    | { type: "dismissed" }
  >>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoActiveRef = useRef(false);
  const restoredRef = useRef(false);
  const qc = useQueryClient();

  const {
    uploadFile, setAnalyzing, setMemorySaving, setCompleteSuccess, fail,
    phase, isBusy, error: uploadError, compressInfo,
    cancel: cancelUpload, reset: resetUpload, attemptId
  } = useUpload();

  useEffect(() => {
    photoActiveRef.current = !!photoPreview || isBusy;
  }, [photoPreview, isBusy]);

  useEffect(() => {
    if (!photoActiveRef.current) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [photoPreview, isBusy]);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    restoreImage().then((restored) => {
      if (restored && !photoPreview) {
        console.log("[chat] Restored persisted image after re-mount");
        setPhotoPreview(restored);
      }
    });
  }, []);

  useEffect(() => {
    if (!userId) setLocation("/");
  }, [userId]);

  const { data: assessment, isLoading: assessmentLoading } = useQuery({
    queryKey: ["assessment", userId],
    queryFn: () => api.getAssessment(userId!),
    enabled: !!userId,
  });

  const { data: garden } = useQuery({
    queryKey: ["garden", userId],
    queryFn: () => api.getGardenSummary(userId!),
    enabled: !!userId,
  });

  const hasNoGoal = !garden?.targeted && !garden?.untargeted;
  const activeGoal = garden?.targeted || garden?.untargeted;
  const gardenFillPercent = activeGoal?.fillPercent ?? 0;
  const displayFillPercent = localFillPercent !== null ? localFillPercent : gardenFillPercent;

  useEffect(() => {
    if (!waterAnimating) setLocalFillPercent(null);
  }, [gardenFillPercent]);

  useEffect(() => {
    if (photoActiveRef.current) return;
    if (!assessmentLoading && !assessment && userId) {
      setLocation("/assessment");
    }
  }, [assessment, assessmentLoading, userId]);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", userId],
    queryFn: () => api.getMessages(userId!),
    enabled: !!userId,
  });

  const sendMutation = useMutation({
    mutationFn: (text: string) => api.sendMessage(userId!, text),
    onSuccess: (data, sentText) => {
      qc.invalidateQueries({ queryKey: ["messages", userId] });
      qc.invalidateQueries({ queryKey: ["user", userId] });
      qc.invalidateQueries({ queryKey: ["entries", userId] });
      qc.invalidateQueries({ queryKey: ["garden", userId] });
      qc.invalidateQueries({ queryKey: ["consistency", userId] });

      const category = data?.titan?.category;
      const jaeId = data?.jaeMessage?.id;

      if (data?.water?.awarded) {
        const w = data.water;
        if (w.cupJustFilled) {
          setLocalFillPercent(w.preResetFillPercent);
          setWaterAnimating(true);
          setTimeout(() => {
            setLocalFillPercent(0);
            setTimeout(() => {
              setLocalFillPercent(w.fillPercent);
              setTimeout(() => setWaterAnimating(false), 800);
            }, 400);
          }, 1200);
        } else {
          setLocalFillPercent(w.fillPercent);
          setWaterAnimating(true);
          setTimeout(() => setWaterAnimating(false), 1500);
        }
      }

      // Set inline confirmation / nudge card for this Jae message
      if (jaeId) {
        if ((category === "VA" || category === "AR") && data?.water?.rewardTransaction === "success" && data?.water?.awarded) {
          // Reward card: confirms AP + water earned
          setInlineCards(prev => ({
            ...prev,
            [jaeId]: {
              type: "reward",
              ap: data.water!.actionPointsAccumulated,
              waterAwarded: data.water!.awarded,
              progressFeedback: data.water!.progressFeedback ?? null,
            },
          }));
          toast({
            title: "ENTRY REWARD PROCESSED",
            description: `${category} · +${data.water!.actionPointsAccumulated} AP · Water added`,
            duration: 3000,
          });
        } else if ((category === "IO" || category === "RW") && looksLikeCompletedAction(sentText)) {
          // Nudge card: offer to log this as verified progress
          setInlineCards(prev => ({
            ...prev,
            [jaeId]: { type: "nudge", text: sentText },
          }));
        }
      }
    },
  });

  const photoMutation = useMutation({
    mutationFn: async ({ file, caption }: { file: File; caption: string }) => {
      const uploadResult = await uploadFile(file);
      if (!uploadResult) throw new Error("Upload failed");

      const { objectPath, attemptId: uploadAttemptId } = uploadResult;

      setAnalyzing();

      const localDate = new Date().toISOString().split("T")[0];

      try {
        const result = await api.sendPhoto(userId!, {
          photoUrl: objectPath,
          caption: caption || undefined,
          localDate,
          uploadAttemptId,
        });

        setMemorySaving();
        await new Promise((r) => setTimeout(r, 200));

        setCompleteSuccess();
        return result;
      } catch (err: any) {
        fail(err.message || "Analysis failed. Your photo was saved.", "ANALYSIS_FAILED", true);
        throw err;
      }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["messages", userId] });
      qc.invalidateQueries({ queryKey: ["user", userId] });
      qc.invalidateQueries({ queryKey: ["entries", userId] });
      qc.invalidateQueries({ queryKey: ["photo-memories", userId] });
      qc.invalidateQueries({ queryKey: ["garden", userId] });
      qc.invalidateQueries({ queryKey: ["consistency", userId] });
      if (data?.water?.awarded) {
        const w = data.water;
        if (w.cupJustFilled) {
          setLocalFillPercent(w.preResetFillPercent);
          setWaterAnimating(true);
          setTimeout(() => {
            setLocalFillPercent(0);
            setTimeout(() => {
              setLocalFillPercent(w.fillPercent);
              setTimeout(() => setWaterAnimating(false), 800);
            }, 400);
          }, 1200);
        } else {
          setLocalFillPercent(w.fillPercent);
          setWaterAnimating(true);
          setTimeout(() => setWaterAnimating(false), 1500);
        }
      }
      setTimeout(async () => {
        setPhotoPreview(null);
        setInput("");
        resetUpload();
        await clearImage();
      }, 800);
    },
    onError: () => {},
  });

  // Confirm-progress mutation — handles nudge card "Log Progress" button.
  // Calls the confirm-progress endpoint which runs processRewardTransaction as VA.
  // Protected by the same 90s dedup in rewardEngine (double-clicks blocked).
  const confirmMutation = useMutation({
    mutationFn: ({ text, jaeMessageId }: { text: string; jaeMessageId: string }) =>
      api.confirmProgress(userId!, text).then(r => ({ ...r, jaeMessageId })),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["messages", userId] });
      qc.invalidateQueries({ queryKey: ["garden", userId] });
      qc.invalidateQueries({ queryKey: ["entries", userId] });
      qc.invalidateQueries({ queryKey: ["consistency", userId] });
      if (data?.water?.awarded) {
        const w = data.water;
        if (w.cupJustFilled) {
          setLocalFillPercent(w.preResetFillPercent);
          setWaterAnimating(true);
          setTimeout(() => {
            setLocalFillPercent(0);
            setTimeout(() => {
              setLocalFillPercent(w.fillPercent);
              setTimeout(() => setWaterAnimating(false), 800);
            }, 400);
          }, 1200);
        } else {
          setLocalFillPercent(w.fillPercent);
          setWaterAnimating(true);
          setTimeout(() => setWaterAnimating(false), 1500);
        }
      }
      // Replace nudge with reward card (or dismiss if deduped)
      setInlineCards(prev => ({
        ...prev,
        [data.jaeMessageId]: data.awarded
          ? {
              type: "reward",
              ap: data.water?.actionPointsAccumulated || 3,
              waterAwarded: data.water?.awarded || false,
              progressFeedback: data.water?.progressFeedback ?? null,
            }
          : { type: "dismissed" },
      }));
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sendMutation.isPending, photoMutation.isPending]);

  const handleSend = () => {
    if (photoPreview) {
      if (photoMutation.isPending || (phase !== "IDLE" && phase !== "FAILED" && phase !== "CANCELED")) return;
      photoMutation.mutate({ file: photoPreview.file, caption: input.trim() });
      return;
    }
    if (!input.trim() || sendMutation.isPending) return;
    const text = input;
    setInput("");
    sendMutation.mutate(text);
  };

  const handleRetryPhoto = () => {
    if (!photoPreview) return;
    resetUpload();
    photoMutation.reset();
    photoMutation.mutate({ file: photoPreview.file, caption: input.trim() });
  };

  const handleCancelUpload = () => {
    cancelUpload();
    photoMutation.reset();
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.name.match(/\.(jpg|jpeg|png|webp|gif|bmp)$/i)) return;

    resetUpload();
    photoMutation.reset();

    const url = await persistImage(file);

    setPhotoPreview({ file, url });
    setShowAttach(false);

    e.target.value = "";
  }, [resetUpload]);

  const handleClearPreview = useCallback(async () => {
    if (photoPreview) {
      setPhotoPreview(null);
      resetUpload();
      photoMutation.reset();
      await clearImage();
    }
  }, [photoPreview, resetUpload]);

  if (!userId) return null;

  const isPhotoProcessing = isBusy || photoMutation.isPending;
  const isTextSending = sendMutation.isPending;
  const photoFailed = (phase === "FAILED" || photoMutation.isError) && !isBusy;
  const photoErrorMsg = uploadError?.message || photoMutation.error?.message || "Upload failed. Try again.";
  const canRetry = uploadError?.retryable !== false;

  const activeStatusLabel = isBusy ? PHASE_LABELS[phase] : (photoMutation.isPending && phase === "IDLE" ? "Starting..." : "");

  return (
    <div className="h-full flex flex-col bg-background relative">
      <header className="p-4 border-b border-border/40 bg-white/50 backdrop-blur-sm sticky top-0 z-10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-secondary/30 flex items-center justify-center border border-white shadow-sm overflow-hidden">
          <img src={JaeAvatar} alt="Jae" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1">
          <h1 className="font-serif font-semibold text-lg" data-testid="text-jae-name">Jae M. Seed</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1" data-testid="text-current-stage">
            {assessment ? (
              <>
                Current Stage: {assessment.stage.charAt(0).toUpperCase() + assessment.stage.slice(1)} {stageEmoji[assessment.stage] || ""}
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Online
              </>
            )}
          </p>
        </div>
        {activeGoal && (
          <div className="flex flex-col items-center gap-0.5">
            <MiniWaterCup fillPercent={displayFillPercent} animating={waterAnimating} />
            <span className="text-[8px] text-muted-foreground font-medium">{activeGoal.cupsFilled ?? 0} cups</span>
          </div>
        )}
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 pb-32"
      >
        {isLoading && (
          <div className="text-center text-muted-foreground text-sm py-8">Loading messages...</div>
        )}

        {!isLoading && messages.length === 0 && hasNoGoal && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
            data-testid="welcome-onboarding"
          >
            <div className="flex items-end gap-2 justify-start">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-white shadow-sm shrink-0 mb-1">
                <img src={JaeAvatar} alt="Jae" className="w-full h-full object-cover" />
              </div>
              <div className="max-w-[80%] px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed bg-white text-foreground rounded-bl-sm border border-border/50 whitespace-pre-wrap" data-testid="text-welcome-message">
                {WELCOME_TEXT}
              </div>
            </div>

            <div className="ml-12 space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide px-1">Quick Start Examples</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_GOALS.map((g) => (
                  <button
                    key={g.label}
                    onClick={() => { setInput(""); sendMutation.mutate(g.command); }}
                    disabled={sendMutation.isPending}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-white rounded-full border border-primary/30 shadow-sm text-sm font-medium text-primary hover:bg-primary/5 hover:border-primary/50 transition-colors disabled:opacity-50"
                    data-testid={`button-quickgoal-${g.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Sprout className="w-3.5 h-3.5" />
                    {g.label}
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-border/30 mt-3">
                <button
                  onClick={() => {
                    setShowCreateOwn(true);
                    const inputEl = document.querySelector<HTMLInputElement>('[data-testid="input-chat"]');
                    if (inputEl) { inputEl.focus(); setInput("save: my goal is "); }
                  }}
                  disabled={sendMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-full border border-primary/20 shadow-sm text-sm font-semibold text-foreground hover:from-primary/15 hover:to-secondary/15 transition-colors disabled:opacity-50"
                  data-testid="button-create-own-goal"
                >
                  <PenLine className="w-4 h-4 text-primary" />
                  Create My Own Goal
                </button>
              </div>
            </div>

            {showCreateOwn && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-end gap-2 justify-start"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden border border-white shadow-sm shrink-0 mb-1">
                  <img src={JaeAvatar} alt="Jae" className="w-full h-full object-cover" />
                </div>
                <div className="max-w-[80%] px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed bg-white text-foreground rounded-bl-sm border border-border/50 whitespace-pre-wrap" data-testid="text-create-own-message">
                  {CREATE_OWN_TEXT}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {!isLoading && messages.length === 0 && !hasNoGoal && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-end gap-2 justify-start"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden border border-white shadow-sm shrink-0 mb-1">
              <img src={JaeAvatar} alt="Jae" className="w-full h-full object-cover" />
            </div>
            <div className="max-w-[80%] px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed bg-white text-foreground rounded-bl-sm border border-border/50">
              Ready when you are. What's on your mind?
            </div>
          </motion.div>
        )}

        {messages.map((msg: any) => {
          const card = inlineCards[msg.id];
          const confirmingThisCard = confirmMutation.isPending &&
            (confirmMutation.variables as any)?.jaeMessageId === msg.id;
          return (
            <Fragment key={msg.id}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-end gap-2 mb-1 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.sender === "jae" && (
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-white shadow-sm shrink-0 mb-1">
                    <img src={JaeAvatar} alt="Jae" className="w-full h-full object-cover" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-2xl shadow-sm text-sm leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-white text-foreground rounded-bl-sm border border-border/50"
                  }`}
                >
                  {msg.messageType === "photo" && msg.photoUrl && (
                    <div className="relative">
                      <img
                        src={msg.photoUrl}
                        alt="Photo"
                        className="w-full rounded-t-2xl object-cover max-h-48"
                        data-testid={`img-photo-${msg.id}`}
                      />
                      {msg.status === "pending_analysis" && (
                        <div className="absolute inset-0 bg-black/30 rounded-t-2xl flex items-center justify-center">
                          <div className="flex items-center gap-2 text-white text-xs bg-black/50 px-3 py-1.5 rounded-full">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Reviewing...
                          </div>
                        </div>
                      )}
                      {msg.status === "analyzed" && msg.analysisJson && (msg.analysisJson as any).water_award > 0 && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 bg-blue-500/90 text-white text-xs px-2 py-1 rounded-full" data-testid={`badge-water-${msg.id}`}>
                          <Droplets className="w-3 h-3" />
                          +{(msg.analysisJson as any).water_award}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="px-4 py-3 whitespace-pre-wrap">
                    {msg.text}
                  </div>
                </div>

                {msg.sender === "user" && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-white shadow-sm shrink-0 mb-1">
                    <div className="w-4 h-4 bg-primary rounded-full opacity-50" />
                  </div>
                )}
              </motion.div>

              {/* Inline reward / nudge cards after each Jae message */}
              {msg.sender === "jae" && card && card.type !== "dismissed" && (
                <AnimatePresence>
                  {card.type === "reward" && (
                    <RewardCard
                      key={`reward-${msg.id}`}
                      ap={card.ap}
                      waterAwarded={card.waterAwarded}
                      progressFeedback={card.progressFeedback}
                      onDismiss={() =>
                        setInlineCards(prev => ({ ...prev, [msg.id]: { type: "dismissed" } }))
                      }
                    />
                  )}
                  {card.type === "nudge" && (
                    <NudgeCard
                      key={`nudge-${msg.id}`}
                      isLoading={confirmingThisCard}
                      onConfirm={() =>
                        confirmMutation.mutate({ text: card.text, jaeMessageId: msg.id })
                      }
                      onSkip={() =>
                        setInlineCards(prev => ({ ...prev, [msg.id]: { type: "dismissed" } }))
                      }
                    />
                  )}
                </AnimatePresence>
              )}
            </Fragment>
          );
        })}

        {isTextSending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-muted-foreground text-xs ml-14"
          >
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" />
            </div>
            Jae is thinking...
          </motion.div>
        )}
      </div>

      <div className="absolute bottom-[4.5rem] w-full p-4 flex flex-col gap-3 bg-gradient-to-t from-white via-white/90 to-transparent pt-8">
        <AnimatePresence>
          {photoPreview && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-start gap-3"
            >
              <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-primary shadow-md shrink-0">
                <img src={photoPreview.url} alt="Preview" className="w-full h-full object-cover" />
                {isPhotoProcessing && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                )}
                {!isPhotoProcessing && !photoFailed && phase !== "CANCELED" && (
                  <button
                    onClick={handleClearPreview}
                    className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"
                    data-testid="button-clear-preview"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-1 min-w-0">
                {isPhotoProcessing && activeStatusLabel && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{activeStatusLabel}</span>
                    {compressInfo && phase === "PREPARING" && (
                      <span className="text-[10px] text-muted-foreground/60">
                        {(compressInfo.compressedSize / 1024).toFixed(0)}KB
                      </span>
                    )}
                    <button
                      onClick={handleCancelUpload}
                      className="text-xs text-red-500 flex items-center gap-1 hover:underline"
                      data-testid="button-cancel-upload"
                    >
                      <Ban className="w-3 h-3" />
                      Cancel
                    </button>
                  </div>
                )}

                {(photoFailed || phase === "CANCELED") && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-red-600 font-medium" data-testid="text-upload-error">
                      {phase === "CANCELED" ? "Upload cancelled." : photoErrorMsg}
                    </span>
                    {uploadError?.code && phase !== "CANCELED" && (
                      <span className="text-[10px] text-red-400 font-mono" data-testid="text-error-code">[{uploadError.code}]</span>
                    )}
                    {uploadError?.details && phase !== "CANCELED" && (
                      <details className="text-[10px] text-muted-foreground">
                        <summary className="cursor-pointer hover:text-foreground">Details</summary>
                        <pre className="mt-1 whitespace-pre-wrap break-all bg-muted/50 p-1.5 rounded text-[9px] max-h-20 overflow-y-auto">{uploadError.details}</pre>
                      </details>
                    )}
                    <div className="flex gap-2">
                      {(canRetry || phase === "CANCELED") && (
                        <button
                          onClick={handleRetryPhoto}
                          className="text-xs text-primary flex items-center gap-1 hover:underline"
                          data-testid="button-retry-upload"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Retry
                        </button>
                      )}
                      <button
                        onClick={handleClearPreview}
                        className="text-xs text-muted-foreground hover:underline"
                        data-testid="button-dismiss-upload"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showAttach && !isPhotoProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex gap-2 mb-1"
            >
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-border shadow-sm text-sm hover:bg-muted transition-colors"
                data-testid="button-take-photo"
              >
                <Camera className="w-4 h-4 text-primary" />
                Take Photo
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-border shadow-sm text-sm hover:bg-muted transition-colors"
                data-testid="button-choose-gallery"
              >
                <Image className="w-4 h-4 text-primary" />
                Gallery
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2 items-center"
        >
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="rounded-full h-12 w-12 shrink-0 border border-border shadow-sm bg-white hover:bg-muted"
            onClick={() => setShowAttach(!showAttach)}
            disabled={isPhotoProcessing}
            data-testid="button-attach"
          >
            <Plus className={`w-5 h-5 transition-transform ${showAttach ? 'rotate-45' : ''}`} />
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={photoPreview ? "Add a caption (optional)..." : "Type a message..."}
            className="rounded-full bg-white border border-border shadow-lg h-12 px-6 focus-visible:ring-1 focus-visible:ring-primary"
            disabled={isPhotoProcessing}
            data-testid="input-chat"
          />
          <Button
            type="submit"
            size="icon"
            className="rounded-full h-12 w-12 shrink-0 bg-primary hover:bg-primary/90 shadow-md"
            disabled={(!input.trim() && !photoPreview) || isPhotoProcessing || isTextSending}
            data-testid="button-send"
          >
            {isPhotoProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </form>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
          data-testid="input-file-gallery"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
          data-testid="input-file-camera"
        />
      </div>
    </div>
  );
}
