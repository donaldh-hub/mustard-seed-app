import { useState, type KeyboardEvent } from "react";
import {
  HEARTBEAT_ORDER,
  HEARTBEAT_NAMES,
  HEARTBEAT_WEIGHTS,
  HEARTBEAT_SCORE_MAX,
  SHOW_WEIGHTS,
  type HeartbeatKey,
  type HeartbeatStanding,
} from "@shared/heartbeats";

// The Five Heartbeats as a loop: 1 → 2 → 3 → 4 → 5 → back to 1, "Growth" at
// the center. Each Heartbeat is a button (tap, click, Enter or Space). Scores
// come from the user's saved assessment; with none, the loop is neutral.

const W = 900;
const CENTER = { x: 450, y: 470 };
const R = 108;
const POS: Record<HeartbeatKey, { x: number; y: number }> = {
  clarity: { x: 450, y: 220 },
  consistency: { x: 732, y: 424 },
  mindset: { x: 622, y: 724 },
  adaptation: { x: 278, y: 724 },
  courage: { x: 168, y: 424 },
};
// Names split for two lines inside a circle (wording unchanged).
const NAME_LINES: Record<HeartbeatKey, [string, string]> = {
  clarity: ["Clarity of", "Vision & Why"],
  consistency: ["Small Steps", "+ Consistency"],
  mindset: ["Mindset", "over Method"],
  adaptation: ["Feedback &", "Adaptation"],
  courage: ["Courageous", "Action"],
};

const GOLD = "#E3C47A";
const SAGE = "#9FB88A";

// A curved arrow from one circle's edge to the next, bowed away from center.
function arcPath(from: HeartbeatKey, to: HeartbeatKey): string {
  const a = POS[from], b = POS[to];
  const ang = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.atan2(q.y - p.y, q.x - p.x);
  const gap = R + 14;
  const start = { x: a.x + Math.cos(ang(a, b) + 0.35) * gap, y: a.y + Math.sin(ang(a, b) + 0.35) * gap };
  const end = { x: b.x + Math.cos(ang(b, a) - 0.35) * (gap + 6), y: b.y + Math.sin(ang(b, a) - 0.35) * (gap + 6) };
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const out = Math.atan2(mid.y - CENTER.y, mid.x - CENTER.x);
  const ctrl = { x: mid.x + Math.cos(out) * 70, y: mid.y + Math.sin(out) * 70 };
  return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} Q ${ctrl.x.toFixed(1)} ${ctrl.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
}

export function heartbeatAriaLabel(key: HeartbeatKey, score: number | undefined, standing: HeartbeatStanding): string {
  const n = HEARTBEAT_ORDER.indexOf(key) + 1;
  const parts = [`Heartbeat ${n}, ${HEARTBEAT_NAMES[key]}`];
  if (typeof score === "number") parts.push(`score ${score.toFixed(1)} out of ${HEARTBEAT_SCORE_MAX}`);
  if (standing.strongest.includes(key)) parts.push("your strongest Heartbeat");
  if (standing.focus === key) parts.push("your focus Heartbeat");
  return parts.join(", ");
}

