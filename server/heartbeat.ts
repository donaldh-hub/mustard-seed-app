type HeartbeatModule = {
  id: string;
  title: string;
  principle: string;
  keywords: string[];
  lines: string[];
  prompts: string[];
  tools: { name: string; action: string }[];
};

const HEARTBEAT_LIBRARY: Record<string, HeartbeatModule> = {
  clarity: {
    id: "clarity",
    title: "Clarity of Vision & Why",
    principle: "Movement without direction is just noise.",
    keywords: ["why", "vision", "goal", "purpose", "lost", "confused", "direction", "aimless"],
    lines: [
      "Clarity doesn't come from thinking harder. It comes from moving.",
      "A strong 'why' makes the 'how' almost obvious.",
      "You don't need the full map. Just the next step."
    ],
    prompts: [
      "If you couldn't fail, what would you go after first?",
      "Who are you becoming by chasing this?",
      "What's it costing you to stay right here?"
    ],
    tools: [
      { name: "Five Whys", action: "Ask 'Why?' five times. Get to the root." },
      { name: "Vision Scripting", action: "Describe one day, six months from now, where this is handled." }
    ]
  },
  consistency: {
    id: "consistency",
    title: "Small Steps + Consistency",
    principle: "Small steps compound.",
    keywords: ["habit", "routine", "schedule", "time", "busy", "skip", "streak", "hard", "tired"],
    lines: [
      "Don't break the chain.",
      "Intensity fades. Consistency builds.",
      "Two minutes still counts."
    ],
    prompts: [
      "What's the smallest version of this you could do today?",
      "What's one friction point we can cut from your routine?",
      "If you only had five minutes, what would you do?"
    ],
    tools: [
      { name: "Chain Building", action: "Mark today. Keep the streak alive." },
      { name: "2-Minute Rule", action: "Shrink it to two minutes. Start there." }
    ]
  },
  mindset: {
    id: "mindset",
    title: "Mindset over Method",
    principle: "Your identity drives your actions.",
    keywords: ["believe", "doubt", "imposter", "fake", "can't", "identity", "fear", "scared"],
    lines: [
      "Evidence builds confidence. Not the other way around.",
      "You are what you repeat.",
      "Action rewires belief."
    ],
    prompts: [
      "What would the person you're becoming do right now?",
      "What evidence contradicts that doubt?",
      "Are you moving from fear or from vision?"
    ],
    tools: [
      { name: "Identity Statement", action: "Finish this: 'I am the kind of person who...'" },
      { name: "Evidence Log", action: "Name three things you did this week that prove you're changing." }
    ]
  },
  adaptation: {
    id: "adaptation",
    title: "Feedback & Adaptation",
    principle: "Failure isn't final; it's data.",
    keywords: ["fail", "failed", "mistake", "wrong", "change", "adjust", "pivot", "stuck"],
    lines: [
      "That's not failure. That's feedback.",
      "Be stubborn about the goal. Flexible about the method.",
      "A plane corrects course the whole flight. So do you."
    ],
    prompts: [
      "What did that teach you that you didn't know before?",
      "If you could redo this week, what's the one thing you'd change?",
      "What is working? Let's lean into that."
    ],
    tools: [
      { name: "Feedback Loop", action: "What happened? Why? What's the next move?" },
      { name: "OODA Loop", action: "Pause. Observe. Re-orient to the goal. Decide one move." }
    ]
  },
  courage: {
    id: "courage",
    title: "Courageous Action",
    principle: "Courage isn't the absence of fear; it's acting despite it.",
    keywords: ["afraid", "anxious", "later", "tomorrow", "wait", "ready", "perfect"],
    lines: [
      "Do it afraid.",
      "Action cures fear. Waiting feeds it.",
      "The perfect time never shows up."
    ],
    prompts: [
      "What are you waiting for permission to do?",
      "Worst case — could you survive it?",
      "If you knew you'd handle whatever comes, what would you do right now?"
    ],
    tools: [
      { name: "Courage Compass", action: "Where the fear points is usually the way." },
      { name: "Decision Writing", action: "Write the decision you're avoiding. Just naming it helps." }
    ]
  }
};

