import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowRight, Check } from "lucide-react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";

const questions = [
  {
    id: "name",
    question: "First, what should I call you?",
    type: "text",
    placeholder: "Your name...",
  },
  {
    id: "goal",
    question: "What is the one big thing you want to grow this season?",
    type: "text",
    placeholder: "e.g., Write a book, Run a marathon...",
  },
  {
    id: "struggle",
    question: "What usually gets in the way?",
    type: "options",
    options: ["Procrastination", "Fear of failure", "Distraction", "Lack of time"],
  },
  {
    id: "commitment",
    question: "How committed are you right now?",
    type: "options",
    options: ["Curious 🌱", "Serious 🌿", "All in 🌳"],
  }
];

export default function Assessment() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [, setLocation] = useLocation();
  const setUserId = useStore((s) => s.setUserId);
  const [saving, setSaving] = useState(false);

  const currentQ = questions[step];

  const handleNext = async (value: any) => {
    const newAnswers = { ...answers, [currentQ.id]: value };
    setAnswers(newAnswers);

    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      setSaving(true);
      try {
        const commitMap: Record<string, string> = { "Curious 🌱": "casual", "Serious 🌿": "serious", "All in 🌳": "intense" };
        const user = await api.createUser({
          name: newAnswers.name,
          goals: [newAnswers.goal],
          struggles: [newAnswers.struggle],
          commitmentLevel: commitMap[newAnswers.commitment] || "serious",
          isOnboarded: 1,
        });
        setUserId(user.id);
        setLocation("/home");
      } catch (e) {
        console.error(e);
        setSaving(false);
      }
    }
  };

  return (
    <div className="h-full flex flex-col p-8 bg-background relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-muted">
        <motion.div 
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${((step + 1) / questions.length) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-3xl font-serif text-foreground mb-8 leading-tight">
              {currentQ.question}
            </h2>

            {currentQ.type === "text" && (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const val = (e.currentTarget.elements.namedItem("input") as HTMLInputElement).value;
                  if (val) handleNext(val);
                }}
              >
                <input 
                  name="input"
                  autoFocus
                  className="w-full bg-transparent border-b-2 border-primary/30 text-2xl py-2 focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50 font-medium"
                  placeholder={currentQ.placeholder}
                  autoComplete="off"
                  data-testid={`input-${currentQ.id}`}
                />
                <Button type="submit" className="mt-8 w-full rounded-full" size="lg" disabled={saving} data-testid="button-next">
                  {saving ? "Saving..." : "Next"} <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </form>
            )}

            {currentQ.type === "options" && (
              <div className="space-y-3">
                {currentQ.options?.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleNext(opt)}
                    disabled={saving}
                    data-testid={`option-${opt}`}
                    className="w-full p-4 text-left rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all group flex items-center justify-between"
                  >
                    <span className="text-lg font-medium">{opt}</span>
                    <Check className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
