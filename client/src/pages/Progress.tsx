import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { Droplets, Plus, Archive, CheckCircle2, Target, Flame, TrendingUp, Clock, X, Crown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import { WaterCup } from "@/components/WaterCup";
import { SeedGrowth } from "@/components/SeedGrowth";
import { UpgradePrompt } from "@/components/UpgradePrompt";

type FormMode = null | "targeted" | "untargeted";

export default function ProgressPage() {
  const userId = useStore((s) => s.userId);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [logGoalId, setLogGoalId] = useState<string | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [logSummary, setLogSummary] = useState("");
  const [logProgress, setLogProgress] = useState("");
  const [completeGoalId, setCompleteGoalId] = useState<string | null>(null);
  const [completionType, setCompletionType] = useState("integrated");

  const [formTitle, setFormTitle] = useState("");
  const [formWhy, setFormWhy] = useState("");
  const [formDeadline, setFormDeadline] = useState("");
  const [formBaseline, setFormBaseline] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [formHabit, setFormHabit] = useState("");
  const [formFocus, setFormFocus] = useState("");
  const [goalPulsing, setGoalPulsing] = useState(false);
  const prevWaterEventsRef = useRef<number | null>(null);

  const isAnyModalOpen = !!formMode || !!logGoalId || !!completeGoalId;
  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isAnyModalOpen]);

  useEffect(() => {
    if (!userId) setLocation("/");
  }, [userId]);

  const { data: assessment, isLoading: assessmentLoading } = useQuery({
    queryKey: ["assessment", userId],
    queryFn: () => api.getAssessment(userId!),
    enabled: !!userId,
  });

  const { data: garden, isLoading: gardenLoading } = useQuery({
    queryKey: ["garden", userId],
    queryFn: () => api.getGardenSummary(userId!),
    enabled: !!userId,
  });

  const { data: user } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => api.getUser(userId!),
    enabled: !!userId,
  });

  const currentWaterEvents = garden?.targeted?.waterEvents ?? garden?.untargeted?.waterEvents ?? null;
  useEffect(() => {
    if (currentWaterEvents === null) return;
    if (prevWaterEventsRef.current !== null && currentWaterEvents > prevWaterEventsRef.current) {
      setGoalPulsing(true);
      const t = setTimeout(() => setGoalPulsing(false), 900);
      return () => clearTimeout(t);
    }
    prevWaterEventsRef.current = currentWaterEvents;
  }, [currentWaterEvents]);

  useEffect(() => {
    if (!assessmentLoading && !assessment && userId) {
      setLocation("/assessment");
    }
  }, [assessment, assessmentLoading, userId]);

  const createGoalMut = useMutation({
    mutationFn: (data: any) => api.createGoal(userId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["garden", userId] });
      resetForm();
    },
  });

  const archiveMut = useMutation({
    mutationFn: (goalId: string) => api.archiveGoal(goalId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["garden", userId] }),
  });

  const completeMut = useMutation({
    mutationFn: ({ goalId, type }: { goalId: string; type?: string }) => api.completeGoal(goalId, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["garden", userId] });
      setCompleteGoalId(null);
    },
  });

  const logMut = useMutation({
    mutationFn: ({ goalId, data }: { goalId: string; data: any }) => api.logGoalProgress(goalId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["garden", userId] });
      queryClient.invalidateQueries({ queryKey: ["consistency", userId] });
      setLogGoalId(null);
      setLogSummary("");
      setLogProgress("");
    },
  });

  function resetForm() {
    setFormMode(null);
    setFormTitle("");
    setFormWhy("");
    setFormDeadline("");
    setFormBaseline("");
    setFormTarget("");
    setFormHabit("");
    setFormFocus("");
  }

  function handleCreateGoal() {
    if (!formTitle.trim()) return;
    const data: any = {
      goalType: formMode,
      title: formTitle.trim(),
      emotionalWhy: formWhy.trim(),
    };
    if (formMode === "targeted") {
      data.deadline = formDeadline || null;
      data.baselineMetric = formBaseline ? parseFloat(formBaseline) : null;
      data.targetMetric = formTarget ? parseFloat(formTarget) : null;
    } else {
      data.microHabit = formHabit.trim();
      data.focusArea = formFocus.trim();
    }
    createGoalMut.mutate(data);
  }

  if (!userId) return null;

  const targeted = garden?.targeted;
  const untargeted = garden?.untargeted;

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-green-50/60 to-blue-50/40">
      <div className="flex-1 overflow-y-auto pb-24">
        <header className="p-5 pb-3">
          <h1 className="text-xl font-serif font-bold text-foreground" data-testid="text-page-title">Growth Dashboard</h1>
          <p className="text-xs text-muted-foreground">Water is earned through action. Not intention.</p>
        </header>

        <div className="px-4 space-y-4">
          <GoalCard
            label="TARGETED GOAL"
            type="targeted"
            data={targeted}
            onAdd={() => {
              const maxGoals = user?.featureLimits?.maxGoals ?? 1;
              const activeCount = [targeted, untargeted].filter(Boolean).length;
              if (activeCount >= maxGoals) {
                setShowUpgradePrompt(true);
              } else {
                setFormMode("targeted");
              }
            }}
            onLog={(id) => { setLogGoalId(id); setLogProgress(""); }}
            onArchive={(id) => archiveMut.mutate(id)}
            onComplete={(id) => { setCompleteGoalId(id); }}
          />
          <GoalCard
            label="IDENTITY GOAL"
            type="untargeted"
            data={untargeted}
            onAdd={() => {
              const maxGoals = user?.featureLimits?.maxGoals ?? 1;
              const activeCount = [targeted, untargeted].filter(Boolean).length;
              if (activeCount >= maxGoals) {
                setShowUpgradePrompt(true);
              } else {
                setFormMode("untargeted");
              }
            }}
            onLog={(id) => { setLogGoalId(id); setLogProgress(""); }}
            onArchive={(id) => archiveMut.mutate(id)}
            onComplete={(id) => { setCompleteGoalId(id); setCompletionType("integrated"); }}
          />

          {targeted && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={goalPulsing
                ? { opacity: 1, y: 0, scale: [1, 1.025, 1], boxShadow: ["0 1px 4px rgba(0,0,0,0.06)", "0 4px 16px rgba(52,211,153,0.28)", "0 1px 4px rgba(0,0,0,0.06)"] }
                : { opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="bg-white rounded-2xl border border-border/50 p-4 shadow-sm"
              data-testid="card-targeted-detail"
            >
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-semibold">Targeted Progress</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Completion</span>
                  <span className="font-medium" data-testid="text-targeted-pct">{Math.round(targeted.percentComplete)}%</span>
                </div>
                <Progress value={targeted.percentComplete} className="h-2" />
                {targeted.daysLeft !== null && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Clock className="w-3 h-3" />
                    <span data-testid="text-targeted-countdown">{targeted.daysLeft} days remaining</span>
                  </div>
                )}
                {targeted.baselineMetric !== null && targeted.targetMetric !== null && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Baseline: {targeted.baselineMetric}</span>
                    <span>Target: {targeted.targetMetric}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {untargeted && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-border/50 p-4 shadow-sm"
              data-testid="card-untargeted-detail"
            >
              <div className="flex items-center gap-2 mb-3">
                <Flame className="w-4 h-4 text-purple-500" />
                <h3 className="text-sm font-semibold">Identity Progress</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-orange-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-orange-700" data-testid="text-streak-count">{untargeted.streakCount}</div>
                  <div className="text-[10px] text-orange-600/80 font-medium uppercase">Streak</div>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-blue-700" data-testid="text-momentum">{untargeted.momentumScore}%</div>
                  <div className="text-[10px] text-blue-600/80 font-medium uppercase">Momentum</div>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-green-700" data-testid="text-consistency">{untargeted.consistencyRate}%</div>
                  <div className="text-[10px] text-green-600/80 font-medium uppercase">Consistency</div>
                </div>
              </div>
              {untargeted.microHabit && (
                <p className="text-xs text-muted-foreground mt-3">
                  Micro-habit: <span className="font-medium text-foreground">{untargeted.microHabit}</span>
                </p>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {createPortal(
      <AnimatePresence>
        {formMode && (
          <FormOverlay
            mode={formMode}
            title={formTitle}
            setTitle={setFormTitle}
            why={formWhy}
            setWhy={setFormWhy}
            deadline={formDeadline}
            setDeadline={setFormDeadline}
            baseline={formBaseline}
            setBaseline={setFormBaseline}
            target={formTarget}
            setTarget={setFormTarget}
            habit={formHabit}
            setHabit={setFormHabit}
            focus={formFocus}
            setFocus={setFormFocus}
            onClose={resetForm}
            onSubmit={handleCreateGoal}
            loading={createGoalMut.isPending}
            error={createGoalMut.error?.message || null}
          />
        )}

        {logGoalId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/40 flex items-end justify-center"
            style={{ touchAction: "none" }}
            onClick={() => setLogGoalId(null)}
          >
            <motion.div
              initial={{ y: 200 }}
              animate={{ y: 0 }}
              exit={{ y: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-t-2xl p-5 space-y-3"
              style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))" }}
            >
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-sm">Log Progress</h3>
                <button onClick={() => setLogGoalId(null)} data-testid="button-close-log"><X className="w-5 h-5" /></button>
              </div>
              <Input
                placeholder="What did you do?"
                value={logSummary}
                onChange={(e) => setLogSummary(e.target.value)}
                data-testid="input-log-summary"
              />
              {targeted && logGoalId === targeted.id && (
                <Input
                  type="number"
                  placeholder="Current metric value (optional)"
                  value={logProgress}
                  onChange={(e) => setLogProgress(e.target.value)}
                  data-testid="input-log-progress"
                />
              )}
              <Button
                className="w-full"
                disabled={!logSummary.trim() || logMut.isPending}
                onClick={() => logMut.mutate({
                  goalId: logGoalId,
                  data: {
                    summary: logSummary.trim(),
                    progressValue: logProgress ? parseFloat(logProgress) : undefined,
                  }
                })}
                data-testid="button-submit-log"
              >
                {logMut.isPending ? "Logging..." : "Log"}
              </Button>
            </motion.div>
          </motion.div>
        )}

        {completeGoalId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center p-6"
            style={{ touchAction: "none" }}
            onClick={() => setCompleteGoalId(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-2xl p-5 space-y-4"
            >
              <h3 className="font-semibold text-center">Complete Goal</h3>
              {untargeted && completeGoalId === untargeted.id ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground text-center">How would you describe this goal's completion?</p>
                  {["integrated", "evolved", "archived"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setCompletionType(t)}
                      className={`w-full p-3 rounded-xl border text-sm text-left capitalize ${completionType === t ? "border-primary bg-primary/5 font-medium" : "border-border"}`}
                      data-testid={`button-completion-${t}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center">Mark this goal as completed?</p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setCompleteGoalId(null)} data-testid="button-cancel-complete">Cancel</Button>
                <Button
                  className="flex-1"
                  disabled={completeMut.isPending}
                  onClick={() => completeMut.mutate({ goalId: completeGoalId, type: completionType })}
                  data-testid="button-confirm-complete"
                >
                  {completeMut.isPending ? "..." : "Complete"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}

      <UpgradePrompt
        feature="dual_goals"
        show={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
      />
    </div>
  );
}

function GoalCard({
  label,
  type,
  data,
  onAdd,
  onLog,
  onArchive,
  onComplete,
}: {
  label: string;
  type: "targeted" | "untargeted";
  data: any;
  onAdd: () => void;
  onLog: (id: string) => void;
  onArchive: (id: string) => void;
  onComplete: (id: string) => void;
}) {
  const isTargeted = type === "targeted";

  if (!data) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/60 backdrop-blur-sm rounded-2xl border border-dashed border-border/60 p-5 flex items-center gap-4"
        data-testid={`card-empty-${type}`}
      >
        <div className="text-4xl opacity-30">🌰</div>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">{label}</p>
          <p className="text-xs text-muted-foreground mb-3">No {isTargeted ? "targeted goal" : "identity goal"} planted yet.</p>
          <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={onAdd} data-testid={`button-add-${type}`}>
            <Plus className="w-3 h-3 mr-1" />
            Plant {isTargeted ? "Goal" : "Identity"}
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white/80 backdrop-blur-sm rounded-2xl border border-border/50 p-4 shadow-sm"
      data-testid={`card-tree-${type}`}
    >
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">{label}</p>
      <p className="text-sm font-medium text-foreground mb-4" data-testid={`text-goal-title-${type}`}>
        {data.title}
      </p>

      <div className="flex items-start justify-center gap-6 mb-4">
        <SeedGrowth seedStage={data.seedStage ?? 0} cupsFilled={data.cupsFilled ?? 0} />
        <WaterCup
          fillPercent={data.fillPercent ?? 0}
          cupsFilled={data.cupsFilled ?? 0}
          revealedStatements={data.revealedStatements ?? {}}
        />
      </div>

      <div className="bg-muted/30 rounded-xl p-3 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground flex items-center gap-1">
            <Droplets className="w-3 h-3 text-blue-500" />
            Water Events
          </span>
          <span className="font-mono font-medium" data-testid={`text-water-events-${type}`}>
            {data.waterEvents ?? 0} / 50
          </span>
        </div>
        <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${data.fillPercent ?? 0}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{data.seedStageName}</span>
          <span>{data.cupsFilled ?? 0} cups filled</span>
        </div>
      </div>

      {isTargeted && data.daysLeft !== null && (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-2">
          <Clock className="w-3 h-3" />
          <span data-testid="text-targeted-countdown-card">{data.daysLeft}d remaining</span>
          <span className="ml-auto" data-testid="text-targeted-pct-card">{Math.round(data.percentComplete)}% done</span>
        </div>
      )}

      {!isTargeted && (
        <div className="flex justify-between text-[11px] text-muted-foreground mt-2">
          <span data-testid="text-streak-card">{data.streakCount}d streak</span>
          <span>{data.momentumScore}% momentum</span>
        </div>
      )}

      <div className="flex gap-1 mt-3 border-t border-border/30 pt-3">
        <Button size="sm" variant="ghost" className="flex-1 text-xs h-8" onClick={() => onLog(data.id)} data-testid={`button-log-${type}`}>
          <TrendingUp className="w-3.5 h-3.5 mr-1" /> Log
        </Button>
        <Button size="sm" variant="ghost" className="flex-1 text-xs h-8" onClick={() => onComplete(data.id)} data-testid={`button-complete-${type}`}>
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Done
        </Button>
        <Button size="sm" variant="ghost" className="text-xs h-8 px-2" onClick={() => onArchive(data.id)} data-testid={`button-archive-${type}`}>
          <Archive className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}

function FormOverlay({
  mode,
  title, setTitle,
  why, setWhy,
  deadline, setDeadline,
  baseline, setBaseline,
  target, setTarget,
  habit, setHabit,
  focus, setFocus,
  onClose,
  onSubmit,
  loading,
  error,
}: {
  mode: "targeted" | "untargeted";
  title: string; setTitle: (v: string) => void;
  why: string; setWhy: (v: string) => void;
  deadline: string; setDeadline: (v: string) => void;
  baseline: string; setBaseline: (v: string) => void;
  target: string; setTarget: (v: string) => void;
  habit: string; setHabit: (v: string) => void;
  focus: string; setFocus: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
}) {
  const isTargeted = mode === "targeted";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/40 flex items-end justify-center"
      style={{ touchAction: "none" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 300 }}
        animate={{ y: 0 }}
        exit={{ y: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-t-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto overscroll-contain"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">
            {isTargeted ? "Plant a Targeted Goal" : "Plant an Identity Goal"}
          </h3>
          <button onClick={onClose} data-testid="button-close-form"><X className="w-5 h-5" /></button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700" data-testid="text-form-error">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            {isTargeted ? "Goal Description" : "Identity Statement (\"I am becoming...\")"}
          </label>
          <Input
            placeholder={isTargeted ? "e.g. Lose 20 pounds in 90 days" : "e.g. I am becoming disciplined"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-testid="input-goal-title"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Emotional Why</label>
          <Input
            placeholder="Why does this matter to you?"
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            data-testid="input-goal-why"
          />
        </div>

        {isTargeted ? (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Deadline</label>
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                data-testid="input-goal-deadline"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Starting Baseline</label>
                <Input
                  type="number"
                  placeholder="e.g. 200"
                  value={baseline}
                  onChange={(e) => setBaseline(e.target.value)}
                  data-testid="input-goal-baseline"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Target Metric</label>
                <Input
                  type="number"
                  placeholder="e.g. 180"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  data-testid="input-goal-target"
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Focus Area</label>
              <Input
                placeholder="e.g. Fitness, Mindset, Leadership"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                data-testid="input-goal-focus"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Daily Micro-Habit</label>
              <Input
                placeholder="e.g. 10 minutes of reading"
                value={habit}
                onChange={(e) => setHabit(e.target.value)}
                data-testid="input-goal-habit"
              />
            </div>
          </>
        )}

        <div className="pb-4">
          <Button
            className="w-full"
            disabled={!title.trim() || loading}
            onClick={onSubmit}
            data-testid="button-create-goal"
          >
            {loading ? "Planting..." : `Plant ${isTargeted ? "Goal" : "Identity"}`}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
