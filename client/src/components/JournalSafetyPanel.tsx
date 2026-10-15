import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertCircle } from "lucide-react";
import { api, type SafetyMessage } from "@/lib/api";
import { getLocalDateStr } from "@/lib/dateUtils";

// After a safety response in the Grounding Journal, the user's next reply
// always gets an answer from Jai, and the journal doesn't move on until it
// has. `isSafetyResolved` is what the parent checks before showing Continue.

export function isSafetyResolved(thread: SafetyMessage[] | undefined): boolean {
  if (!thread || thread.length === 0) return true;
  const lastUser = thread.map((m) => m.from).lastIndexOf("user");
  return lastUser !== -1 && thread.slice(lastUser + 1).some((m) => m.from === "jae");
}

export function JournalSafetyPanel({
  userId,
  entryId,
  tier,
  thread,
  avatar,
  onUpdate,
}: {
  userId: string;
  entryId: string;
  tier: "clear" | "check_in";
  thread: SafetyMessage[];
  avatar: string;
  onUpdate: (next: { safetyThread: SafetyMessage[]; outcome: string; jae: any | null }) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  const resolved = isSafetyResolved(thread);
  // The 988 line stays in view after a clear-risk flag, or whenever the
  // reply didn't make things clear.
  const showResources = tier === "clear" || outcome === "still_unclear" || outcome === "escalated";

  const send = async () => {
    const reply = text.trim();
    if (!reply || sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await api.sendJournalSafetyReply(userId, entryId, reply, getLocalDateStr());
      setOutcome(r.outcome);
      setText("");
      onUpdate({ safetyThread: r.safetyThread, outcome: r.outcome, jae: r.jae });
    } catch {
      setError("That didn't send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="journal-safety-panel">
      {thread.map((m, i) =>
        m.from === "jae" ? (
          <div key={i} className="flex items-start gap-2" data-testid="safety-jai-message">
            <img src={avatar} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow shrink-0" alt="Jai" />
            <p className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white border border-border/50 text-sm text-foreground leading-relaxed">
              {m.text}
            </p>
          </div>
        ) : (
          <div key={i} className="flex justify-end" data-testid="safety-user-message">
            <p className="max-w-[85%] px-4 py-3 rounded-2xl rounded-tr-sm bg-primary text-primary-foreground text-sm leading-relaxed">
              {m.text}
            </p>
          </div>
        ),
      )}

      {sending && (
        <div className="flex items-center gap-2" data-testid="safety-jai-typing">
          <img src={avatar} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow" alt="Jai" />
          <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-white border border-border/50 flex gap-1.5">
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
          </div>
        </div>
      )}

      {showResources && (
        <p className="text-xs text-foreground/80 bg-primary/5 border border-primary/15 rounded-xl px-3 py-2" data-testid="safety-resources">
          988 Suicide &amp; Crisis Lifeline — call or text 988, anytime · Crisis Text Line — text HOME to 741741 · In danger now: 911
        </p>
      )}

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">
          {resolved ? "Want to say more? Jai's still here (optional)" : "Reply to Jai — he'll answer before you move on"}
        </label>
        <Textarea
          placeholder="..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="resize-none rounded-xl min-h-[70px]"
          disabled={sending}
          data-testid="input-safety-reply"
        />
        <Button variant="outline" className="w-full rounded-xl h-11" onClick={send} disabled={!text.trim() || sending} data-testid="button-safety-reply">
          {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Send to Jai
        </Button>
        {error && (
          <div className="flex items-center gap-1.5 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
