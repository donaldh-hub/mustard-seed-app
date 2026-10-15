import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Camera, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { useUpload } from "@/hooks/use-upload";
import { getLocalDateStr, getUserTimezone } from "@/lib/dateUtils";
import { readPhotoMeta } from "@/lib/photoMeta";

// Optional photo proof after the user reports a physical action in the
// Grounding Journal. Uses the same loop as Chat: upload → POST
// /messages/photo (vision check → photo memory → Memory Bank → water when a
// goal is active). Skipping it costs nothing.
export function JournalPhotoProof({
  userId,
  invite,
  caption,
  avatar,
}: {
  userId: string;
  invite: string;
  caption: string;
  avatar: string;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, reset } = useUpload();
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [result, setResult] = useState<{ status: string; jai: string; water: number } | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setState("working");
    try {
      const meta = await readPhotoMeta(file);
      const up = await uploadFile(file);
      if (!up) throw new Error("upload failed");
      const r = await api.sendPhoto(userId, {
        photoUrl: up.objectPath, caption, localDate: getLocalDateStr(), uploadAttemptId: up.attemptId,
        source: "gallery", ...meta, userTimezone: getUserTimezone(),
      });
      setResult({
        status: r?.validation?.status ?? "unclear",
        jai: r?.jaeResponse?.text ?? "",
        water: r?.water?.awarded ? 1 : 0,
      });
      setState("done");
      for (const key of ["entries", "photo-memories", "garden", "consistency", "messages", "user"]) {
        qc.invalidateQueries({ queryKey: [key, userId] });
      }
    } catch {
      setState("error");
      reset();
    }
  };

  return (
    <div className="rounded-2xl p-4 bg-white border border-border/40 shadow-sm space-y-3" data-testid="card-photo-proof">
      <div className="flex items-start gap-2">
        <img src={avatar} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow shrink-0" alt="Jai" />
        <p className="text-sm text-foreground leading-relaxed">{invite}</p>
      </div>

      {state === "done" && result ? (
        <div className="space-y-1" data-testid="photo-proof-result">
          <p className="text-sm font-medium text-primary flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Saved to your Memory{result.water > 0 ? " · your seed got water 💧" : ""}
          </p>
          {result.jai && <p className="text-sm text-foreground/80 leading-relaxed">{result.jai}</p>}
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
            data-testid="input-photo-proof"
          />
          <Button variant="outline" className="w-full rounded-xl h-11" disabled={state === "working"} onClick={() => inputRef.current?.click()} data-testid="button-photo-proof">
            {state === "working" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
            {state === "working" ? "Saving your photo…" : "Add a photo (optional)"}
          </Button>
          {state === "error" && <p className="text-xs text-amber-700">That photo didn't upload. You can try again or skip it — nothing is lost.</p>}
        </>
      )}
    </div>
  );
}
