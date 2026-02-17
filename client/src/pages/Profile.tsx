import { useStore } from "@/lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { User, Bell, Shield, LogOut } from "lucide-react";

export default function Profile() {
  const { profile } = useStore();

  return (
    <div className="h-full p-6 bg-background">
      <header className="mb-8 flex items-center gap-4">
        <Avatar className="w-16 h-16 border-2 border-white shadow-md">
          <AvatarImage src="https://github.com/shadcn.png" />
          <AvatarFallback className="bg-primary/20 text-primary text-xl">
            {profile.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">
            {profile.name || "Traveler"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {profile.commitmentLevel === 'serious' ? 'Serious Commitment 🌿' : 'Just Exploring 🌱'}
          </p>
        </div>
      </header>

      <div className="space-y-6">
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-border/40">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            My Focus
          </h2>
          <div className="space-y-3">
             <div className="flex items-start gap-3">
               <div className="mt-1 w-2 h-2 rounded-full bg-primary" />
               <div>
                 <p className="font-medium text-foreground">Big Goal</p>
                 <p className="text-sm text-muted-foreground">{profile.goals[0] || "Not set yet"}</p>
               </div>
             </div>
             <div className="flex items-start gap-3">
               <div className="mt-1 w-2 h-2 rounded-full bg-orange-400" />
               <div>
                 <p className="font-medium text-foreground">Main Struggle</p>
                 <p className="text-sm text-muted-foreground">{profile.struggles[0] || "None identified"}</p>
               </div>
             </div>
          </div>
        </section>

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

        <Button variant="outline" className="w-full text-destructive hover:bg-destructive/5 hover:text-destructive border-destructive/20 h-12 rounded-xl">
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
