import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, AlertCircle } from "lucide-react";

const DIR_SYMBOL: Record<string, string> = {
  up: "↑",
  stagnant: "→",
  down: "↓",
};

const DIR_LABEL: Record<string, string> = {
  up: "Advancement",
  stagnant: "Stagnation",
  down: "Regression",
};

const HEARTBEAT_NAMES: Record<string, string> = {
  clarity: "Clarity of Vision & Why",
  consistency: "Small Steps + Consistency",
  mindset: "Mindset over Method",
  adaptation: "Feedback & Adaptation",
  courage: "Courageous Action",
};

const HEARTBEAT_ORDER = ["clarity", "consistency", "mindset", "adaptation", "courage"];

export default function WeeklyReview() {
  const userId = useStore((s) => s.userId);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) setLocation("/");
  }, [userId]);

  const { data: review, isLoading, isError: isGenerateError } = useQuery({
    queryKey: ["weekly-review-generate", userId],
    queryFn: () => api.generateWeeklyReview(userId!),
    enabled: !!userId,
    staleTime: Infinity,
  });

  const completeMutation = useMutation({
    mutationFn: () => api.completeWeeklyReview(userId!, review.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weekly-review-status"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-review-generate"] });
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      setLocation("/home");
    },
    onError: () => {
      setCompleting(false);
      setCompleteError("Something went wrong. Please try again.");
    },
  });

  const handleAcknowledge = () => {
    setCompleting(true);
    setCompleteError(null);
    completeMutation.mutate();
  };

  if (!userId) return null;

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Generating your Weekly Review...</p>
            <p className="text-xs text-muted-foreground/60">Analyzing the past 7 days</p>
          </div>
        </div>
      </div>
    );
  }

  if (isGenerateError) {
    return (
      <div className="h-full flex flex-col bg-background">
        <header className="p-4 flex items-center gap-3 border-b border-border/50">
          <button onClick={() => setLocation("/home")} data-testid="button-back-from-review">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-serif font-semibold text-lg">Weekly Review</h1>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-4" data-testid="text-generate-error">
            <div className="flex items-center justify-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm font-medium">Something went wrong. Please try again.</p>
            </div>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["weekly-review-generate", userId] })}
              data-testid="button-retry-generate"
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="h-full flex flex-col bg-background">
        <header className="p-4 flex items-center gap-3 border-b border-border/50">
          <button onClick={() => setLocation("/home")} data-testid="button-back-from-review">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-serif font-semibold text-lg">Weekly Review</h1>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">No review data available.</p>
        </div>
      </div>
    );
  }

  const goalSnap = review.targetedGoalSnapshot as any;
  const directions = review.heartbeatDirections as any;

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="p-4 flex items-center gap-3 border-b border-border/50">
        <button onClick={() => setLocation("/home")} data-testid="button-back-from-review">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-serif font-semibold text-lg">Weekly Review</h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-28">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="p-5 space-y-6"
        >
          <div className="text-center pb-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Week of</p>
            <p className="text-sm font-medium" data-testid="text-review-cycle-date">{review.cycleStartDate}</p>
          </div>

          <div className="border-t border-border/40" />

          <section data-testid="section-goal-progress">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Targeted Goal Progress
            </h2>
            {goalSnap?.hasGoal ? (
              <div className="bg-white rounded-xl border border-border/50 p-4 space-y-2">
                <p className="text-sm font-medium" data-testid="text-review-goal-statement">
                  Goal: {goalSnap.goalStatement}
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Last Week:</span>
                    <span className="ml-2 font-mono font-medium" data-testid="text-review-last-week">
                      {goalSnap.lastWeekValue != null ? goalSnap.lastWeekValue : "—"}
                      {goalSnap.metricType && goalSnap.lastWeekValue != null ? ` ${goalSnap.metricType}` : ""}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">This Week:</span>
                    <span className="ml-2 font-mono font-medium" data-testid="text-review-this-week">
                      {goalSnap.currentValue != null ? goalSnap.currentValue : "—"}
                      {goalSnap.metricType && goalSnap.currentValue != null ? ` ${goalSnap.metricType}` : ""}
                    </span>
                  </div>
                </div>
                <div className="pt-1">
                  <span className="text-muted-foreground text-sm">Net Change:</span>
                  <span
                    className={`ml-2 font-mono font-semibold text-sm ${
                      goalSnap.netChange != null && goalSnap.netChange < 0
                        ? "text-green-600"
                        : goalSnap.netChange != null && goalSnap.netChange > 0
                        ? "text-red-500"
                        : "text-foreground"
                    }`}
                    data-testid="text-review-net-change"
                  >
                    {goalSnap.netChange != null
                      ? `${goalSnap.netChange > 0 ? "+" : ""}${goalSnap.netChange}`
                      : "—"}
                    {goalSnap.metricType && goalSnap.netChange != null ? ` ${goalSnap.metricType}` : ""}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic" data-testid="text-no-targeted-goal">
                No targeted goal active.
              </p>
            )}
          </section>

          <div className="border-t border-border/40" />

          <section data-testid="section-heartbeat-direction">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Heartbeat Direction
            </h2>
            <div className="bg-white rounded-xl border border-border/50 divide-y divide-border/30">
              {HEARTBEAT_ORDER.map((key) => {
                const dir = directions?.[key] || "stagnant";
                const symbol = DIR_SYMBOL[dir];
                const colorClass =
                  dir === "up" ? "text-green-600" : dir === "down" ? "text-red-500" : "text-amber-500";
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between px-4 py-3"
                    data-testid={`heartbeat-direction-${key}`}
                  >
                    <span className="text-sm text-foreground">{HEARTBEAT_NAMES[key]}</span>
                    <span className={`text-lg font-bold ${colorClass}`} title={DIR_LABEL[dir]}>
                      {symbol}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="border-t border-border/40" />

          <section data-testid="section-collective-analysis">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Collective Analysis
            </h2>
            <div className="bg-white rounded-xl border border-border/50 p-4">
              <p className="text-sm text-foreground leading-relaxed" data-testid="text-collective-analysis">
                {review.collectiveAnalysis || "Insufficient data for analysis this week."}
              </p>
            </div>
          </section>
        </motion.div>
      </div>

      <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
        <div className="max-w-md mx-auto space-y-2">
          <Button
            onClick={handleAcknowledge}
            disabled={completing || review.status === "completed"}
            className="w-full rounded-full"
            size="lg"
            data-testid="button-acknowledge-review"
          >
            {completing ? (
              "Completing..."
            ) : review.status === "completed" ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Reviewed
              </>
            ) : (
              "Acknowledge Review"
            )}
          </Button>
          {completeError && (
            <div className="flex items-center justify-center gap-1.5 text-red-600 text-sm" data-testid="text-complete-error">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{completeError}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
