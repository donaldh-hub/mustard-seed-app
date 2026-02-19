import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Layout from "@/components/Layout";
import Welcome from "@/pages/Welcome";
import Assessment from "@/pages/Assessment";
import Home from "@/pages/Home";
import Chat from "@/pages/Chat";
import ProgressPage from "@/pages/Progress";
import CalendarPage from "@/pages/Calendar";
import Profile from "@/pages/Profile";
import WeeklyReview from "@/pages/WeeklyReview";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Welcome} />
        <Route path="/assessment" component={Assessment} />
        <Route path="/home" component={Home} />
        <Route path="/chat" component={Chat} />
        <Route path="/progress" component={ProgressPage} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/profile" component={Profile} />
        <Route path="/weekly-review" component={WeeklyReview} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
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
