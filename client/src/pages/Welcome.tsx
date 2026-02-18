import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Sprout } from "lucide-react";
import { useStore } from "@/lib/store";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Welcome() {
  const [, setLocation] = useLocation();
  const userId = useStore((s) => s.userId);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!userId) {
      setChecking(false);
      return;
    }
    api.getAssessment(userId).then((assessment) => {
      if (assessment) {
        setLocation("/home");
      } else {
        setLocation("/assessment");
      }
    }).catch(() => {
      setChecking(false);
    });
  }, [userId]);

  if (checking && userId) return null;

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-green-50 to-background">
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="mb-8 p-6 bg-primary/10 rounded-full"
      >
        <Sprout className="w-16 h-16 text-primary" strokeWidth={1.5} />
      </motion.div>

      <motion.h1 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-4xl font-serif text-foreground mb-2"
      >
        Mustard Seed
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-primary font-medium text-lg mb-6"
        data-testid="text-tagline"
      >
        Growth starts small.
      </motion.p>

      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-muted-foreground text-base mb-12 max-w-xs leading-relaxed"
      >
        Track growth. Stay accountable. Celebrate small wins. Your digital accountability partner for lasting change.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="w-full max-w-xs space-y-4"
      >
        <Button 
          data-testid="button-begin"
          size="lg" 
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-full h-14 text-lg shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]"
          onClick={() => setLocation("/assessment")}
        >
          Begin Journey
        </Button>

        <p className="text-xs text-muted-foreground/70 italic">
          Every journey starts with a single seed.
        </p>
      </motion.div>
    </div>
  );
}
