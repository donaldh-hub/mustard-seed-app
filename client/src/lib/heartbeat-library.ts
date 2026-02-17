// Knowledge Library for Weeks 2-6
// Structured for retrieval by the Heartbeat Logic Relay

export type HeartbeatModule = {
  id: string;
  title: string;
  principle: string;
  keywords: string[];
  pocketLines: string[];
  prompts: string[]; // Reflection prompts
  tools: {
    name: string;
    description: string;
    action: string;
  }[];
};

export const HEARTBEAT_LIBRARY: Record<string, HeartbeatModule> = {
  clarity: {
    id: "clarity",
    title: "Clarity of Vision & Why",
    principle: "Movement without direction is just noise. We need to know where we're going and why it matters.",
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
      {
        name: "Five Whys",
        description: "Dig deeper to find the root motivation.",
        action: "Ask 'Why?' five times to get to the core of this goal."
      },
      {
        name: "Vision Scripting",
        description: "Write it as if it's already true.",
        action: "Describe a day in your life 6 months from now where this is solved."
      }
    ]
  },
  consistency: {
    id: "consistency",
    title: "Small Steps + Consistency",
    principle: "We overestimate what we can do in a day and underestimate what we can do in a month. Small steps compound.",
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
      {
        name: "Chain Building",
        description: "Don't break the chain of daily actions.",
        action: "Let's mark an X for today. Keep the streak alive."
      },
      {
        name: "2-Minute Rule",
        description: "Make it so easy you can't say no.",
        action: "Shrink the task down to something that takes 2 minutes."
      }
    ]
  },
  mindset: {
    id: "mindset",
    title: "Mindset over Method",
    principle: "Your identity drives your actions. You don't just 'run'; you are a 'runner'.",
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
      {
        name: "Identity Statement",
        description: "Reframe your self-talk.",
        action: "Complete this sentence: 'I am the kind of person who...'"
      },
      {
        name: "Evidence Log",
        description: "Collect proof of your new identity.",
        action: "List 3 things you did this week that prove you are changing."
      }
    ]
  },
  adaptation: {
    id: "adaptation",
    title: "Feedback & Adaptation",
    principle: "Failure isn't final; it's data. We iterate, we don't quit.",
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
      {
        name: "Feedback Loop",
        description: "Analyze what happened without judgment.",
        action: "Let's review: What happened? Why? What next?"
      },
      {
        name: "OODA Loop",
        description: "Observe, Orient, Decide, Act.",
        action: "Let's pause. Observe the situation. Re-orient to your goal. Decide one move."
      }
    ]
  },
  courage: {
    id: "courage",
    title: "Courageous Action",
    principle: "Courage isn't the absence of fear; it's acting despite it. Waiting for confidence is a trap.",
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
      {
        name: "Courage Compass",
        description: "Navigate towards the fear, not away from it.",
        action: "Identify where the fear is pointing. That's usually the way."
      },
      {
        name: "Decision Writing",
        description: "Get it out of your head and onto paper.",
        action: "Write down the decision you're avoiding. Just seeing it helps."
      }
    ]
  }
};
