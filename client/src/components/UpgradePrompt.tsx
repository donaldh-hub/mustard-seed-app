import { motion, AnimatePresence } from "framer-motion";
import { Crown, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

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

  const { data: plans } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: () => api.getSubscriptionPlans(),
    enabled: show,
  });

  const checkoutMut = useMutation({
    mutationFn: (priceId: string) => api.createCheckout(userId!, priceId),
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

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

            {plans?.plans?.length > 0 && (
              <div className="space-y-2">
                {plans.plans
                  .sort((a: any, b: any) => (a.interval === "month" ? -1 : 1))
                  .map((plan: any) => (
                    <Button
                      key={plan.priceId}
                      className="w-full h-12 justify-between rounded-xl"
                      variant={plan.interval === "year" ? "default" : "outline"}
                      disabled={checkoutMut.isPending}
                      onClick={() => checkoutMut.mutate(plan.priceId)}
                      data-testid={`button-upgrade-${plan.interval}`}
                    >
                      <span className="capitalize">{plan.interval}ly</span>
                      <span className="font-bold">${plan.amount.toFixed(2)}/{plan.interval === "month" ? "mo" : "yr"}</span>
                    </Button>
                  ))}
              </div>
            )}

            <button onClick={onClose} className="w-full text-center text-sm text-muted-foreground py-1">
              Not now
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
