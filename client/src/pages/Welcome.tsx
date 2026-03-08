import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import jaiHero from "@assets/ChatGPT_Image_Mar_7,_2026,_09_01_46_PM_1772935512407.png";

export default function Welcome() {
  const [, setLocation] = useLocation();
  const userId = useStore((s) => s.userId);
  const onboardingCompleted = useStore((s) => s.onboardingCompleted);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (onboardingCompleted && userId) {
      setLocation("/home", { replace: true });
      return;
    }
    if (!userId) {
      setChecking(false);
      return;
    }
    api.getAssessment(userId).then((assessment) => {
      if (assessment) {
        useStore.getState().completeOnboarding();
        setLocation("/home", { replace: true });
      } else {
        setLocation("/orientation", { replace: true });
      }
    }).catch(() => {
      setChecking(false);
    });
  }, [userId, onboardingCompleted]);

  if (checking && userId) return null;

  return (
    <div className="h-full flex flex-col items-center justify-between px-6 py-10 text-center bg-gradient-to-b from-stone-100 via-stone-50 to-stone-200">
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="mb-6"
        >
          <img
            src={jaiHero}
            alt="JAI - Your Accountability Partner"
            data-testid="img-jai-hero"
            className="w-56 h-56 sm:w-64 sm:h-64 object-cover object-top rounded-2xl mx-auto"
          />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-3xl sm:text-4xl font-bold text-stone-900 mb-4 tracking-tight"
          data-testid="text-jai-title"
        >
          I'm JAI.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-lg sm:text-xl font-semibold text-stone-700 leading-relaxed mb-6"
          data-testid="text-positioning"
        >
          I'm not here to hype you up.
          <br />
          I'm here to help you grow.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="text-base text-stone-500 leading-relaxed max-w-xs mb-10"
          data-testid="text-supporting"
        >
          You'll answer a few quick questions so I can understand where you are.
          <br />
          From there, we build.
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="w-full max-w-xs pb-4"
      >
        <button
          data-testid="button-begin"
          onClick={() => setLocation("/orientation", { replace: true })}
          className="w-full h-14 rounded-full text-lg font-bold text-stone-900 shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: "linear-gradient(180deg, #F5D060 0%, #E8B828 100%)",
            boxShadow: "0 4px 14px rgba(232, 184, 40, 0.4)",
          }}
        >
          Begin
        </button>
      </motion.div>
    </div>
  );
}
