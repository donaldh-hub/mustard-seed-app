import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import Layout from "@/components/Layout";
import Auth from "@/pages/Auth";
import LandingPage from "@/pages/LandingPage";
import Welcome from "@/pages/Welcome";
import Orientation from "@/pages/Orientation";
import Assessment from "@/pages/Assessment";
import Home from "@/pages/Home";
import Chat from "@/pages/Chat";
import ProgressPage from "@/pages/Progress";
import CalendarPage from "@/pages/Calendar";
import Profile from "@/pages/Profile";
import WeeklyReview from "@/pages/WeeklyReview";
import GroundingJournal from "@/pages/GroundingJournal";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";

function AuthGate({ children }: { children: React.ReactNode }) {
  const authStatus = useStore((s) => s.authStatus);
  const setUserId = useStore((s) => s.setUserId);
  const setAuthStatus = useStore((s) => s.setAuthStatus);
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    api.authMe()
      .then((user) => {
        setUserId(user.id);
        if (user.isOnboarded) completeOnboarding();
        setAuthStatus("authenticated");
      })
      .catch(() => {
        setAuthStatus("unauthenticated");
        if (location !== "/") {
          setLocation("/auth", { replace: true });
        }
      });
  }, []);

  if (authStatus === "loading") {
    return (
      <div className="h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    return location === "/" ? <LandingPage /> : null;
  }

  return <>{children}</>;
}

function Router() {
  const [location] = useLocation();

  if (location === "/auth" || location.startsWith("/auth?")) {
    return <Auth />;
  }

  return (
    <AuthGate>
      <Layout>
        <Switch>
          <Route path="/" component={Welcome} />
          <Route path="/orientation" component={Orientation} />
          <Route path="/assessment" component={Assessment} />
          <Route path="/home" component={Home} />
          <Route path="/chat" component={Chat} />
          <Route path="/progress" component={ProgressPage} />
          <Route path="/calendar" component={CalendarPage} />
          <Route path="/profile" component={Profile} />
          <Route path="/weekly-review" component={WeeklyReview} />
          <Route path="/journal" component={GroundingJournal} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </AuthGate>
  );
}

function App() {
  if (typeof window !== "undefined" && window.location.search.includes("reset=1")) {
    localStorage.removeItem("mustard_seed_onboarding_completed");
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).finally(() => {
      window.location.href = "/auth";
    });
    return null;
  }
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
