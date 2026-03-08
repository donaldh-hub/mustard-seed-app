import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

const QUESTIONS = [
  "I have a clear picture of what I want to achieve right now.",
  "I take at least one small action daily toward my goals.",
  "I stay consistent even when motivation dips.",
  "I believe growth comes more from effort than talent.",
  "I adjust when things don't go as planned instead of quitting.",
  "I face discomfort knowing it leads to growth.",
  "I give myself grace when I fall short.",
  "I track or reflect on my progress each week.",
  "I surround myself with people or tools that hold me accountable.",
  "I feel proud of how I'm showing up lately.",
];

const SCALE_LABELS = [
  "Strongly Disagree",
  "Disagree",
  "Slightly Disagree",
  "Slightly Agree",
  "Agree",
  "Strongly Agree",
];

const STAGE_EMOJI: Record<string, string> = {
  seed: "🌱",
  sprout: "🌿",
  growth: "🌳",
  bloom: "🌸",
};

export default function Assessment() {
  const [name, setName] = useState("");
  const [answers, setAnswers] = useState<(number | null)[]>(Array(10).fill(null));
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, setLocation] = useLocation();
  const userId = useStore((s) => s.userId);
  const setUserId = useStore((s) => s.setUserId);
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const qc = useQueryClient();

  const onboardingCompleted = useStore((s) => s.onboardingCompleted);

  useEffect(() => {
    if (onboardingCompleted) {
      setLocation("/home", { replace: true });
    }
  }, [onboardingCompleted]);

  const isReturningUser = !!userId;
  const allAnswered = (isReturningUser || name.trim().length > 0) && answers.every((a) => a !== null);

  const handleSelect = (qIndex: number, value: number) => {
    const updated = [...answers];
    updated[qIndex] = value;
    setAnswers(updated);
  };

  const handleSubmit = async () => {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    try {
      let currentUserId = userId;
      if (!currentUserId) {
        const user = await api.createUser({
          name: name.trim(),
          isOnboarded: 1,
        });
        setUserId(user.id);
        currentUserId = user.id;
      } else if (name.trim()) {
        await api.updateUser(currentUserId, { name: name.trim() });
      }

      const assessmentResult = await api.submitAssessment(
        currentUserId!,
        answers as number[]
      );
      localStorage.setItem("assessmentResult", JSON.stringify(assessmentResult));
      setResult(assessmentResult);

      qc.invalidateQueries({ queryKey: ["assessment", currentUserId] });
      qc.invalidateQueries({ queryKey: ["user", currentUserId] });

      completeOnboarding();

      setTimeout(() => {
        setLocation("/home", { replace: true });
      }, 3500);
    } catch (e) {
      console.error(e);
      setSubmitting(false);
    }
  };

  const handleRetake = () => {
    setAnswers(Array(10).fill(null));
    setResult(null);
    setSubmitting(false);
  };

  if (result) {
    const stageName = result.stage.charAt(0).toUpperCase() + result.stage.slice(1);
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-border/50 p-8 text-center space-y-6"
          data-testid="result-box"
        >
          <div className="text-6xl">{STAGE_EMOJI[result.stage] || "🌱"}</div>
          <h2 className="text-2xl font-serif font-semibold text-foreground" data-testid="text-score">
            Your Score: {result.totalScore}/50
          </h2>
          <p className="text-xl font-medium text-primary" data-testid="text-stage">
            Stage: {stageName} {STAGE_EMOJI[result.stage] || ""}
          </p>
          <p className="text-muted-foreground leading-relaxed" data-testid="text-motivational">
            {result.motivationalMessage}
          </p>

          {result.weakestHeartbeat && (
            <p className="text-sm text-orange-600 font-medium" data-testid="text-weakest">
              Focus Area: {result.weakestHeartbeat.charAt(0).toUpperCase() + result.weakestHeartbeat.slice(1)}
            </p>
          )}

          <div className="pt-2 text-xs text-muted-foreground/70 border-t border-border/30">
            🌱 Seed 0-15 | 🌿 Sprout 16-30 | 🌳 Growth 31-45 | 🌸 Bloom 46-50
          </div>
          <Button
            onClick={handleRetake}
            variant="outline"
            className="w-full rounded-full"
            data-testid="button-retake"
          >
            Retake Assessment
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-lg mx-auto p-6 pb-32 space-y-8">
        <div className="text-center space-y-2 pt-4">
          <h1 className="text-3xl font-serif font-semibold text-foreground" data-testid="text-title">
            Self Check-In
          </h1>
          <p className="text-muted-foreground text-sm">
            No overthinking — answer based on how true this feels TODAY.
          </p>
        </div>

        {!isReturningUser && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              What should I call you?
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name..."
              className="w-full bg-white border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              autoComplete="off"
              data-testid="input-name"
            />
          </div>
        )}

        <div className="bg-white/80 rounded-xl p-3 border border-border/30 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 justify-center">
          {SCALE_LABELS.map((label, i) => (
            <span key={i}>
              <span className="font-semibold text-foreground">{i}</span> = {label}
            </span>
          ))}
        </div>

        <div className="space-y-6">
          {QUESTIONS.map((q, qIndex) => (
            <div
              key={qIndex}
              className="bg-white rounded-xl p-4 border border-border/30 shadow-sm space-y-3"
              data-testid={`question-${qIndex + 1}`}
            >
              <p className="text-sm font-medium text-foreground leading-relaxed">
                <span className="text-primary font-semibold mr-1">{qIndex + 1}.</span>
                {q}
              </p>
              <div className="flex gap-2">
                {[0, 1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    onClick={() => handleSelect(qIndex, val)}
                    className={`flex-1 h-10 rounded-lg text-sm font-semibold transition-all ${
                      answers[qIndex] === val
                        ? "bg-primary text-primary-foreground shadow-md scale-105"
                        : "bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    }`}
                    data-testid={`button-q${qIndex + 1}-${val}`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!allAnswered || submitting}
          className="w-full rounded-full h-12 text-base font-medium"
          size="lg"
          data-testid="button-submit-assessment"
        >
          {submitting ? "Submitting..." : "Submit Assessment"}
        </Button>
      </div>
    </div>
  );
}
