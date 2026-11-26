// Memory as a short story of the day, built when Memory is shown. Stored
// records are never merged or deleted (some of them count water); this only
// decides how they read.
//
// - One card per journal session, titled "Day 2 · Evening", with up to three
//   short lines in the user's own words: what happened, what got in the way
//   or helped, and the step set. Tap shows everything they wrote and Jai's
//   reply.
// - Small chips for single moments, one per action: Goal planted (with its
//   first step), Water earned, Kept your word.
// - The day's meaningful chat lines merge into one "From chat" card.
// - Titles are never Jai's labels; swearing stays in the full text only.

export interface MemoryCard {
  id: string;
  date: string;
  kind: "journal" | "chat" | "chip" | "raw";
  icon?: string;
  title: string;
  lines: string[];
  full: { label: string; text: string }[];
  at: number;
  entryId?: string; // "raw" cards (weekly reviews, photos) keep their entry
}

type EntryLike = { id: string; date: string; summary: string; mood: string; createdAt?: Date | string | null };
type JournalLike = {
  id: string; dayNumber: number; session: string; prompts: unknown; createdAt?: Date | string | null;
  jaeReflection?: string | null; jaeFollowUpQuestion?: string | null; userFollowUpResponse?: string | null;
  jaeFollowUpReply?: string | null; nextStep?: string | null; possibleFirstSeed?: string | null;
};

const STEP_CHECK = /^Last night's step:/;
const SESSION_LABEL: Record<string, string> = { intention: "Your intention", morning: "Morning", evening: "Evening", grounding_statement: "Grounding Statement" };

// One short line in their exact words (swearing kept: Speak Freely). A whole
// answer up to 180 characters stays whole; longer ones keep whole sentences,
// cut at a clause or word boundary only as a last resort (never "…").
export function shortLine(text: string, max = 160): string {
  let t = (text ?? "").replace(/\s{2,}/g, " ").trim();
  if (t.length <= 180) return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
  // Sentences end at . ! ? followed by a space (so "growth...i almost got
  // fired" stays whole); take as many whole sentences as fit.
  const parts = t.split(/(?<=[.!?])\s+/);
  let kept = parts[0] ?? "";
  for (const p of parts.slice(1)) {
    if ((kept + " " + p).length > max) break;
    kept = `${kept} ${p}`;
  }
  t = kept.trim();
  if (t.length > max) {
    const cut = t.slice(0, max);
    const comma = cut.lastIndexOf(",");
    t = comma > max * 0.5 ? cut.slice(0, comma) : cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : max);
  }
  t = t.replace(/[\s,;:-]+$/, "");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}

const time = (d?: Date | string | null) => new Date(d ?? 0).getTime();

