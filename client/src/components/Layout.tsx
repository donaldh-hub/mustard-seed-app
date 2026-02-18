import { Link, useLocation } from "wouter";
import { Home, TreeDeciduous, Calendar, User, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

  const isTabBarVisible = ["/home", "/chat", "/progress", "/calendar", "/profile"].includes(location);

  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-md h-screen flex flex-col bg-card shadow-2xl overflow-hidden relative border-x border-border/40">
        <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
          {children}
        </main>

        {isTabBarVisible && (
          <nav className="h-20 bg-white/80 backdrop-blur-md border-t border-border flex items-center justify-around px-6 pb-2 z-50 absolute bottom-0 w-full">
            <button onClick={() => setLocation("/home")} className={cn("flex flex-col items-center gap-1 transition-colors", location === "/home" ? "text-primary" : "text-muted-foreground hover:text-primary/70")} data-testid="nav-home">
              <Home className="w-6 h-6" strokeWidth={location === "/home" ? 2.5 : 2} />
              <span className="text-[10px] font-medium">Home</span>
            </button>
            <button onClick={() => setLocation("/progress")} className={cn("flex flex-col items-center gap-1 transition-colors", location === "/progress" ? "text-primary" : "text-muted-foreground hover:text-primary/70")} data-testid="nav-progress">
              <TreeDeciduous className="w-6 h-6" strokeWidth={location === "/progress" ? 2.5 : 2} />
              <span className="text-[10px] font-medium">Growth</span>
            </button>
            <button onClick={() => setLocation("/chat")} className={cn("-mt-8 p-3 rounded-full shadow-lg border-4 border-white cursor-pointer hover:scale-105 transition-transform", location === "/chat" ? "bg-primary text-primary-foreground" : "bg-primary/90 text-primary-foreground")} data-testid="nav-chat">
              <MessageCircle className="w-6 h-6" />
            </button>
            <button onClick={() => setLocation("/calendar")} className={cn("flex flex-col items-center gap-1 transition-colors", location === "/calendar" ? "text-primary" : "text-muted-foreground hover:text-primary/70")} data-testid="nav-memory">
              <Calendar className="w-6 h-6" strokeWidth={location === "/calendar" ? 2.5 : 2} />
              <span className="text-[10px] font-medium">Memory</span>
            </button>
            <button onClick={() => setLocation("/profile")} className={cn("flex flex-col items-center gap-1 transition-colors", location === "/profile" ? "text-primary" : "text-muted-foreground hover:text-primary/70")} data-testid="nav-profile">
              <User className="w-6 h-6" strokeWidth={location === "/profile" ? 2.5 : 2} />
              <span className="text-[10px] font-medium">Profile</span>
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
