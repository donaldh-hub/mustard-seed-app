import { useStore } from "@/lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Shield, LogOut, RefreshCw, CalendarDays, Crown, Sparkles, ExternalLink } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import JaeAvatar from "@assets/file_000000006e04620e9931a4040836810b_1771384491714.png";

const STAGE_EMOJI: Record<string, string> = { seed: "🌱", sprout: "🌿", growth: "🌳", bloom: "🌸" };
const HEARTBEAT_LABELS: Record<string, string> = {
  clarity: "Clarity of Vision & Why",
  consistency: "Small Steps + Consistency",
  mindset: "Mindset over Method",
  adaptation: "Feedback & Adaptation",
  courage: "Courageous Action",
};

export default function Profile() {
  const userId = useStore((s) => s.userId);
  const [, setLocation] = useLocation();
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    if (!userId) setLocation("/");
  }, [userId]);

  const { data: user } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => api.getUser(userId!),
    enabled: !!userId,
  });

  const { data: assessment } = useQuery({
    queryKey: ["assessment", userId],
    queryFn: () => api.getAssessment(userId!),
    enabled: !!userId,
  });

  const { data: garden } = useQuery({
    queryKey: ["garden", userId],
    queryFn: () => api.getGardenSummary(userId!),
    enabled: !!userId,
  });

  const { data: plans } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: () => api.getSubscriptionPlans(),
    enabled: showUpgrade,
  });

  const checkoutMut = useMutation({
    mutationFn: (priceId: string) => api.createCheckout(userId!, priceId),
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const portalMut = useMutation({
    mutationFn: () => api.createPortalSession(userId!),
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const handleSignOut = () => {
    localStorage.removeItem("mustard_seed_user_id");
    localStorage.removeItem("assessmentResult");
    window.location.href = "/";
  };

  if (!userId || !user) return null;

  const joinDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Unknown";
  const assessmentDate = assessment?.createdAt ? new Date(assessment.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;
  const heartbeatScores = (assessment?.heartbeatScores as Record<string, number>) || {};

  const badge = user.subscriptionBadge || "Lite";
  const isPremium = user.subscriptionTier === "premium";
  const trialDays = user.trialDaysRemaining;
  const hasStripe = !!user.stripeSubscriptionId;

  return (
    <div className="h-full overflow-y-auto p-6 bg-background">
      <header className="mb-8 flex items-center gap-4">
        <Avatar className="w-16 h-16 border-2 border-white shadow-md">
          <AvatarImage src={JaeAvatar} className="object-cover" />
          <AvatarFallback className="bg-primary/20 text-primary text-xl">
            {(user.name || "T").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-serif font-bold text-foreground" data-testid="text-username">
              {user.name || "Traveler"}
            </h1>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${
                isPremium
                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                  : "bg-gray-100 text-gray-600 border border-gray-200"
              }`}
              data-testid="badge-subscription"
            >
              {isPremium && <Crown className="w-3 h-3" />}
              {badge}
            </span>
          </div>
          <p className="text-muted-foreground text-sm flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" />
            Joined {joinDate}
          </p>
          {trialDays !== null && trialDays > 0 && (
            <p className="text-xs text-amber-600 font-medium mt-0.5" data-testid="text-trial-days">
              {trialDays} day{trialDays !== 1 ? "s" : ""} left on trial
            </p>
          )}
        </div>
      </header>

      <div className="space-y-6 pb-24">
        {!isPremium && (
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-200/60 shadow-sm"
            data-testid="section-upgrade"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-xl">
                <Sparkles className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-amber-900">Unlock Premium</h3>
                <p className="text-xs text-amber-700/80 mt-1">
                  Dual goals, weighted water, heartbeat trends, deep weekly reviews, and monthly recalibration.
                </p>
                <Button
                  size="sm"
                  className="mt-3 bg-amber-600 hover:bg-amber-700 text-white rounded-full text-xs"
                  onClick={() => setShowUpgrade(true)}
                  data-testid="button-upgrade"
                >
                  <Crown className="w-3.5 h-3.5 mr-1" />
                  View Plans
                </Button>
              </div>
            </div>
          </motion.section>
        )}

        {isPremium && hasStripe && (
          <section className="bg-white rounded-2xl p-4 shadow-sm border border-border/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium">Premium Subscription</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-xs rounded-full"
                onClick={() => portalMut.mutate()}
                disabled={portalMut.isPending}
                data-testid="button-manage-subscription"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Manage
              </Button>
            </div>
            {user.planInterval && (
              <p className="text-xs text-muted-foreground mt-1 capitalize">{user.planInterval}ly plan</p>
            )}
          </section>
        )}

        {assessment && (
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-border/40" data-testid="section-assessment">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Assessment Results
            </h2>
            <div className="flex items-center gap-3 mb-4">
              <div className="text-4xl">{STAGE_EMOJI[assessment.stage] || "🌱"}</div>
              <div>
                <p className="font-semibold text-lg text-foreground" data-testid="text-assessment-stage">
                  {assessment.stage.charAt(0).toUpperCase() + assessment.stage.slice(1)} Stage
                </p>
                <p className="text-sm text-muted-foreground" data-testid="text-assessment-score">
                  Score: {assessment.totalScore}/50
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{assessment.motivationalMessage}</p>

            {Object.keys(heartbeatScores).length > 0 && (
              <div className="space-y-2 mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Five Heartbeats</p>
                {Object.entries(heartbeatScores).map(([key, score]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{HEARTBEAT_LABELS[key] || key}</span>
                    <span className={`font-semibold ${key === assessment.weakestHeartbeat ? 'text-orange-500' : 'text-primary'}`}>
                      {score}/5 {key === assessment.weakestHeartbeat ? '← Focus' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {assessmentDate && (
              <p className="text-xs text-muted-foreground">Last taken: {assessmentDate}</p>
            )}
          </section>
        )}

        <section className="bg-white rounded-2xl p-6 shadow-sm border border-border/40">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            My Focus
          </h2>
          <div className="space-y-3">
             <div className="flex items-start gap-3">
               <div className="mt-1 w-2 h-2 rounded-full bg-primary" />
               <div>
                 <p className="font-medium text-foreground">Big Goal</p>
                 <p className="text-sm text-muted-foreground" data-testid="text-goal">{garden?.targeted?.title || user.goals?.[0] || "Not set yet — tell Jae 'Save: my goal is...'"}</p>
               </div>
             </div>
             <div className="flex items-start gap-3">
               <div className="mt-1 w-2 h-2 rounded-full bg-orange-400" />
               <div>
                 <p className="font-medium text-foreground">Main Struggle</p>
                 <p className="text-sm text-muted-foreground" data-testid="text-struggle">{user.struggles?.[0] || "None identified"}</p>
               </div>
             </div>
          </div>
        </section>

        <Button
          onClick={() => setLocation("/assessment")}
          variant="outline"
          className="w-full rounded-xl h-12 border-primary/30 text-primary hover:bg-primary/5"
          data-testid="button-retake-assessment"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retake Assessment
        </Button>

        <section className="bg-white rounded-2xl p-6 shadow-sm border border-border/40 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted/50 rounded-lg">
                <Bell className="w-5 h-5 text-foreground" />
              </div>
              <Label htmlFor="notifications" className="font-medium">Daily Reminders</Label>
            </div>
            <Switch id="notifications" defaultChecked />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted/50 rounded-lg">
                 <Shield className="w-5 h-5 text-foreground" />
              </div>
              <Label htmlFor="privacy" className="font-medium">Private Mode</Label>
            </div>
            <Switch id="privacy" />
          </div>
        </section>

        <Button 
          variant="outline" 
          className="w-full text-destructive hover:bg-destructive/5 hover:text-destructive border-destructive/20 h-12 rounded-xl"
          onClick={handleSignOut}
          data-testid="button-signout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>

      <AnimatePresence>
        {showUpgrade && (
          <UpgradeOverlay
            plans={plans?.plans || []}
            loading={checkoutMut.isPending}
            onSelect={(priceId) => checkoutMut.mutate(priceId)}
            onClose={() => setShowUpgrade(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function UpgradeOverlay({
  plans,
  loading,
  onSelect,
  onClose,
}: {
  plans: { priceId: string; interval: string; amount: number; currency: string }[];
  loading: boolean;
  onSelect: (priceId: string) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 300 }}
        animate={{ y: 0 }}
        exit={{ y: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-t-2xl p-6 space-y-4"
      >
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-100 rounded-full mb-3">
            <Crown className="w-6 h-6 text-amber-600" />
          </div>
          <h3 className="font-serif font-bold text-lg">Mustard Seed Premium</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Unlock the full Five Heartbeats engine
          </p>
        </div>

        <div className="space-y-2 text-sm">
          {[
            "Dual goals (targeted + identity)",
            "Weighted water based on action quality",
            "Heartbeat trend analytics",
            "Deep weekly reviews with analysis",
            "Monthly heartbeat recalibration",
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>{feature}</span>
            </div>
          ))}
        </div>

        {plans.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center">Loading plans...</p>
        ) : (
          <div className="space-y-2">
            {plans
              .sort((a, b) => (a.interval === "month" ? -1 : 1))
              .map((plan) => (
                <Button
                  key={plan.priceId}
                  className="w-full h-14 justify-between rounded-xl"
                  variant={plan.interval === "year" ? "default" : "outline"}
                  disabled={loading}
                  onClick={() => onSelect(plan.priceId)}
                  data-testid={`button-plan-${plan.interval}`}
                >
                  <span className="capitalize font-medium">{plan.interval}ly</span>
                  <span className="font-bold">
                    ${plan.amount.toFixed(2)}/{plan.interval === "month" ? "mo" : "yr"}
                    {plan.interval === "year" && (
                      <span className="text-xs font-normal ml-1 opacity-70">Save 33%</span>
                    )}
                  </span>
                </Button>
              ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full text-center text-sm text-muted-foreground py-2"
          data-testid="button-close-upgrade"
        >
          Maybe later
        </button>
      </motion.div>
    </motion.div>
  );
}
