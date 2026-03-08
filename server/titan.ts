export type TitanCategory = "VA" | "AR" | "RW" | "IO" | "AD";

export type HeartbeatKey = "clarity" | "consistency" | "mindset" | "adaptation" | "courage";

export interface TitanClassification {
  category: TitanCategory;
  actionPoints: number;
  insightPoints: number;
  driftMarker: number;
  heartbeatCredit: HeartbeatKey | null;
  label: string;
}

export interface EscalationState {
  driftWarning: boolean;
  cBurnTriggered: boolean;
  recoveryAcceleration: boolean;
  bonusActionPoints: number;
  escalationMessage: string | null;
}

export interface HeartbeatCredits {
  clarity: number;
  consistency: number;
  mindset: number;
  adaptation: number;
  courage: number;
}

const VA_PATTERNS = [
  /\b(went to the gym|hit the gym|worked out|exercised|trained|lifted|did (my |a )?workout)\b/i,
  /\b(walked|ran|jogged|cycled|biked|swam|hiked|sprinted)\b/i,
  /\b(meal[- ]?prepped|cooked|prepared (my )?(meals?|food|lunch|dinner|breakfast))\b/i,
  /\b(made the call|called|emailed|sent|submitted|shipped|posted|published|applied|delivered)\b/i,
  /\b(took the stairs|woke up early|got up at|went to bed|slept (by|before))\b/i,
  /\b(meditated|journaled|wrote|read|studied|practiced|rehearsed)\b/i,
  /\b(completed|finished|accomplished|done|did it|nailed it|got it done|followed through|kept my promise|made progress)\b/i,
  /\b(tracked|logged|measured|recorded|weighed|counted)\b/i,
  /\b(cleaned|organized|set up|built|created|designed|coded|programmed)\b/i,
  /\b(attended|showed up|went to|participated|enrolled|signed up)\b/i,
  /\b(bought|purchased|invested in|paid for)\b/i,
  /\b(outlined|drafted|structured|mapped out|planned out|sketched out|laid out)\b/i,
  /\b(is outlined|is drafted|is done|is finished|is completed|is built|is created|is written|is submitted|is recorded)\b/i,
  /\b(i (did|made|took|started|went|ran|walked|completed|finished|submitted|shipped|built|wrote|read|cooked|cleaned|organized|practiced|trained|exercised|meditated|journaled|studied|applied|delivered|called|emailed|sent|posted|published|attended|measured|tracked|logged|outlined|drafted|created))\b/i,
  /\b(today i|this morning i|just|i just)\s+(did|made|took|went|ran|walked|completed|finished|submitted|shipped|outlined|drafted|wrote|built|created)\b/i,
];

const AR_PATTERNS = [
  /\b(messed up|failed|fell off|slipped|relapsed|missed|skipped)\b.*\b(but|and|so|then)\b.*\b(adjusted|restarted|got back|tried again|recovered|bounced back|came back|picked up|resumed|corrected|fixed|made up)\b/i,
  /\b(restarted|got back on track|picked it back up|resumed|bounced back|recovered)\b.*\b(today|this morning|now)\b/i,
  /\b(fell off)\b.*\b(back|again|restart)\b/i,
  /\b(adjusted|adapted|changed|modified|tweaked)\b.*\b(my approach|my plan|my routine|my strategy|what I was doing)\b/i,
  /\b(i messed up|i failed|i missed)\b.*\b(but)\b/i,
];

