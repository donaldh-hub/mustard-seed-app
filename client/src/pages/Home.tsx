import { useState, useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Droplets, MessageCircle, Target, Brain, BookOpen, Sprout, TreeDeciduous, Flame, ClipboardCheck, X } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation } from "wouter";

function CircularProgressRing({
  percent,
  size = 52,
  strokeWidth = 4.5,
}: { percent: number; size?: number; strokeWidth?: number }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(100, Math.max(0, percent)) / 100);
  const cx = size / 2;

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        cx={cx} cy={cx} r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-orange-100"
      />
      <circle
        cx={cx} cy={cx} r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        className="text-orange-500 transition-all duration-700 ease-out"
      />
    </svg>
  );
}

const stageEmoji: Record<string, string> = { seed: "🌱", sprout: "🌿", growth: "🌳", bloom: "🌸" };

const HEARTBEAT_LABELS: Record<string, string> = {
  clarity: "Clarity of Vision & Why",
  consistency: "Small Steps + Consistency",
  mindset: "Mindset over Method",
  adaptation: "Feedback & Adaptation",
  courage: "Courageous Action",
};

const HEARTBEAT_ORDER = ["clarity", "consistency", "mindset", "adaptation", "courage"];

function focusMessage(weakest: string): string {
  const map: Record<string, string> = {
    clarity: "Get clear on your why — everything else follows from it.",
    consistency: "Small daily reps beat big occasional efforts.",
    mindset: "Your mindset shapes your results more than your method.",
    adaptation: "Listen to the feedback. Adjust. Keep moving.",
    courage: "Take the action you've been avoiding. Growth lives there.",
  };
  return map[weakest] || "Keep showing up. Consistency compounds.";
}

