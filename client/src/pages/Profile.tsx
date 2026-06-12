import { useStore } from "@/lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Shield, LogOut, RefreshCw, CalendarDays, Crown, Sparkles, Loader2, AlertCircle, Moon, Sun, Trash2, ClipboardCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { applyTheme, getStoredTheme } from "@/lib/theme";
import JaeAvatar from "@assets/file_000000006e04620e9931a4040836810b_1771384491714.png";

const STAGE_EMOJI: Record<string, string> = { seed: "🌱", sprout: "🌿", growth: "🌳", bloom: "🌸" };
const HEARTBEAT_LABELS: Record<string, string> = {
  clarity: "Clarity of Vision & Why",
  consistency: "Small Steps + Consistency",
  mindset: "Mindset over Method",
  adaptation: "Feedback & Adaptation",
  courage: "Courageous Action",
};

const ASSESSMENT_REMINDER_OPTIONS = [
  { value: "0", label: "Off" },
  { value: "3", label: "Every 3 months" },
  { value: "6", label: "Every 6 months" },
];

export default function Profile() {
  const userId = useStore((s) => s.userId);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

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

  const signOut = useStore((s) => s.signOut);

  const [notificationsOn, setNotificationsOn] = useState(() => {
    return localStorage.getItem("pref_notifications") !== "false";
  });
  const [privateMode, setPrivateMode] = useState(() => {
    return localStorage.getItem("pref_private_mode") === "true";
  });
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [stripeConfigured, setStripeConfigured] = useState<boolean | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => getStoredTheme());
  const [dataCleared, setDataCleared] = useState(false);

  useEffect(() => {
    api.getStripeConfig().then((cfg) => setStripeConfigured(cfg.configured)).catch(() => setStripeConfigured(false));
  }, []);

  const updateSettingsMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.updateUser(userId!, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user", userId] }),
  });

  const handleThemeChange = (next: "light" | "dark") => {
    setTheme(next);
    applyTheme(next);
    updateSettingsMut.mutate({ themePreference: next });
  };

  const handleClearLocalData = () => {
    const preserve = new Set(["pref_theme"]);
    Object.keys(localStorage)
      .filter((k) => !preserve.has(k))
      .forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
    setDataCleared(true);
    setTimeout(() => setDataCleared(false), 3000);
  };

  const handleUpgrade = async () => {
    if (!userId) return;
    setCheckoutError(null);
    setCheckoutLoading(true);
    try {
      const { url } = await api.createStripeCheckout(userId);
      window.location.href = url;
    } catch (err: any) {
      setCheckoutError(err.message?.includes("not configured")
        ? "Payment processing is not yet available. Please check back soon."
        : (err.message || "Could not start checkout. Please try again."));
      setCheckoutLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await api.authLogout();
    } catch {}
    signOut();
    window.location.href = "/auth";
  };

  if (!userId || !user) return null;

  const joinDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Unknown";
  const assessmentDate = assessment?.createdAt ? new Date(assessment.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;
  const heartbeatScores = (assessment?.heartbeatScores as Record<string, number>) || {};

  const badge = user.subscriptionBadge || "Lite";
  const subscriptionState = user.subscriptionState as string | undefined;
  // Only hide the upgrade CTA for users who have actively paid (not trial).
  // PREMIUM_TRIAL_ACTIVE users haven't paid yet — they should still see the upgrade section.
  const PAID_STATES = ["PREMIUM_ACTIVE", "PREMIUM_GRACE_PERIOD", "CANCELED_PENDING_EXPIRATION", "PAYMENT_FAILED"];
  const isPremium = PAID_STATES.includes(subscriptionState ?? "");
  const trialDays = user.trialDaysRemaining;

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
                 <p className="text-sm text-muted-foreground" data-testid="text-goal">{garden?.targeted?.title || garden?.untargeted?.title || user.goals?.[0] || "Not set yet — tell Jae 'Save: my goal is...'"}</p>
                 {(garden?.targeted?.emotionalWhy || garden?.untargeted?.emotionalWhy) && (
                   <p className="text-xs text-muted-foreground/70 italic mt-0.5" data-testid="text-goal-why">"{garden?.targeted?.emotionalWhy || garden?.untargeted?.emotionalWhy}"</p>
                 )}
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
            <Switch
              id="notifications"
              checked={notificationsOn}
              onCheckedChange={(v) => {
                setNotificationsOn(v);
                localStorage.setItem("pref_notifications", String(v));
              }}
              data-testid="switch-notifications"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted/50 rounded-lg">
                 <Shield className="w-5 h-5 text-foreground" />
              </div>
              <Label htmlFor="privacy" className="font-medium">Private Mode</Label>
            </div>
            <Switch
              id="privacy"
              checked={privateMode}
              onCheckedChange={(v) => {
                setPrivateMode(v);
                localStorage.setItem("pref_private_mode", String(v));
              }}
              data-testid="switch-privacy"
            />
          </div>
        </section>

        <section className="bg-white rounded-2xl p-6 shadow-sm border border-border/40 space-y-6" data-testid="section-notification-settings">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Notification Settings
          </h2>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted/50 rounded-lg">
                <Bell className="w-5 h-5 text-foreground" />
              </div>
              <Label htmlFor="notify-daily-encouragement" className="font-medium">Daily Encouragement</Label>
            </div>
            <Switch
              id="notify-daily-encouragement"
              checked={user.notifyDailyEncouragement !== false}
              onCheckedChange={(v) => updateSettingsMut.mutate({ notifyDailyEncouragement: v })}
              data-testid="switch-notify-daily-encouragement"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted/50 rounded-lg">
                <ClipboardCheck className="w-5 h-5 text-foreground" />
              </div>
              <Label htmlFor="notify-weekly-summary" className="font-medium">Weekly Summary</Label>
            </div>
            <Switch
              id="notify-weekly-summary"
              checked={user.notifyWeeklySummary !== false}
              onCheckedChange={(v) => updateSettingsMut.mutate({ notifyWeeklySummary: v })}
              data-testid="switch-notify-weekly-summary"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted/50 rounded-lg">
                <RefreshCw className="w-5 h-5 text-foreground" />
              </div>
              <Label htmlFor="notify-assessment-reminder" className="font-medium">Assessment Reminder</Label>
            </div>
            <Switch
              id="notify-assessment-reminder"
              checked={user.notifyAssessmentReminder !== false}
              onCheckedChange={(v) => updateSettingsMut.mutate({ notifyAssessmentReminder: v })}
              data-testid="switch-notify-assessment-reminder"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="reassessment-cadence" className="font-medium">Reassessment Cadence</Label>
            <Select
              value={String(user.assessmentReminderCadenceMonths ?? 3)}
              onValueChange={(v) => updateSettingsMut.mutate({ assessmentReminderCadenceMonths: Number(v) })}
            >
              <SelectTrigger id="reassessment-cadence" className="w-40" data-testid="select-reassessment-cadence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSESSMENT_REMINDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="bg-white rounded-2xl p-6 shadow-sm border border-border/40 space-y-6" data-testid="section-appearance">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Appearance
          </h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted/50 rounded-lg">
                {theme === "dark" ? <Moon className="w-5 h-5 text-foreground" /> : <Sun className="w-5 h-5 text-foreground" />}
              </div>
              <Label htmlFor="theme-toggle" className="font-medium">Dark Mode</Label>
            </div>
            <Switch
              id="theme-toggle"
              checked={theme === "dark"}
              onCheckedChange={(v) => handleThemeChange(v ? "dark" : "light")}
              data-testid="switch-theme"
            />
          </div>
        </section>

        <section className="bg-white rounded-2xl p-6 shadow-sm border border-border/40 space-y-4" data-testid="section-data-management">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Data Management
          </h2>
          <Button
            onClick={handleClearLocalData}
            variant="outline"
            className="w-full rounded-xl h-12 justify-start"
            data-testid="button-clear-local-data"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {dataCleared ? "Local data cleared" : "Clear Local Data"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Clears locally stored preferences and dismissed prompts on this device. Your account, goals, and journal entries are not affected.
          </p>
        </section>

        {!isPremium && (
          <section className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-200 shadow-sm" data-testid="section-upgrade">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-xl shrink-0">
                <Sparkles className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-900 text-sm">
                  {trialDays && trialDays > 0 ? `${trialDays} day${trialDays !== 1 ? "s" : ""} left on Premium trial` : "Upgrade to Premium"}
                </p>
                <p className="text-xs text-amber-700/80 mt-0.5 leading-snug">
                  Unlock deep AI coaching, photo memories, and full heartbeat analytics.
                </p>
              </div>
            </div>

            {checkoutError && (
              <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{checkoutError}</p>
              </div>
            )}

            {stripeConfigured === false && !checkoutError && (
              <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">Payment processing is coming soon. Check back shortly.</p>
              </div>
            )}

            {stripeConfigured !== false && (
              <Button
                className="mt-4 w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl h-10 text-sm font-semibold disabled:opacity-60"
                onClick={handleUpgrade}
                disabled={checkoutLoading}
                data-testid="button-upgrade-cta"
              >
                {checkoutLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting checkout…
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade to Premium
                  </>
                )}
              </Button>
            )}
          </section>
        )}

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
    </div>
  );
}