const IO_PATTERNS = [
  /\b(i('m| am) going to|i plan to|i('ll| will)|i want to|i need to|i should|i intend to|tomorrow i('ll| will)|next week i('ll| will)|starting (tomorrow|monday|next))\b/i,
  /\b(gonna|planning to|thinking about|considering|hoping to|about to)\b/i,
  /\b(my plan is|the plan is|i('m| am) thinking)\b/i,
];

const AD_PATTERNS = [
  /\b(i don't know|i can't|i won't|it doesn't matter|what's the point|i give up|forget it|whatever|i quit|not worth it|too hard|impossible)\b/i,
  /\b(later|eventually|someday|one day|when i have time|when things settle|not now|not yet|maybe|if i feel like it)\b.*\b(later|eventually|someday)\b/i,
  /\b(yeah but|i know but|i should but)\b/i,
  /\b(haven't done anything|didn't do anything|nothing happened|same as before|no change|no progress)\b/i,
];

const RW_PATTERNS = [
  /\b(i realize|i realized|i've been|i notice|i noticed|it hit me|i see now|i understand now)\b/i,
  /\b(i('m| am) afraid|i('m| am) scared|i('m| am) worried|i('m| am) anxious|i('m| am) overwhelmed)\b/i,
  /\b(i feel|i think|i believe|i know|i've learned|i've discovered)\b/i,
  /\b(procrastinating|avoiding|hesitating|stuck|struggling|resistance)\b/i,
  /\b(reflection|insight|awareness|pattern|tendency)\b/i,
];

const HEARTBEAT_ACTION_MAP: Record<string, HeartbeatKey> = {
  "goal": "clarity",
  "vision": "clarity",
  "why": "clarity",
  "purpose": "clarity",
  "direction": "clarity",
  "mission": "clarity",
  "clarity": "clarity",

  "walked": "consistency",
  "ran": "consistency",
  "exercised": "consistency",
  "trained": "consistency",
  "meditated": "consistency",
  "tracked": "consistency",
  "logged": "consistency",
  "routine": "consistency",
  "habit": "consistency",
  "daily": "consistency",
  "every day": "consistency",
  "streak": "consistency",
  "consistent": "consistency",
  "meal prepped": "consistency",
  "prepped": "consistency",
  "cooked": "consistency",
  "practiced": "consistency",
  "studied": "consistency",
  "read": "consistency",
  "wrote": "consistency",
  "journaled": "consistency",
  "gym": "consistency",
  "workout": "consistency",
  "outlined": "consistency",
  "drafted": "consistency",
  "structured": "consistency",

  "mindset": "mindset",
  "perspective": "mindset",
  "attitude": "mindset",
  "belief": "mindset",
  "identity": "mindset",
  "becoming": "mindset",
  "growth": "mindset",
  "reframe": "mindset",

  "adjusted": "adaptation",
  "adapted": "adaptation",
  "changed": "adaptation",
  "modified": "adaptation",
  "tweaked": "adaptation",
  "feedback": "adaptation",
  "learned from": "adaptation",
  "improved": "adaptation",
  "restarted": "adaptation",
  "recovered": "adaptation",
  "bounced back": "adaptation",

  "confronted": "courage",
  "stood up": "courage",
  "spoke up": "courage",
  "asked for": "courage",
  "reached out": "courage",
  "published": "courage",
  "shared": "courage",
  "applied": "courage",
  "pitched": "courage",
  "presented": "courage",
  "cold call": "courage",
  "initiated": "courage",
  "risked": "courage",
  "vulnerable": "courage",
  "first time": "courage",
  "scared but": "courage",
  "afraid but": "courage",
  "uncomfortable": "courage",
};

function mapHeartbeat(message: string): HeartbeatKey {
  const lower = message.toLowerCase();
  for (const [keyword, heartbeat] of Object.entries(HEARTBEAT_ACTION_MAP)) {
    if (lower.includes(keyword)) {
      return heartbeat;
    }
  }
  return "consistency";
}

export function classifyMessage(message: string): TitanClassification {
  const msg = message.trim();
  if (!msg) {
    return { category: "IO", actionPoints: 0, insightPoints: 0, driftMarker: 0, heartbeatCredit: null, label: "Empty message" };
  }

  for (const pattern of AR_PATTERNS) {
    if (pattern.test(msg)) {
      return {
        category: "AR",
        actionPoints: 2,
        insightPoints: 0,
        driftMarker: 0,
        heartbeatCredit: "adaptation",
        label: "Adaptive Recovery",
      };
    }
  }

  for (const pattern of VA_PATTERNS) {
    if (pattern.test(msg)) {
      const heartbeat = mapHeartbeat(msg);
      return {
        category: "VA",
        actionPoints: 3,
        insightPoints: 0,
        driftMarker: 0,
        heartbeatCredit: heartbeat,
        label: "Verified Action",
      };
    }
  }

  for (const pattern of AD_PATTERNS) {
    if (pattern.test(msg)) {
      return {
        category: "AD",
        actionPoints: 0,
        insightPoints: 0,
        driftMarker: -1,
        heartbeatCredit: null,
        label: "Avoidance / Drift",
      };
    }
  }

  for (const pattern of RW_PATTERNS) {
    if (pattern.test(msg)) {
      return {
        category: "RW",
        actionPoints: 0,
        insightPoints: 1,
        driftMarker: 0,
        heartbeatCredit: null,
        label: "Reflection Without Action",
      };
    }
  }

  for (const pattern of IO_PATTERNS) {
    if (pattern.test(msg)) {
      return {
        category: "IO",
        actionPoints: 0,
        insightPoints: 0,
        driftMarker: 0,
        heartbeatCredit: null,
        label: "Intention Only",
      };
    }
  }

  return {
    category: "RW",
    actionPoints: 0,
    insightPoints: 0,
    driftMarker: 0,
    heartbeatCredit: null,
    label: "Unclassified (treated as reflection)",
  };
}

export function classifyMultipleActions(message: string): TitanClassification[] {
  const sentences = message.split(/[.!;]\s+/).filter((s) => s.trim().length > 5);
  if (sentences.length <= 1) {
    return [classifyMessage(message)];
  }

  const results: TitanClassification[] = [];
  for (const sentence of sentences) {
    const classification = classifyMessage(sentence);
    if (classification.category === "VA" || classification.category === "AR") {
      results.push(classification);
    }
  }

  if (results.length === 0) {
    return [classifyMessage(message)];
  }

  return results;
}

export function aggregateClassifications(classifications: TitanClassification[]): {
  totalActionPoints: number;
  totalInsightPoints: number;
  totalDriftMarkers: number;
  heartbeatCredits: Partial<Record<HeartbeatKey, number>>;
  primaryCategory: TitanCategory;
} {
  let totalAP = 0;
  let totalIP = 0;
  let totalDrift = 0;
  const credits: Partial<Record<HeartbeatKey, number>> = {};

  for (const c of classifications) {
    totalAP += c.actionPoints;
    totalIP += c.insightPoints;
    totalDrift += c.driftMarker;
    if (c.heartbeatCredit && Object.keys(credits).length === 0) {
      credits[c.heartbeatCredit] = 1;
    }
  }

  const primary = classifications[0]?.category || "RW";

  return {
    totalActionPoints: totalAP,
    totalInsightPoints: totalIP,
    totalDriftMarkers: totalDrift,
    heartbeatCredits: credits,
    primaryCategory: primary,
  };
}

const AP_PER_WATER_UNIT = 10;

export function computeWaterFromAP(
  currentAP: number,
  newAP: number
): { waterUnits: number; remainingAP: number } {
  const totalAP = currentAP + newAP;
  const waterUnits = Math.floor(totalAP / AP_PER_WATER_UNIT);
  const remainingAP = totalAP % AP_PER_WATER_UNIT;
  return { waterUnits, remainingAP };
}

export function checkEscalation(
  driftMarkers7d: number,
  consecutiveIOCount: number,
  daysSinceLastVA: number,
  driftWarningCount14d: number,
  cBurnActive: boolean,
  recentVACountLast48h: number,
  hasDriftWarning: boolean
): EscalationState {
  let driftWarning = false;
  let cBurnTriggered = false;
  let recoveryAcceleration = false;
  let bonusActionPoints = 0;
  let escalationMessage: string | null = null;

  if (hasDriftWarning && recentVACountLast48h >= 3) {
    recoveryAcceleration = true;
    bonusActionPoints = 2;
    escalationMessage = "Recovery acceleration activated. +2 bonus action points for showing up strong after a drift warning.";
  }

  if (!cBurnActive) {
    if (driftMarkers7d >= 3 || consecutiveIOCount >= 5) {
      driftWarning = true;
      escalationMessage = escalationMessage || "Drift warning. You've been talking about action more than taking it. What's one verified action you can complete in the next 24 hours?";
    }

    if (daysSinceLastVA >= 7 || driftWarningCount14d >= 2) {
      cBurnTriggered = true;
      escalationMessage = "Water accumulation is paused. No verified action in 7 days. One real action resumes everything. What will it be?";
    }
  }

  if (cBurnActive && !cBurnTriggered) {
    escalationMessage = null;
  }

  return {
    driftWarning,
    cBurnTriggered,
    recoveryAcceleration,
    bonusActionPoints,
    escalationMessage,
  };
}

export function computeHeartbeatBalance(credits: HeartbeatCredits): {
  balanced: boolean;
  percentages: Record<HeartbeatKey, number>;
  weakHeartbeats: HeartbeatKey[];
  feedbackType: "balanced" | "mild_imbalance" | "none";
} {
  const total = credits.clarity + credits.consistency + credits.mindset + credits.adaptation + credits.courage;

  if (total === 0) {
    return {
      balanced: true,
      percentages: { clarity: 20, consistency: 20, mindset: 20, adaptation: 20, courage: 20 },
      weakHeartbeats: [],
      feedbackType: "none",
    };
  }

  const pct = (val: number) => Math.round((val / total) * 100);
  const percentages: Record<HeartbeatKey, number> = {
    clarity: pct(credits.clarity),
    consistency: pct(credits.consistency),
    mindset: pct(credits.mindset),
    adaptation: pct(credits.adaptation),
    courage: pct(credits.courage),
  };

  const weakHeartbeats: HeartbeatKey[] = [];
  for (const [key, val] of Object.entries(percentages)) {
    if (val < 15) {
      weakHeartbeats.push(key as HeartbeatKey);
    }
  }

  const balanced = weakHeartbeats.length === 0;

  return {
    balanced,
    percentages,
    weakHeartbeats,
    feedbackType: balanced ? "balanced" : "mild_imbalance",
  };
}

export function computeEscalationFromMessages(
  userMessages: { text: string; sender: string; createdAt: Date | null }[],
  user: {
    consecutiveIOCount: number;
    lastVerifiedActionAt: Date | null;
    lastDriftWarningAt: Date | null;
    driftWarningCount14d: number;
    cBurnActive: number;
  }
): EscalationState {
  const userOnly = userMessages.filter((m) => m.sender === "user");

  let driftMarkers7d = 0;
  for (const m of userOnly) {
    const c = classifyMultipleActions(m.text);
    const a = aggregateClassifications(c);
    if (a.totalDriftMarkers < 0) driftMarkers7d += Math.abs(a.totalDriftMarkers);
  }

  const now = Date.now();
  const daysSinceVA = user.lastVerifiedActionAt
    ? Math.floor((now - new Date(user.lastVerifiedActionAt).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  const now14d = new Date(now - 14 * 24 * 60 * 60 * 1000);
  const driftWarningCount14d =
    user.lastDriftWarningAt && new Date(user.lastDriftWarningAt) >= now14d
      ? user.driftWarningCount14d
      : 0;

  const cutoff48h = new Date(now - 48 * 60 * 60 * 1000);
  const recentVACountLast48h = userOnly
    .filter((m) => m.createdAt && new Date(m.createdAt) >= cutoff48h)
    .reduce((count, m) => {
      const c = classifyMultipleActions(m.text);
      const a = aggregateClassifications(c);
      return count + (a.primaryCategory === "VA" ? 1 : 0);
    }, 0);

  const hasDriftWarning = user.lastDriftWarningAt
    ? now - new Date(user.lastDriftWarningAt).getTime() < 48 * 60 * 60 * 1000
    : false;

  return checkEscalation(
    driftMarkers7d,
    user.consecutiveIOCount,
    daysSinceVA,
    driftWarningCount14d,
    !!(user.cBurnActive),
    recentVACountLast48h,
    hasDriftWarning
  );
}

export const HEARTBEAT_NAMES: Record<HeartbeatKey, string> = {
  clarity: "Clarity of Vision & Why",
  consistency: "Small Steps + Consistency",
  mindset: "Mindset over Method",
  adaptation: "Feedback & Adaptation",
  courage: "Courageous Action",
};