export function HeartbeatsLoop({
  scores,
  standing,
  selected,
  onSelect,
}: {
  scores: Record<string, number> | null;
  standing: HeartbeatStanding;
  selected: HeartbeatKey | null;
  onSelect: (key: HeartbeatKey) => void;
}) {
  const [focused, setFocused] = useState<HeartbeatKey | null>(null);
  const onKey = (key: HeartbeatKey) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(key);
    }
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${W - 20}`}
      className="w-full h-auto select-none"
      role="group"
      aria-label="The Five Heartbeats loop. Each Heartbeat feeds the next, and Courageous Action feeds back into Clarity of Vision & Why."
      data-testid="heartbeats-loop"
    >
      <defs>
        <radialGradient id="hb-bg" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor="#1F3A2C" />
          <stop offset="100%" stopColor="#0F1C16" />
        </radialGradient>
        <marker id="hb-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={GOLD} />
        </marker>
      </defs>
      <rect x="0" y="0" width={W} height={W - 20} rx="40" fill="url(#hb-bg)" />

      {/* Center */}
      <circle cx={CENTER.x} cy={CENTER.y} r="138" fill="#1B2E24" stroke={SAGE} strokeOpacity="0.45" strokeWidth="2.5" strokeDasharray="10 9" />
      <text x={CENTER.x} y={CENTER.y + 18} textAnchor="middle" fill="#FBF6EA" fontSize="58" fontWeight="800" letterSpacing="1">
        Growth
      </text>

      {/* Flow: 1 → 2 → 3 → 4 → 5 → 1 */}
      {HEARTBEAT_ORDER.map((k, i) => {
        const next = HEARTBEAT_ORDER[(i + 1) % HEARTBEAT_ORDER.length];
        return (
          <path
            key={`arc-${k}`}
            d={arcPath(k, next)}
            fill="none"
            stroke={GOLD}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="16 12"
            markerEnd="url(#hb-arrow)"
            className="hb-flow"
            aria-hidden="true"
          />
        );
      })}

      {/* Heartbeats */}
      {HEARTBEAT_ORDER.map((k, i) => {
        const p = POS[k];
        const score = scores?.[k];
        const isStrongest = standing.strongest.includes(k);
        const isFocus = standing.focus === k;
        const isSelected = selected === k;
        const ring = isStrongest ? GOLD : isFocus ? "#F2A65A" : SAGE;
        const tag = isStrongest ? "Strongest" : isFocus ? "Focus" : null;
        return (
          <g
            key={k}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={heartbeatAriaLabel(k, score, standing)}
            onClick={() => onSelect(k)}
            onKeyDown={onKey(k)}
            onFocus={() => setFocused(k)}
            onBlur={() => setFocused((f) => (f === k ? null : f))}
            className="cursor-pointer outline-none"
            data-testid={`heartbeat-node-${k}`}
          >
            {(isSelected || focused === k) && (
              <circle cx={p.x} cy={p.y} r={R + 12} fill="none" stroke="#FBF6EA" strokeOpacity={focused === k ? 0.9 : 0.5} strokeWidth="4" />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={R}
              fill={isSelected ? "#3B5C46" : "#2F4A38"}
              stroke={ring}
              strokeWidth={isStrongest || isFocus ? 7 : 4}
              strokeDasharray={isFocus && !isStrongest ? "14 8" : undefined}
            />
            <text x={p.x} y={p.y - 50} textAnchor="middle" fill={GOLD} fontSize="30" fontWeight="800">
              {String(i + 1).padStart(2, "0")}
            </text>
            <text x={p.x} y={p.y - 8} textAnchor="middle" fill="#FBF6EA" fontSize="25" fontWeight="700">
              {NAME_LINES[k][0]}
            </text>
            <text x={p.x} y={p.y + 22} textAnchor="middle" fill="#FBF6EA" fontSize="25" fontWeight="700">
              {NAME_LINES[k][1]}
            </text>
            {typeof score === "number" && (
              <text x={p.x} y={p.y + 58} textAnchor="middle" fill="#DCE6D3" fontSize="24" data-testid={`heartbeat-score-${k}`}>
                {score.toFixed(1)} / {HEARTBEAT_SCORE_MAX}
                {SHOW_WEIGHTS ? ` · ${HEARTBEAT_WEIGHTS[k]}%` : ""}
              </text>
            )}
            {typeof score !== "number" && SHOW_WEIGHTS && (
              <text x={p.x} y={p.y + 58} textAnchor="middle" fill="#DCE6D3" fontSize="24">{HEARTBEAT_WEIGHTS[k]}%</text>
            )}
            {tag && (
              <g aria-hidden="true">
                <rect x={p.x - 62} y={p.y + R - 16} width="124" height="34" rx="17" fill={ring} />
                <text x={p.x} y={p.y + R + 8} textAnchor="middle" fill="#13231B" fontSize="20" fontWeight="800" data-testid={`heartbeat-tag-${k}`}>
                  {tag}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
