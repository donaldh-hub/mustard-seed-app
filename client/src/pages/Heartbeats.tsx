import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, MessageCircle, ClipboardCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { HeartbeatsLoop } from "@/components/HeartbeatsLoop";
import {
  HEARTBEAT_ORDER,
  HEARTBEAT_NAMES,
  HEARTBEAT_COPY,
  HEARTBEAT_SCORE_MAX,
  heartbeatStanding,
  type HeartbeatKey,
} from "@shared/heartbeats";

// The Five Heartbeats loop, with the user's saved assessment scores.
export default function Heartbeats() {
  const userId = useStore((s) => s.userId);
  const [, setLocation] = useLocation();
  const [selected, setSelected] = useState<HeartbeatKey | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  // Jai's opener is posted (with the saved scores, server-side) before Chat
  // opens, so it's the first thing they see there.
  const talkWithJai = async (key: HeartbeatKey) => {
    if (!userId || opening) return;
    setOpening(true);
    setOpenError(null);
    try {
      await api.openHeartbeatChat(userId, key);
      setLocation("/chat");
    } catch {
      setOpenError("Couldn't reach Jai just now. Please try again.");
      setOpening(false);
    }
  };

  const { data: assessment, isLoading } = useQuery({
    queryKey: ["assessment", userId],
    queryFn: () => api.getAssessment(userId!),
    enabled: !!userId,
  });

  const scores: Record<string, number> | null =
    assessment?.heartbeatScores && Object.keys(assessment.heartbeatScores).length > 0 ? assessment.heartbeatScores : null;
  const standing = heartbeatStanding(scores, assessment?.weakestHeartbeat);
  const nameList = (keys: HeartbeatKey[]) => keys.map((k) => HEARTBEAT_NAMES[k]).join(" and ");

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-lg mx-auto px-4 py-6 pb-24 space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/home")}
            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-muted/50"
            aria-label="Back to Home"
            data-testid="button-heartbeats-back"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Mustard Seed</p>
            <h1 className="font-serif text-xl font-bold text-foreground">The Five Heartbeats</h1>
          </div>
        </div>

        {!isLoading && !scores && (
          <div className="rounded-2xl p-4 bg-primary/5 border border-primary/20 space-y-3" data-testid="heartbeats-no-assessment">
            <p className="text-sm text-foreground leading-relaxed">
              Take the Five Heartbeats assessment to see your own scores on the loop, your strongest Heartbeat, and the one to focus on.
            </p>
            <Button className="w-full rounded-xl min-h-11" onClick={() => setLocation("/assessment")} data-testid="button-take-assessment">
              <ClipboardCheck className="w-4 h-4 mr-2" />
              Take the assessment
            </Button>
          </div>
        )}

        {scores && (standing.strongest.length > 0 || standing.focus) && (
          <p className="text-sm text-muted-foreground leading-relaxed" data-testid="heartbeats-summary">
            {standing.strongest.length > 0 && <>Strongest: <span className="font-medium text-foreground">{nameList(standing.strongest)}</span>. </>}
            {standing.strongest.length === 0 && <>All five of your Heartbeats scored the same. </>}
            {standing.focus && <>Focus: <span className="font-medium text-foreground">{HEARTBEAT_NAMES[standing.focus]}</span>.</>}
          </p>
        )}

        <HeartbeatsLoop scores={scores} standing={standing} selected={selected} onSelect={setSelected} />

        <section aria-live="polite" className="bg-white dark:bg-card rounded-2xl p-5 border border-border/40 shadow-sm" data-testid="heartbeat-panel">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Tap a Heartbeat to see what it means and how it feeds the next one.</p>
          ) : (
            <HeartbeatDetail
              heartbeat={selected}
              score={scores?.[selected]}
              hasAssessment={!!scores}
              isStrongest={standing.strongest.includes(selected)}
              isFocus={standing.focus === selected}
              tiedWithFocus={standing.focus === selected ? standing.tiedWithFocus : []}
              onTalk={() => talkWithJai(selected)}
              opening={opening}
              error={openError}
              onAssess={() => setLocation("/assessment")}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function HeartbeatDetail({
  heartbeat, score, hasAssessment, isStrongest, isFocus, tiedWithFocus, onTalk, onAssess, opening, error,
}: {
  opening: boolean;
  error: string | null;
  heartbeat: HeartbeatKey;
  score: number | undefined;
  hasAssessment: boolean;
  isStrongest: boolean;
  isFocus: boolean;
  tiedWithFocus: HeartbeatKey[];
  onTalk: () => void;
  onAssess: () => void;
}) {
  const n = HEARTBEAT_ORDER.indexOf(heartbeat) + 1;
  const next = HEARTBEAT_ORDER[n % HEARTBEAT_ORDER.length];
  const copy = HEARTBEAT_COPY[heartbeat];
  return (
    <div className="space-y-3" data-testid={`heartbeat-detail-${heartbeat}`}>
      <div>
        <p className="text-xs font-semibold text-primary uppercase tracking-wider">Heartbeat {n}</p>
        <h2 className="font-serif text-lg font-bold text-foreground" data-testid="heartbeat-detail-name">{HEARTBEAT_NAMES[heartbeat]}</h2>
      </div>
      <p className="text-sm text-foreground leading-relaxed" data-testid="heartbeat-detail-meaning">{copy.meaning}</p>
      <div>
        <p className="text-xs text-muted-foreground font-medium">Feeds Heartbeat {(n % HEARTBEAT_ORDER.length) + 1}, {HEARTBEAT_NAMES[next]}</p>
        <p className="text-sm text-foreground leading-relaxed">{copy.feedsNext}</p>
      </div>
      <div className="rounded-xl px-3 py-2 bg-muted/40" data-testid="heartbeat-detail-score">
        {typeof score === "number" ? (
          <p className="text-sm text-foreground">
            Your score: <span className="font-semibold">{score.toFixed(1)} out of {HEARTBEAT_SCORE_MAX}</span>
            {isStrongest && <span className="ml-1 text-primary font-medium">· your strongest</span>}
            {isFocus && <span className="ml-1 text-orange-600 font-medium">· your focus</span>}
            {tiedWithFocus.length > 0 && (
              <span className="block text-xs text-muted-foreground mt-1">
                Tied with {tiedWithFocus.map((k) => HEARTBEAT_NAMES[k]).join(" and ")}.
              </span>
            )}
          </p>
        ) : hasAssessment ? (
          <p className="text-sm text-muted-foreground">No score saved for this Heartbeat yet.</p>
        ) : (
          <button className="text-sm text-primary underline min-h-11" onClick={onAssess} data-testid="button-panel-take-assessment">
            Take the assessment to see your score
          </button>
        )}
      </div>
      <Button className="w-full rounded-xl min-h-11" onClick={onTalk} disabled={opening} data-testid="button-talk-jai-heartbeat">
        {opening ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
        Talk with Jai about this heartbeat
      </Button>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}
