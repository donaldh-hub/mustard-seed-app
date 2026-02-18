import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Droplets, MessageCircle, Target, Brain, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation } from "wouter";

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

  const { data: entries = [] } = useQuery({
    queryKey: ["entries", userId],
    queryFn: () => api.getEntries(userId!),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!assessmentLoading && !assessment && userId) {
      setLocation("/assessment");
    }
  }, [assessment, assessmentLoading, userId]);

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
  const goal = user?.goals?.[0] || "";
  const waterLevel = user?.waterLevel ?? 0;

  const recentEntry = entries.length > 0
    ? entries.sort((a: any, b: any) => (b.createdAt > a.createdAt ? 1 : -1))[0]
    : null;

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
              <p className="text-sm text-muted-foreground italic" data-testid="text-no-goal">No goal saved yet</p>
            )}
            <Button
              onClick={() => setLocation("/chat")}
              variant="outline"
              className="mt-3 w-full rounded-full"
              size="sm"
              data-testid="button-refine-goal"
            >
              Refine Goal
            </Button>
          </motion.div>

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
            className="bg-white rounded-2xl border border-border/50 p-4 shadow-sm"
            data-testid="card-water-level"
          >
            <div className="flex items-center gap-2 mb-2">
              <Droplets className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-semibold text-foreground">Water Level</h2>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-blue-600" data-testid="text-water-level">{waterLevel}</span>
              <span className="text-sm text-muted-foreground mb-1">/ 100</span>
            </div>
            <div className="mt-2 h-2 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(waterLevel, 100)}%` }}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
