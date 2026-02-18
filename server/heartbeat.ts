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
      "You don't need the full map. Just the next step.",
      "Fog lifts when you start walking.",
      "Direction matters more than speed right now.",
      "The clearest goals start as messy drafts.",
      "Stop waiting for the vision to feel perfect. Sharpen it by acting on it.",
      "Confusion is just clarity that hasn't been earned yet."
    ],
    prompts: [
      "If you couldn't fail, what would you go after first?",
      "Who are you becoming by chasing this?",
      "What's it costing you to stay right here?",
      "What would make you proud to look back on six months from now?",
      "If you had to explain your goal to a stranger in one sentence, what would you say?",
      "What's the one thing you know for sure about what you want?",
      "What part of the path feels clearest to you right now?"
    ],
    tools: [
      { name: "Five Whys", action: "Ask 'Why?' five times. Get to the root." },
      { name: "Vision Scripting", action: "Describe one day, six months from now, where this is handled." },
      { name: "One-Sentence Goal", action: "Write your goal in one sentence. No filler. Just the truth." },
      { name: "Reverse Clarity", action: "Describe what you don't want. Sometimes that reveals what you do." }
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
      "Two minutes still counts.",
      "The days you don't feel like it are the ones that count most.",
      "Small reps add up faster than you think.",
      "Motivation is a guest. Discipline lives here.",
      "You don't have to go big. You have to go again.",
      "Missing once is an accident. Missing twice is a pattern."
    ],
    prompts: [
      "What's the smallest version of this you could do today?",
      "What's one friction point we can cut from your routine?",
      "If you only had five minutes, what would you do?",
      "What did you do yesterday that you can repeat right now?",
      "Which part of your routine feels the most fragile?",
      "What's the one habit that, if you kept it, would change everything?",
      "When do you usually fall off — and what could you do differently?"
    ],
    tools: [
      { name: "Chain Building", action: "Mark today. Keep the streak alive." },
      { name: "2-Minute Rule", action: "Shrink it to two minutes. Start there." },
      { name: "Anchor Habit", action: "Attach it to something you already do every day." },
      { name: "Minimum Viable Effort", action: "Do the bare minimum version. Just don't skip." }
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
      "Action rewires belief.",
      "Doubt is loud. But it's not in charge.",
      "Your past doesn't get to write your future.",
      "The voice saying you can't is the same one you've already proven wrong before.",
      "Identity shifts one decision at a time.",
      "Stop trying to feel ready. Start acting like someone who is."
    ],
    prompts: [
      "What would the person you're becoming do right now?",
      "What evidence contradicts that doubt?",
      "Are you moving from fear or from vision?",
      "When was the last time you did something you didn't think you could?",
      "What story are you telling yourself that's keeping you stuck?",
      "If your best friend said what you're saying, what would you tell them?",
      "What's one belief about yourself you're ready to let go of?"
    ],
    tools: [
      { name: "Identity Statement", action: "Finish this: 'I am the kind of person who...'" },
      { name: "Evidence Log", action: "Name three things you did this week that prove you're changing." },
      { name: "Belief Audit", action: "Write down the thought holding you back. Then write the opposite." },
      { name: "Future Self Letter", action: "Write one paragraph from the version of you who already made it." }
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
      "A plane corrects course the whole flight. So do you.",
      "Setbacks aren't the opposite of progress. They're part of it.",
      "The plan didn't work. That doesn't mean you didn't.",
      "Adjust, don't abandon.",
      "Stuckness is a sign you need a different angle, not more force.",
      "Every wrong turn still teaches you the map."
    ],
    prompts: [
      "What did that teach you that you didn't know before?",
      "If you could redo this week, what's the one thing you'd change?",
      "What is working? Let's lean into that.",
      "Where did you try too hard instead of trying differently?",
      "What would you do if this obstacle was actually feedback?",
      "What's the smallest adjustment that could make the biggest difference?",
      "What would you tell someone else in this exact situation?"
    ],
    tools: [
      { name: "Feedback Loop", action: "What happened? Why? What's the next move?" },
      { name: "OODA Loop", action: "Pause. Observe. Re-orient to the goal. Decide one move." },
      { name: "Pivot Check", action: "Is this a dead end or a detour? Name which one." },
      { name: "After-Action Review", action: "What went right? What went wrong? What will you do next time?" }
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
      "The perfect time never shows up.",
      "Readiness is a myth. You get ready by starting.",
      "Comfort zones don't grow anything.",
      "What you're avoiding is probably what you need most.",
      "Bravery isn't a feeling. It's a decision.",
      "The gap between wanting and having is doing."
    ],
    prompts: [
      "What are you waiting for permission to do?",
      "Worst case — could you survive it?",
      "If you knew you'd handle whatever comes, what would you do right now?",
      "What's the one thing you keep putting off?",
      "What would you do today if no one was watching?",
      "What's on the other side of the thing you're avoiding?",
      "What decision would your future self thank you for making today?"
    ],
    tools: [
      { name: "Courage Compass", action: "Where the fear points is usually the way." },
      { name: "Decision Writing", action: "Write the decision you're avoiding. Just naming it helps." },
      { name: "10-Second Rule", action: "Count to ten, then move. Don't let hesitation win." },
      { name: "Fear Inventory", action: "List what scares you about this. Then cross off what you can survive." }
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
    "Showing up is the work at this stage.",
    "This is where it all starts. Don't rush past it.",
    "Seeds don't grow by being pulled up to check. Trust the process.",
    "The ground looks empty, but something is happening underneath.",
    "Starting small isn't thinking small. It's thinking smart."
  ],
  sprout: [
    "You're finding your rhythm. Stay in it.",
    "Momentum is building. Don't second-guess it.",
    "Consistency is feeding the seed. Keep watering.",
    "You're past the hardest part — the beginning. Now build on it.",
    "Small signs of growth are still growth.",
    "The routine is taking shape. Protect it.",
    "You've proven you can start. Now prove you can continue."
  ],
  growth: [
    "Growth lives in the tension. Lean into it.",
    "You've built roots. Now stretch.",
    "This part isn't comfortable. That's how you know it's working.",
    "You're in the middle — the part most people quit. Keep going.",
    "The work is harder here because the stakes are real now.",
    "Growth means outgrowing old habits. Let them go.",
    "Discomfort is the price of expansion. You can afford it."
  ],
  bloom: [
    "You're in bloom. Stay humble. Stay hungry.",
    "Your effort is showing. Don't coast.",
    "Keep the soil rich. Every season still matters.",
    "This stage is earned, not given. Honor it with consistency.",
    "Bloom doesn't mean finished. It means ready for the next level.",
    "Success without maintenance is temporary. Keep tending.",
    "You've grown into this. Now grow others."
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

const POSITIVE_ACKS = [
  "that's a win.",
  "solid.",
  "there it is.",
  "you showed up and delivered.",
  "that's the kind of move that compounds.",
  "rep logged. That one counted.",
  "momentum earned.",
];

const POSITIVE_QUESTIONS = [
  "What made it click today?",
  "What pushed you past the resistance?",
  "How did it feel to follow through?",
  "What part of that do you want to repeat?",
  "What shifted inside you when you did it?",
  "What can you carry from today into tomorrow?",
];

const STAGE_ACTIONS_WEAK = [
  "Give five minutes to WEAK today.",
  "Put some attention on WEAK — even a small effort counts.",
  "One focused action on WEAK will move the needle.",
  "Spend a few minutes strengthening WEAK today.",
  "Do one thing for WEAK. That's the assignment.",
  "Channel some energy toward WEAK — it's where the growth is waiting.",
];

const STAGE_ACTIONS_GOAL = [
  "Take one step toward \"GOAL\" today.",
  "Move \"GOAL\" forward — even an inch counts.",
  "One action toward \"GOAL\" before the day ends.",
  "Put ten minutes into \"GOAL\" right now.",
  "Do one thing that brings \"GOAL\" closer.",
];

const STAGE_ACTIONS_GENERAL = [
  "Pick one thing and move it forward today.",
  "Choose one priority and give it your attention.",
  "Name one thing that matters and take one step.",
  "Find the one move that will make today count.",
];

const OBSTACLE_QUESTIONS = [
  "When \"OBS\" shows up, what's your counter-move?",
  "How are you planning to handle \"OBS\" today?",
  "What's your defense when \"OBS\" hits?",
  "If \"OBS\" shows up later, what will you do differently?",
  "How will you push through when \"OBS\" tries to slow you down?",
];

const GOAL_QUESTIONS = [
  "What's one move toward \"GOAL\" you can make right now?",
  "What would push \"GOAL\" forward by the end of today?",
  "What's the next step that brings \"GOAL\" within reach?",
  "If you could only do one thing for \"GOAL\" today, what would it be?",
  "What part of \"GOAL\" can you chip away at right now?",
];

const GENERAL_QUESTIONS = [
  "What felt hardest this week — and what did it teach you?",
  "Where did you surprise yourself lately?",
  "What's one thing you'd do differently if you restarted this week?",
  "What's been on your mind that you haven't said out loud yet?",
  "What's the truth you're dancing around right now?",
];

const WEAK_HOOKS = [
  "This is your lowest heartbeat — sharpening it changes everything.",
  "This is your growth edge. Lean into it.",
  "This heartbeat needs the most attention. That's where the breakthrough lives.",
  "Your weakest heartbeat is also your biggest opportunity.",
];

const OBSTACLE_HOOKS = [
  "You said \"OBS\" gets in the way — let's use that.",
  "You named \"OBS\" as your obstacle. Time to outwork it.",
  "\"OBS\" is the pattern. Let's break it.",
  "You told me \"OBS\" holds you back. Not today.",
];

const GOAL_HOOKS = [
  "This connects to \"GOAL\".",
  "Keep \"GOAL\" in sight.",
  "This ties back to \"GOAL\" — every move counts.",
  "\"GOAL\" is what this is about.",
];

const FALLBACK_ACKS_GOAL = [
  "let's focus on \"GOAL\".",
  "\"GOAL\" is on the board. Let's work it.",
  "eyes on \"GOAL\".",
  "back to \"GOAL\" — what's next?",
  "\"GOAL\" won't move itself. Let's go.",
];

const FALLBACK_ACKS_GENERAL = [
  "let's get moving.",
  "let's make something happen.",
  "ready when you are.",
  "let's find the next step.",
  "time to move.",
];

const FALLBACK_ACTIONS_WEAK = [
  "Your focus area is WEAK — one small move there today.",
  "WEAK is the priority. Start small.",
  "A few minutes on WEAK today will compound over time.",
  "WEAK is where the growth is. Give it something.",
];

const FALLBACK_ACTIONS_GENERAL = [
  "Pick one thing and take one step forward.",
  "Choose one area and give it five minutes.",
  "Name one thing worth doing today and do it.",
  "One move. That's all it takes to keep going.",
];

const FALLBACK_QUESTIONS_OBSTACLE = [
  "What does \"OBS\" look like for you today?",
  "How is \"OBS\" showing up right now?",
  "When \"OBS\" hits today, what's your plan?",
  "What will you do differently when \"OBS\" tries to take over?",
];

const FALLBACK_QUESTIONS_GENERAL = [
  "What's between you and your next step?",
  "What's the one thing holding you back right now?",
  "Where do you feel the most resistance?",
  "What needs your attention most today?",
  "What would make today feel like progress?",
];

function fillTemplate(template: string, ctx: UserContext, weakLabel: string): string {
  return template
    .replace(/WEAK/g, weakLabel.toLowerCase())
    .replace(/GOAL/g, ctx.goal)
    .replace(/OBS/g, ctx.obstacle);
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
      contextHook = " " + pick(WEAK_HOOKS);
    } else if (ctx.obstacle && (module.id === "adaptation" || module.id === "mindset" || module.id === "courage")) {
      contextHook = " " + fillTemplate(pick(OBSTACLE_HOOKS), ctx, weakLabel);
    } else if (ctx.goal) {
      contextHook = " " + fillTemplate(pick(GOAL_HOOKS), ctx, weakLabel);
    }

    let action = "";
    if (ctx.goal && weakLabel) {
      action = fillTemplate(pick(STAGE_ACTIONS_WEAK), ctx, weakLabel);
    } else if (ctx.goal) {
      action = fillTemplate(pick(STAGE_ACTIONS_GOAL), ctx, weakLabel);
    } else if (weakLabel) {
      action = fillTemplate(pick(STAGE_ACTIONS_WEAK), ctx, weakLabel);
    } else {
      action = pick(module.tools).action;
    }

    return {
      text: `${n}${line}${contextHook}\n${dataLine}\n${action}\n\n${prompt}`,
      mood: isPositive ? 'happy' : 'neutral',
    };
  }

  if (isPositive) {
    const ack = pick(POSITIVE_ACKS);
    const goalRef = ctx.goal ? ` One step closer to "${ctx.goal}".` : "";
    const streakRef = ctx.streak > 0 ? ` Day ${ctx.streak + 1}.` : "";
    const question = pick(POSITIVE_QUESTIONS);
    return {
      text: `${n}${ack}${goalRef}${streakRef}\n${dataLine}\n\n${question}`,
      mood: 'happy',
    };
  }

  if (stage && STAGE_LINES[stage]) {
    const stageLine = pick(STAGE_LINES[stage]);

    let action = "";
    if (weakLabel) {
      action = fillTemplate(pick(STAGE_ACTIONS_WEAK), ctx, weakLabel);
    } else if (ctx.goal) {
      action = fillTemplate(pick(STAGE_ACTIONS_GOAL), ctx, weakLabel);
    } else {
      action = pick(STAGE_ACTIONS_GENERAL);
    }

    let question = "";
    if (ctx.obstacle) {
      question = fillTemplate(pick(OBSTACLE_QUESTIONS), ctx, weakLabel);
    } else if (ctx.goal) {
      question = fillTemplate(pick(GOAL_QUESTIONS), ctx, weakLabel);
    } else {
      question = pick(GENERAL_QUESTIONS);
    }

    return {
      text: `${n}${stageLine}\n${dataLine}\n${action}\n\n${question}`,
      mood: 'neutral',
    };
  }

  const ack = ctx.goal
    ? `${n}${fillTemplate(pick(FALLBACK_ACKS_GOAL), ctx, weakLabel)}`
    : `${n}${pick(FALLBACK_ACKS_GENERAL)}`;
  const action = weakLabel
    ? fillTemplate(pick(FALLBACK_ACTIONS_WEAK), ctx, weakLabel)
    : pick(FALLBACK_ACTIONS_GENERAL);
  const question = ctx.obstacle
    ? fillTemplate(pick(FALLBACK_QUESTIONS_OBSTACLE), ctx, weakLabel)
    : pick(FALLBACK_QUESTIONS_GENERAL);

  return {
    text: `${ack}\n${dataLine}\n${action}\n\n${question}`,
    mood: 'neutral',
  };
}