export function buildMemoryCards(entries: EntryLike[], journal: JournalLike[]): MemoryCard[] {
  const cards: MemoryCard[] = [];
  const byDate = new Map<string, EntryLike[]>();
  for (const e of entries) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  const seenSessions = new Set<string>();
  for (const [date, list] of byDate) {
    const chat: EntryLike[] = [];
    const planted = list.find((e) => /^Goal planted: /.test(e.summary));
    const firstStep = list.find((e) => /^First step for your goal/.test(e.summary));
    for (const e of list) {
      const s = e.summary ?? "";
      const j = s.match(/^Grounding Journal — Day (\d+) (Morning|Evening|Grounding Statement)/);
      if (j) {
        const session = j[2] === "Morning" ? "morning" : j[2] === "Evening" ? "evening" : "grounding_statement";
        // One card per session: Jai's follow-up reply and any duplicate copy
        // fold into the session card (its full view shows the reply).
        const key = `${j[1]}:${session}`;
        if (seenSessions.has(key)) continue;
        seenSessions.add(key);
        const row = journal.find((r) => r.dayNumber === Number(j[1]) && r.session === session);
        cards.push(journalCard(date, Number(j[1]), session, row, e));
        continue;
      }
      if (/^Kept your word/.test(s)) {
        cards.push({ id: e.id, date, kind: "chip", icon: "✓", title: `Kept your word${s.match(/\(Day \d+\)/)?.[0] ? ` ${s.match(/\(Day \d+\)/)![0]}` : ""}`, lines: [], full: [{ label: "", text: s }], at: time(e.createdAt) });
        continue;
      }
      if (e === planted) {
        const step = firstStep?.summary.replace(/^First step for your goal \([^)]*\):\s*/, "");
        cards.push({ id: e.id, date, kind: "chip", icon: "🌱", title: s, lines: step ? [`First step: ${shortLine(step)}`] : [], full: [{ label: "", text: s }, ...(step ? [{ label: "First step", text: step }] : [])], at: time(e.createdAt) });
        continue;
      }
      if (e === firstStep && planted) continue; // folded into the planted chip
      if (/^Weekly Review/.test(s) || /^📷/.test(s)) {
        cards.push({ id: e.id, date, kind: "raw", title: s, lines: [], full: [], at: time(e.createdAt), entryId: e.id });
        continue;
      }
      if (e.mood === "happy") {
        cards.push({ id: e.id, date, kind: "chip", icon: "💧", title: shortLine(s, 80) || "Water earned", lines: [], full: [{ label: "", text: s }], at: time(e.createdAt) });
        continue;
      }
      chat.push(e);
    }
    if (chat.length) {
      const sorted = chat.sort((a, b) => time(a.createdAt) - time(b.createdAt));
      cards.push({
        id: `chat-${date}`,
        date,
        kind: "chat",
        title: "From chat",
        lines: sorted.slice(-3).map((e) => shortLine(e.summary.replace(/^Step from a brainstorm with Jai:\s*/, "Step: "))).filter(Boolean),
        full: sorted.map((e) => ({ label: "", text: e.summary })),
        at: time(sorted[sorted.length - 1].createdAt),
      });
    }
  }
  return cards.sort((a, b) => b.at - a.at);
}

function journalCard(date: string, day: number, session: string, row: JournalLike | undefined, mirror: EntryLike): MemoryCard {
  const prompts = ((row?.prompts as { prompt: string; response: string }[]) ?? []).filter((p) => !STEP_CHECK.test(p.prompt ?? ""));
  const answers = prompts.map((p) => p.response ?? "").filter((a) => a.trim());
  const step = row?.nextStep || mirror.summary.split(" · Your small step: ")[1] || "";
  const lines = [
    ...answers.slice(0, step || session === "grounding_statement" ? 2 : 3).map((a) => shortLine(a)),
    step ? `Step: ${shortLine(step.replace(/^(tomorrow|tonight),\s*/i, (m) => m))}` : "",
    session === "grounding_statement" && row?.possibleFirstSeed ? `First seed: ${shortLine(row.possibleFirstSeed)}` : "",
  ].filter(Boolean).slice(0, 3);
  const full = [
    ...prompts.map((p) => ({ label: p.prompt, text: p.response })),
    ...(row?.jaeReflection ? [{ label: "Jai", text: row.jaeReflection }] : []),
    ...(row?.jaeFollowUpQuestion && row?.userFollowUpResponse ? [{ label: row.jaeFollowUpQuestion, text: row.userFollowUpResponse }] : []),
    ...(row?.jaeFollowUpReply ? [{ label: "Jai", text: row.jaeFollowUpReply }] : []),
    ...(step ? [{ label: "Your step", text: step }] : []),
  ];
  return {
    id: mirror.id,
    date,
    kind: "journal",
    title: `Day ${day} · ${SESSION_LABEL[session] ?? session}`,
    lines,
    full,
    at: time(mirror.createdAt),
  };
}

// Jai's memory context: the distilled cards, newest first (6–8).
export function memoryContextLines(cards: MemoryCard[], n = 8): string[] {
  return cards.filter((c) => c.kind !== "raw").slice(0, n).map((c) => `${c.date} ${c.icon ?? ""} ${c.title}${c.lines.length ? `: ${c.lines.join(" / ")}` : ""}`.replace(/\s+/g, " ").trim());
}
