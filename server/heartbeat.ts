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
      "Confusion is just clarity that hasn't been earned yet.",
      "One clear sentence about what you want beats a hundred vague ideas.",
      "Clarity sharpens in motion, not in stillness.",
      "You're closer to knowing than you think. The next step will prove it.",
      "What feels murky now will make sense once you start.",
      "The path doesn't reveal itself to people who stand still.",
      "You can think about this forever or try something and learn in five minutes.",
      "Overthinking is the opposite of clarity. Move first, refine later.",
      "Purpose doesn't arrive fully formed. It gets built through action.",
      "A vague plan executed beats a perfect plan imagined.",
      "You already know more than you're giving yourself credit for.",
      "Clear next steps beat grand visions every time.",
      "When everything feels uncertain, narrow the frame. What's the smallest thing you know?"
    ],
    prompts: [
      "If you couldn't fail, what would you go after first?",
      "Who are you becoming by chasing this?",
      "What's it costing you to stay right here?",
      "What would make you proud to look back on six months from now?",
      "If you had to explain your goal to a stranger in one sentence, what would you say?",
      "What's the one thing you know for sure about what you want?",
      "What part of the path feels clearest to you right now?",
      "What would tomorrow look like if this problem was already solved?",
      "If you removed every 'should' — what would you actually want?",
      "What part of this have you been avoiding naming out loud?",
      "What's the simplest version of the outcome you're after?",
      "What matters more — the method or the destination?",
      "If you had to bet on one direction right now, which would it be?",
      "What question are you avoiding that would give you the most clarity?",
      "What would you need to see or feel to know you're on the right track?"
    ],
    tools: [
      { name: "Five Whys", action: "Ask 'Why?' five times. Get to the root." },
      { name: "Vision Scripting", action: "Describe one day, six months from now, where this is handled." },
      { name: "One-Sentence Goal", action: "Write your goal in one sentence. No filler." },
      { name: "Reverse Clarity", action: "Describe what you don't want. Sometimes that reveals what you do." },
      { name: "Priority Filter", action: "List everything on your mind. Circle the one that matters most." },
      { name: "Decision Deadline", action: "Give yourself 24 hours to decide. Pressure creates clarity." }
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
      "Missing once is an accident. Missing twice is a pattern.",
      "Progress hides inside boring repetition.",
      "The compound effect doesn't care about your mood. It rewards showing up.",
      "A short workout beats a skipped one every single time.",
      "Routines aren't restrictive. They're freeing.",
      "You don't rise to the level of your goals. You fall to the level of your systems.",
      "Today's effort is tomorrow's evidence.",
      "Perfection is the enemy of consistency.",
      "Tiny actions repeated daily will always outperform occasional big ones.",
      "The streak is the proof. Protect it.",
      "Consistency isn't about doing it perfectly. It's about doing it again.",
      "The only habit that fails is the one you abandon.",
      "Average effort applied consistently beats exceptional effort applied occasionally."
    ],
    prompts: [
      "What's the smallest version of this you could do today?",
      "What's one friction point we can cut from your routine?",
      "If you only had five minutes, what would you do?",
      "What did you do yesterday that you can repeat right now?",
      "Which part of your routine feels the most fragile?",
      "What's the one habit that, if you kept it, would change everything?",
      "When do you usually fall off — and what could you do differently?",
      "What does your ideal morning routine look like in three steps?",
      "What's the first thing you do when motivation disappears?",
      "What small win can you stack on top of yesterday's?",
      "If you designed the easiest possible version of this habit, what would it be?",
      "What triggers your best days vs your worst?",
      "What's one thing you've been consistent at without even trying? What can you learn from that?",
      "How can you make the right choice the easiest choice?",
      "Where in your day is there a two-minute gap you could fill with progress?"
    ],
    tools: [
      { name: "Chain Building", action: "Mark today. Keep the streak alive." },
      { name: "2-Minute Rule", action: "Shrink it to two minutes. Start there." },
      { name: "Anchor Habit", action: "Attach it to something you already do every day." },
      { name: "Minimum Viable Effort", action: "Do the bare minimum version. Just don't skip." },
      { name: "Environment Design", action: "Set up your space so the right choice is the easy one." },
      { name: "Habit Stack", action: "After [current habit], I will [new habit]. Write it down." }
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
      "Stop trying to feel ready. Start acting like someone who is.",
      "Your thoughts are suggestions, not commands.",
      "The person you want to be doesn't wait for confidence. They build it.",
      "Self-trust isn't given. It's earned through kept promises to yourself.",
      "Fear and growth ride the same wave. You don't get one without the other.",
      "What you believe about yourself becomes the ceiling. Raise it.",
      "Imposter syndrome means you're in the right room. Grow into it.",
      "You don't need to fix your mindset. You need to act in spite of it.",
      "The evidence you need is created by the actions you take.",
      "Old versions of you had old limits. You're not that person anymore.",
      "Confidence is a lagging indicator. Action is the leading one.",
      "The method matters less than the person executing it.",
      "Who you think you are determines what you think is possible."
    ],
    prompts: [
      "What would the person you're becoming do right now?",
      "What evidence contradicts that doubt?",
      "Are you moving from fear or from vision?",
      "When was the last time you did something you didn't think you could?",
      "What story are you telling yourself that's keeping you stuck?",
      "If your best friend said what you're saying, what would you tell them?",
      "What's one belief about yourself you're ready to let go of?",
      "What would you attempt if you knew your skills were enough?",
      "What's one thing you've already proven you're capable of?",
      "What version of yourself do you want to strengthen this week?",
      "Where is doubt protecting you from something you actually want?",
      "What promise can you make to yourself today — and keep?",
      "What would shift if you stopped asking 'Can I?' and started asking 'How will I?'",
      "What's one area where your actions already exceed your beliefs?",
      "What would your life look like if you fully trusted yourself?"
    ],
    tools: [
      { name: "Identity Statement", action: "Finish this: 'I am the kind of person who...'" },
      { name: "Evidence Log", action: "Name three things you did this week that prove you're changing." },
      { name: "Belief Audit", action: "Write down the thought holding you back. Then write the opposite." },
      { name: "Future Self Letter", action: "Write one paragraph from the version of you who already made it." },
      { name: "Reframe Practice", action: "Take your biggest doubt and rewrite it as a challenge to solve." },
      { name: "Identity Alignment", action: "List three actions the person you want to be takes daily. Do one now." }
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
      "Every wrong turn still teaches you the map.",
      "The problem isn't that you fell. It's staying down.",
      "Data doesn't care about your feelings. Use what it's showing you.",
      "Iteration beats perfection. Keep refining.",
      "What worked last month might not work now. And that's fine.",
      "Rigid plans break. Flexible ones survive.",
      "Mistakes aren't setbacks. They're tuition for the next attempt.",
      "The fastest learners are the ones who fail and adjust quickest.",
      "You're not behind. You're recalibrating.",
      "The method changed. The goal didn't. Keep moving.",
      "Being stuck means you've outgrown the current approach.",
      "Progress isn't a straight line. It zigzags. That's normal.",
      "Adaptation is intelligence in action."
    ],
    prompts: [
      "What did that teach you that you didn't know before?",
      "If you could redo this week, what's the one thing you'd change?",
      "What is working? Let's lean into that.",
      "Where did you try too hard instead of trying differently?",
      "What would you do if this obstacle was actually feedback?",
      "What's the smallest adjustment that could make the biggest difference?",
      "What would you tell someone else in this exact situation?",
      "What worked last week that you stopped doing?",
      "If this approach isn't working, what's the alternative you haven't tried?",
      "What's the pattern you keep repeating? And what would break it?",
      "What's one thing you'd keep, one thing you'd cut, and one thing you'd add?",
      "Where are you being stubborn about the method instead of the goal?",
      "What would happen if you tried the opposite of what you've been doing?",
      "What lesson keeps showing up that you haven't fully absorbed yet?",
      "If you treated this like an experiment instead of a test, what would change?"
    ],
    tools: [
      { name: "Feedback Loop", action: "What happened? Why? What's the next move?" },
      { name: "OODA Loop", action: "Pause. Observe. Re-orient to the goal. Decide one move." },
      { name: "Pivot Check", action: "Is this a dead end or a detour? Name which one." },
      { name: "After-Action Review", action: "What went right? What went wrong? What will you do next time?" },
      { name: "Experiment Frame", action: "Reframe this as a 7-day experiment. What will you test?" },
      { name: "Keep/Cut/Add", action: "Name one thing to keep, one to cut, one to add." }
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
      "The gap between wanting and having is doing.",
      "Tomorrow is where procrastination hides. Today is where change happens.",
      "Hesitation is a habit. So is action. Pick one.",
      "The discomfort you feel is the border of your growth zone.",
      "You've survived worse than this. Move.",
      "Fear shrinks when you walk toward it.",
      "Delaying the hard thing doesn't make it easier. It makes it heavier.",
      "The version of you on the other side of this already exists. Go meet them.",
      "Waiting for confidence is waiting forever. Start without it.",
      "Every bold move you've ever made started with a decision to stop waiting.",
      "Courage is a muscle. The only way to build it is to use it.",
      "What looks like risk to others looks like progress to someone ready to grow.",
      "You don't need a green light. You just need to go."
    ],
    prompts: [
      "What are you waiting for permission to do?",
      "Worst case — could you survive it?",
      "If you knew you'd handle whatever comes, what would you do right now?",
      "What's the one thing you keep putting off?",
      "What would you do today if no one was watching?",
      "What's on the other side of the thing you're avoiding?",
      "What decision would your future self thank you for making today?",
      "What would happen if you just started — imperfectly, messily — right now?",
      "What are you protecting by not acting?",
      "What does playing it safe cost you in the long run?",
      "If someone you admired was watching, what would you do?",
      "What's one uncomfortable conversation you've been dodging?",
      "What's the next bold step that scares you a little?",
      "Where are you choosing comfort over growth right now?",
      "What would you regret not doing a year from now?"
    ],
    tools: [
      { name: "Courage Compass", action: "Where the fear points is usually the way." },
      { name: "Decision Writing", action: "Write the decision you're avoiding. Just naming it helps." },
      { name: "10-Second Rule", action: "Count to ten, then move. Don't let hesitation win." },
      { name: "Fear Inventory", action: "List what scares you about this. Then cross off what you can survive." },
      { name: "Ship Date", action: "Set a date for action. Put it somewhere you'll see it." },
      { name: "Bold Move Log", action: "Write down one brave thing you did recently. Proof you can do it again." }
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
    "Starting small isn't thinking small. It's thinking smart.",
    "Everything strong started invisible.",
    "You're building the foundation. This part matters most.",
    "The beginning is quiet. That's okay. It's still real.",
    "Nobody sees the roots. But they hold up the whole tree.",
    "You chose to begin. Most people never get here.",
    "Plant it. Water it. Wait. That's the job right now.",
    "Seeds don't rush. Neither should you.",
    "This stage asks for patience. Give it."
  ],
  sprout: [
    "You're finding your rhythm. Stay in it.",
    "Momentum is building. Don't second-guess it.",
    "Consistency is feeding the seed. Keep watering.",
    "You're past the hardest part — the beginning. Now build on it.",
    "Small signs of growth are still growth.",
    "The routine is taking shape. Protect it.",
    "You've proven you can start. Now prove you can continue.",
    "Sprouts are fragile. Guard what you've started.",
    "Something is pushing through. Don't stop now.",
    "Repetition is the soil. You're feeding it.",
    "You're not just dreaming anymore. You're doing.",
    "This stage rewards patience and persistence.",
    "The hard part was starting. Now the work is staying.",
    "Your habits are forming. This is the critical window.",
    "Growth is quiet here. But it's real."
  ],
  growth: [
    "Growth lives in the tension. Lean into it.",
    "You've built roots. Now stretch.",
    "This part isn't comfortable. That's how you know it's working.",
    "You're in the middle — the part most people quit. Keep going.",
    "The work is harder here because the stakes are real now.",
    "Growth means outgrowing old habits. Let them go.",
    "Discomfort is the price of expansion. You can afford it.",
    "You're past easy. Now you're building something real.",
    "The edges are rough here. That means you're being shaped.",
    "Growing pains are a good sign. They mean you're moving.",
    "This stage tests your adaptability. Rise to it.",
    "What got you here won't get you there. Time to level up.",
    "Resistance means you're pushing into new territory.",
    "The middle is where discipline overtakes motivation.",
    "You're growing beyond the version of yourself that started this."
  ],
  bloom: [
    "You're in bloom. Stay humble. Stay hungry.",
    "Your effort is showing. Don't coast.",
    "Keep the soil rich. Every season still matters.",
    "This stage is earned, not given. Honor it with consistency.",
    "Bloom doesn't mean finished. It means ready for the next level.",
    "Success without maintenance is temporary. Keep tending.",
    "You've grown into this. Now grow others.",
    "Mastery isn't a destination. It's a practice.",
    "The harvest is here. Don't forget what planted it.",
    "Stay grounded. Stay generous. The roots still need water.",
    "This is where complacency becomes the new enemy.",
    "Your bloom is proof of what consistency creates.",
    "Celebrate this. Then keep going. The next season is coming.",
    "Others are watching. Let your actions keep speaking.",
    "You didn't get here by accident. Remember what it took."
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

function fillTemplate(template: string, ctx: UserContext, weakLabel: string): string {
  return template
    .replace(/\{weak\}/g, weakLabel.toLowerCase())
    .replace(/\{goal\}/g, ctx.goal)
    .replace(/\{obs\}/g, ctx.obstacle)
    .replace(/\{streak\}/g, String(ctx.streak))
    .replace(/\{streak1\}/g, String(ctx.streak + 1));
}

const POSITIVE_ACKS = [
  "that's a win.",
  "solid.",
  "there it is.",
  "you showed up and delivered.",
  "that's the kind of move that compounds.",
  "rep logged. That one counted.",
  "momentum earned.",
  "noted. That's progress.",
  "clean execution.",
  "real work. Real result.",
  "the proof is in the doing. And you did it.",
  "no shortcuts. Just effort.",
  "that's what commitment looks like.",
  "nothing wasted today.",
  "that just raised the floor.",
  "stacked another one.",
  "that's effort you can point to.",
  "you made it count.",
];

const POSITIVE_QUESTIONS = [
  "What made it click today?",
  "What pushed you past the resistance?",
  "How did it feel to follow through?",
  "What part of that do you want to repeat?",
  "What shifted inside you when you did it?",
  "What can you carry from today into tomorrow?",
  "What's the one thing that helped you get it done?",
  "Would you do anything differently next time?",
  "What did you learn about yourself in that moment?",
  "What habit did that reinforce?",
  "What part of your routine made that possible?",
  "How can you set yourself up for the same result tomorrow?",
  "What would it look like to build on this?",
  "If this became a pattern, where would you be in 30 days?",
  "What does this tell you about what you're capable of?",
];

const ACTION_WEAK = [
  "Give five minutes to {weak} today.",
  "Put some attention on {weak} — even a small effort counts.",
  "One focused action on {weak} will move the needle.",
  "Spend a few minutes strengthening {weak} today.",
  "Do one thing for {weak}. That's the assignment.",
  "Channel some energy toward {weak} — it's where the growth is waiting.",
  "Direct your next ten minutes toward {weak}.",
  "{weak} is asking for your attention. Give it something real.",
  "One intentional action on {weak} today shifts the trajectory.",
  "Put {weak} first today. Everything else can wait.",
  "Today's focus: {weak}. One move. That's it.",
  "Invest in {weak} today. The return will surprise you.",
  "{weak} won't improve on its own. Give it something small.",
  "One rep on {weak}. Consistency starts here.",
  "Feed {weak} with one deliberate action today.",
];

const ACTION_GOAL = [
  "Take one step toward \"{goal}\" today.",
  "Move \"{goal}\" forward — even an inch counts.",
  "One action toward \"{goal}\" before the day ends.",
  "Put ten minutes into \"{goal}\" right now.",
  "Do one thing that brings \"{goal}\" closer.",
  "Push \"{goal}\" one step further today.",
  "Give \"{goal}\" your next available ten minutes.",
  "One move for \"{goal}\". Make it concrete.",
  "Advance \"{goal}\" today — action over intention.",
  "Chip away at \"{goal}\" with one deliberate step.",
  "\"{goal}\" deserves your energy today. Give it some.",
  "One focused effort on \"{goal}\" changes the timeline.",
  "What's the smallest action that moves \"{goal}\" forward? Do that.",
  "Make \"{goal}\" real today with one tangible move.",
  "Put \"{goal}\" in motion. Even five minutes of effort counts.",
];

const ACTION_GENERAL = [
  "Pick one thing and move it forward today.",
  "Choose one priority and give it your attention.",
  "Name one thing that matters and take one step.",
  "Find the one move that will make today count.",
  "Commit to one action before the day is over.",
  "Do one thing with intention today.",
  "The agenda is simple — one step forward.",
  "What's the one thing worth your effort today? Do that.",
  "Pick the hardest thing on your list and give it five minutes.",
  "Identify the priority. Then move on it.",
  "Choose progress over perfection today.",
  "Start something. Finish something. Or continue something.",
  "One meaningful action. That's all today needs.",
  "Name the priority. Then protect the time for it.",
  "Today's win is waiting. Go claim it.",
];

const QUESTION_OBSTACLE = [
  "When \"{obs}\" shows up, what's your counter-move?",
  "How are you planning to handle \"{obs}\" today?",
  "What's your defense when \"{obs}\" hits?",
  "If \"{obs}\" shows up later, what will you do differently?",
  "How will you push through when \"{obs}\" tries to slow you down?",
  "What's your plan for the next time \"{obs}\" appears?",
  "When \"{obs}\" knocks, what will you do instead of opening the door?",
  "How are you going to outwork \"{obs}\" today?",
  "What's one way you can reduce the power \"{obs}\" has over your day?",
  "If \"{obs}\" tried to stop you right now, what would you say back?",
  "What's different about today that \"{obs}\" can't touch?",
  "How will you spot \"{obs}\" early and reroute?",
  "What's the opposite of \"{obs}\"? Can you practice that today?",
  "When \"{obs}\" gets loud, what quiets it down?",
  "What tools do you have to handle \"{obs}\" before it takes over?",
];

const QUESTION_GOAL = [
  "What's one move toward \"{goal}\" you can make right now?",
  "What would push \"{goal}\" forward by the end of today?",
  "What's the next step that brings \"{goal}\" within reach?",
  "If you could only do one thing for \"{goal}\" today, what would it be?",
  "What part of \"{goal}\" can you chip away at right now?",
  "Where does \"{goal}\" need the most attention this week?",
  "What does progress on \"{goal}\" look like today?",
  "What's between you and the next milestone for \"{goal}\"?",
  "How will you measure progress on \"{goal}\" this week?",
  "What's the most impactful thing you could do for \"{goal}\" today?",
  "What's the thing about \"{goal}\" that you've been postponing?",
  "If \"{goal}\" had a deadline of one week, what would you do first?",
  "What's one action for \"{goal}\" that takes less than ten minutes?",
  "Where is \"{goal}\" stuck — and what loosens it?",
  "What would \"{goal}\" look like one step further than where it is now?",
];

const QUESTION_GENERAL = [
  "What felt hardest this week — and what did it teach you?",
  "Where did you surprise yourself lately?",
  "What's one thing you'd do differently if you restarted this week?",
  "What's been on your mind that you haven't said out loud yet?",
  "What's the truth you're dancing around right now?",
  "What's the one thing you're avoiding that would actually help?",
  "What area of your life needs the most honesty right now?",
  "What drained your energy this week — and what refilled it?",
  "If you were coaching yourself, what would you say?",
  "What would you need to let go of to move forward?",
  "What's one area where you're holding yourself to someone else's standard?",
  "What would today look like if you gave yourself full permission to try?",
  "Where did you grow this week without realizing it?",
  "What's one pattern you're ready to break?",
  "What does your gut say about what to do next?",
];

const HOOK_WEAK = [
  "This is your lowest heartbeat — sharpening it changes everything.",
  "This is your growth edge. Lean into it.",
  "This heartbeat needs the most attention. That's where the breakthrough lives.",
  "Your weakest heartbeat is also your biggest opportunity.",
  "This is the signal your check-in flagged. Pay attention.",
  "This is where the real work is. And you're ready for it.",
  "Strengthening this one area will ripple across everything else.",
  "The score is low here — but the potential is wide open.",
  "This is the part of the puzzle that unlocks the rest.",
  "Your check-in pointed here for a reason.",
  "This heartbeat is asking for your attention.",
  "Low score, high potential. That's the opportunity.",
  "This is the one that moves the others if you work on it.",
  "Growth starts where the score is lowest.",
  "The gap here is where the next breakthrough hides.",
];

const HOOK_OBSTACLE = [
  "You said \"{obs}\" gets in the way — let's use that.",
  "You named \"{obs}\" as your obstacle. Time to outwork it.",
  "\"{obs}\" is the pattern. Let's break it.",
  "You told me \"{obs}\" holds you back. Not today.",
  "\"{obs}\" is the thing to beat. You already know it.",
  "You've identified \"{obs}\". That gives you an advantage.",
  "\"{obs}\" won't disappear. But you can outmaneuver it.",
  "You flagged \"{obs}\". Now let's build around it.",
  "Knowing \"{obs}\" is half the battle. Strategy is the other half.",
  "\"{obs}\" has been running the show. Time to change that.",
  "You see \"{obs}\" coming. That means you can plan for it.",
  "\"{obs}\" only wins when it catches you off guard.",
  "You named it. Now own it. \"{obs}\" doesn't get to drive.",
  "\"{obs}\" is familiar. But familiar doesn't mean unstoppable.",
  "Every time \"{obs}\" shows up, you get to choose differently.",
];

const HOOK_GOAL = [
  "This connects to \"{goal}\".",
  "Keep \"{goal}\" in sight.",
  "This ties back to \"{goal}\" — every move counts.",
  "\"{goal}\" is what this is about.",
  "Everything you're doing feeds \"{goal}\".",
  "\"{goal}\" doesn't happen by accident. This effort matters.",
  "This is part of the path to \"{goal}\".",
  "\"{goal}\" is on the line. Stay with it.",
  "Remember — \"{goal}\" is why you're here.",
  "Each step here is a step toward \"{goal}\".",
  "This work is in service of \"{goal}\".",
  "\"{goal}\" needs exactly this kind of effort.",
  "This is \"{goal}\" in action.",
  "What you're doing right now builds \"{goal}\".",
  "\"{goal}\" gets closer with every move like this.",
];

const FALLBACK_ACKS_GOAL = [
  "let's focus on \"{goal}\".",
  "\"{goal}\" is on the board. Let's work it.",
  "eyes on \"{goal}\".",
  "back to \"{goal}\" — what's next?",
  "\"{goal}\" won't move itself. Let's go.",
  "let's talk about \"{goal}\".",
  "\"{goal}\" is still the mission.",
  "your north star is \"{goal}\". Let's navigate.",
  "the target is \"{goal}\". What's the next play?",
  "everything comes back to \"{goal}\".",
  "\"{goal}\" is waiting for today's effort.",
  "\"{goal}\" needs action. What do you have?",
  "let's push \"{goal}\" forward.",
  "\"{goal}\" — that's what we're building toward.",
  "\"{goal}\" doesn't take days off. Neither should we.",
];

const FALLBACK_ACKS_GENERAL = [
  "let's get moving.",
  "let's make something happen.",
  "ready when you are.",
  "let's find the next step.",
  "time to move.",
  "let's build on what you've got.",
  "let's make today count.",
  "momentum starts now.",
  "let's get to work.",
  "the next step is waiting.",
  "let's keep this going.",
  "forward is the only direction.",
  "today has potential. Let's use it.",
  "something needs to move today. What is it?",
  "let's figure out the next step.",
];

const FALLBACK_ACTIONS_WEAK = [
  "Your focus area is {weak} — one small move there today.",
  "{weak} is the priority. Start small.",
  "A few minutes on {weak} today will compound over time.",
  "{weak} is where the growth is. Give it something.",
  "Put {weak} at the top of the list.",
  "Direct today's energy toward {weak}.",
  "{weak} scored lowest. Give it your first effort today.",
  "One step on {weak}. That's the move.",
  "{weak} improves when you show up for it. Even briefly.",
  "Today's assignment: {weak}. Keep it simple.",
  "Start with {weak}. One focused action.",
  "{weak} is the lever. Pull it.",
  "Give {weak} something real today — not tomorrow.",
  "Focus on {weak} for just a few minutes. It adds up.",
  "{weak} is the area with the most room to grow. Feed it.",
];

const FALLBACK_ACTIONS_GENERAL = [
  "Pick one thing and take one step forward.",
  "Choose one area and give it five minutes.",
  "Name one thing worth doing today and do it.",
  "One move. That's all it takes to keep going.",
  "Find the simplest next action and take it.",
  "Start anywhere. Just start.",
  "Choose progress, not perfection.",
  "One task. One attempt. One step.",
  "Give your best effort to one thing today.",
  "Put five minutes toward something meaningful.",
  "The smallest move still counts. Make it.",
  "What's the lowest-effort action that still creates progress? Do that.",
  "Today doesn't need to be big. It needs to be intentional.",
  "Commit to one thing. Then follow through.",
  "Progress hides in small, daily decisions. Make one now.",
];

const FALLBACK_QUESTIONS_OBSTACLE = [
  "What does \"{obs}\" look like for you today?",
  "How is \"{obs}\" showing up right now?",
  "When \"{obs}\" hits today, what's your plan?",
  "What will you do differently when \"{obs}\" tries to take over?",
  "Where do you feel \"{obs}\" pulling you off course?",
  "What's one way to shrink the power of \"{obs}\" today?",
  "How early can you spot \"{obs}\" before it takes hold?",
  "What's the first thing that happens when \"{obs}\" shows up?",
  "If you could remove \"{obs}\" for one hour, what would you accomplish?",
  "What does \"{obs}\" cost you when it wins?",
  "How did you handle \"{obs}\" the last time it surfaced?",
  "What's different about today that could help you beat \"{obs}\"?",
  "Where does \"{obs}\" hide in your routine?",
  "When \"{obs}\" speaks, what does it usually say?",
  "What's one small boundary you can set against \"{obs}\" today?",
];

const FALLBACK_QUESTIONS_GENERAL = [
  "What's between you and your next step?",
  "What's the one thing holding you back right now?",
  "Where do you feel the most resistance?",
  "What needs your attention most today?",
  "What would make today feel like progress?",
  "What's the simplest thing you can do right now to move forward?",
  "What's asking for your energy today?",
  "If you could solve one thing today, what would it be?",
  "What are you putting off that would take less than ten minutes?",
  "What's the thing you keep circling back to in your head?",
  "What would you tackle first if nothing else mattered?",
  "Where are you spending energy that isn't serving you?",
  "What's one thing you wish someone would remind you of?",
  "If you had to choose one priority for this week, what would it be?",
  "What would feel different tomorrow if you acted on something today?",
];

export function generateJaeResponse(userText: string, ctx: UserContext): { text: string; mood: 'happy' | 'neutral' | 'sad' } {
  const module = analyzeIntent(userText);
  const lowerText = userText.toLowerCase();
  const n = ctx.name ? `${ctx.name}, ` : "";
  const stage = ctx.stage || "";
  const weakLabel = ctx.weakestHeartbeat ? ctx.weakestHeartbeat.charAt(0).toUpperCase() + ctx.weakestHeartbeat.slice(1) : "";
  const dataLine = buildDataLine(ctx, weakLabel);
  const f = (t: string) => fillTemplate(t, ctx, weakLabel);

  const isPositive = /done|did it|good|great|completed|finished|accomplished|nailed/.test(lowerText);

  if (module) {
    const line = pick(module.lines);
    const prompt = pick(module.prompts);

    let contextHook = "";
    if (module.id === ctx.weakestHeartbeat) {
      contextHook = " " + pick(HOOK_WEAK);
    } else if (ctx.obstacle && (module.id === "adaptation" || module.id === "mindset" || module.id === "courage")) {
      contextHook = " " + f(pick(HOOK_OBSTACLE));
    } else if (ctx.goal) {
      contextHook = " " + f(pick(HOOK_GOAL));
    }

    let action = "";
    if (ctx.goal && weakLabel) {
      action = f(pick(ACTION_WEAK));
    } else if (ctx.goal) {
      action = f(pick(ACTION_GOAL));
    } else if (weakLabel) {
      action = f(pick(ACTION_WEAK));
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
      action = f(pick(ACTION_WEAK));
    } else if (ctx.goal) {
      action = f(pick(ACTION_GOAL));
    } else {
      action = pick(ACTION_GENERAL);
    }

    let question = "";
    if (ctx.obstacle) {
      question = f(pick(QUESTION_OBSTACLE));
    } else if (ctx.goal) {
      question = f(pick(QUESTION_GOAL));
    } else {
      question = pick(QUESTION_GENERAL);
    }

    return {
      text: `${n}${stageLine}\n${dataLine}\n${action}\n\n${question}`,
      mood: 'neutral',
    };
  }

  const ack = ctx.goal
    ? `${n}${f(pick(FALLBACK_ACKS_GOAL))}`
    : `${n}${pick(FALLBACK_ACKS_GENERAL)}`;
  const action = weakLabel
    ? f(pick(FALLBACK_ACTIONS_WEAK))
    : pick(FALLBACK_ACTIONS_GENERAL);
  const question = ctx.obstacle
    ? f(pick(FALLBACK_QUESTIONS_OBSTACLE))
    : pick(FALLBACK_QUESTIONS_GENERAL);

  return {
    text: `${ack}\n${dataLine}\n${action}\n\n${question}`,
    mood: 'neutral',
  };
}
