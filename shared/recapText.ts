// A recap line shows what they named, not a question they asked Jai along
// the way ("not being a zombie at work. should i skip coffee after 2pm, yes
// or no?" shows "not being a zombie at work."). If the whole answer was a
// question, it stays as written.
const ASKS = /\?\s*$|^\s*(yes or no|y\/n|yes\/no)\s*[.?!]*\s*$/i;
export function withoutQuestions(text: string): string {
  const parts = (text ?? "").match(/[^.!?]+[.!?]*/g) ?? [];
  const kept = parts.filter((s) => !ASKS.test(s));
  const out = kept.join("").replace(/\s+/g, " ").trim();
  return out || (text ?? "").trim();
}
