import { useStore } from "@/lib/store";
import { Calendar as CalendarIcon } from "lucide-react";

export default function CalendarPage() {
  const { entries } = useStore();
  const today = new Date();
  
  // Generate a mock calendar view for the current month
  // Just a visual representation for the prototype
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

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
          {['S','M','T','W','T','F','S'].map(d => (
            <div key={d} className="text-muted-foreground font-medium text-xs">{d}</div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {/* Padding for start of month - skipped for simple prototype */}
          {days.map(day => {
            // Check if we have an entry for this day (mock check)
             // In a real app, we'd match the date string format properly
             const dateKey = `2024-02-${day.toString().padStart(2, '0')}`; // Mock key
             const hasEntry = entries[dateKey] || (day % 3 === 0 && day < today.getDate()); // Mock data for visual population

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

      <div className="space-y-4">
        <h3 className="font-serif font-semibold text-foreground">Recent Memories</h3>
        {Object.entries(entries).length === 0 ? (
          <div className="text-center p-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
            <p>No memories recorded yet.</p>
            <p className="text-xs mt-2">Chat with Jae to save moments.</p>
          </div>
        ) : (
          Object.entries(entries).map(([date, entry]) => (
            <div key={date} className="p-4 bg-white rounded-xl border border-border/40 shadow-sm flex gap-4">
               <div className={`w-1 rounded-full ${entry.mood === 'happy' ? 'bg-yellow-400' : 'bg-gray-400'}`} />
               <div>
                 <p className="text-xs text-muted-foreground mb-1">{date}</p>
                 <p className="text-sm line-clamp-2">{entry.summary}</p>
               </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
