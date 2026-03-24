import { useStore } from "@/lib/store";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, ArrowUp, ArrowRight, ArrowDown, Leaf, Droplets, Camera } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

const HEARTBEAT_NAMES: Record<string, string> = {
  clarity: "Clarity of Vision & Why",
  consistency: "Small Steps + Consistency",
  mindset: "Mindset over Method",
  adaptation: "Feedback & Adaptation",
  courage: "Courageous Action",
};

const HEARTBEAT_ORDER = ["clarity", "consistency", "mindset", "adaptation", "courage"];

function isWeeklyReviewEntry(summary: string) {
  return summary.startsWith("Weekly Review");
}

function isPhotoEntry(summary: string) {
  return summary.startsWith("📷");
}

function DirArrow({ dir }: { dir: string }) {
  if (dir === "up") return <ArrowUp className="w-4 h-4 text-green-600" />;
  if (dir === "down") return <ArrowDown className="w-4 h-4 text-red-500" />;
  return <ArrowRight className="w-4 h-4 text-amber-500" />;
}

function DirLabel({ dir }: { dir: string }) {
  if (dir === "up") return <span className="text-green-600 font-medium">Advancement</span>;
  if (dir === "down") return <span className="text-red-500 font-medium">Regression</span>;
  return <span className="text-amber-500 font-medium">Stagnation</span>;
}