export default function Home() {
  const userId = useStore((s) => s.userId);
  const [, setLocation] = useLocation();
  const [heartbeatsOpen, setHeartbeatsOpen] = useState(false);
  const prevStreakRef = useRef<number>(0);
  const [streakPulsing, setStreakPulsing] = useState(false);
  const [inactivityBannerDismissed, setInactivityBannerDismissed] = useState(() => {
    const key = `inactivity_banner_dismissed_${userId}`;
    const stored = sessionStorage.getItem(key);
    return stored ? Number(stored) > Date.now() - 3 * 60 * 60 * 1000 : false;
  });

  useEffect(() => {
    if (!userId) setLocation("/");
  }, [userId]);

  const { data: user, isFetching: userFetching } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => api.getUser(userId!),
    enabled: !!userId,
  });

  const { data: assessment, isLoading: assessmentLoading } = useQuery({
    queryKey: ["assessment", userId],
    queryFn: () => api.getAssessment(userId!),
    enabled: !!userId,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["entries", userId],
    queryFn: () => api.getEntries(userId!),
    enabled: !!userId,
  });

  const { data: consistency } = useQuery({
    queryKey: ["consistency", userId],
    queryFn: () => api.getConsistencySummary(userId!),
    enabled: !!userId,
  });

  const { data: garden } = useQuery({
    queryKey: ["garden", userId],
    queryFn: () => api.getGardenSummary(userId!),
    enabled: !!userId,
  });

  const { data: weeklyStatus } = useQuery({
    queryKey: ["weekly-review-status", userId],
    queryFn: () => api.getWeeklyReviewStatus(userId!),
    enabled: !!userId,
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (!assessmentLoading && !assessment && userId) {
      setLocation("/assessment");
    }
  }, [assessment, assessmentLoading, userId]);

  const currentStreak = user?.streak ?? 0;
  useEffect(() => {
    if (currentStreak > prevStreakRef.current) {
      setStreakPulsing(true);
      const t = setTimeout(() => setStreakPulsing(false), 900);
      prevStreakRef.current = currentStreak;
      return () => clearTimeout(t);
    }
    prevStreakRef.current = currentStreak;
  }, [currentStreak]);

  if (!userId || assessmentLoading) return null;
  if (!assessment) return null;

  const userName = user?.name || "there";
  const stage = assessment.stage
    ? assessment.stage.charAt(0).toUpperCase() + assessment.stage.slice(1)
    : "Seed";
  const emoji = assessment.stage ? (stageEmoji[assessment.stage] || "🌱") : "🌱";
  const assessmentDate = assessment.createdAt
    ? new Date(assessment.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";

  const heartbeatScores: Record<string, number> = assessment.heartbeatScores || {};
  const weakest = assessment.weakestHeartbeat || "";
  const weakestScore = heartbeatScores[weakest] ?? 0;
  const goal = garden?.targeted?.title || garden?.untargeted?.title || "";

  const recentEntry = entries.length > 0
    ? entries.sort((a: any, b: any) => (b.createdAt > a.createdAt ? 1 : -1))[0]
    : null;

  // Inactivity reminder: only for targeted goals, only after first VA ever
  const hoursSinceLastVA = user?.lastVerifiedActionAt
    ? (Date.now() - new Date(user.lastVerifiedActionAt).getTime()) / 3600000
    : 0;
  const hasTargetedGoal = !!garden?.targeted;
  const show24hBanner = hasTargetedGoal && hoursSinceLastVA >= 24 && !inactivityBannerDismissed;

  // Streak state
  const previousStreak = (user as any)?.previousStreak ?? 0;
  const streakAtRisk = currentStreak >= 1 && hoursSinceLastVA >= 24 && hoursSinceLastVA < 48;
  const streakBroken = hoursSinceLastVA >= 48 && currentStreak >= 1;
  const streakNewBegins = currentStreak === 1 && previousStreak > 0 && hoursSinceLastVA < 24;

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-1 overflow-y-auto pb-24">
        <header className="p-5 pb-3 bg-gradient-to-b from-primary/5 to-transparent">
          <h1 className="font-serif font-semibold text-xl" data-testid="text-user-name">{userName}'s Report</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-medium text-primary" data-testid="text-stage">
              {emoji} {stage}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground" data-testid="text-assessment-date">
              Assessed {assessmentDate}
            </span>
          </div>
        </header>

        <div className="px-5 space-y-4">
          {weeklyStatus?.pending && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm cursor-pointer"
              onClick={() => setLocation("/weekly-review")}
              data-testid="banner-weekly-review"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <ClipboardCheck className="w-4.5 h-4.5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900">Your Weekly Review is Ready</p>
                  <p className="text-xs text-amber-700/70 mt-0.5">Tap to view your progress report</p>
                </div>
              </div>
            </motion.div>
          )}

          {show24hBanner && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3"
              data-testid="banner-inactivity-24h"
            >
              <Droplets className="w-4 h-4 text-orange-400 shrink-0" />
              <p className="flex-1 text-sm text-orange-900 font-medium leading-snug">
                Momentum waiting — one small step moves your goal forward.
              </p>
              <button
                onClick={() => {
                  setInactivityBannerDismissed(true);
                  sessionStorage.setItem(`inactivity_banner_dismissed_${userId}`, String(Date.now()));
                }}
                className="text-orange-400 hover:text-orange-600 shrink-0"
                data-testid="button-dismiss-inactivity-banner"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}

          {!weeklyStatus?.pending && weeklyStatus?.lastSnapshot && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.02 }}
              className="bg-white rounded-2xl border border-border/50 p-4 shadow-sm"
              data-testid="card-last-review-snapshot"
            >
              <div className="flex items-center gap-2 mb-2">
                <ClipboardCheck className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Last Weekly Review</h2>
                <span className="text-xs text-muted-foreground ml-auto">{weeklyStatus.lastSnapshot.date}</span>
              </div>
              <div className="flex items-center gap-4">
                {weeklyStatus.lastSnapshot.goalNet != null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Goal Net</p>
                    <p className="text-sm font-mono font-semibold" data-testid="text-snapshot-goal-net">
                      {weeklyStatus.lastSnapshot.goalNet > 0 ? "+" : ""}{weeklyStatus.lastSnapshot.goalNet}
                      {weeklyStatus.lastSnapshot.metricType ? ` ${weeklyStatus.lastSnapshot.metricType}` : ""}
                    </p>
                  </div>
                )}
                {weeklyStatus.lastSnapshot.heartbeatSummary && (
                  <div>
                    <p className="text-xs text-muted-foreground">Heartbeats</p>
                    <p className="text-sm font-mono font-semibold tracking-wider" data-testid="text-snapshot-heartbeats">
                      {weeklyStatus.lastSnapshot.heartbeatSummary}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-white rounded-2xl border border-border/50 p-4 shadow-sm"
            data-testid="card-focus"
          >
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Focus Area</h2>
            </div>
            <p className="text-base font-medium capitalize" data-testid="text-weakest-heartbeat">{weakest || "—"}</p>
            <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-weakest-score">Score: {weakestScore} / 5</p>
            <p className="text-sm text-foreground/80 mt-2 leading-relaxed" data-testid="text-focus-message">{focusMessage(weakest)}</p>
            <Button
              onClick={() => setLocation("/chat")}
              className="mt-3 w-full rounded-full"
              size="sm"
              data-testid="button-work-with-jae"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Work with Jae
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl border border-border/50 p-4 shadow-sm"
            data-testid="card-goal"
          >
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Goal</h2>
            </div>
            {goal ? (
              <p className="text-base font-semibold text-foreground truncate" data-testid="text-goal">{goal}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic" data-testid="text-no-goal">No active goal yet</p>
            )}
            <Button
              onClick={() => setLocation(goal ? "/chat" : "/progress")}
              variant="outline"
              className="mt-3 w-full rounded-full"
              size="sm"
              data-testid="button-refine-goal"
            >
              {goal ? "Refine Goal" : "Plant a Goal"}
            </Button>
          </motion.div>

          {(garden?.targeted || garden?.untargeted) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="bg-white rounded-2xl border border-border/50 p-4 shadow-sm"
              data-testid="card-active-goals"
            >
              <div className="flex items-center gap-2 mb-3">
                <TreeDeciduous className="w-4 h-4 text-green-600" />
                <h2 className="text-sm font-semibold text-foreground">Active Goals</h2>
              </div>
              <div className="space-y-2">
                {garden.targeted && (
                  <div className="flex items-center gap-3 bg-orange-50 rounded-xl px-3 py-3">
                    <div className="relative shrink-0">
                      <CircularProgressRing percent={Math.round(garden.targeted.percentComplete)} size={52} />
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-orange-600" data-testid="text-home-targeted-pct">
                        {Math.round(garden.targeted.percentComplete)}%
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate" data-testid="text-home-targeted-title">{garden.targeted.title}</p>
                      <p className="text-base font-bold text-orange-600 leading-tight" aria-hidden="true">
                        {Math.round(garden.targeted.percentComplete)}% complete
                      </p>
                      {garden.targeted.daysLeft !== null && (
                        <p className="text-[10px] text-muted-foreground">{garden.targeted.daysLeft}d left</p>
                      )}
                    </div>
                  </div>
                )}
                {garden.untargeted && (
                  <div className="flex items-center gap-2 bg-purple-50 rounded-xl px-3 py-2">
                    <Flame className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" data-testid="text-home-untargeted-title">{garden.untargeted.title}</p>
                      <p className="text-[10px] text-muted-foreground">{garden.untargeted.streakCount}d streak · {garden.untargeted.momentumScore}% momentum</p>
                    </div>
                  </div>
                )}
              </div>
              <Button
                onClick={() => setLocation("/progress")}
                variant="outline"
                className="mt-3 w-full rounded-full"
                size="sm"
                data-testid="button-view-growth"
              >
                View Growth Dashboard
              </Button>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden"
            data-testid="card-heartbeats"
          >
            <button
              onClick={() => setHeartbeatsOpen(!heartbeatsOpen)}
              className="w-full flex items-center justify-between p-4 text-left"
              data-testid="button-toggle-heartbeats"
            >
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Five Heartbeats</h2>
              </div>
              {heartbeatsOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            {heartbeatsOpen && (
              <div className="px-4 pb-4 space-y-3">
                {HEARTBEAT_ORDER.map((key) => {
                  const score = heartbeatScores[key] ?? 0;
                  const isWeakest = key === weakest;
                  return (
                    <div
                      key={key}
                      className={`flex items-center justify-between py-2 px-3 rounded-xl ${isWeakest ? "bg-primary/10 border border-primary/30" : "bg-muted/30"}`}
                      data-testid={`heartbeat-row-${key}`}
                    >
                      <span className={`text-sm ${isWeakest ? "font-semibold text-primary" : "text-foreground"}`}>
                        {HEARTBEAT_LABELS[key]}
                        {isWeakest && <span className="ml-1 text-xs">(focus)</span>}
                      </span>
                      <span className={`text-sm font-mono font-medium ${isWeakest ? "text-primary" : "text-muted-foreground"}`}>
                        {score.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl border border-border/50 p-4 shadow-sm"
            data-testid="card-recent-memory"
          >
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Recent Memory</h2>
            </div>
            {recentEntry ? (
              <div>
                <p className="text-xs text-muted-foreground" data-testid="text-memory-date">{recentEntry.date}</p>
                <p className="text-sm text-foreground mt-1" data-testid="text-memory-summary">{recentEntry.summary}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic" data-testid="text-no-memory">No memories yet</p>
            )}
            <Button
              onClick={() => setLocation("/calendar")}
              variant="outline"
              className="mt-3 w-full rounded-full"
              size="sm"
              data-testid="button-view-memory"
            >
              View Memory Bank
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white rounded-2xl border border-border/50 px-3.5 py-3 shadow-sm"
            data-testid="card-water-level"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Droplets className="w-3.5 h-3.5 text-blue-500" />
              <h2 className="text-xs font-semibold text-foreground">Water Level</h2>
            </div>
            <p className="text-[10px] text-muted-foreground/80 mb-1.5">Habit momentum indicator.</p>
            <div className="flex items-end gap-1.5">
              <span className="text-2xl font-bold text-blue-600" data-testid="text-water-level">{consistency?.weeklyWaterLevelPercent ?? 0}</span>
              <span className="text-xs text-muted-foreground mb-0.5">/ 100</span>
            </div>
            <div className="mt-1.5 h-1.5 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(consistency?.weeklyWaterLevelPercent ?? 0, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5" data-testid="text-water-days">
              Days active: {consistency?.weeklyActiveDays ?? 0} / 7
            </p>
            {consistency?.weeklyWaterLevelPercent === 100 && (
              <span className="inline-block mt-1.5 text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full" data-testid="badge-fully-watered">
                Fully watered this week.
              </span>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl border border-border/50 p-4 shadow-sm"
            data-testid="card-seed-stage"
          >
            <div className="flex items-center gap-2 mb-1">
              <Sprout className="w-4 h-4 text-green-600" />
              <h2 className="text-sm font-semibold text-foreground">Seed Stage</h2>
            </div>
            <p className="text-[10px] text-muted-foreground/80 mb-2">Growth phase — long term.</p>
            <p className="text-lg font-semibold text-foreground" data-testid="text-seed-stage-name">
              {consistency?.seedStageName ?? "Seed"}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-seed-stage-desc">
              {consistency?.seedStageDescription ?? "You've started. Protect the habit."}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-2" data-testid="text-lifetime-days">
              {consistency?.lifetimeActiveDays ?? 0} lifetime active {(consistency?.lifetimeActiveDays ?? 0) === 1 ? "day" : "days"}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: streakPulsing ? [1, 1.04, 1] : 1,
            }}
            transition={{ delay: 0.35, scale: { duration: 0.45, ease: "easeInOut" } }}
            className={`relative overflow-hidden rounded-2xl px-3.5 py-3 shadow-sm border ${
              streakBroken
                ? "bg-white border-border/50"
                : streakAtRisk
                ? "bg-amber-50/80 border-amber-300"
                : "bg-white border-border/50"
            }`}
            data-testid="card-streak"
          >
            {userFetching && (
              <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none z-10">
                <div className="animate-shimmer absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
              </div>
            )}
            <div className="flex items-center gap-1.5 mb-1">
              <Flame className={`w-3.5 h-3.5 ${streakAtRisk ? "text-amber-500" : streakBroken ? "text-muted-foreground/40" : "text-orange-500"}`} />
              <h2 className="text-xs font-semibold text-foreground">Consistency Streak</h2>
              {streakAtRisk && (
                <span className="ml-auto text-[9px] font-semibold text-amber-600 uppercase tracking-wide" data-testid="badge-streak-at-risk">At risk</span>
              )}
            </div>
            {streakNewBegins ? (
              <p className="text-sm font-medium text-primary mt-1" data-testid="text-streak-new">New streak begins today.</p>
            ) : streakBroken ? (
              <>
                <p className="text-2xl font-bold text-muted-foreground/40 leading-none" data-testid="text-streak-count">{currentStreak}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Log a verified action to keep it alive.</p>
              </>
            ) : (
              <>
                <div className="flex items-end gap-1.5">
                  <span className="text-2xl font-bold text-orange-500 leading-none" data-testid="text-streak-count">{currentStreak}</span>
                  <span className="text-xs text-muted-foreground mb-0.5">{currentStreak === 1 ? "day" : "days"}</span>
                </div>
                {streakAtRisk && (
                  <p className="text-[11px] text-amber-600 mt-1">Log today to protect your streak.</p>
                )}
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
