import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateJaeResponse, getWeakestHeartbeat, computeHeartbeatScores } from "./heartbeat";
import { insertUserSchema, assessments, insertGoalSchema } from "@shared/schema";
import type { InsertAssessment, Assessment } from "@shared/schema";

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function stripSmartQuotes(text: string): string {
  return text
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    .replace(/^["'\s]+/, "")
    .replace(/["'\s]+$/, "");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/users", async (req, res) => {
    const result = insertUserSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ message: result.error.message });
    const user = await storage.createUser(result.data);
    return res.json(user);
  });

  app.get("/api/users/:id", async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  });

  app.patch("/api/users/:id", async (req, res) => {
    const user = await storage.updateUser(req.params.id, req.body);
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  });

  app.get("/api/users/:userId/messages", async (req, res) => {
    const msgs = await storage.getMessages(req.params.userId);
    return res.json(msgs);
  });

  app.post("/api/users/:userId/messages", async (req, res) => {
    try {
      const userId = req.params.userId;
      const rawText = stripSmartQuotes(String(req.body?.text ?? "").trim());
      if (!rawText) return res.status(400).json({ message: "Text is required" });

      const userMsg = await storage.createMessage({ userId, text: rawText, sender: "user" });

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const name = user.name || "";
      const goal = user.goals?.length ? user.goals[0] : "";
      const obstacle = user.struggles?.length ? user.struggles[0] : "";
      const waterLevel = user.waterLevel ?? 0;
      const treeStage = user.treeStage ?? 1;
      const streak = user.streak ?? 0;
      const greeting = name ? `${name}, ` : "";

      const textLower = rawText.toLowerCase();
      let jaeText = "";
      let shouldWater = false;

      const asksStage = /what('?s| is) my stage/i.test(textLower) || /my stage/i.test(textLower) || /current stage/i.test(textLower);
      const asksFocus = /what should i focus/i.test(textLower) || /focus.*week/i.test(textLower) || /what should i do today/i.test(textLower);
      const asksWeakest = /weakest.*heartbeat/i.test(textLower) || /which heartbeat/i.test(textLower) || /where.*weakest/i.test(textLower);
      const asksSmallStep = /one small step/i.test(textLower) || /small step.*today/i.test(textLower) || /give me.*step/i.test(textLower);

      if (asksStage || asksFocus || asksWeakest || asksSmallStep) {
        const assessment = await storage.getLatestAssessment(userId);
        if (assessment) {
          const answers = assessment.answers as number[];
          const stageEmoji: Record<string, string> = { seed: "🌱", sprout: "🌿", growth: "🌳", bloom: "🌸" };
          const stageName = assessment.stage.charAt(0).toUpperCase() + assessment.stage.slice(1);
          const emoji = stageEmoji[assessment.stage] || "";
          const weakest = getWeakestHeartbeat(answers);

          const wl = weakest.label.toLowerCase();
          const ws = weakest.score.toFixed(1);

          if (asksStage) {
            const goalRef = goal ? ` Goal: "${goal}".` : "";
            const stageActions = [
              "Keep building from here.",
              "Stay on this path.",
              "You've earned this ground. Hold it.",
              "This is where you sharpen everything.",
              "Now use this stage. Don't just sit in it.",
              "Own this position. Build from it.",
              "The ground under you is solid. Push forward.",
              "This stage isn't a label. It's a launchpad.",
              "You're not stuck here. You're grounded here.",
              "What you do at this stage defines the next one.",
              "Use this stage as fuel.",
              "This is your operating level. Work it.",
              "The stage is set. Your move.",
              "Every stage is a checkpoint. You've earned this one.",
              "You know where you stand. That's an advantage.",
            ];
            const stageQuestions = [
              "What's one move you're making today?",
              "What will you do with this stage today?",
              "How are you going to push forward from here?",
              "What's the next step worth taking?",
              "What action does this stage call for?",
              "How do you want to show up at this stage?",
              "What would make this stage feel productive?",
              "What does progress look like from here?",
              "What's one thing you can do to keep building?",
              "If this stage had one assignment, what would you make it?",
              "What part of this stage challenges you most?",
              "What will today's version of you contribute to the next stage?",
              "How can you make the most of where you are right now?",
              "What's the highest-value action for this stage?",
              "What would someone thriving at this stage do today?",
            ];
            jaeText = `${greeting}you're in **${stageName}** ${emoji}.${goalRef} Focus: ${wl}.\n${pick(stageActions)}\n\n${pick(stageQuestions)}`;
          } else if (asksFocus) {
            const focusFrames = [
              `${wl} is your lowest heartbeat — ${ws} out of 5. That's not a weakness. It's a signal.`,
              `${wl} is sitting at ${ws} out of 5. That's your growth edge right now.`,
              `your focus area is ${wl} — ${ws} out of 5. This is where small effort compounds fastest.`,
              `${wl} scored ${ws} out of 5. That's the heartbeat that needs you most.`,
              `right now, ${wl} is at ${ws}. That's where your energy will have the biggest return.`,
              `the data says ${wl} — ${ws} out of 5. That's where the real opportunity is.`,
              `${wl} is the lowest signal at ${ws} out of 5. Time to address it.`,
              `your check-in flagged ${wl} at ${ws}. That's the focus.`,
              `${ws} on ${wl}. Not bad — but it's your floor. Let's raise it.`,
              `${wl} came in at ${ws}. The score tells you where to invest.`,
              `the weakest signal right now is ${wl} at ${ws}. That's your leverage point.`,
              `${wl} at ${ws} out of 5. It's the heartbeat with the most room to grow.`,
              `your ${wl} heartbeat is sitting at ${ws}. It's the quiet one asking for your attention.`,
              `at ${ws}, ${wl} is the area with the widest gap to close.`,
              `${wl}, ${ws} out of 5. This number moves when you move.`,
            ];
            const focusActions = [
              `Five minutes on ${wl} today will compound.`,
              `One focused action on ${wl} today — that's the assignment.`,
              `Put some energy into ${wl} today. Even something small.`,
              `Give ${wl} ten minutes of real attention.`,
              `Direct your next effort toward ${wl}.`,
              `Start the day with ${wl} in mind.`,
              `One concrete step on ${wl} today. Keep it simple.`,
              `Name one thing you can do for ${wl} before tonight.`,
              `Invest in ${wl} today. The return will compound.`,
              `Give ${wl} something tangible today — not a plan, an action.`,
              `${wl} improves when you show up for it. Start today.`,
              `One small rep on ${wl}. That's the play.`,
              `Put ${wl} first today, even if it's just for a few minutes.`,
              `Today's challenge: one move on ${wl}. That's it.`,
              `Feed ${wl} with one deliberate action.`,
            ];
            const focusQuestions = [
              "What does that look like for you?",
              "What's one thing you can do for that today?",
              "How will you show up for that this week?",
              "Where can you start?",
              "What does progress on that feel like?",
              "What's the smallest version of that effort?",
              "When today can you carve out time for that?",
              "What would a focused five minutes on that look like?",
              "What's the first step that comes to mind?",
              "How would you measure progress there this week?",
              "What's one thing you've tried before that worked?",
              "What's the easiest entry point?",
              "What would feel like a win in that area?",
              "If you could only do one thing for it, what would it be?",
              "What part of that feels most within reach today?",
            ];
            jaeText = `${greeting}${pick(focusFrames)}\n${pick(focusActions)}\n\n${pick(focusQuestions)}`;
          } else if (asksWeakest) {
            const weakFrames = [
              `${wl} is at ${ws} out of 5. That's where the biggest growth lives.`,
              `${wl} came in at ${ws} out of 5. That's your opening.`,
              `your lowest heartbeat is ${wl} — ${ws} out of 5. This is the one to watch.`,
              `${wl} scored ${ws} out of 5. Every point you raise here changes the whole picture.`,
              `${wl} at ${ws}. It's your lowest — and your highest-leverage area.`,
              `right now, ${wl} is the gap at ${ws} out of 5.`,
              `your check-in shows ${wl} at ${ws}. That's the floor. Let's raise it.`,
              `${ws} on ${wl}. Not the end — it's the beginning of something.`,
              `${wl} needs the most work at ${ws} out of 5. That's also where the most growth waits.`,
              `the weakest heartbeat right now is ${wl}, sitting at ${ws}.`,
              `${wl}, ${ws} out of 5. This one has the most room to move.`,
              `your lowest signal is ${wl} — ${ws}. Raising it even slightly shifts everything.`,
              `at ${ws}, ${wl} is asking for attention. And that attention will pay off.`,
              `${wl} is the one lagging at ${ws}. But lagging means room to run.`,
              `the data points to ${wl} at ${ws}. That's where the breakthrough starts.`,
            ];
            const weakActions = [
              "Let's sharpen it.",
              "Time to put some work in there.",
              "Small, steady effort on this will shift everything.",
              "This is where your focus pays off most.",
              "One action there today moves the needle.",
              "Start with the smallest step you can take on this.",
              "Give it something real — not a promise, an action.",
              "Progress here changes the score and the trajectory.",
              "Work on this one, and the others benefit too.",
              "Today's effort on this area is tomorrow's evidence.",
              "Even a few minutes here creates momentum.",
              "This is the area worth your best effort.",
              "Focus here and you'll feel the difference everywhere.",
              "It's low, but it's not stuck. You can move it.",
              "The gap is the opportunity. Close it one step at a time.",
            ];
            const weakQuestions = [
              "What's one thing you can do this week to raise that number?",
              "What would moving that number up by even half a point look like?",
              "Where do you want to start?",
              "What's one action that would strengthen this?",
              "What's the first step that comes to mind?",
              "How can you build on this starting today?",
              "What would a stronger version of this heartbeat look like for you?",
              "If you gave this one area full focus for a week, what would you do?",
              "What's the most impactful thing you could try here?",
              "What does one step forward look like for this heartbeat?",
              "What would be different if this score went up by a point?",
              "How can you turn this into your strongest area over time?",
              "What's one experiment you could run on this?",
              "Where is the gap you feel most in your day-to-day?",
              "What change, even small, would you notice if this improved?",
            ];
            jaeText = `${greeting}${pick(weakFrames)}\n${pick(weakActions)}\n\n${pick(weakQuestions)}`;
          } else if (asksSmallStep) {
            const stepFrames = [
              `you're in ${stageName} ${emoji}. ${weakest.label} needs attention.`,
              `${stageName} ${emoji} stage. ${weakest.label} is the priority.`,
              `you're at ${stageName} ${emoji}, and ${wl} is where the next breakthrough lives.`,
              `${stageName} ${emoji}. Your focus: ${wl}.`,
              `at ${stageName} ${emoji}, the best move is something small for ${wl}.`,
              `you're in ${stageName} ${emoji}. The data points to ${wl}.`,
              `${stageName} ${emoji} with ${wl} as the target. Here's the play.`,
              `your stage is ${stageName} ${emoji}. Your growth edge: ${wl}.`,
              `${stageName} ${emoji}. ${wl} is the heartbeat to feed today.`,
              `at ${stageName} ${emoji}, one small action on ${wl} will compound.`,
              `${stageName} ${emoji}. Let's direct today's energy toward ${wl}.`,
              `you're at ${stageName} ${emoji}. The signal says: ${wl}.`,
              `${stageName} ${emoji}. And ${wl} is waiting for your effort.`,
              `your check-in says ${stageName} ${emoji}. ${wl} is where the work is.`,
              `${stageName} ${emoji}. One move on ${wl} — that's the whole plan.`,
            ];
            const stepActions = [
              `One move: five minutes on ${wl}.`,
              `Spend a few minutes on ${wl} today. That's the whole play.`,
              `Give ${wl} one focused effort — even something small shifts the score.`,
              `Five minutes of real effort on ${wl}. No more, no less.`,
              `Pick one action for ${wl}. Keep it simple.`,
              `Do one concrete thing for ${wl} today.`,
              `Today's step: anything that feeds ${wl}.`,
              `Make your next move about ${wl}. Start small.`,
              `One deliberate rep on ${wl} — that's the assignment.`,
              `Direct your next five minutes at ${wl}. Start now.`,
              `Put ${wl} first. One action. Done.`,
              `${wl} gets stronger with one focused moment. Give it that.`,
              `Name one thing you can do for ${wl}. Then do it.`,
              `Start with ${wl}. Keep it to one step.`,
              `The step is: one real action on ${wl} today.`,
            ];
            const stepQuestions = [
              "What will you choose?",
              "What's it going to be?",
              "What action fits your day?",
              "How will you spend those minutes?",
              "What comes to mind first?",
              "What's the easiest version of that?",
              "What step can you take right now?",
              "What does that look like for you today?",
              "What's the simplest action you can commit to?",
              "What feels doable right now?",
              "How will you get started?",
              "What's one concrete thing you can do in the next hour?",
              "Where in your day can you fit this in?",
              "What would the smallest win look like here?",
              "If you only had five minutes, what would you do for this?",
            ];
            jaeText = `${greeting}${pick(stepFrames)}\n${pick(stepActions)}\n\n${pick(stepQuestions)}`;
          }

          const jaeMsg = await storage.createMessage({ userId, text: jaeText, sender: "jae" });
          return res.json({ userMessage: userMsg, jaeMessage: jaeMsg });
        } else {
          const noAssessmentMessages = [
            `${greeting}I need your Self Check-In first. Without it, I'm guessing — and that's not how we work. Take it, and I'll know exactly where to coach you.`,
            `${greeting}we haven't done the Self Check-In yet. I need that to give you real guidance. Complete it, and we'll have something to work with.`,
            `${greeting}before I can point you anywhere useful, I need your Self Check-In. That's where the real data comes from.`,
            `${greeting}no check-in data yet. I'm not going to guess — take the Self Check-In so I can coach you with real numbers.`,
            `${greeting}I work best with real data. Your Self Check-In gives me that. Take it first, then we'll talk strategy.`,
            `${greeting}without the Self Check-In, I'm flying blind. Complete it and I'll know exactly where to focus.`,
            `${greeting}the Self Check-In is step one. I can't give you real direction without real data.`,
            `${greeting}let's get your baseline. Take the Self Check-In first — then I'll know your stage, your heartbeats, and where to push.`,
            `${greeting}I need to see your heartbeat scores before I coach you. The Self Check-In takes a few minutes. Let's do that first.`,
            `${greeting}can't give you specifics without the Self Check-In. Once you take it, every response I give will be grounded in your data.`,
            `${greeting}your check-in data is missing. I need it to coach you properly. Take the Self Check-In and I'll have your heartbeat map.`,
            `${greeting}no heartbeat data on file yet. The Self Check-In changes that. Complete it so I can speak to your actual strengths and gaps.`,
            `${greeting}I don't have your numbers yet. Take the Self Check-In — it gives me your stage, your focus area, and your growth edge.`,
            `${greeting}right now I'm coaching in the dark. The Self Check-In lights up the picture. Take it and we'll get specific.`,
            `${greeting}the Self Check-In takes a few minutes but it changes everything I can do for you. Complete it first.`,
          ];
          jaeText = pick(noAssessmentMessages);
          const jaeMsg = await storage.createMessage({ userId, text: jaeText, sender: "jae" });
          return res.json({ userMessage: userMsg, jaeMessage: jaeMsg });
        }
      }

      const asksGoal =
        /repeat.*goal/i.test(textLower) ||
        /what('?s| is) my goal/i.test(textLower) ||
        /my goal\??$/i.test(textLower) ||
        /remind me.*goal/i.test(textLower);

      const asksObstacle =
        /what.*gets in the way/i.test(textLower) ||
        /main obstacle/i.test(textLower) ||
        /what('?s| is) my obstacle/i.test(textLower) ||
        /my struggle/i.test(textLower) ||
        /remind me.*obstacle/i.test(textLower);

      const isSave =
        /^save:/i.test(textLower) ||
        /save that/i.test(textLower) ||
        /remember this/i.test(textLower);

      const isLog =
        /^log:/i.test(textLower) ||
        /^logged:/i.test(textLower) ||
        /^i (did|walked|ran|worked out|trained|lifted|completed|finished|read|wrote|practiced)/i.test(textLower) ||
        /today i (did|walked|ran|worked out|trained|lifted|completed|finished|read|wrote|practiced)/i.test(textLower);

      if (asksGoal || asksObstacle) {
        const goalPresent = [
          `your goal is "${goal}"`,
          `you set "${goal}" as your goal`,
          `"${goal}" — that's what you're working toward`,
          `your goal on file: "${goal}"`,
          `I have "${goal}" saved as your goal`,
          `"${goal}" is locked in`,
          `your target is "${goal}"`,
          `the mission: "${goal}"`,
          `"${goal}" — that's what's on the board`,
          `you're going after "${goal}"`,
          `"${goal}" is your north star right now`,
          `you told me "${goal}". That's what we're building toward`,
          `I've got "${goal}" as your focus`,
          `"${goal}" — still the priority`,
          `your direction: "${goal}"`,
        ];
        const goalMissing = [
          "no goal locked in yet. Send me one and I'll hold you to it",
          "you don't have a goal saved yet. Tell me what you're working toward",
          "no goal on file. Send one and we'll make it official",
          "nothing saved as a goal yet. Name it and I'll track it",
          "I don't have a goal from you yet. What are you going after?",
          "no goal recorded. What's the thing you want to accomplish?",
          "your goal slot is empty. Fill it and I'll keep you accountable",
          "I'm working without a target. Send your goal and I'll lock it in",
          "no goal yet. Give me something to hold you to",
          "you haven't set a goal. Let's fix that — name it",
          "nothing to point you toward yet. What's the goal?",
          "I need a goal from you before I can track progress. What is it?",
          "your goal isn't saved yet. Send it and we'll get moving",
          "no goal on record. Tell me what matters most to you right now",
          "I can't coach toward nothing. What's the goal?",
        ];
        const obsMissing = [
          "no obstacle saved yet. Name it so we can work around it",
          "you haven't named an obstacle yet. What keeps getting in the way?",
          "no obstacle on file. Tell me what slows you down",
          "I don't have an obstacle from you yet. What's the thing that trips you up?",
          "nothing saved as an obstacle. Name the pattern and we'll build around it",
          "no obstacle tracked. What keeps pulling you off course?",
          "you haven't told me what gets in the way yet. Name it",
          "your obstacle slot is empty. What's the thing that blocks you?",
          "no barrier on file. What's the recurring challenge?",
          "I need to know what you're up against. Name the obstacle",
          "nothing saved as a struggle. What do you keep bumping into?",
          "your obstacle isn't recorded yet. What's the pattern that holds you back?",
          "tell me what gets in the way and I'll help you plan around it",
          "no obstacle identified. What's the thing that shows up when you try?",
          "I can't plan around what I don't know. What's your main obstacle?",
        ];
        const obsPresent = [
          `your main obstacle is "${obstacle}"`,
          `you named "${obstacle}" as your obstacle`,
          `"${obstacle}" — that's what you said gets in the way`,
          `your obstacle on file: "${obstacle}"`,
          `I have "${obstacle}" tracked as your main challenge`,
          `"${obstacle}" is the barrier you identified`,
          `the thing you're working against: "${obstacle}"`,
          `"${obstacle}" — that's the pattern to break`,
          `you flagged "${obstacle}" as the challenge`,
          `"${obstacle}" is what you said slows you down`,
          `your biggest hurdle: "${obstacle}"`,
          `"${obstacle}" — that's the one we're building around`,
          `the obstacle you named: "${obstacle}"`,
          `I've got "${obstacle}" as your main barrier`,
          `"${obstacle}" is the thing in the way`,
        ];

        const parts: string[] = [];
        if (asksGoal) {
          parts.push(goal ? pick(goalPresent) : pick(goalMissing));
        }
        if (asksObstacle) {
          parts.push(obstacle ? pick(obsPresent) : pick(obsMissing));
        }

        const goalFollowups = [
          `What's one move toward "${goal}" in the next 24 hours?`,
          `What does progress on "${goal}" look like today?`,
          `How are you planning to advance "${goal}" this week?`,
          `What's the next concrete step for "${goal}"?`,
          `If you had ten minutes for "${goal}" right now, what would you do?`,
          `What part of "${goal}" needs the most attention today?`,
          `How will you push "${goal}" forward this week?`,
          `What's blocking "${goal}" right now — and what can you do about it?`,
          `What would a productive day for "${goal}" look like?`,
          `Where does "${goal}" stand — and what moves it?`,
          `What's the one thing that would accelerate "${goal}"?`,
          `How are you keeping "${goal}" alive in your daily routine?`,
          `If "${goal}" had a deadline of next week, what would you do first?`,
          `What does the next milestone for "${goal}" look like?`,
          `What action for "${goal}" would you be most proud of completing?`,
        ];
        const noGoalFollowups = [
          `Send "Save: [your goal]" and I'll lock it in.`,
          `Tell me your goal and I'll make it official.`,
          `What are you working toward? Name it.`,
          `Share your goal and we'll start tracking.`,
          `What's the one thing you want to accomplish? Send it.`,
          `Give me something to hold you to. What's the goal?`,
          `Set your direction. Send "Save: my goal is [your goal]."`,
          `I work best when I have a target. What's yours?`,
          `What matters most to you right now? That's your goal.`,
          `Name it and I'll track it. What are you going after?`,
          `What would feel like real progress? Start there.`,
          `Pick one thing that matters and tell me. That's your goal.`,
          `What do you want to be different in 30 days? That's the goal.`,
          `I need a direction. Send "Save: my goal is [X]" to set one.`,
          `Let's set the target. What are you building toward?`,
        ];
        const next = goal
          ? `\n\n${pick(goalFollowups)}`
          : `\n\n${pick(noGoalFollowups)}`;
        jaeText = `${greeting}${parts.join(". ")}.${next}`;

      } else if (isSave) {
        const payload = rawText.replace(/^save:\s*/i, "").replace(/save that\.?\s*/i, "").replace(/remember this\.?\s*/i, "").trim();

        const goalMatch = rawText.match(/(?:my )?goal (?:is|:)\s*(.+?)(?:\.|,|$)/i);
        const obstacleMatch = rawText.match(/(?:my )?(?:obstacle|struggle) (?:is|:)\s*(.+?)(?:\.|,|$)/i);

        const patch: Record<string, any> = {};
        if (goalMatch?.[1]) patch.goals = [goalMatch[1].trim()];
        if (obstacleMatch?.[1]) patch.struggles = [obstacleMatch[1].trim()];

        if (Object.keys(patch).length) {
          await storage.updateUser(userId, patch);
        }

        const savedContent = payload || goalMatch?.[1] || obstacleMatch?.[1] || rawText;
        await storage.createEntry({
          userId,
          date: todayStr(),
          summary: savedContent,
          mood: "neutral",
        });

        shouldWater = true;

        const saveConfirms = [
          `${greeting}locked in.`,
          `${greeting}saved.`,
          `${greeting}got it. On the record.`,
          `${greeting}noted and saved.`,
          `${greeting}done. I'll hold onto that.`,
          `${greeting}saved. I won't forget it.`,
          `${greeting}it's in the system.`,
          `${greeting}stored. I'll reference it from here on.`,
          `${greeting}that's on file now.`,
          `${greeting}captured. You can count on me to remember.`,
          `${greeting}committed to memory.`,
          `${greeting}locked in and logged.`,
          `${greeting}saved and sealed.`,
          `${greeting}written down. It's official now.`,
          `${greeting}tracked. This is part of the record.`,
        ];

        const confirmLines: string[] = [pick(saveConfirms)];
        if (patch.goals) {
          const goalConfirms = [
            `Goal: "${patch.goals[0]}".`,
            `Your goal: "${patch.goals[0]}". I'll hold you to it.`,
            `Goal set: "${patch.goals[0]}".`,
            `"${patch.goals[0]}" — that's what we're building toward.`,
            `"${patch.goals[0]}" is now the target.`,
            `"${patch.goals[0]}" — locked in as your direction.`,
            `Goal saved: "${patch.goals[0]}". Every response I give will point here.`,
            `"${patch.goals[0]}" is on the board. Let's make it real.`,
            `Your north star: "${patch.goals[0]}".`,
            `"${patch.goals[0]}" — I'll keep bringing you back to this.`,
            `Goal recorded: "${patch.goals[0]}". I'll track your progress against it.`,
            `"${patch.goals[0]}" — that's the mission now.`,
            `Your target: "${patch.goals[0]}". I won't let you forget it.`,
            `"${patch.goals[0]}" is official.`,
            `Set: "${patch.goals[0]}". Now let's move on it.`,
          ];
          confirmLines.push(pick(goalConfirms));
        }
        if (patch.struggles) {
          const obsConfirms = [
            `Obstacle: "${patch.struggles[0]}". Now I know what to watch for.`,
            `"${patch.struggles[0]}" — that's the thing to outwork.`,
            `Obstacle saved: "${patch.struggles[0]}". I'll factor that in.`,
            `"${patch.struggles[0]}" is on my radar now.`,
            `I see "${patch.struggles[0]}" as the barrier. We'll plan around it.`,
            `"${patch.struggles[0]}" — noted. I'll help you build around it.`,
            `Obstacle tracked: "${patch.struggles[0]}". We'll strategize against it.`,
            `"${patch.struggles[0]}" is the thing to beat. I'll keep that in mind.`,
            `Barrier identified: "${patch.struggles[0]}". Knowing it is step one.`,
            `"${patch.struggles[0]}" — that's the pattern we're breaking.`,
            `Obstacle logged: "${patch.struggles[0]}". Now we can work with it.`,
            `"${patch.struggles[0]}" — I'll reference this when coaching you.`,
            `Your obstacle: "${patch.struggles[0]}". Naming it gives you power over it.`,
            `"${patch.struggles[0]}" saved. Every plan we make accounts for this.`,
            `Noted: "${patch.struggles[0]}". We'll plan our way around it.`,
          ];
          confirmLines.push(pick(obsConfirms));
        }

        const saveFollowups = [
          "What's one move you can make in the next 24 hours?",
          "What does action on this look like today?",
          "What's the first step you're taking?",
          "How are you going to start?",
          "What's the smallest thing you can do right now to act on this?",
          "What comes next?",
          "How will you make progress on this today?",
          "What's one thing you can do before the day ends?",
          "What's the most important action tied to this?",
          "Ready to move on this — what's your first step?",
          "What would progress look like by tonight?",
          "What's one thing you can do in the next hour to act on this?",
          "Where do you want to start?",
          "What's the simplest version of the next step?",
          "How will today be different because of this?",
          "What will you do first?",
          "If you could only take one action on this today, what would it be?",
        ];
        confirmLines.push(`\n${pick(saveFollowups)}`);
        jaeText = confirmLines.join("\n");

      } else if (isLog) {
        const payload = rawText.replace(/^log:\s*/i, "").replace(/^logged:\s*/i, "").trim();

        await storage.createEntry({
          userId,
          date: todayStr(),
          summary: payload || rawText,
          mood: "happy",
        });

        shouldWater = true;

        const logConfirms = [
          `${greeting}logged.`,
          `${greeting}tracked.`,
          `${greeting}on the record.`,
          `${greeting}added to the log.`,
          `${greeting}captured.`,
          `${greeting}entry saved.`,
          `${greeting}noted and logged.`,
          `${greeting}that's in the system now.`,
          `${greeting}done. Added to your history.`,
          `${greeting}another one on the board.`,
          `${greeting}saved. The record grows.`,
          `${greeting}recorded.`,
          `${greeting}filed. Your effort is on paper now.`,
          `${greeting}logged and counted.`,
          `${greeting}proof, saved.`,
        ];

        const streakRef = streak > 0 ? ` Day ${streak + 1}.` : "";

        const goalLogLines = [
          `Progress toward "${goal}".`,
          `Closer to "${goal}".`,
          `"${goal}" just moved forward.`,
          `That feeds "${goal}".`,
          `One more step toward "${goal}".`,
          `"${goal}" benefits from this.`,
          `This effort counts toward "${goal}".`,
          `"${goal}" got attention today.`,
          `Another push toward "${goal}".`,
          `"${goal}" is one step nearer.`,
          `That's real progress on "${goal}".`,
          `"${goal}" doesn't happen without reps like this.`,
          `Today's work moves "${goal}" forward.`,
          `Closer to "${goal}" than yesterday.`,
          `"${goal}" just got a little more real.`,
        ];
        const noGoalLogLines = [
          "That's a rep.",
          "Another rep in the books.",
          "The work speaks.",
          "Effort recorded.",
          "Another data point in your favor.",
          "That's evidence of who you're becoming.",
          "Action logged. Keep building.",
          "That's proof you showed up.",
          "One more in the bank.",
          "The record gets stronger.",
          "That's what consistency looks like.",
          "Another brick in the foundation.",
          "The work adds up. This counted.",
          "Every rep matters. This one included.",
          "Progress, documented.",
        ];
        const goalRef = goal ? pick(goalLogLines) : pick(noGoalLogLines);

        const obstacleLogLines = [
          ` "${obstacle}" didn't win today.`,
          ` You showed up despite "${obstacle}".`,
          ` "${obstacle}" tried. You went anyway.`,
          ` "${obstacle}" lost this round.`,
          ` Today you beat "${obstacle}".`,
          ` "${obstacle}" had no say in this one.`,
          ` You moved past "${obstacle}".`,
          ` "${obstacle}" got outworked.`,
          ` Despite "${obstacle}", you delivered.`,
          ` You chose action over "${obstacle}".`,
          ` "${obstacle}" didn't stop you today.`,
          ` "${obstacle}" took a loss.`,
          ` You put in the work regardless of "${obstacle}".`,
          ` "${obstacle}" showed up. You showed up harder.`,
          ` Today, "${obstacle}" wasn't in charge.`,
        ];
        const obstacleRef = obstacle ? pick(obstacleLogLines) : "";

        const logFollowups = [
          "What's the next move you can repeat tomorrow?",
          "How can you build on this?",
          "What will tomorrow's version of this look like?",
          "What's the next action you're committing to?",
          "Can you do this again tomorrow?",
          "What made this possible today?",
          "How did you push past the resistance?",
          "What part of that felt the most rewarding?",
          "What would make tomorrow's effort even stronger?",
          "What's the smallest thing you can carry forward from this?",
          "What routine supported this?",
          "If this becomes a pattern, where will you be in a month?",
          "What did you learn from showing up today?",
          "What would it take to repeat this three days in a row?",
          "What part of this are you most proud of?",
        ];

        jaeText = `${pick(logConfirms)}${streakRef}\n${goalRef}${obstacleRef}\n\n${pick(logFollowups)}`;

      } else {
        const latestAssessment = await storage.getLatestAssessment(userId);
        const result = generateJaeResponse(rawText, {
          name,
          goal,
          obstacle,
          streak,
          treeStage,
          waterLevel,
          stage: latestAssessment?.stage,
          weakestHeartbeat: latestAssessment?.weakestHeartbeat || undefined,
          assessmentAnswers: latestAssessment?.answers as number[] | undefined,
        });
        jaeText = result.text;

        const isPositive = /done|did it|good|great|completed|finished|accomplished|nailed/i.test(textLower);
        if (isPositive) {
          shouldWater = true;
          await storage.createEntry({
            userId,
            date: todayStr(),
            summary: rawText,
            mood: "happy",
          });
        }
      }

      const jaeMsg = await storage.createMessage({ userId, text: jaeText, sender: "jae" });

      if (shouldWater) {
        const newLevel = Math.min(waterLevel + 20, 100);
        const newStage = newLevel >= 100 && treeStage < 5 ? treeStage + 1 : treeStage;
        await storage.updateUser(userId, {
          waterLevel: newLevel >= 100 ? 0 : newLevel,
          treeStage: newStage,
          streak: streak + 1,
        });
      }

      return res.json({ userMessage: userMsg, jaeMessage: jaeMsg });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/users/:userId/entries", async (req, res) => {
    const list = await storage.getEntries(req.params.userId);
    return res.json(list);
  });

  app.get("/api/users/:userId/assessment", async (req, res) => {
    const assessment = await storage.getLatestAssessment(req.params.userId);
    return res.json(assessment || null);
  });

  app.post("/api/users/:userId/assessment", async (req, res) => {
    try {
      const userId = req.params.userId;
      const { answers } = req.body;
      if (!Array.isArray(answers) || answers.length !== 10) {
        return res.status(400).json({ message: "answers must be an array of 10 numbers" });
      }
      const totalScore = answers.reduce((sum: number, v: number) => sum + v, 0);

      let stage: string;
      if (totalScore <= 15) stage = "seed";
      else if (totalScore <= 30) stage = "sprout";
      else if (totalScore <= 45) stage = "growth";
      else stage = "bloom";

      const motivationalMessages: Record<string, string> = {
        seed: "You're planting new habits. Focus on clarity and one small daily action. Every tree starts small.",
        sprout: "You're building consistency. Keep watering your routines and refining your mindset. Consistency feeds the seed.",
        growth: "You're growing strong roots. Stay flexible and keep adapting. Growth isn't comfortable — it's movement.",
        bloom: "You're thriving. Keep nurturing what's working and share your growth with others. Your effort is showing.",
      };

      const motivationalMessage = motivationalMessages[stage];

      const weakest = getWeakestHeartbeat(answers);
      const heartbeatScores = computeHeartbeatScores(answers);

      const assessment = await storage.createAssessment({
        userId,
        answers,
        totalScore,
        stage,
        motivationalMessage,
        heartbeatScores,
        weakestHeartbeat: weakest.heartbeat,
      });

      return res.json(assessment);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/users/:id/consistency-summary", async (req, res) => {
    try {
      const userId = req.params.id;
      const allEntries = await storage.getEntries(userId);

      const distinctDates = new Set(allEntries.map((e) => e.date));

      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const windowStart = sevenDaysAgo.toISOString().split("T")[0];
      const todayDate = now.toISOString().split("T")[0];

      let weeklyActiveDays = 0;
      Array.from(distinctDates).forEach((d) => {
        if (d >= windowStart && d <= todayDate) weeklyActiveDays++;
      });

      const weeklyWaterLevelPercent = Math.round(Math.min((weeklyActiveDays / 7) * 100, 100));

      const lifetimeActiveDays = distinctDates.size;

      let seedStageName: string;
      let seedStageDescription: string;
      let seedStageIconKey: string;

      if (lifetimeActiveDays <= 7) {
        seedStageName = "Seed";
        seedStageDescription = "You've started. Protect the habit.";
        seedStageIconKey = "seed";
      } else if (lifetimeActiveDays <= 21) {
        seedStageName = "Germinating";
        seedStageDescription = "Roots are forming. Stay steady.";
        seedStageIconKey = "germinating";
      } else if (lifetimeActiveDays <= 45) {
        seedStageName = "Sprout";
        seedStageDescription = "You're breaking the surface.";
        seedStageIconKey = "sprout";
      } else if (lifetimeActiveDays <= 90) {
        seedStageName = "Growing";
        seedStageDescription = "Momentum is visible.";
        seedStageIconKey = "growing";
      } else {
        seedStageName = "Rooted";
        seedStageDescription = "Consistency is part of who you are now.";
        seedStageIconKey = "rooted";
      }

      return res.json({
        weeklyWaterLevelPercent,
        weeklyActiveDays,
        lifetimeActiveDays,
        seedStageName,
        seedStageDescription,
        seedStageIconKey,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  return httpServer;
}