export default function CalendarPage() {
  const userId = useStore((s) => s.userId);
  const [, setLocation] = useLocation();
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number>(today.getDate());
  const [expandedEntry, setExpandedEntry] = useState<any>(null);

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

  const { data: photoMemories = [] } = useQuery({
    queryKey: ["photo-memories", userId],
    queryFn: () => api.getPhotoMemories(userId!),
    enabled: !!userId,
  });

  const { data: reviewHistory = [] } = useQuery({
    queryKey: ["weekly-review-history", userId],
    queryFn: () => api.getWeeklyReviewHistory(userId!),
    enabled: !!userId,
  });

  const reviewsByDate = useMemo(() => {
    const map: Record<string, any> = {};
    reviewHistory.forEach((r: any) => {
      if (r.createdAt) {
        const d = new Date(r.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        map[key] = r;
      }
      if (r.cycleStartDate) {
        map[r.cycleStartDate] = r;
      }
    });
    return map;
  }, [reviewHistory]);

  const photosByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    photoMemories.forEach((pm: any) => {
      if (!map[pm.dateKey]) map[pm.dateKey] = [];
      map[pm.dateKey].push(pm);
    });
    return map;
  }, [photoMemories]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfWeek }, (_, i) => i);

  const isToday = (day: number) =>
    viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate();

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const dateKey = (day: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const entriesByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    entriesList.forEach((e: any) => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    );
    return map;
  }, [entriesList]);

  const selectedDateKey = dateKey(selectedDay);
  const selectedEntries = entriesByDate[selectedDateKey] || [];
  const selectedPhotos = photosByDate[selectedDateKey] || [];

  const prevMonth = () => {
    setSelectedDay(1);
    setExpandedEntry(null);
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    setSelectedDay(1);
    setExpandedEntry(null);
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleDayClick = (day: number) => {
    setSelectedDay(day);
    setExpandedEntry(null);
  };

  const monthLabel = new Date(viewYear, viewMonth).toLocaleString("default", { month: "long", year: "numeric" });

  const moodEmoji = (mood: string) => {
    if (mood === "happy") return "😊";
    if (mood === "sad") return "😔";
    return "😐";
  };

  const moodColor = (mood: string) => {
    if (mood === "happy") return "bg-yellow-400";
    if (mood === "sad") return "bg-blue-400";
    return "bg-gray-400";
  };

  if (!userId) return null;

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 pb-28">
        <header className="mb-6">
          <h1 className="text-2xl font-serif font-bold text-foreground" data-testid="text-calendar-title">Memory Bank</h1>
          <p className="text-muted-foreground text-sm">Tap a day to see your memories.</p>
        </header>

        <div className="bg-white rounded-3xl p-5 shadow-sm border border-border/50 mb-5">
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={prevMonth}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              data-testid="button-prev-month"
            >
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <h2 className="font-semibold text-base flex items-center gap-2" data-testid="text-month-label">
              <CalendarIcon className="w-4 h-4 text-primary" />
              {monthLabel}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              data-testid="button-next-month"
            >
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={`${d}-${i}`} className="text-muted-foreground font-medium py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {blanks.map((b) => (
              <div key={`blank-${b}`} className="aspect-square" />
            ))}
            {days.map((day) => {
              const dk = dateKey(day);
              const hasEntry = !!entriesByDate[dk];
              const hasPhoto = !!photosByDate[dk];
              const isTodayDay = isToday(day);
              const isSelected = selectedDay === day;
              const hasReview = !!reviewsByDate[dk];

              const entryCount = (entriesByDate[dk]?.filter((e: any) => !isPhotoEntry(e.summary)).length ?? 0) + (photosByDate[dk]?.length ?? 0);

              return (
                <button
                  key={day}
                  onClick={() => handleDayClick(day)}
                  className={`aspect-square rounded-full flex items-center justify-center text-sm relative transition-all
                    ${isTodayDay && isSelected
                      ? "bg-primary text-white font-bold shadow-md ring-2 ring-primary/30"
                      : isTodayDay
                      ? "bg-primary/20 text-primary font-bold ring-2 ring-primary/40"
                      : isSelected
                      ? "bg-primary text-white font-semibold shadow-sm"
                      : "text-foreground hover:bg-muted"
                    }
                  `}
                  data-testid={`button-day-${day}`}
                >
                  {day}
                  <div className="absolute bottom-0.5 flex gap-0.5 items-center">
                    {(hasEntry || hasPhoto) && !isSelected && (
                      <>
                        <div className={`w-1.5 h-1.5 rounded-full ${hasPhoto ? "bg-blue-500" : hasReview ? "bg-amber-500" : "bg-green-500"}`} />
                        {entryCount > 1 && (
                          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-stone-600 text-white flex items-center justify-center" style={{ fontSize: "7px", fontWeight: 700 }}>
                            {entryCount}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {expandedEntry ? (
            <motion.div
              key="detail"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {expandedEntry._isPhoto ? (
                <PhotoMemoryDetail
                  memory={expandedEntry}
                  onClose={() => setExpandedEntry(null)}
                />
              ) : (
                <MemoryDetail
                  entry={expandedEntry}
                  review={reviewsByDate[expandedEntry.date]}
                  onClose={() => setExpandedEntry(null)}
                />
              )}
            </motion.div>
          ) : (
            <motion.div
              key={`list-${selectedDateKey}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-serif font-semibold text-foreground text-sm" data-testid="text-selected-date">
                  {isCurrentMonth && selectedDay === today.getDate()
                    ? "Today's Memories"
                    : `${new Date(viewYear, viewMonth, selectedDay).toLocaleDateString("default", { weekday: "long", month: "short", day: "numeric" })}`}
                </h3>
                {(selectedEntries.length > 0 || selectedPhotos.length > 0) && (
                  <span className="text-xs text-muted-foreground" data-testid="text-entry-count">
                    {selectedEntries.length + selectedPhotos.length} {(selectedEntries.length + selectedPhotos.length) === 1 ? "memory" : "memories"}
                  </span>
                )}
              </div>

              {selectedPhotos.length > 0 && (
                <div className="space-y-3">
                  {selectedPhotos.map((pm: any) => (
                    <button
                      key={pm.id}
                      onClick={() => setExpandedEntry({ ...pm, _isPhoto: true })}
                      className="w-full text-left bg-white rounded-xl border border-border/40 shadow-sm overflow-hidden hover:shadow-md transition-shadow active:scale-[0.99]"
                      data-testid={`button-photo-memory-${pm.id}`}
                    >
                      <div className="flex gap-3 p-3">
                        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-muted">
                          <img src={pm.photoUrl} alt="Memory" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Camera className="w-3 h-3 text-blue-500" />
                            <span className="text-xs font-medium text-blue-600">Photo Memory</span>
                            {pm.waterAwarded > 0 && (
                              <span className="flex items-center gap-0.5 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full" data-testid={`badge-water-memory-${pm.id}`}>
                                <Droplets className="w-3 h-3" />
                                +{pm.waterAwarded}
                              </span>
                            )}
                          </div>
                          <p className="text-sm line-clamp-2 text-foreground">
                            {pm.waterReason || "Photo uploaded"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(pm.createdAt).toLocaleTimeString("default", { hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 self-center" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedEntries.length === 0 && selectedPhotos.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border" data-testid="text-no-memories">
                  <p className="text-sm">No memories for this day.</p>
                  <p className="text-xs mt-1">Chat with Jae to create moments worth remembering.</p>
                </div>
              ) : (
                selectedEntries.filter((e: any) => !isPhotoEntry(e.summary)).map((entry: any) => {
                  const isReview = isWeeklyReviewEntry(entry.summary) && !!reviewsByDate[entry.date];
                  return (
                    <button
                      key={entry.id}
                      onClick={() => setExpandedEntry(entry)}
                      className="w-full text-left p-4 bg-white rounded-xl border border-border/40 shadow-sm flex gap-3 hover:shadow-md transition-shadow active:scale-[0.99]"
                      data-testid={`button-memory-${entry.id}`}
                    >
                      <div className={`w-1 rounded-full shrink-0 ${isReview ? "bg-amber-500" : moodColor(entry.mood)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {isReview ? (
                            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full" data-testid="badge-weekly-review">
                              Weekly Review
                            </span>
                          ) : (
                            <span className="text-xs" data-testid={`text-mood-${entry.id}`}>{moodEmoji(entry.mood)}</span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleTimeString("default", { hour: "numeric", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-sm line-clamp-2 text-foreground">{entry.summary}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 self-center" />
                    </button>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function PhotoMemoryDetail({
  memory,
  onClose,
}: {
  memory: any;
  onClose: () => void;
}) {
  const analysis = memory.analysisJson as any;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-sm text-primary font-medium hover:underline"
          data-testid="button-back-to-list"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <span className="text-xs text-muted-foreground">
          {new Date(memory.createdAt).toLocaleString("default", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-border/40 shadow-sm overflow-hidden">
        <img
          src={memory.photoUrl}
          alt="Photo memory"
          className="w-full max-h-64 object-cover"
          data-testid="img-photo-memory-detail"
        />

        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-foreground">Photo Memory</span>
            {memory.waterAwarded > 0 && (
              <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full" data-testid="badge-water-detail">
                <Droplets className="w-3 h-3" />
                +{memory.waterAwarded} water
              </span>
            )}
            {memory.waterAwarded === 0 && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                No water
              </span>
            )}
          </div>

          {analysis && (
            <>
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Jae's Feedback</p>
                <p className="text-sm text-foreground leading-relaxed" data-testid="text-jae-feedback">
                  {analysis.next_prompt}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {analysis.tags?.map((tag: string, i: number) => (
                  <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full" data-testid={`tag-${tag}`}>
                    {tag}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-muted/30 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground">Confidence</p>
                  <p className="font-mono font-semibold text-sm" data-testid="text-confidence">
                    {Math.round((analysis.confidence || 0) * 100)}%
                  </p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground">Proof</p>
                  <p className="font-mono font-semibold text-sm" data-testid="text-proof-level">
                    {analysis.proof_level}/3
                  </p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="font-mono font-semibold text-xs" data-testid="text-action-type">
                    {(analysis.action_type || "").replace(/_/g, " ")}
                  </p>
                </div>
              </div>

              {memory.waterReason && (
                <div className="text-xs text-muted-foreground italic" data-testid="text-water-reason">
                  {memory.waterReason}
                </div>
              )}
            </>
          )}

          {!analysis && memory.status === "pending_analysis" && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Jae is still reviewing this photo...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MemoryDetail({
  entry,
  review,
  onClose,
}: {
  entry: any;
  review?: any;
  onClose: () => void;
}) {
  const isReview = isWeeklyReviewEntry(entry.summary);
  const directions = review?.heartbeatDirections as Record<string, string> | undefined;
  const goalSnap = review?.targetedGoalSnapshot as any;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-sm text-primary font-medium hover:underline"
          data-testid="button-back-to-list"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <span className="text-xs text-muted-foreground">
          {new Date(entry.createdAt).toLocaleString("default", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      </div>

      {isReview && review ? (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
            <Leaf className="w-6 h-6 text-amber-600 mx-auto mb-2" />
            <h3 className="font-serif font-semibold text-lg text-foreground" data-testid="text-review-detail-title">Weekly Review</h3>
            <p className="text-xs text-muted-foreground mt-1">Week of {review.cycleStartDate}</p>
          </div>

          <div className="bg-white rounded-xl border border-border/50 p-4 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" data-testid="label-goal-progress">
              Targeted Goal Progress
            </h4>
            {goalSnap?.hasGoal ? (
              <div className="space-y-2">
                <p className="text-sm font-medium" data-testid="text-detail-goal-statement">
                  {goalSnap.goalStatement}
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">Last Week</p>
                    <p className="font-mono font-semibold text-sm" data-testid="text-detail-last-week">
                      {goalSnap.lastWeekValue ?? "—"}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">This Week</p>
                    <p className="font-mono font-semibold text-sm" data-testid="text-detail-this-week">
                      {goalSnap.currentValue ?? "—"}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">Net</p>
                    <p
                      className={`font-mono font-semibold text-sm ${
                        goalSnap.netChange != null && goalSnap.netChange < 0
                          ? "text-green-600"
                          : goalSnap.netChange != null && goalSnap.netChange > 0
                          ? "text-red-500"
                          : ""
                      }`}
                      data-testid="text-detail-net-change"
                    >
                      {goalSnap.netChange != null ? `${goalSnap.netChange > 0 ? "+" : ""}${goalSnap.netChange}` : "—"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic" data-testid="text-detail-no-goal">No targeted goal active.</p>
            )}
          </div>

          {directions && (
            <div className="bg-white rounded-xl border border-border/50 overflow-hidden">
              <div className="px-4 pt-3 pb-1">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" data-testid="label-heartbeat-direction">
                  Heartbeat Direction
                </h4>
              </div>
              <div className="divide-y divide-border/30">
                {HEARTBEAT_ORDER.map((key) => {
                  const dir = directions[key] || "stagnant";
                  return (
                    <div key={key} className="flex items-center justify-between px-4 py-3" data-testid={`detail-heartbeat-${key}`}>
                      <span className="text-sm text-foreground">{HEARTBEAT_NAMES[key]}</span>
                      <div className="flex items-center gap-2">
                        <DirLabel dir={dir} />
                        <DirArrow dir={dir} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {review.collectiveAnalysis && (
            <div className="bg-white rounded-xl border border-border/50 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2" data-testid="label-collective-analysis">
                Collective Analysis
              </h4>
              <p className="text-sm text-foreground leading-relaxed" data-testid="text-detail-collective-analysis">
                {review.collectiveAnalysis}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border/40 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{entry.mood === "happy" ? "😊" : entry.mood === "sad" ? "😔" : "😐"}</span>
            <span className="text-xs text-muted-foreground capitalize">{entry.mood} mood</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed" data-testid="text-memory-full-summary">
            {entry.summary}
          </p>
        </div>
      )}
    </div>
  );
}
