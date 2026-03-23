import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ────────────────────────────────────────────────────────────────────

export type GoalCompletionCeremonyPayload = {
  goalId: string;
  goalTitle: string;
  completedUnits: number;
  targetUnits: number;
  daysUsed: number;
  streakAtCompletion: number;
  completionGrowth: {
    prevSeedStage: number;
    newSeedStage: number;
    waterAdded: number;
    cupJustFilled: boolean;
    stageAdvanced: boolean;
  } | null;
};

type CeremonyMode = "BASIC" | "CUP" | "STAGE";

// ── Stage visuals ─────────────────────────────────────────────────────────────

const STAGE_ICON: Record<number, string> = {
  0: "🌰",
  1: "🌱",
  2: "🌿",
  3: "🌳",
  4: "🌸",
  5: "🌺",
};

// ── Mode helpers ──────────────────────────────────────────────────────────────

function detectMode(payload: GoalCompletionCeremonyPayload): CeremonyMode {
  if (payload.completionGrowth?.stageAdvanced) return "STAGE";
  if (payload.completionGrowth?.cupJustFilled) return "CUP";
  return "BASIC";
}

function getHeadline(mode: CeremonyMode): string {
  if (mode === "STAGE") return "YOU KEPT THE PROMISE.";
  if (mode === "CUP") return "PROGRESS LOCKED IN.";
  return "GOAL COMPLETE.";
}

function getReinforcementLine(mode: CeremonyMode): string {
  if (mode === "STAGE") return "Consistency just changed your story.";
  if (mode === "CUP") return "This is what follow-through looks like.";
  return "Small promises become real progress.";
}

// ── SeedGlowVisual ───────────────────────────────────────────────────────────

function SeedGlowVisual({
  mode,
  prevStage,
  newStage,
}: {
  mode: CeremonyMode;
  prevStage: number;
  newStage: number;
}) {
  const [showNew, setShowNew] = useState(false);
  const [showBurst, setShowBurst] = useState(false);

  useEffect(() => {
    if (mode === "STAGE") {
      const t1 = setTimeout(() => {
        setShowNew(true);
        setShowBurst(true);
      }, 700);
      const t2 = setTimeout(() => setShowBurst(false), 1200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [mode]);

  const displayIcon = mode === "STAGE" && showNew
    ? (STAGE_ICON[newStage] ?? "🌱")
    : (STAGE_ICON[prevStage] ?? "🌰");

  const glowColor =
    mode === "STAGE" ? "rgba(34, 197, 94, 0.35)"
    : mode === "CUP" ? "rgba(59, 130, 246, 0.30)"
    : "rgba(34, 197, 94, 0.22)";

  return (
    <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
      {/* Ambient glow ring */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 110,
          height: 110,
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
        }}
        animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Cup fill visual — CUP mode only */}
      {mode === "CUP" && (
        <motion.div
          className="absolute bottom-1 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          style={{ transformOrigin: "bottom" }}
        >
          <div className="w-9 h-11 border-2 border-blue-300/70 rounded-b-xl bg-blue-50/40 overflow-hidden relative">
            <motion.div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500/90 to-blue-400/70"
              initial={{ height: "0%" }}
              animate={{ height: "100%" }}
              transition={{ duration: 0.9, delay: 0.6, ease: "easeOut" }}
            />
          </div>
        </motion.div>
      )}

      {/* Main plant icon */}
      <AnimatePresence mode="wait">
        <motion.span
          key={displayIcon}
          className="select-none z-10 leading-none"
          style={{ fontSize: 56 }}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0, filter: "blur(4px)" }}
          transition={{ duration: 0.35, ease: "backOut" }}
        >
          {displayIcon}
        </motion.span>
      </AnimatePresence>

      {/* Stage advance radial burst */}
      {showBurst && (
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          initial={{ scale: 1, opacity: 0.7 }}
          animate={{ scale: 2.6, opacity: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          style={{ background: "radial-gradient(circle, rgba(34,197,94,0.55) 0%, transparent 65%)" }}
        />
      )}

      {/* Scale-in wrapper for whole visual */}
      <motion.div
        className="absolute inset-0 rounded-full"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "backOut", delay: 0.15 }}
      />
    </div>
  );
}

// ── Reward Line ───────────────────────────────────────────────────────────────

function RewardLine({ text, icon, delay }: { text: string; icon: string; delay: number }) {
  return (
    <motion.div
      className="flex items-center gap-2.5"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3, ease: "easeOut" }}
    >
      <span className="text-base leading-none">{icon}</span>
      <span className="text-sm font-semibold text-foreground/85 leading-none">{text}</span>
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type Props = {
  payload: GoalCompletionCeremonyPayload | null;
  onDismiss: () => void;
};

