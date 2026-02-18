import { useStore } from "@/lib/store";
import { motion } from "framer-motion";
import { Sun, Droplets, Sprout } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import { useEffect } from "react";

const SEED_ICON: Record<string, string> = {
  seed: "🌰",
  germinating: "🌱",
  sprout: "🌿",
  growing: "🪴",
  rooted: "🌳",
};

export default function ProgressPage() {
  const userId = useStore((s) => s.userId);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!userId) setLocation("/");
  }, [userId]);

  const { data: user } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => api.getUser(userId!),
    enabled: !!userId,
  });

  const { data: assessment, isLoading: assessmentLoading } = useQuery({
    queryKey: ["assessment", userId],
    queryFn: () => api.getAssessment(userId!),
    enabled: !!userId,
  });

  const { data: consistency } = useQuery({
    queryKey: ["consistency", userId],
    queryFn: () => api.getConsistencySummary(userId!),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!assessmentLoading && !assessment && userId) {
      setLocation("/assessment");
    }
  }, [assessment, assessmentLoading, userId]);

  const streak = user?.streak ?? 0;

  const seedStageName = consistency?.seedStageName ?? "Seed";
  const seedStageDesc = consistency?.seedStageDescription ?? "You've started. Protect the habit.";
  const seedIconKey = consistency?.seedStageIconKey ?? "seed";
  const seedIcon = SEED_ICON[seedIconKey] || "🌰";
  const weeklyWater = consistency?.weeklyWaterLevelPercent ?? 0;
  const weeklyActive = consistency?.weeklyActiveDays ?? 0;
  const lifetimeDays = consistency?.lifetimeActiveDays ?? 0;

  if (!userId) return null;

  return (
    <div className="h-full p-6 flex flex-col bg-gradient-to-b from-blue-50/50 to-green-50/50 pb-24">
      <header className="mb-8">
        <h1 className="text-2xl font-serif font-bold text-foreground" data-testid="text-page-title">Your Progress</h1>
        <p className="text-muted-foreground text-sm">Small steps. Big shifts.</p>
      </header>

      <div className="flex-1 flex flex-col items-center justify-start relative space-y-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className="absolute top-0 right-0 text-orange-300 opacity-50"
        >
          <Sun className="w-12 h-12" />
        </motion.div>

        <div className="relative w-48 h-48 flex items-center justify-center">
          <motion.div
            key={seedIconKey}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="text-8xl filter drop-shadow-xl"
            data-testid="text-tree-stage"
          >
            {seedIcon}
          </motion.div>
          <div className="absolute bottom-2 w-full h-3 bg-amber-900/10 rounded-[100%] blur-sm -z-10" />
        </div>

        <div className="text-center">
          <p className="text-lg font-serif font-semibold text-foreground" data-testid="text-seed-stage-name">
            {seedStageName}
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs" data-testid="text-seed-stage-desc">
            {seedStageDesc}
          </p>
          <p className="text-[11px] text-muted-foreground/70 mt-1" data-testid="text-lifetime-days">
            {lifetimeDays} lifetime active {lifetimeDays === 1 ? "day" : "days"}
          </p>
        </div>

        <div className="w-full max-w-sm bg-white/80 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-white/50 space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span className="flex items-center gap-2 text-blue-600">
                <Droplets className="w-4 h-4" /> Water Level
              </span>
              <span data-testid="text-water-level">{weeklyWater}%</span>
            </div>
            <Progress value={weeklyWater} className="h-3 bg-blue-100" />
            <p className="text-xs text-muted-foreground pt-1">
              Days active: {weeklyActive} / 7
            </p>
            <p className="text-[11px] text-muted-foreground/70">
              Based on days you logged at least one action in the last 7 days.
            </p>
            {weeklyWater === 100 && (
              <span className="inline-block text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full" data-testid="badge-fully-watered">
                Fully watered this week.
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-orange-50 p-4 rounded-xl text-center border border-orange-100">
              <div className="text-2xl font-bold text-orange-700" data-testid="text-streak">{streak}</div>
              <div className="text-xs text-orange-600/80 font-medium uppercase tracking-wider">Day Streak</div>
            </div>
            <div className="bg-green-50 p-4 rounded-xl text-center border border-green-100">
              <div className="text-2xl font-bold text-green-700" data-testid="text-stage">{seedStageName}</div>
              <div className="text-xs text-green-600/80 font-medium uppercase tracking-wider">Seed Stage</div>
            </div>
          </div>

          {assessment?.weakestHeartbeat && (
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-center">
              <p className="text-xs text-amber-600/80 font-medium uppercase tracking-wider mb-1">Focus Heartbeat</p>
              <p className="text-sm font-semibold text-amber-700" data-testid="text-focus-heartbeat">
                {assessment.weakestHeartbeat.charAt(0).toUpperCase() + assessment.weakestHeartbeat.slice(1)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
