import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

// Shared player for local video files paired with separately-recorded
// narration audio clips. Originally built for the 7-Day Rebuild; also used
// by the 3-Day Grounding Journal so both guided experiences look and feel
// like the same product.
//
// Real animation files are silent — narration lives as separate mp3 clips.
// "timed" sync fires each clip when the video's playhead crosses its scripted
// start time; "sequential" (no timing map exists) just chains clips back to
// back alongside the video's own pacing. If narration outlasts the video
// (a couple of days self-flag this in their own scripts), the video holds its
// last frame while remaining clips keep playing to completion.

export interface SlideTiming {
  slideNumber: number;
  startSec: number;
  durationSec: number;
  onScreenText: string;
  narrationText: string;
}

export interface AudioSync {
  mode: "timed" | "sequential";
  clipCount: number;
  clipUrl: (n: number) => string;
  slides?: SlideTiming[];
  timingMismatch?: { narrationSec: number; videoSec: number };
}

export function SyncedVideoPlayer({
  url,
  audioSync,
  hasEmbeddedAudio,
  onReady,
  comingSoonText = "Video coming soon.",
  skipLabel = "Skip ahead",
}: {
  url: string;
  audioSync?: AudioSync;
  // True for videos whose file has narration muxed directly in (extended /
  // repaired re-exports) — the video plays with sound instead of silently
  // alongside a separate clip sequence.
  hasEmbeddedAudio?: boolean;
  onReady: () => void;
  comingSoonText?: string;
  skipLabel?: string;
}) {
  const isPlaceholder = url.startsWith("PLACEHOLDER");
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [started, setStarted] = useState(false);
  const playedRef = useRef<Set<number>>(new Set());

  function playClip(n: number) {
    if (!audioSync || !audioRef.current || playedRef.current.has(n)) return;
    playedRef.current.add(n);
    audioRef.current.src = audioSync.clipUrl(n);
    audioRef.current.play().catch(() => {});
  }

  function handleStart() {
    setStarted(true);
    videoRef.current?.play().catch(() => {});
    if (audioSync) playClip(1);
  }

  function handleTimeUpdate() {
    if (!audioSync || audioSync.mode !== "timed" || !audioSync.slides) return;
    const t = videoRef.current?.currentTime ?? 0;
    for (const slide of audioSync.slides) {
      if (t >= slide.startSec && !playedRef.current.has(slide.slideNumber)) {
        playClip(slide.slideNumber);
        break;
      }
    }
  }

  function handleAudioEnded() {
    if (!audioSync) return;
    const nextClip = playedRef.current.size + 1;
    if (nextClip > audioSync.clipCount) return;
    // Sequential mode always chains immediately. Timed mode only chains here
    // once the video itself has stopped advancing (ended, or narration is
    // known to outlast it) — otherwise handleTimeUpdate drives the pacing.
    const videoDone = videoRef.current?.ended ?? false;
    if (audioSync.mode === "sequential" || videoDone || audioSync.timingMismatch) {
      playClip(nextClip);
    }
  }

  if (isPlaceholder) {
    return (
      <div className="w-full aspect-video bg-[#1a3a2a] rounded-2xl flex flex-col items-center justify-center gap-4 text-white">
        <Play className="w-12 h-12 text-[#c8a84b] opacity-80" />
        <p className="text-sm text-stone-300 text-center px-6">{comingSoonText}</p>
        <Button
          variant="outline"
          className="text-white border-white/30 hover:bg-white/10 mt-2"
          onClick={onReady}
        >
          {skipLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-lg relative bg-black">
      <video
        ref={videoRef}
        src={url}
        muted={!hasEmbeddedAudio}
        playsInline
        controls={started}
        className="w-full h-full object-contain"
        onTimeUpdate={handleTimeUpdate}
      />
      {audioSync && <audio ref={audioRef} onEnded={handleAudioEnded} />}
      {!started && (
        <button
          onClick={handleStart}
          className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/30 transition-colors text-white"
          aria-label="Play video"
        >
          <span className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <Play className="w-8 h-8 ml-1" fill="currentColor" />
          </span>
        </button>
      )}
    </div>
  );
}
