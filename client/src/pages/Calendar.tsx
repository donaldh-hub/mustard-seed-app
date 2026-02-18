import { useStore } from "@/lib/store";
import { Calendar as CalendarIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function CalendarPage() {
  const userId = useStore((s) => s.userId);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!userId) setLocation("/");
  }, [userId]);

  const { data: assessment, isLoading: assessmentLoading } = useQuery({
    queryKey: ["assessment", userId],
    queryFn: () => api.getAssessment(userId!),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!assessmentLoading && !assessment && userId) {
      setLocation("/assessment");
    }
  }, [assessment, assessmentLoading, userId]);

  const { data: entriesList = [] } = useQuery({
    queryKey: ["entries", userId],
    queryFn: () => api.getEntries(userId!),
    enabled: !!userId,
  });

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const entryDates = new Set(entriesList.map((e: any) => e.date));

  if (!userId) return null;

  return (
    <div className="h-full p-6 bg-background">
      <header className="mb-8">
        <h1 className="text-2xl font-serif font-bold text-foreground">Memory Bank</h1>
        <p className="text-muted-foreground text-sm">Reflecting on your journey.</p>
      </header>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-border/50 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            {today.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h2>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-sm mb-2">
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={`${d}-${i}`} className="text-muted-foreground font-medium text-xs">{d}</div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {days.map(day => {
            const dateKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const hasEntry = entryDates.has(dateKey);

            return (
              <div 
                key={day} 
                className={`aspect-square rounded-full flex items-center justify-center text-sm relative
                  ${day === today.getDate() ? 'bg-primary text-white font-bold shadow-md' : 'text-foreground hover:bg-muted cursor-pointer'}
                `}
              >
                {day}
                {hasEntry && day !== today.getDate() && (
                  <div className="absolute bottom-1 w-1 h-1 rounded-full bg-green-500" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 pb-24">
        <h3 className="font-serif font-semibold text-foreground">Recent Memories</h3>
        {entriesList.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
            <p>No memories recorded yet.</p>
            <p className="text-xs mt-2">Chat with Jae to save moments.</p>
          </div>
        ) : (
          entriesList.map((entry: any) => (
            <div key={entry.id} className="p-4 bg-white rounded-xl border border-border/40 shadow-sm flex gap-4">
               <div className={`w-1 rounded-full shrink-0 ${entry.mood === 'happy' ? 'bg-yellow-400' : entry.mood === 'sad' ? 'bg-blue-400' : 'bg-gray-400'}`} />
               <div>
                 <p className="text-xs text-muted-foreground mb-1">{entry.date}</p>
                 <p className="text-sm line-clamp-2">{entry.summary}</p>
               </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