function analyzeIntent(text: string): HeartbeatModule | null {
  const lowerText = text.toLowerCase();
  let bestMatch: HeartbeatModule | null = null;
  let maxHits = 0;

  Object.values(HEARTBEAT_LIBRARY).forEach(module => {
    let hits = 0;
    module.keywords.forEach(kw => {
      if (lowerText.includes(kw)) hits++;
    });
    if (hits > maxHits) {
      maxHits = hits;
      bestMatch = module;
    }
  });

  return bestMatch;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const STAGE_LINES: Record<string, string[]> = {
  seed: [
    "You're planting right now. That's the hardest part.",
    "Roots come before results.",
    "Showing up is the work at this stage."
  ],
  sprout: [
    "You're finding your rhythm. Stay in it.",
    "Momentum is building. Don't second-guess it.",
    "Consistency is feeding the seed. Keep watering."
  ],
  growth: [
    "Growth lives in the tension. Lean into it.",
    "You've built roots. Now stretch.",
    "This part isn't comfortable. That's how you know it's working."
  ],
  bloom: [
    "You're in bloom. Stay humble. Stay hungry.",
    "Your effort is showing. Don't coast.",
    "Keep the soil rich. Every season still matters."
  ]
};

// Q1 (clear picture) → Clarity
// Q2 (small action daily) → Consistency (Small Steps)
// Q3 (consistent when motivation dips) → Consistency
// Q4 (effort > talent) → Mindset
// Q5 (adjust instead of quit) → Adaptation
// Q6 (face discomfort) → Courage
// Q7 (grace when fall short) → Mindset
// Q8 (track/reflect progress) → Adaptation
// Q9 (accountability tools/people) → Consistency
// Q10 (proud of showing up) → Courage

const QUESTION_HEARTBEAT_MAP: { heartbeat: string; label: string }[] = [
  { heartbeat: "clarity", label: "Clarity" },
  { heartbeat: "consistency", label: "Consistency" },
  { heartbeat: "consistency", label: "Consistency" },
  { heartbeat: "mindset", label: "Mindset" },
  { heartbeat: "adaptation", label: "Adaptation" },
  { heartbeat: "courage", label: "Courage" },
  { heartbeat: "mindset", label: "Mindset" },
  { heartbeat: "adaptation", label: "Adaptation" },
  { heartbeat: "consistency", label: "Consistency" },
  { heartbeat: "courage", label: "Courage" },
];

export function computeHeartbeatScores(answers: number[]): Record<string, number> {
  const totals: Record<string, { sum: number; count: number }> = {};
  for (let i = 0; i < Math.min(answers.length, 10); i++) {
    const mapping = QUESTION_HEARTBEAT_MAP[i];
    if (!totals[mapping.heartbeat]) {
      totals[mapping.heartbeat] = { sum: 0, count: 0 };
    }
    totals[mapping.heartbeat].sum += answers[i];
    totals[mapping.heartbeat].count++;
  }
  const scores: Record<string, number> = {};
  for (const [key, val] of Object.entries(totals)) {
    scores[key] = Math.round((val.sum / val.count) * 10) / 10;
  }
  return scores;
}

export function getWeakestHeartbeat(answers: number[]): { heartbeat: string; label: string; score: number } {
  const totals: Record<string, { sum: number; count: number; label: string }> = {};
  for (let i = 0; i < Math.min(answers.length, 10); i++) {
    const mapping = QUESTION_HEARTBEAT_MAP[i];
    if (!totals[mapping.heartbeat]) {
      totals[mapping.heartbeat] = { sum: 0, count: 0, label: mapping.label };
    }
    totals[mapping.heartbeat].sum += answers[i];
    totals[mapping.heartbeat].count++;
  }

  let weakest = { heartbeat: "clarity", label: "Clarity", score: 5 };
  for (const [key, val] of Object.entries(totals)) {
    const avg = val.sum / val.count;
    if (avg < weakest.score) {
      weakest = { heartbeat: key, label: val.label, score: avg };
    }
  }
  return weakest;
}

type UserContext = {
  name: string;
  goal: string;
  obstacle: string;
  streak: number;
  treeStage: number;
  waterLevel: number;
  stage?: string;
  weakestHeartbeat?: string;
  weakestScore?: number;
  assessmentAnswers?: number[];
};

function buildDataLine(ctx: UserContext, weakLabel: string): string {
  const parts: string[] = [];
  if (ctx.stage) {
    const cap = ctx.stage.charAt(0).toUpperCase() + ctx.stage.slice(1);
    parts.push(`${cap} stage`);
  }
  if (weakLabel) parts.push(`focus: ${weakLabel.toLowerCase()}`);
  if (ctx.goal) parts.push(`goal: "${ctx.goal}"`);
  if (ctx.streak > 1) parts.push(`${ctx.streak}-day streak`);
  if (ctx.obstacle && parts.length < 3) parts.push(`obstacle: "${ctx.obstacle}"`);
  if (parts.length === 0) parts.push("Let's get your baseline set");
  return parts.join(" · ") + ".";
}

export function generateJaeResponse(userText: string, ctx: UserContext): { text: string; mood: 'happy' | 'neutral' | 'sad' } {
  const module = analyzeIntent(userText);
  const lowerText = userText.toLowerCase();
  const n = ctx.name ? `${ctx.name}, ` : "";
  const stage = ctx.stage || "";
  const weakLabel = ctx.weakestHeartbeat ? ctx.weakestHeartbeat.charAt(0).toUpperCase() + ctx.weakestHeartbeat.slice(1) : "";
  const dataLine = buildDataLine(ctx, weakLabel);

  const isPositive = /done|did it|good|great|completed|finished|accomplished|nailed/.test(lowerText);

  if (module) {
    const line = pick(module.lines);
    const prompt = pick(module.prompts);

    let contextHook = "";
    if (module.id === ctx.weakestHeartbeat) {
      contextHook = ` This is your lowest heartbeat — sharpening it changes everything.`;
    } else if (ctx.obstacle && (module.id === "adaptation" || module.id === "mindset" || module.id === "courage")) {
      contextHook = ` You said "${ctx.obstacle}" gets in the way — let's use that.`;
    } else if (ctx.goal) {
      contextHook = ` This connects to "${ctx.goal}".`;
    }

    let action = "";
    if (ctx.goal && weakLabel) {
      action = `Today: one ${module.title.toLowerCase().split(" ")[0]}-building action toward "${ctx.goal}".`;
    } else if (ctx.goal) {
      action = `One move toward "${ctx.goal}" today.`;
    } else if (weakLabel) {
      action = `Five minutes on ${weakLabel.toLowerCase()} today.`;
    } else {
      action = pick(module.tools).action;
    }

    return {
      text: `${n}${line}${contextHook}\n${dataLine}\n${action}\n\n${prompt}`,
      mood: isPositive ? 'happy' : 'neutral',
    };
  }

  if (isPositive) {
    const goalRef = ctx.goal ? ` One step closer to "${ctx.goal}".` : "";
    const streakRef = ctx.streak > 0 ? ` Day ${ctx.streak + 1}.` : "";
    return {
      text: `${n}that's a win.${goalRef}${streakRef}\n${dataLine}\n\nWhat made it click today?`,
      mood: 'happy',
    };
  }

  if (stage && STAGE_LINES[stage]) {
    const stageLine = pick(STAGE_LINES[stage]);

    let action = "";
    if (weakLabel) {
      action = `Spend five minutes on ${weakLabel.toLowerCase()} today.`;
    } else if (ctx.goal) {
      action = `Take one step toward "${ctx.goal}" today.`;
    } else {
      action = "Pick one thing and move it forward today.";
    }

    const question = ctx.obstacle
      ? `When "${ctx.obstacle}" shows up, what's your counter-move?`
      : ctx.goal
        ? `What's one move toward "${ctx.goal}" you can make right now?`
        : "What felt hardest this week — and what did it teach you?";

    return {
      text: `${n}${stageLine}\n${dataLine}\n${action}\n\n${question}`,
      mood: 'neutral',
    };
  }

  let ack = ctx.goal
    ? `${n}let's focus on "${ctx.goal}".`
    : `${n}let's get moving.`;
  let action = weakLabel
    ? `Your focus area is ${weakLabel.toLowerCase()} — one small move there today.`
    : "Pick one thing and take one step forward.";
  let question = ctx.obstacle
    ? `What does "${ctx.obstacle}" look like for you today?`
    : "What's between you and your next step?";

  return {
    text: `${ack}\n${dataLine}\n${action}\n\n${question}`,
    mood: 'neutral',
  };
}
