type HeartbeatModule = {
  id: string;
  title: string;
  principle: string;
  keywords: string[];
  pocketLines: string[];
  prompts: string[];
  tools: { name: string; action: string }[];
};

const HEARTBEAT_LIBRARY: Record<string, HeartbeatModule> = {
  clarity: {
    id: "clarity",
    title: "Clarity of Vision & Why",
    principle: "Movement without direction is just noise.",
    keywords: ["why", "vision", "goal", "purpose", "lost", "confused", "direction", "aimless"],
    pocketLines: [
      "Clarity comes from action, not just thought.",
      "If the 'why' is strong enough, the 'how' becomes easier.",
      "Vision isn't about seeing the future; it's about seeing your next step clearly."
    ],
    prompts: [
      "If you were guaranteed not to fail, what would this look like?",
      "Who are you becoming by pursuing this?",
      "What is the cost of staying exactly where you are?"
    ],
    tools: [
      { name: "Five Whys", action: "Ask 'Why?' five times to get to the core of this goal." },
      { name: "Vision Scripting", action: "Describe a day in your life 6 months from now where this is solved." }
    ]
  },
  consistency: {
    id: "consistency",
    title: "Small Steps + Consistency",
    principle: "Small steps compound.",
    keywords: ["habit", "routine", "schedule", "time", "busy", "skip", "streak", "hard", "tired"],
    pocketLines: [
      "Don't break the chain.",
      "Intensity is overrated; consistency is the secret.",
      "Show up, even if it's just for two minutes."
    ],
    prompts: [
      "What is the smallest possible step you can take today?",
      "What is one friction point we can remove from your routine?",
      "If you could only do 5 minutes today, what would you do?"
    ],
    tools: [
      { name: "Chain Building", action: "Let's mark an X for today. Keep the streak alive." },
      { name: "2-Minute Rule", action: "Shrink the task down to something that takes 2 minutes." }
    ]
  },
  mindset: {
    id: "mindset",
    title: "Mindset over Method",
    principle: "Your identity drives your actions.",
    keywords: ["believe", "doubt", "imposter", "fake", "can't", "identity", "fear", "scared"],
    pocketLines: [
      "Evidence builds confidence.",
      "You are what you do repeatedly.",
      "Action alters attitude."
    ],
    prompts: [
      "What would the person you want to be do in this situation?",
      "What evidence do you have that contradicts that doubt?",
      "Are you acting out of fear or out of vision?"
    ],
    tools: [
      { name: "Identity Statement", action: "Complete this sentence: 'I am the kind of person who...'" },
      { name: "Evidence Log", action: "List 3 things you did this week that prove you are changing." }
    ]
  },
  adaptation: {
    id: "adaptation",
    title: "Feedback & Adaptation",
    principle: "Failure isn't final; it's data.",
    keywords: ["fail", "failed", "mistake", "wrong", "change", "adjust", "pivot", "stuck"],
    pocketLines: [
      "It's not failure, it's feedback.",
      "Be stubborn about the goal, but flexible about the method.",
      "A plane is off-course 90% of the time; it just keeps correcting."
    ],
    prompts: [
      "What did we learn from this that we didn't know yesterday?",
      "If you could do this week over, what's the one thing you'd change?",
      "What is working? Let's double down on that."
    ],
    tools: [
      { name: "Feedback Loop", action: "Let's review: What happened? Why? What next?" },
      { name: "OODA Loop", action: "Let's pause. Observe the situation. Re-orient to your goal. Decide one move." }
    ]
  },
  courage: {
    id: "courage",
    title: "Courageous Action",
    principle: "Courage isn't the absence of fear; it's acting despite it.",
    keywords: ["afraid", "anxious", "later", "tomorrow", "wait", "ready", "perfect"],
    pocketLines: [
      "Do it afraid.",
      "Action cures fear.",
      "The perfect time never arrives."
    ],
    prompts: [
      "What are you waiting for permission to do?",
      "What is the worst that could happen? And could you survive it?",
      "If you knew you'd handle whatever happens, what would you do right now?"
    ],
    tools: [
      { name: "Courage Compass", action: "Identify where the fear is pointing. That's usually the way." },
      { name: "Decision Writing", action: "Write down the decision you're avoiding. Just seeing it helps." }
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

type UserContext = {
  name: string;
  goal: string;
  obstacle: string;
  streak: number;
  treeStage: number;
  waterLevel: number;
};

export function generateJaeResponse(userText: string, ctx: UserContext): { text: string; mood: 'happy' | 'neutral' | 'sad' } {
  const module = analyzeIntent(userText);
  const lowerText = userText.toLowerCase();
  const greeting = ctx.name ? `${ctx.name}, ` : "";

  const isPositive = /done|did it|good|great|completed|finished|accomplished|nailed/.test(lowerText);

  if (module) {
    const pocketLine = pick(module.pocketLines);
    const prompt = pick(module.prompts);
    const tool = pick(module.tools);

    let contextLine = "";
    if (ctx.goal && (module.id === "clarity" || module.id === "consistency")) {
      contextLine = `\n\nYour goal — "${ctx.goal}" — is worth fighting for.`;
    }
    if (ctx.obstacle && (module.id === "adaptation" || module.id === "mindset" || module.id === "courage")) {
      contextLine = `\n\nYou told me "${ctx.obstacle}" gets in the way. Let's work with that.`;
    }

    const streakLine = ctx.streak > 0 ? `\n\nYou're on a ${ctx.streak}-day streak. Keep it alive.` : "";

    return {
      text: `${greeting}${pocketLine}${contextLine}\n\n${prompt}\n\nTry this: ${tool.action} (${tool.name})${streakLine}`,
      mood: isPositive ? 'happy' : 'neutral',
    };
  }

  if (isPositive) {
    const goalRef = ctx.goal ? ` Every step like this brings you closer to "${ctx.goal}".` : "";
    return {
      text: `${greeting}that's a win.${goalRef}\n\nWhat made it click for you today?`,
      mood: 'happy',
    };
  }

  const fallbackPrompts = [
    ctx.goal
      ? `${greeting}let's zoom in. When you think about "${ctx.goal}", what feels like the next right step?`
      : `${greeting}what's the one thing on your mind right now that you want to move forward on?`,
    ctx.obstacle
      ? `${greeting}you mentioned "${ctx.obstacle}" holds you back. What does that look like today?`
      : `${greeting}what's one thing standing between you and progress right now?`,
    `${greeting}break it down for me — what happened, and where do you want to go from here?`,
    ctx.streak > 0
      ? `${greeting}you're ${ctx.streak} days in. What's keeping you going?`
      : `${greeting}every journey starts somewhere. What's the smallest move you can make today?`,
  ];

  return {
    text: pick(fallbackPrompts),
    mood: 'neutral',
  };
}