export function GoalCompletionCeremony({ payload, onDismiss }: Props) {
  const [canDismiss, setCanDismiss] = useState(false);
  const dismissingRef = useRef(false);

  useEffect(() => {
    if (!payload) {
      setCanDismiss(false);
      return;
    }
    dismissingRef.current = false;
    setCanDismiss(false);

    const mode = detectMode(payload);
    console.log(`[CEREMONY] payload_received | mode=${mode} | goal="${payload.goalTitle}"`);
    console.log(`[CEREMONY] mode_selected = ${mode}`);
    console.log(`[CEREMONY] animation_start`);

    const tDismiss = setTimeout(() => setCanDismiss(true), 2200);
    const tComplete = setTimeout(() => {
      console.log(`[CEREMONY] animation_complete`);
    }, 1600);

    return () => {
      clearTimeout(tDismiss);
      clearTimeout(tComplete);
    };
  }, [payload?.goalId]);

  const handleDismiss = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    console.log("[CEREMONY] dismissed");
    onDismiss();
  }, [onDismiss]);

  if (!payload) return null;

  const mode = detectMode(payload);
  const headline = getHeadline(mode);
  const reinforcement = getReinforcementLine(mode);
  const growth = payload.completionGrowth;

  const prevStage = growth?.prevSeedStage ?? 0;
  const newStage = growth?.newSeedStage ?? prevStage;

  const rewardLines: { text: string; icon: string; show: boolean }[] = [
    {
      text: `+${growth?.waterAdded ?? 0} Water`,
      icon: "💧",
      show: (growth?.waterAdded ?? 0) > 0,
    },
    {
      text: "Cup Filled",
      icon: "🏆",
      show: growth?.cupJustFilled === true,
    },
    {
      text: "Stage Advanced",
      icon: "🌱",
      show: growth?.stageAdvanced === true,
    },
    {
      text: `${payload.streakAtCompletion}-Day Streak Strengthened`,
      icon: "🔥",
      show: payload.streakAtCompletion > 1,
    },
  ].filter(r => r.show);

  const rewardStartDelay = 0.95;
  const rewardItemSpacing = 0.14;
  const postRewardDelay = rewardStartDelay + rewardLines.length * rewardItemSpacing;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      data-testid="ceremony-overlay"
      onClick={canDismiss ? handleDismiss : undefined}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
      />

      {/* Card */}
      <motion.div
        className="relative z-10 mx-5 max-w-[340px] w-full bg-white rounded-[28px] shadow-2xl overflow-hidden"
        initial={{ scale: 0.82, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 12 }}
        transition={{ duration: 0.42, ease: [0.34, 1.56, 0.64, 1], delay: 0.08 }}
        onClick={e => e.stopPropagation()}
        data-testid="ceremony-card"
      >
        {/* Accent bar */}
        <div className="h-[3px] w-full bg-gradient-to-r from-primary/50 via-primary to-emerald-400/80" />

        <div className="px-6 pt-7 pb-6 flex flex-col items-center gap-5">

          {/* Seed / plant visual */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1], delay: 0.18 }}
          >
            <SeedGlowVisual mode={mode} prevStage={prevStage} newStage={newStage} />
          </motion.div>

          {/* Headline block */}
          <motion.div
            className="text-center space-y-1"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.35 }}
          >
            <p className="text-[10px] font-bold tracking-[0.18em] text-primary/55 uppercase">
              {payload.completedUnits}/{payload.targetUnits} Actions · {payload.daysUsed === 1 ? "1 day" : `${payload.daysUsed} days`}
            </p>
            <h2
              className="text-[22px] font-bold tracking-tight text-foreground leading-tight"
              data-testid="ceremony-headline"
            >
              {headline}
            </h2>
          </motion.div>

          {/* Reward lines */}
          {rewardLines.length > 0 && (
            <motion.div
              className="w-full border-t border-b border-border/30 py-3.5 flex flex-col gap-2.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.85, duration: 0.2 }}
            >
              {rewardLines.map((r, i) => (
                <RewardLine
                  key={r.text}
                  text={r.text}
                  icon={r.icon}
                  delay={rewardStartDelay + i * rewardItemSpacing}
                />
              ))}
            </motion.div>
          )}

          {/* Reinforcement line */}
          <motion.p
            className="text-[13px] text-muted-foreground text-center leading-snug px-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: postRewardDelay + 0.25, duration: 0.4 }}
            data-testid="ceremony-reinforcement"
          >
            {reinforcement}
          </motion.p>

          {/* Continue button */}
          <motion.button
            className="w-full py-3 bg-primary text-primary-foreground rounded-[14px] text-sm font-semibold tracking-wide hover:bg-primary/90 active:scale-[0.98] transition-all"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: postRewardDelay + 0.6, duration: 0.3 }}
            onClick={handleDismiss}
            data-testid="button-ceremony-continue"
          >
            Continue
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
