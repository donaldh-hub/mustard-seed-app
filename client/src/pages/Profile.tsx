import { useStore } from "@/lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Shield, LogOut, RefreshCw, CalendarDays } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import { useEffect } from "react";
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

  const handleSignOut = () => {
    localStorage.removeItem("mustard_seed_user_id");
    localStorage.removeItem("assessmentResult");
    window.location.href = "/";
  };

  if (!userId || !user) return null;

  const joinDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Unknown";
  const assessmentDate = assessment?.createdAt ? new Date(assessment.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;
  const heartbeatScores = (assessment?.heartbeatScores as Record<string, number>) || {};

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
          <h1 className="text-2xl font-serif font-bold text-foreground" data-testid="text-username">
            {user.name || "Traveler"}
          </h1>
          <p className="text-muted-foreground text-sm flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" />
            Joined {joinDate}
          </p>
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
                 <p className="text-sm text-muted-foreground" data-testid="text-goal">{user.goals?.[0] || "Not set yet — tell Jae 'Save: my goal is...'"}</p>
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
    </div>
  );
}
