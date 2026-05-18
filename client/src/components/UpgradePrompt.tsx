import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Sparkles, X, Loader2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";

const FEATURE_MESSAGES: Record<string, { title: string; description: string }> = {
  dual_goals: {
    title: "Dual Goals",
    description: "Premium lets you plant both a targeted goal and an identity goal at the same time.",
  },
  heartbeat_trends: {
    title: "Heartbeat Trends",
    description: "Track how your Five Heartbeats shift over time with visual trend analytics.",
  },
  deep_weekly_review: {
    title: "Deep Weekly Reviews",
    description: "Get detailed AI analysis of your weekly progress with actionable heartbeat insights.",
  },
  monthly_recalibration: {
    title: "Monthly Recalibration",
    description: "Recalibrate your heartbeat scores monthly to track real growth over time.",
  },
  weighted_water: {
    title: "Weighted Water",
    description: "Earn more water based on the difficulty and courage of your actions.",
  },
};

const PREMIUM_FEATURES = [
  "Dual goals (targeted + identity)",
  "Weighted water based on action quality",
  "Heartbeat trend analytics",
  "Deep weekly reviews with analysis",
  "Monthly heartbeat recalibration",
];

export function UpgradePrompt({
  feature,
  show,
  onClose,
}: {
  feature: string;
  show: boolean;
  onClose: () => void;
}) {
  const userId = useStore((s) => s.userId);
  const featureInfo = FEATURE_MESSAGES[feature] || { title: "Premium Feature", description: "This feature is available with Premium." };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeConfigured, setStripeConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    if (show) {
      setError(null);
      api.getStripeConfig().then((cfg) => setStripeConfigured(cfg.configured)).catch(() => setStripeConfigured(false));
    }
  }, [show]);

  const handleUpgrade = async () => {
    if (!userId) return;
    setError(null);
    setLoading(true);
    try {
      const { url } = await api.createStripeCheckout(userId);
      window.location.href = url;
    } catch (err: any) {
      if (err.message?.includes("not configured")) {
        setError("Payment processing is not yet available. Please check back soon.");
      } else {
        setError(err.message || "Could not start checkout. Please try again.");
      }
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-2xl p-5 space-y-4"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 rounded-xl">
                  <Crown className="w-5 h-5 text-amber-600" />
                </div>
                <h3 className="font-semibold text-sm">{featureInfo.title}</h3>
              </div>
              <button onClick={onClose} data-testid="button-close-upgrade-prompt">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground">{featureInfo.description}</p>

            <div className="space-y-1.5">
              {PREMIUM_FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            {stripeConfigured === false && !error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">Payment processing is not yet configured. Please check back soon.</p>
              </div>
            )}

            {stripeConfigured !== false && (
              <button
                onClick={handleUpgrade}
                disabled={loading}
                data-testid="button-upgrade-to-premium"
                className="w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting checkout…
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4" />
                    Upgrade to Premium
                  </>
                )}
              </button>
            )}

            <button onClick={onClose} className="w-full text-center text-sm text-muted-foreground py-1" data-testid="button-close-upgrade-prompt-text">
              Maybe later
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
