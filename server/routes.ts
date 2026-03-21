import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateJaeResponse, getWeakestHeartbeat, computeHeartbeatScores } from "./heartbeat";
import { generateDepthResponse } from "./jaeCoach";
import { evaluateHeartbeatDirections, generateCollectiveAnalysis } from "./weeklyReview";
import { computeGrowthUpdate, SEED_STAGE_INFO, CUP_IDENTITY_STATEMENTS } from "./waterEngine";
import { classifyMultipleActions, aggregateClassifications, computeWaterFromAP, checkEscalation, computeEscalationFromMessages, computeHeartbeatBalance, type HeartbeatCredits, type HeartbeatKey, HEARTBEAT_NAMES } from "./titan";
import { processRewardTransaction, REWARD_CONFIG, type RewardActionType, type RewardResult } from "./rewardEngine";
import { analyzePhoto } from "./visionAnalysis";
import { insertUserSchema, assessments, insertGoalSchema } from "@shared/schema";
import type { InsertAssessment, Assessment, Goal } from "@shared/schema";
import { deriveEffectiveState, isPremium, getSubscriptionBadge, getTrialDaysRemaining, getFeatureLimits, computeTrialExpiresAt, validateReceiptUpdate } from "./subscriptionEngine";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { sql } from "drizzle-orm";

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

  registerObjectStorageRoutes(app);

  app.post("/api/users", async (req, res) => {
    const result = insertUserSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ message: result.error.message });
    const now = new Date();
    const trialExpires = computeTrialExpiresAt(now);
    const userData = {
      ...result.data,
      weeklyCycleStart: now,
      subscriptionTier: "premium",
      subscriptionState: "PREMIUM_TRIAL_ACTIVE" as const,
      trialStartedAt: now,
      trialExpiresAt: trialExpires,
    };
    const user = await storage.createUser(userData as any);
    return res.json(user);
  });

  app.get("/api/users/:id", async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const effective = deriveEffectiveState(user);
    if (effective.subscriptionState !== user.subscriptionState || effective.subscriptionTier !== user.subscriptionTier) {
      await storage.updateUser(user.id, {
        subscriptionState: effective.subscriptionState,
        subscriptionTier: effective.subscriptionTier,
      } as any);
    }

    return res.json({
      ...user,
      subscriptionState: effective.subscriptionState,
      subscriptionTier: effective.subscriptionTier,
      subscriptionBadge: getSubscriptionBadge(user),
      trialDaysRemaining: getTrialDaysRemaining(user),
      featureLimits: getFeatureLimits({ ...user, ...effective } as any),
    });
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
      const obstacle = user.struggles?.length ? user.struggles[0] : "";
      const waterLevel = user.waterLevel ?? 0;
      const treeStage = user.treeStage ?? 1;
      const streak = user.streak ?? 0;
      const greeting = name ? `${name}, ` : "";

      const activeGoals = await storage.getActiveGoals(userId);
      const targetedGoal = activeGoals.find((g) => g.goalType === "targeted");
      const untargetedGoal = activeGoals.find((g) => g.goalType === "untargeted");
      const goal = targetedGoal?.title || untargetedGoal?.title || "";
      const goalSummary = [
        targetedGoal ? `Targeted: "${targetedGoal.title}"` : null,
        untargetedGoal ? `Identity: "${untargetedGoal.title}"` : null,
      ].filter(Boolean).join(" | ") || "";

      const textLower = rawText.toLowerCase();
      let jaeText = "";

      const trimmedLower = textLower.trim();
      const isGoalTypeConfirm = /^(targeted|target|identity)$/i.test(trimmedLower);
      if (isGoalTypeConfirm) {
        const recentMessages = await storage.getMessages(userId);
        const recentJae = recentMessages.filter(m => m.sender === "jae").sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()).slice(0, 5);
        const clarificationMsg = recentJae.find(m => m.text.includes('a **targeted goal**'));
        if (clarificationMsg) {
          const pendingMatch = clarificationMsg.text.match(/Is "(.+?)" a \*\*targeted goal\*\*/);
          if (pendingMatch) {
            const pendingGoalText = pendingMatch[1];
            const chosenType = (trimmedLower === "targeted" || trimmedLower === "target") ? "targeted" as const : "untargeted" as const;

            const existingOfType = activeGoals.find((g) => g.goalType === chosenType);
            if (existingOfType) {
              const typeLabel = chosenType === "targeted" ? "targeted goal" : "identity goal";
              jaeText = `${greeting}you already have an active ${typeLabel}: "${existingOfType.title}". Complete or archive it first.`;
              const jaeMsg = await storage.createMessage({ userId, text: jaeText, sender: "jae" });
              return res.json({ userMessage: userMsg, jaeMessage: jaeMsg });
            }

            const limits = getFeatureLimits(user);
            if (activeGoals.length >= limits.maxGoals) {
              jaeText = `${greeting}you've reached your goal limit. Upgrade to Premium or archive an existing goal first.`;
              const jaeMsg = await storage.createMessage({ userId, text: jaeText, sender: "jae" });
              return res.json({ userMessage: userMsg, jaeMessage: jaeMsg });
            }

            await storage.createGoal({
              userId,
              title: pendingGoalText,
              goalType: chosenType,
              status: "active",
              emotionalWhy: "",
              focusArea: "",
              metricType: "actions",
              deadline: null,
              baselineMetric: null,
              targetMetric: null,
              percentComplete: 0,
              microHabit: "",
              weeklyTarget: 3,
              streakCount: 0,
              momentumScore: 0,
              consistencyRate: 0,
              treeGrowthScore: 0,
              isActive: 1,
            });

            const clarGoalIndex = chosenType === "targeted" ? 0 : 1;
            const clarUser = await storage.getUser(userId);
            if (clarUser) {
              const clarGoals = [...(clarUser.goals || [])];
              while (clarGoals.length <= clarGoalIndex) clarGoals.push("");
              clarGoals[clarGoalIndex] = pendingGoalText;
              await storage.updateUser(userId, { goals: clarGoals });
            }

            await storage.createEntry({ userId, date: todayStr(), summary: `Goal planted: ${pendingGoalText}`, mood: "neutral" });

            const typeLabel = chosenType === "targeted" ? "Targeted Goal" : "Identity Goal";
            jaeText = `${greeting}${typeLabel} planted: "${pendingGoalText}".\n\nYour goal has been planted. Check the Growth tab to see your seed. Every action you take from here adds water and helps it grow.`;
            const jaeMsg = await storage.createMessage({ userId, text: jaeText, sender: "jae" });
            return res.json({ userMessage: userMsg, jaeMessage: jaeMsg });
          }
        }
      }

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
            const goalParts = [
              targetedGoal ? `Targeted: "${targetedGoal.title}"` : null,
              untargetedGoal ? `Identity: "${untargetedGoal.title}"` : null,
            ].filter(Boolean);
            const goalRef = goalParts.length > 0 ? ` Goals: ${goalParts.join(", ")}.` : "";
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

      const goalSavePatterns = [
        { re: /^save:\s*(.+)/i, extract: 1 },
        { re: /^set goal:\s*(.+)/i, extract: 1 },
        { re: /^plant goal:\s*(.+)/i, extract: 1 },
        { re: /^plant identity:\s*(.+)/i, extract: 1, forceIdentity: true },
        { re: /^set identity goal:\s*(.+)/i, extract: 1, forceIdentity: true },
        { re: /^my goal is\s+(.+)/i, extract: 1 },
      ];

      let goalSaveMatch: { text: string; forceIdentity?: boolean } | null = null;
      for (const p of goalSavePatterns) {
        const m = rawText.match(p.re);
        if (m && m[p.extract]) {
          goalSaveMatch = { text: m[p.extract].trim(), forceIdentity: !!(p as any).forceIdentity };
          break;
        }
      }

      const isSave =
        /save that/i.test(textLower) ||
        /remember this/i.test(textLower);

      const isGoalSave = !!goalSaveMatch && !isSave;

      const isLog =
        /^log:/i.test(textLower) ||
        /^logged:/i.test(textLower) ||
        /^i (did|walked|ran|worked out|trained|lifted|completed|finished|read|wrote|practiced)/i.test(textLower) ||
        /today i (did|walked|ran|worked out|trained|lifted|completed|finished|read|wrote|practiced)/i.test(textLower);

      if (asksGoal || asksObstacle) {
        let goalStatusText = "";
        if (targetedGoal && untargetedGoal) {
          const goalBothPresent = [
            `you have two active goals. Targeted: "${targetedGoal.title}". Identity: "${untargetedGoal.title}"`,
            `here's what's on the board. Targeted goal: "${targetedGoal.title}". Identity goal: "${untargetedGoal.title}"`,
            `two goals locked in. "${targetedGoal.title}" (targeted) and "${untargetedGoal.title}" (identity)`,
            `your targeted goal is "${targetedGoal.title}" and your identity goal is "${untargetedGoal.title}"`,
            `"${targetedGoal.title}" is your outcome goal. "${untargetedGoal.title}" is your identity goal`,
          ];
          goalStatusText = pick(goalBothPresent);
        } else if (targetedGoal) {
          const goalTargetedOnly = [
            `your targeted goal is "${targetedGoal.title}". No identity goal planted yet — consider adding one`,
            `"${targetedGoal.title}" is locked in as your targeted goal. You could also plant an identity goal`,
            `targeted goal: "${targetedGoal.title}". You don't have an identity goal yet — want to add one?`,
          ];
          goalStatusText = pick(goalTargetedOnly);
        } else if (untargetedGoal) {
          const goalIdentityOnly = [
            `your identity goal is "${untargetedGoal.title}". No targeted goal planted yet — consider adding one`,
            `"${untargetedGoal.title}" is your identity goal. You could also plant a targeted goal with a deadline`,
            `identity goal: "${untargetedGoal.title}". You don't have a targeted goal yet — want to set one?`,
          ];
          goalStatusText = pick(goalIdentityOnly);
        } else {
          const goalMissing = [
            "you don't have any active goals yet. Head to the Growth dashboard and plant one",
            "no goals planted yet. Let's fix that — go to Growth and plant a targeted or identity goal",
            "no active goals on file. Plant one on the Growth dashboard to get started",
            "you haven't planted a goal yet. Head to Growth and plant a seed",
            "no goals yet. Go to the Growth tab and plant a targeted or identity goal to get moving",
          ];
          goalStatusText = pick(goalMissing);
        }
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
          parts.push(goalStatusText);
        }
        if (asksObstacle) {
          parts.push(obstacle ? pick(obsPresent) : pick(obsMissing));
        }

        const goalFollowups = goal ? [
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
        ] : [];
        const noGoalFollowups = [
          "Head to the Growth tab and plant your first goal.",
          "Go to Growth and plant a seed — that's where it starts.",
          "Plant a goal on the Growth dashboard and I'll start coaching you toward it.",
          "No goal means no direction. Plant one on the Growth tab.",
          "Once you plant a goal, I can give you real direction.",
        ];
        const next = goal
          ? `\n\n${pick(goalFollowups)}`
          : `\n\n${pick(noGoalFollowups)}`;
        jaeText = `${greeting}${parts.join(". ")}.${next}`;

      } else if (isGoalSave) {
        const goalText = goalSaveMatch!.text;
        const hasTimeline = /\b(in \d+|by \w+ \d+|\d+ days|\d+ weeks|\d+ months|deadline|by end of)\b/i.test(goalText);
        const hasMetric = /\b(lose|gain|drop|reach|hit|save|earn|make|run|lift|weigh)\b.*\b\d+/i.test(goalText);
        const isIdentityStyle = goalSaveMatch!.forceIdentity ||
          /\b(identity|become|becoming|i am becoming|i want to be|i.m building the habit|kind of person)\b/i.test(goalText);

        let goalType: "targeted" | "untargeted";
        if (isIdentityStyle && !hasTimeline && !hasMetric) {
          goalType = "untargeted";
        } else if (hasTimeline || hasMetric) {
          goalType = "targeted";
        } else {
          jaeText = `${greeting}I want to make sure I save this correctly. Is "${goalText}" a **targeted goal** (has a deadline or measurable outcome) or an **identity goal** (about who you're becoming)?\n\nJust reply "targeted" or "identity" and I'll plant it.`;
          const jaeMsg = await storage.createMessage({ userId, text: jaeText, sender: "jae" });
          return res.json({ userMessage: userMsg, jaeMessage: jaeMsg });
        }

        const existingOfType = activeGoals.find((g) => g.goalType === goalType);
        if (existingOfType) {
          const typeLabel = goalType === "targeted" ? "targeted goal" : "identity goal";
          jaeText = `${greeting}you already have an active ${typeLabel}: "${existingOfType.title}". Complete or archive it on the Growth dashboard before planting a new one.`;
          const jaeMsg = await storage.createMessage({ userId, text: jaeText, sender: "jae" });
          return res.json({ userMessage: userMsg, jaeMessage: jaeMsg });
        }

        const limits = getFeatureLimits(user);
        if (activeGoals.length >= limits.maxGoals) {
          jaeText = `${greeting}you've reached your goal limit. Upgrade to Premium to plant a second goal, or complete/archive an existing one first.`;
          const jaeMsg = await storage.createMessage({ userId, text: jaeText, sender: "jae" });
          return res.json({ userMessage: userMsg, jaeMessage: jaeMsg });
        }

        let deadline: string | null = null;
        let baselineMetric: number | null = null;
        let targetMetric: number | null = null;

        if (goalType === "targeted") {
          const monthsMatch = goalText.match(/in (\d+) months?/i);
          const daysMatch = goalText.match(/in (\d+) days?/i);
          const weeksMatch = goalText.match(/in (\d+) weeks?/i);
          const byDateMatch = goalText.match(/by (\w+ \d+(?:,? \d{4})?)/i);

          if (monthsMatch) {
            const d = new Date(); d.setMonth(d.getMonth() + parseInt(monthsMatch[1]));
            deadline = d.toISOString().split("T")[0];
          } else if (daysMatch) {
            const d = new Date(); d.setDate(d.getDate() + parseInt(daysMatch[1]));
            deadline = d.toISOString().split("T")[0];
          } else if (weeksMatch) {
            const d = new Date(); d.setDate(d.getDate() + parseInt(weeksMatch[1]) * 7);
            deadline = d.toISOString().split("T")[0];
          } else if (byDateMatch) {
            const parsed = new Date(byDateMatch[1]);
            if (!isNaN(parsed.getTime())) deadline = parsed.toISOString().split("T")[0];
          }

          const metricNumbers = goalText.match(/\d+/g);
          if (metricNumbers && metricNumbers.length >= 1) {
            const nums = metricNumbers.map(Number).filter(n => n > 0);
            if (nums.length >= 2) {
              baselineMetric = Math.max(...nums);
              targetMetric = Math.min(...nums);
            }
          }
        }

        const newGoal = await storage.createGoal({
          userId,
          title: goalText,
          goalType,
          status: "active",
          emotionalWhy: "",
          focusArea: "",
          metricType: "actions",
          deadline,
          baselineMetric,
          targetMetric,
          percentComplete: 0,
          microHabit: "",
          weeklyTarget: 3,
          streakCount: 0,
          momentumScore: 0,
          consistencyRate: 0,
          treeGrowthScore: 0,
          isActive: 1,
        });

        const goalIndex = goalType === "targeted" ? 0 : 1;
        const currentUser = await storage.getUser(userId);
        if (currentUser) {
          const updatedGoals = [...(currentUser.goals || [])];
          while (updatedGoals.length <= goalIndex) updatedGoals.push("");
          updatedGoals[goalIndex] = goalText;
          await storage.updateUser(userId, { goals: updatedGoals });
        }

        await storage.createEntry({
          userId,
          date: todayStr(),
          summary: `Goal planted: ${goalText}`,
          mood: "neutral",
        });

        const typeLabel = goalType === "targeted" ? "Targeted Goal" : "Identity Goal";
        const confirmLines: string[] = [`${greeting}${typeLabel} planted: "${goalText}".`];

        if (deadline) confirmLines.push(`Deadline: ${deadline}.`);
        if (baselineMetric !== null && targetMetric !== null) {
          confirmLines.push(`Baseline: ${baselineMetric} → Target: ${targetMetric}.`);
        }

        confirmLines.push(`\nYour goal has been planted. Check the Growth tab to see your seed. Every action you take from here adds water and helps it grow.`);
        jaeText = confirmLines.join("\n");

        const jaeMsg = await storage.createMessage({ userId, text: jaeText, sender: "jae" });
        return res.json({ userMessage: userMsg, jaeMessage: jaeMsg });

      } else if (isSave) {
        const payload = rawText.replace(/^save:\s*/i, "").replace(/save that\.?\s*/i, "").replace(/remember this\.?\s*/i, "").trim();

        const obstacleMatch = rawText.match(/(?:my )?(?:obstacle|struggle) (?:is|:)\s*(.+?)(?:\.|,|$)/i);

        const patch: Record<string, any> = {};
        if (obstacleMatch?.[1]) patch.struggles = [obstacleMatch[1].trim()];

        if (Object.keys(patch).length) {
          await storage.updateUser(userId, patch);
        }

        const savedContent = payload || obstacleMatch?.[1] || rawText;
        await storage.createEntry({
          userId,
          date: todayStr(),
          summary: savedContent,
          mood: "neutral",
        });

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
        ];

        const confirmLines: string[] = [pick(saveConfirms)];
        if (patch.struggles) {
          const obsConfirms = [
            `Obstacle: "${patch.struggles[0]}". Now I know what to watch for.`,
            `"${patch.struggles[0]}" — that's the thing to outwork.`,
            `Obstacle saved: "${patch.struggles[0]}". I'll factor that in.`,
          ];
          confirmLines.push(pick(obsConfirms));
        }

        const saveFollowups = [
          "What's one move you can make in the next 24 hours?",
          "What does action on this look like today?",
          "What's the first step you're taking?",
          "How are you going to start?",
          "What comes next?",
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
        const recentMsgs = await storage.getMessages(userId);
        const last10 = recentMsgs
          .sort((a: any, b: any) => (a.createdAt > b.createdAt ? 1 : -1))
          .slice(-10)
          .map((m: any) => ({ sender: m.sender, text: m.text }));

        const pendingCommitments = await storage.getPendingCommitments(userId);
        const recentCommitments = await storage.getRecentCommitments(userId, 20);
        const missedCount = recentCommitments.filter(c => c.status === "missed").length;
        const completedCount = recentCommitments.filter(c => c.status === "completed").length;
        const totalResolved = missedCount + completedCount;
        const followThroughRate = totalResolved > 0 ? Math.round((completedCount / totalResolved) * 100) : 100;
        const ioMessages = last10.filter(m => m.sender === "user" && /\b(i('m| am) going to|i('ll| will)|i plan to|gonna|planning to)\b/i.test(m.text));
        const repeatedIntentCount = ioMessages.length;
        const actionGapDays = user.lastVerifiedActionAt
          ? Math.floor((Date.now() - new Date(user.lastVerifiedActionAt).getTime()) / (1000 * 60 * 60 * 24))
          : undefined;

        const depthResult = await generateDepthResponse(rawText, {
          userName: name,
          targetedGoalTitle: targetedGoal?.title,
          untargetedGoalTitle: untargetedGoal?.title,
          obstacle,
          streak,
          stage: latestAssessment?.stage,
          weakestHeartbeat: latestAssessment?.weakestHeartbeat || undefined,
          weakestScore: latestAssessment?.heartbeatScores
            ? (latestAssessment.heartbeatScores as Record<string, number>)[latestAssessment.weakestHeartbeat || ""] ?? undefined
            : undefined,
          recentMessages: last10,
          pendingCommitments: pendingCommitments.slice(0, 3).map(c => ({
            action: c.action,
            expectedTime: c.expectedTime,
            createdAt: c.createdAt,
          })),
          missedCommitmentCount: missedCount,
          repeatedIntentCount,
          followThroughRate,
          actionGapDays,
        });

        if (depthResult.text) {
          jaeText = depthResult.text;
        } else {
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
            targetedGoalTitle: targetedGoal?.title,
            untargetedGoalTitle: untargetedGoal?.title,
          });
          jaeText = result.text;
        }
      }

      if (process.env.NODE_ENV !== "production") {
        const userGoalTexts = [
          targetedGoal?.title || "",
          untargetedGoal?.title || "",
          obstacle,
        ].join(" ").toLowerCase();
        if (/first 5k|5k/i.test(jaeText) && !/5k/i.test(userGoalTexts) && !/5k/i.test(rawText)) {
          console.error("DEV GUARD: Jae response contains '5K' but user goals do not. Blocking stale goal injection.");
        }
      }

      const jaeMsg = await storage.createMessage({ userId, text: jaeText, sender: "jae" });

      const classifications = classifyMultipleActions(rawText);
      const agg = aggregateClassifications(classifications);

      // --- Commitment Memory Engine ---
      const COMMITMENT_PATTERNS = [
        /\b(?:i(?:'m| am) going to|i(?:'ll| will)|i plan to|i intend to)\s+(.{5,80})/i,
        /\b(?:tomorrow i(?:'ll| will)?)\s+(.{5,80})/i,
        /\b(?:tonight i(?:'ll| will)?)\s+(.{5,80})/i,
        /\b(?:later i(?:'ll| will)?)\s+(.{5,80})/i,
        /\b(?:after work i(?:'ll| will|'m going to)?)\s+(.{5,80})/i,
        /\b(?:starting (?:tomorrow|monday|next week))\b.*?(?:i(?:'ll| will|'m going to))\s+(.{5,80})/i,
        /\b(?:tonight|this evening|this morning|at \d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b.*?\b(?:i(?:'ll| will|'m going to))\s+(.{5,40})/i,
      ];
      const TIME_PATTERNS = [
        /\b(?:at|by|around|before|after)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i,
        /\b(tomorrow|tonight|this evening|this morning|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
        /\b(in \d+ (?:hours?|minutes?|days?))\b/i,
      ];

      const hasFutureIntent = /\b(?:i(?:'m| am) going to|i(?:'ll| will)|i plan to|i intend to|tomorrow|tonight|later i|after work i|this evening|next week|starting)\b/i.test(rawText);
      if (hasFutureIntent) {
        for (const pat of COMMITMENT_PATTERNS) {
          const match = rawText.match(pat);
          if (match && match[1]) {
            let expectedTime: string | null = null;
            for (const tp of TIME_PATTERNS) {
              const tm = rawText.match(tp);
              if (tm) { expectedTime = tm[1] || tm[0]; break; }
            }
            await storage.createCommitment({
              userId,
              action: match[1].trim().replace(/[.!?,;]+$/, ""),
              expectedTime: expectedTime || null,
              status: "pending",
              sourceMessageId: userMsg.id,
            });
            console.log(`[COMMIT] Stored: "${match[1].trim()}" expected=${expectedTime || "unspecified"}`);
            break;
          }
        }
      }

      // Auto-resolve pending commitments when user takes real action
      const resolvedCommitments: string[] = [];
      if (agg.primaryCategory === "VA" || agg.primaryCategory === "AR") {
        const pending = await storage.getPendingCommitments(userId);
        for (const c of pending) {
          const actionWords = c.action.toLowerCase().split(/\s+/);
          const messageWords = rawText.toLowerCase();
          const overlap = actionWords.filter(w => w.length > 3 && messageWords.includes(w));
          if (overlap.length >= 2 || pending.length === 1) {
            await storage.resolveCommitment(c.id, "completed");
            resolvedCommitments.push(c.action);
            console.log(`[COMMIT] Resolved: "${c.action}" → completed`);
          }
        }
      }

      let waterAwarded = false;
      let waterGoalId: string | null = null;
      let growthResult: any = null;
      let postUpdateAP: number | null = null;
      let apDelta = agg.totalActionPoints;
      let ipDelta = agg.totalInsightPoints;
      let driftDelta = agg.totalDriftMarkers;
      let rewardResult: RewardResult = {
        success: false,
        skipReason: "no_verified_action",
        waterAwarded: false,
        entryCreated: false,
        apActuallyAwarded: 0,
        postUpdateAP: null,
        growthResult: null,
        waterGoalId: null,
      };

      // ZERO REWARD FOR TALK OR COMMITMENT — only VA/AR earn AP
      // Commitments are tracked and followed up, but never rewarded

      const userCredits = (user.heartbeatCredits || { clarity: 0, consistency: 0, mindset: 0, adaptation: 0, courage: 0 }) as HeartbeatCredits;
      const isCBurnActive = !!(user.cBurnActive);

      if (isCBurnActive && agg.primaryCategory !== "VA") {
        apDelta = 0;
        ipDelta = 0;
      }

      if (driftDelta < 0) {
        await storage.updateUser(userId, {
          driftMarkers: (user.driftMarkers || 0) + Math.abs(driftDelta),
          consecutiveIOCount: (user.consecutiveIOCount || 0) + 1,
        } as any);
      } else if (agg.primaryCategory === "IO") {
        await storage.updateUser(userId, {
          consecutiveIOCount: (user.consecutiveIOCount || 0) + 1,
        } as any);
      }

      let heartbeatKey: HeartbeatKey | null = null;
      if (agg.primaryCategory === "VA" || agg.primaryCategory === "AR") {
        const creditKeys = Object.keys(agg.heartbeatCredits) as HeartbeatKey[];
        heartbeatKey = creditKeys[0] || "consistency";
        const updatedCredits = { ...userCredits };
        updatedCredits[heartbeatKey] = (updatedCredits[heartbeatKey] || 0) + 1;

        await storage.updateUser(userId, {
          heartbeatCredits: updatedCredits as any,
          lastVerifiedActionAt: new Date(),
          consecutiveIOCount: 0,
          cBurnActive: 0,
          streak: streak + 1,
        } as any);

        const matchGoal = targetedGoal || untargetedGoal;

        // --- CENTRAL REWARD ENGINE: single source of truth for AP/water/entry ---
        rewardResult = await processRewardTransaction({
          userId,
          rawText,
          apDelta,
          matchGoal: matchGoal || null,
          actionType: agg.primaryCategory as RewardActionType,
          todayStr: todayStr(),
        });

        if (rewardResult.postUpdateAP !== null) postUpdateAP = rewardResult.postUpdateAP;
        if (rewardResult.waterAwarded && rewardResult.growthResult) {
          waterAwarded = true;
          waterGoalId = rewardResult.waterGoalId;
          growthResult = rewardResult.growthResult;
        }

        // --- PROGRESS MODE: Anime Celebration Engine ---
        // GATED: celebration fires ONLY after a successful reward transaction.
        if (rewardResult.success) {
          const CELEBRATIONS = [
            "YES! That's a clean win.",
            "Nice! Momentum just leveled up.",
            "Boom. That's progress.",
            "You said you'd do it — and you did.",
            "That's how seeds grow.",
            "Small step. Big energy.",
            "Let's go! That counts.",
            "That move just strengthened your roots.",
            "Action confirmed. Respect.",
            "Momentum unlocked.",
            "You just watered the seed.",
            "That's a real step forward.",
            "Nice follow-through.",
            "You showed up today.",
            "That's how the story moves forward.",
            "That's a win. No doubt.",
            "You just built momentum.",
            "Another step in the right direction.",
            "That action matters.",
            "Seed status: stronger.",
            "Consistency in action.",
            "That's how progress stacks.",
            "Good work — that was real effort.",
            "You moved the mission forward.",
            "Momentum continues.",
          ];

          const celebrationLine = CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)];

          const commitCallback = resolvedCommitments.length > 0
            ? `You said you'd ${resolvedCommitments[0]} — and you followed through.`
            : (() => {
                let actionText = rawText.toLowerCase();
                const swaps: [RegExp, string][] = [
                  [/\bi was\b/g, "you were"],
                  [/\bi've\b/g, "you've"],
                  [/\bi'm\b/g, "you're"],
                  [/\bi am\b/g, "you are"],
                  [/\bmy\b/g, "your"],
                  [/\bme\b/g, "you"],
                ];
                for (const [pat, rep] of swaps) {
                  actionText = actionText.replace(pat, rep);
                }
                actionText = actionText.replace(/\bi\b/g, "you");
                actionText = actionText.replace(/\byou you\b/gi, "you");
                if (actionText.length > 70) actionText = actionText.substring(0, 67) + "...";
                return actionText.charAt(0).toUpperCase() + actionText.slice(1) + ".";
              })();

          const emotionPatterns = /nervous|scared|afraid|anxious|stressed|worried|tough|hard|difficult|struggle|didn.?t feel like|wasn.?t easy|uncomfortable/i;
          const emotionMatch = rawText.match(emotionPatterns);
          const emotionLine = emotionMatch
            ? `Doing it even when it felt ${emotionMatch[0].toLowerCase()} takes real courage.`
            : "";

          // waterLine is truthful: only shows if the reward transaction actually saved AP
          const waterLine = (rewardResult.apActuallyAwarded > 0 && !!(targetedGoal || untargetedGoal))
            ? "Water added to your cup."
            : "";

          const nextStepOptions = [
            "What feels like the next small step while the momentum is here?",
            "What's the next move while you're rolling?",
            "Where do you go from here?",
            "What's the next step?",
            "Next move when you're ready.",
          ];
          const nextStepLine = nextStepOptions[Math.floor(Math.random() * nextStepOptions.length)];

          const celebrationParts = [
            celebrationLine,
            commitCallback,
            emotionLine,
            waterLine,
            nextStepLine,
          ].filter(Boolean);

          const celebrationText = celebrationParts.join(" ");

          await storage.updateMessage(jaeMsg.id, { text: celebrationText });
          jaeMsg.text = celebrationText;

          console.log(`[PROGRESS] celebration_sent=true | tx_success=true | water_awarded=${waterAwarded} | ap_awarded=${rewardResult.apActuallyAwarded} | goal=${(targetedGoal || untargetedGoal)?.title || "none"} | commitments_resolved=${resolvedCommitments.length} | emotion=${emotionMatch ? emotionMatch[0] : "none"}`);
        } else {
          console.log(`[PROGRESS] celebration_blocked | reason=${rewardResult.skipReason} | category=${agg.primaryCategory} | text="${rawText.substring(0, 60)}"`);
        }
      } else {
        if (ipDelta > 0) {
          const matchGoal = targetedGoal || untargetedGoal;
          if (matchGoal) {
            await storage.updateGoal(matchGoal.id, {
              insightPoints: (matchGoal.insightPoints || 0) + ipDelta,
            });
          }
        }
      }

      const recentMsgs7d = await storage.getMessagesSince(userId, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      const escalation = computeEscalationFromMessages(recentMsgs7d, {
        consecutiveIOCount: user.consecutiveIOCount || 0,
        lastVerifiedActionAt: user.lastVerifiedActionAt,
        lastDriftWarningAt: user.lastDriftWarningAt,
        driftWarningCount14d: user.driftWarningCount14d || 0,
        cBurnActive: user.cBurnActive || 0,
      });

      const justVerified = agg.primaryCategory === "VA" || agg.primaryCategory === "AR";
      if (escalation.driftWarning && !escalation.cBurnTriggered && !justVerified) {
        await storage.updateUser(userId, {
          lastDriftWarningAt: new Date(),
          driftWarningCount14d: (user.driftWarningCount14d || 0) + 1,
        } as any);
      }
      if (escalation.cBurnTriggered && !justVerified) {
        await storage.updateUser(userId, {
          cBurnActive: 1,
        } as any);
      }

      const matchGoalForLog = targetedGoal || untargetedGoal;
      console.log(`[TITAN] category=${agg.primaryCategory} | apDelta=${apDelta} | driftDelta=${driftDelta} | heartbeat=${heartbeatKey || "none"} | goalAP=${matchGoalForLog?.actionPoints ?? 0} | waterUnits=${waterAwarded ? Math.floor(((matchGoalForLog?.actionPoints || 0) + apDelta) / 10) : 0} | escalation=${escalation.driftWarning ? "drift_warning" : escalation.cBurnTriggered ? "c_burn" : "none"} | cBurn=${isCBurnActive}`);

      return res.json({
        userMessage: userMsg,
        jaeMessage: jaeMsg,
        titan: { category: agg.primaryCategory, actionPoints: apDelta, insightPoints: ipDelta, driftMarkers: driftDelta },
        escalation: (escalation.escalationMessage && !justVerified) ? { message: escalation.escalationMessage, cBurn: escalation.cBurnTriggered, driftWarning: escalation.driftWarning } : null,
        water: (agg.primaryCategory === "VA" || agg.primaryCategory === "AR") ? (() => {
          const mg = targetedGoal || untargetedGoal;
          const we = growthResult?.waterEvents ?? (mg?.waterEvents ?? 0);
          const cf = growthResult?.cupsFilled ?? (mg?.cupsFilled ?? 0);
          const ap = postUpdateAP ?? ((mg?.actionPoints ?? 0) + apDelta);
          const fillPct = Math.min(100, Math.round(we * 10 + ap));
          return {
            // awarded is TRUE only when the reward transaction actually succeeded in DB
            awarded: rewardResult.success && rewardResult.apActuallyAwarded > 0 && !!mg,
            goalId: waterGoalId || mg?.id || null,
            waterEvents: we,
            cupsFilled: cf,
            seedStage: growthResult?.seedStage ?? (mg?.seedStage ?? 0),
            cupJustFilled: growthResult?.cupJustFilled ?? false,
            stageAdvanced: growthResult?.stageAdvanced ?? false,
            fillPercent: fillPct,
            preResetFillPercent: growthResult?.preResetFillPercent ?? fillPct,
            actionPointsAccumulated: ap,
            actionPointsNeeded: 10,
            rewardTransaction: rewardResult.skipReason ?? "success",
          };
        })() : null,
      });
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

      await storage.updateUser(userId, { weeklyCycleStart: new Date() } as any);

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

  // ─── Goal CRUD with Discipline Protection ───

  app.get("/api/users/:userId/goals", async (req, res) => {
    try {
      const activeGoals = await storage.getActiveGoals(req.params.userId);
      return res.json(activeGoals);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/users/:userId/goals/all", async (req, res) => {
    try {
      const allGoals = await storage.getAllGoals(req.params.userId);
      return res.json(allGoals);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/users/:userId/goals", async (req, res) => {
    try {
      const userId = req.params.userId;
      const { goalType } = req.body;
      if (!goalType || !["targeted", "untargeted"].includes(goalType)) {
        return res.status(400).json({ message: "goalType must be 'targeted' or 'untargeted'" });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const activeGoals = await storage.getActiveGoals(userId);
      const existingOfType = activeGoals.find((g) => g.goalType === goalType);

      if (existingOfType) {
        const msg = goalType === "targeted"
          ? "You already have an active targeted goal. Complete or archive it before starting another."
          : "Focus builds growth. Complete or archive your current identity goal before adding another.";
        return res.status(409).json({ message: msg });
      }

      const limits = getFeatureLimits(user);
      if (activeGoals.length >= limits.maxGoals) {
        return res.status(403).json({
          message: "Upgrade to Premium to plant a second goal.",
          upgradeRequired: true,
          feature: "dual_goals",
        });
      }

      const data = {
        userId,
        title: req.body.title || "",
        goalType,
        status: "active" as const,
        emotionalWhy: req.body.emotionalWhy || "",
        focusArea: req.body.focusArea || "",
        metricType: req.body.metricType || "actions",
        deadline: req.body.deadline || null,
        baselineMetric: req.body.baselineMetric ?? null,
        targetMetric: req.body.targetMetric ?? null,
        percentComplete: 0,
        microHabit: req.body.microHabit || "",
        weeklyTarget: req.body.weeklyTarget ?? 3,
        streakCount: 0,
        momentumScore: 0,
        consistencyRate: 0,
        treeGrowthScore: 0,
        isActive: 1,
      };

      const goal = await storage.createGoal(data);

      const apiGoalIndex = goalType === "targeted" ? 0 : 1;
      const apiGoals = [...(user.goals || [])];
      while (apiGoals.length <= apiGoalIndex) apiGoals.push("");
      apiGoals[apiGoalIndex] = data.title;
      await storage.updateUser(userId, { goals: apiGoals });

      await storage.createEntry({
        userId,
        date: new Date().toISOString().split("T")[0],
        summary: `Goal planted: ${data.title}`,
        mood: "neutral",
      });

      return res.json(goal);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.patch("/api/goals/:goalId", async (req, res) => {
    try {
      const goal = await storage.updateGoal(req.params.goalId, req.body);
      if (!goal) return res.status(404).json({ message: "Goal not found" });
      return res.json(goal);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/goals/:goalId/archive", async (req, res) => {
    try {
      const goal = await storage.updateGoal(req.params.goalId, { status: "archived", isActive: 0 });
      if (!goal) return res.status(404).json({ message: "Goal not found" });
      return res.json(goal);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/goals/:goalId/complete", async (req, res) => {
    try {
      const goal = await storage.getGoal(req.params.goalId);
      if (!goal) return res.status(404).json({ message: "Goal not found" });

      const statusLabel = goal.goalType === "untargeted"
        ? (req.body.completionType || "integrated")
        : "completed";

      const updated = await storage.updateGoal(req.params.goalId, {
        status: statusLabel,
        isActive: 0,
        percentComplete: goal.goalType === "targeted" ? 100 : goal.percentComplete,
        treeGrowthScore: 100,
      });
      return res.json(updated);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/goals/:goalId/log", async (req, res) => {
    try {
      const goal = await storage.getGoal(req.params.goalId);
      if (!goal) return res.status(404).json({ message: "Goal not found" });

      const summary = req.body.summary || "Activity logged";
      const mood = req.body.mood || "neutral";
      const progressValue = req.body.progressValue ?? null;

      const entry = await storage.createEntry({
        userId: goal.userId,
        goalId: goal.id,
        date: todayStr(),
        summary,
        mood,
      });

      const goalEntries = await storage.getEntriesByGoalId(goal.id);

      if (goal.goalType === "targeted" && progressValue !== null && goal.targetMetric && goal.baselineMetric !== null) {
        const range = goal.targetMetric - (goal.baselineMetric ?? 0);
        const current = progressValue - (goal.baselineMetric ?? 0);
        const pct = range > 0 ? Math.min(Math.round((current / range) * 100), 100) : 0;
        const treeScore = Math.min(pct, 100);
        await storage.updateGoal(goal.id, { percentComplete: pct, treeGrowthScore: treeScore });
      }

      if (goal.goalType === "untargeted") {
        const distinctDates = new Set(goalEntries.map((e) => e.date));
        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        const windowStart = sevenDaysAgo.toISOString().split("T")[0];
        const today = todayStr();

        let weeklyActive = 0;
        distinctDates.forEach((d) => {
          if (d >= windowStart && d <= today) weeklyActive++;
        });

        const momentum = Math.round(Math.min((weeklyActive / 7) * 100, 100));

        const allDates = Array.from(distinctDates).sort();
        let streak = 0;
        const todayD = new Date(today);
        for (let i = 0; i < 365; i++) {
          const checkDate = new Date(todayD);
          checkDate.setDate(checkDate.getDate() - i);
          const checkStr = checkDate.toISOString().split("T")[0];
          if (distinctDates.has(checkStr)) {
            streak++;
          } else {
            break;
          }
        }

        const totalDays = distinctDates.size;
        const startDate = new Date(goal.createdAt!);
        const daysSinceStart = Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
        const consistencyR = Math.round(Math.min((totalDays / daysSinceStart) * 100, 100));

        const treeLevels = [
          { min: 0, max: 7, score: 10 },
          { min: 8, max: 21, score: 30 },
          { min: 22, max: 45, score: 55 },
          { min: 46, max: 90, score: 80 },
          { min: 91, max: Infinity, score: 100 },
        ];
        let treeScore = 0;
        for (const level of treeLevels) {
          if (totalDays >= level.min && totalDays <= level.max) {
            const rangeSize = level.max === Infinity ? 100 : level.max - level.min;
            const progress = Math.min((totalDays - level.min) / rangeSize, 1);
            const prevScore = treeLevels[treeLevels.indexOf(level) - 1]?.score ?? 0;
            treeScore = prevScore + progress * (level.score - prevScore);
            break;
          }
        }

        await storage.updateGoal(goal.id, {
          streakCount: streak,
          momentumScore: momentum,
          consistencyRate: consistencyR,
          treeGrowthScore: Math.round(treeScore),
        });
      }

      return res.json(entry);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  // ─── Garden Summary (per-goal metrics for Growth Dashboard) ───

  app.get("/api/users/:userId/garden-summary", async (req, res) => {
    try {
      const userId = req.params.userId;
      const activeGoals = await storage.getActiveGoals(userId);

      const result: any = { targeted: null, untargeted: null };

      for (const goal of activeGoals) {
        const waterEvents = goal.waterEvents ?? 0;
        const cupsFilled = goal.cupsFilled ?? 0;
        const seedStage = goal.seedStage ?? 0;
        const actionPoints = goal.actionPoints ?? 0;
        const fillPercent = Math.min(100, Math.round(waterEvents * 10 + actionPoints));
        const stageInfo = SEED_STAGE_INFO[seedStage] || SEED_STAGE_INFO[0];

        const revealedStatements: Record<number, string> = {};
        for (const [threshold, statement] of Object.entries(CUP_IDENTITY_STATEMENTS)) {
          if (fillPercent >= Number(threshold)) {
            revealedStatements[Number(threshold)] = statement;
          }
        }

        const SEED_ICONS: Record<number, string> = {
          0: "\u{1F330}", 1: "\u{1F330}", 2: "\u{1FAB4}", 3: "\u{1FAB4}",
          4: "\u{1F331}", 5: "\u{1F331}", 6: "\u{1FAB4}",
        };

        const now = new Date();

        if (goal.goalType === "targeted") {
          const daysLeft = goal.deadline
            ? Math.max(0, Math.ceil((new Date(goal.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
            : null;

          result.targeted = {
            id: goal.id,
            title: goal.title,
            emotionalWhy: goal.emotionalWhy,
            deadline: goal.deadline,
            daysLeft,
            baselineMetric: goal.baselineMetric,
            targetMetric: goal.targetMetric,
            percentComplete: goal.percentComplete,
            waterEvents,
            cupsFilled,
            seedStage,
            fillPercent,
            seedStageName: stageInfo.name,
            seedStageDescription: stageInfo.description,
            seedIcon: SEED_ICONS[seedStage] || "\u{1F330}",
            revealedStatements,
          };
        } else {
          result.untargeted = {
            id: goal.id,
            title: goal.title,
            emotionalWhy: goal.emotionalWhy,
            microHabit: goal.microHabit,
            focusArea: goal.focusArea,
            streakCount: goal.streakCount,
            momentumScore: goal.momentumScore,
            consistencyRate: goal.consistencyRate,
            waterEvents,
            cupsFilled,
            seedStage,
            fillPercent,
            seedStageName: stageInfo.name,
            seedStageDescription: stageInfo.description,
            seedIcon: SEED_ICONS[seedStage] || "\u{1F330}",
            revealedStatements,
          };
        }
      }

      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/users/:userId/weekly-review/status", async (req, res) => {
    try {
      const userId = req.params.userId;
      const status = await storage.getWeeklyReviewStatus(userId);

      const lastCompleted = await storage.getLatestCompletedReview(userId);
      let snapshot = null;
      if (lastCompleted) {
        const goalSnap = lastCompleted.targetedGoalSnapshot as any;
        const dirs = lastCompleted.heartbeatDirections as any;
        const dirSymbol = (d: string) => d === "up" ? "↑" : d === "down" ? "↓" : "→";
        snapshot = {
          reviewId: lastCompleted.id,
          date: lastCompleted.completedAt ? new Date(lastCompleted.completedAt).toISOString().split("T")[0] : lastCompleted.cycleStartDate,
          goalNet: goalSnap?.hasGoal ? goalSnap.netChange : null,
          metricType: goalSnap?.metricType || null,
          heartbeatSummary: dirs ? `${dirSymbol(dirs.clarity)} ${dirSymbol(dirs.consistency)} ${dirSymbol(dirs.mindset)} ${dirSymbol(dirs.adaptation)} ${dirSymbol(dirs.courage)}` : null,
        };
      }

      return res.json({ ...status, lastSnapshot: snapshot });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/users/:userId/weekly-review/generate", async (req, res) => {
    try {
      const userId = req.params.userId;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const existing = await storage.getPendingWeeklyReview(userId);
      if (existing) return res.json(existing);

      const cycleStart = user.weeklyCycleStart;
      if (!cycleStart) return res.status(400).json({ message: "No weekly cycle started" });

      const cycleStartDate = new Date(cycleStart);
      const recentMessages = await storage.getMessagesSince(userId, cycleStartDate);

      const activeGoals = await storage.getActiveGoals(userId);
      const targetedGoal = activeGoals.find(g => g.goalType === "targeted");

      const lastReview = await storage.getLatestCompletedReview(userId);
      const lastMeasurable = lastReview?.currentMeasurable ?? targetedGoal?.baselineMetric ?? null;

      let goalProgress: any = { hasGoal: false };
      let currentMeasurable: number | null = null;

      if (targetedGoal) {
        const goalEntries = await storage.getEntriesByGoalId(targetedGoal.id);
        const recentEntries = goalEntries.filter(e => {
          const entryDate = new Date(e.date);
          return entryDate >= cycleStartDate;
        });

        const latestProgressEntry = recentEntries.length > 0 ? recentEntries[0] : null;

        if (targetedGoal.metricType === "lbs" || targetedGoal.metricType === "kg" || targetedGoal.metricType === "weight") {
          const progressMatch = latestProgressEntry?.summary?.match(/(\d+\.?\d*)/);
          currentMeasurable = progressMatch ? parseFloat(progressMatch[1]) : lastMeasurable;
        } else {
          currentMeasurable = targetedGoal.percentComplete ?? 0;
        }

        const netChange = (currentMeasurable != null && lastMeasurable != null)
          ? Math.round((currentMeasurable - lastMeasurable) * 100) / 100
          : null;

        goalProgress = {
          hasGoal: true,
          goalStatement: targetedGoal.title,
          lastWeekValue: lastMeasurable,
          currentValue: currentMeasurable,
          netChange,
          metricType: targetedGoal.metricType || "units",
        };
      }

      const directions = await evaluateHeartbeatDirections(recentMessages);

      const credits = (user.heartbeatCredits || { clarity: 0, consistency: 0, mindset: 0, adaptation: 0, courage: 0 }) as HeartbeatCredits;
      const balance = computeHeartbeatBalance(credits);

      let balanceFeedback = "";
      if (balance.feedbackType === "balanced") {
        balanceFeedback = " All heartbeats are balanced (each ≥15%).";
      } else if (balance.weakHeartbeats.length > 0) {
        const weakNames = balance.weakHeartbeats.map(k => HEARTBEAT_NAMES[k]).join(", ");
        balanceFeedback = ` Heartbeat imbalance detected: ${weakNames} below 15%. Distribution: Clarity ${balance.percentages.clarity}%, Consistency ${balance.percentages.consistency}%, Mindset ${balance.percentages.mindset}%, Adaptation ${balance.percentages.adaptation}%, Courage ${balance.percentages.courage}%.`;
      }

      const analysis = await generateCollectiveAnalysis(goalProgress, directions, recentMessages);
      const fullAnalysis = analysis + balanceFeedback;

      const review = await storage.createWeeklyReview({
        userId,
        cycleStartDate: cycleStartDate.toISOString().split("T")[0],
        status: "pending",
        targetedGoalSnapshot: goalProgress,
        heartbeatDirections: directions,
        collectiveAnalysis: fullAnalysis,
        previousMeasurable: lastMeasurable,
        currentMeasurable,
      });

      const dirSymbol = (d: string) => d === "up" ? "↑" : d === "down" ? "↓" : "→";
      const heartbeatLine = `${dirSymbol(directions.clarity)} ${dirSymbol(directions.consistency)} ${dirSymbol(directions.mindset)} ${dirSymbol(directions.adaptation)} ${dirSymbol(directions.courage)}`;
      const calendarSummary = goalProgress.hasGoal
        ? `Weekly Review — ${goalProgress.goalStatement} | Net: ${goalProgress.netChange ?? "N/A"} | Heartbeats: ${heartbeatLine}`
        : `Weekly Review — No targeted goal | Heartbeats: ${heartbeatLine}`;

      await storage.createEntry({
        userId,
        date: todayStr(),
        summary: calendarSummary,
        mood: "neutral",
        goalId: null,
      });

      return res.json(review);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/users/:userId/weekly-review/:reviewId/complete", async (req, res) => {
    try {
      const userId = req.params.userId;
      const reviewId = req.params.reviewId;

      const pending = await storage.getPendingWeeklyReview(userId);
      if (!pending || pending.id !== reviewId) {
        return res.status(404).json({ message: "Review not found for this user" });
      }

      const review = await storage.completeWeeklyReview(reviewId);
      if (!review) return res.status(404).json({ message: "Review not found" });

      await storage.updateUser(userId, { weeklyCycleStart: new Date() } as any);

      return res.json(review);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/users/:userId/weekly-review/history", async (req, res) => {
    try {
      const userId = req.params.userId;
      const pending = await storage.getPendingWeeklyReview(userId);
      const latest = await storage.getLatestCompletedReview(userId);
      const reviews = [pending, latest].filter(Boolean);
      return res.json(reviews);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  // ─── Subscription & Stripe Routes ───

  app.get("/api/stripe/publishable-key", async (_req, res) => {
    try {
      const key = await getStripePublishableKey();
      return res.json({ publishableKey: key });
    } catch (err) {
      console.error("Error getting Stripe publishable key:", err);
      return res.status(500).json({ message: "Stripe not configured" });
    }
  });

  app.get("/api/subscription/plans", async (_req, res) => {
    try {
      const stripe = await getUncachableStripeClient();
      const products = await stripe.products.search({ query: "metadata['app']:'mustard_seed'" });
      const premiumProduct = products.data[0];
      if (!premiumProduct) return res.json({ plans: [] });

      const prices = await stripe.prices.list({ product: premiumProduct.id, active: true });
      const plans = prices.data.map((p) => ({
        priceId: p.id,
        interval: p.recurring?.interval || "month",
        amount: p.unit_amount! / 100,
        currency: p.currency,
      }));

      return res.json({ plans });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Error fetching plans" });
    }
  });

  app.post("/api/users/:userId/checkout", async (req, res) => {
    try {
      const userId = req.params.userId;
      const { priceId } = req.body;
      if (!priceId) return res.status(400).json({ message: "priceId is required" });

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const stripe = await getUncachableStripeClient();

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          name: user.name || undefined,
          metadata: { userId },
        });
        customerId = customer.id;
        await storage.updateUser(userId, { stripeCustomerId: customerId } as any);
      }

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}`;
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${baseUrl}/profile?checkout=success`,
        cancel_url: `${baseUrl}/profile?checkout=cancel`,
        metadata: { userId },
      });

      return res.json({ url: session.url });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Checkout error" });
    }
  });

  app.post("/api/users/:userId/portal", async (req, res) => {
    try {
      const userId = req.params.userId;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (!user.stripeCustomerId) return res.status(400).json({ message: "No subscription found" });

      const stripe = await getUncachableStripeClient();
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}`;
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${baseUrl}/profile`,
      });

      return res.json({ url: session.url });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Portal error" });
    }
  });

  app.get("/api/users/:userId/subscription", async (req, res) => {
    try {
      const userId = req.params.userId;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const effective = deriveEffectiveState(user);

      return res.json({
        subscriptionState: effective.subscriptionState,
        subscriptionTier: effective.subscriptionTier,
        badge: getSubscriptionBadge({ ...user, ...effective } as any),
        trialDaysRemaining: getTrialDaysRemaining(user),
        featureLimits: getFeatureLimits({ ...user, ...effective } as any),
        platform: user.subscriptionPlatform || null,
        hasStripeSubscription: !!user.stripeSubscriptionId,
        planInterval: user.planInterval,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/stripe/subscription-webhook", async (req, res) => {
    try {
      const { type, data } = req.body;

      if (type === "customer.subscription.created" || type === "customer.subscription.updated") {
        const subscription = data.object;
        const customerId = subscription.customer;

        const user = await storage.findUserByStripeCustomerId(customerId);
        if (user) {
          const periodEnd = new Date(subscription.current_period_end * 1000);
          const interval = subscription.items?.data?.[0]?.price?.recurring?.interval || "month";

          if (subscription.status === "active") {
            await storage.updateUser(user.id, {
              subscriptionState: "PREMIUM_ACTIVE",
              subscriptionTier: "premium",
              subscriptionPlatform: "STRIPE",
              stripeSubscriptionId: subscription.id,
              subscriptionExpiresAt: periodEnd,
              planInterval: interval,
              lastPaymentStatus: "succeeded",
              lastReceiptValidation: new Date(),
            } as any);
          } else if (subscription.status === "past_due") {
            await storage.updateUser(user.id, {
              subscriptionState: "PAYMENT_FAILED",
              lastPaymentStatus: "failed",
              lastReceiptValidation: new Date(),
            } as any);
          } else if (subscription.status === "canceled") {
            await storage.updateUser(user.id, {
              subscriptionState: "PREMIUM_EXPIRED",
              subscriptionTier: "lite",
              lastPaymentStatus: "canceled",
              lastReceiptValidation: new Date(),
            } as any);
          }
        }
      }

      if (type === "customer.subscription.deleted") {
        const subscription = data.object;
        const customerId = subscription.customer;
        const user = await storage.findUserByStripeCustomerId(customerId);
        if (user) {
          await storage.updateUser(user.id, {
            subscriptionState: "PREMIUM_EXPIRED",
            subscriptionTier: "lite",
            stripeSubscriptionId: null,
            lastPaymentStatus: "canceled",
            lastReceiptValidation: new Date(),
          } as any);
        }
      }

      return res.json({ received: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Webhook error" });
    }
  });

  // ─── Photo Upload + Vision Analysis ───

  app.post("/api/users/:userId/messages/photo", async (req, res) => {
    const startTime = Date.now();
    try {
      const userId = req.params.userId;
      const { photoUrl, caption, localDate, uploadAttemptId } = req.body;

      if (!photoUrl) return res.status(400).json({ ok: false, message: "photoUrl is required", code: "MISSING_PHOTO" });

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ ok: false, message: "User not found", code: "USER_NOT_FOUND" });

      const dateKey = localDate || todayStr();

      console.log(`[PHOTO] Start: userId=${userId} photoUrl=${photoUrl.substring(0, 60)} caption="${(caption || "").substring(0, 40)}" attemptId=${uploadAttemptId || "none"}`);

      const duplicate = await storage.getPhotoMemoryByUrl(userId, photoUrl);
      if (duplicate) {
        console.log(`[PHOTO] IDEMPOTENT HIT: photoUrl already processed (memoryId=${duplicate.id}, messageId=${duplicate.messageId})`);
        const existingPhotoMsg = await storage.getMessageById(duplicate.messageId);
        let existingJaeMsg = null;
        if (existingPhotoMsg) {
          const allMsgs = await storage.getMessages(userId);
          const photoIdx = allMsgs.findIndex((m) => m.id === existingPhotoMsg.id);
          if (photoIdx >= 0 && photoIdx + 1 < allMsgs.length) {
            const nextMsg = allMsgs[photoIdx + 1];
            if (nextMsg.sender === "jae") existingJaeMsg = nextMsg;
          }
        }
        return res.json({
          ok: true,
          idempotent: true,
          photoMessage: existingPhotoMsg || null,
          jaeResponse: existingJaeMsg || null,
          analysis: duplicate.analysisJson || null,
          photoMemory: duplicate,
        });
      }

      const photoMessage = await storage.createMessage({
        userId,
        text: caption || "📷 Photo uploaded",
        sender: "user",
        messageType: "photo",
        status: "pending_analysis",
        photoUrl,
      });

      const photoMemory = await storage.createPhotoMemory({
        userId,
        messageId: photoMessage.id,
        dateKey,
        photoUrl,
        status: "pending_analysis",
        waterAwarded: 0,
      });

      await storage.createEntry({
        userId,
        date: dateKey,
        summary: caption ? `📷 ${caption}` : "📷 Photo uploaded",
        mood: "neutral",
      });

      const activeGoals = await storage.getActiveGoals(userId);
      const targetedGoal = activeGoals.find((g) => g.goalType === "targeted");
      const untargetedGoal = activeGoals.find((g) => g.goalType === "untargeted");

      const serveUrl = photoUrl.startsWith("/objects/")
        ? `${req.protocol}://${req.get("host")}${photoUrl}`
        : photoUrl;

      let analysis;
      try {
        analysis = await analyzePhoto(
          serveUrl,
          caption || "",
          targetedGoal?.title || null,
          untargetedGoal?.title || null,
          user.name || ""
        );
      } catch (analysisErr: any) {
        console.error(`[PHOTO] Vision analysis failed after ${Date.now() - startTime}ms:`, analysisErr?.message || analysisErr);
        analysis = {
          labels: [],
          confidence: 0,
          action_type: "unknown_or_irrelevant",
          proof_level: 0,
          water_award: 0,
          water_reason: "Analysis unavailable",
          risk_flags: ["analysis_error"],
          tags: [],
          next_prompt: "Got it. I wasn't able to review this photo right now, but keep sharing your progress.",
        };
      }

      const validConfidence = typeof analysis.confidence === "number" ? analysis.confidence : 0;
      const validActionType = analysis.action_type || "unknown_or_irrelevant";

      let validationStatus: "valid" | "invalid" | "unclear" = "invalid";
      let validationReason = "";

      if (validActionType === "unknown_or_irrelevant" || validConfidence < 0.60) {
        validationStatus = "invalid";
        validationReason = analysis.water_reason || "Image does not show a recognizable goal-aligned action.";
      } else if (validConfidence >= 0.60 && validConfidence < 0.75) {
        validationStatus = "unclear";
        validationReason = analysis.water_reason || "Image may show an action but confidence is too low to verify.";
      } else {
        validationStatus = "valid";
        validationReason = analysis.water_reason || "Verified goal-aligned action detected.";
      }

      const validation = { status: validationStatus, reason: validationReason };
      console.log(`[PHOTO] Validation: status=${validationStatus} confidence=${validConfidence} actionType=${validActionType}`);

      let photoAP = 0;
      if (validationStatus === "valid") {
        photoAP = analysis.proof_level >= 2 ? 3 : 2;
      }

      analysis.water_award = photoAP;
      analysis.action_points = photoAP;

      await storage.updateMessage(photoMessage.id, {
        status: "analyzed",
        analysisJson: analysis as any,
      });

      await storage.updatePhotoMemory(photoMemory.id, {
        status: "analyzed",
        analysisJson: analysis as any,
        waterAwarded: analysis.water_award,
        waterReason: analysis.water_reason,
        tags: analysis.tags || [],
      });

      let photoWaterAwarded = false;
      let photoGrowthResult: any = null;
      if (photoAP > 0) {
        const matchGoal = targetedGoal || untargetedGoal;
        if (matchGoal) {
          const effectiveAP = user.cBurnActive ? 0 : photoAP;
          const currentAP = matchGoal.actionPoints || 0;
          const { waterUnits, remainingAP } = computeWaterFromAP(currentAP, effectiveAP);

          if (waterUnits > 0) {
            const gr = computeGrowthUpdate(
              matchGoal.waterEvents,
              matchGoal.cupsFilled,
              matchGoal.seedStage,
              waterUnits
            );
            photoGrowthResult = gr;
            photoWaterAwarded = true;
            await storage.updateGoal(matchGoal.id, {
              actionPoints: remainingAP,
              waterEvents: gr.waterEvents,
              cupsFilled: gr.cupsFilled,
              seedStage: gr.seedStage,
            });
          } else if (effectiveAP > 0) {
            await storage.updateGoal(matchGoal.id, {
              actionPoints: remainingAP,
            });
          }

          const userCredits = (user.heartbeatCredits || { clarity: 0, consistency: 0, mindset: 0, adaptation: 0, courage: 0 }) as HeartbeatCredits;
          const hbKey = analysis.action_type?.includes("courage") ? "courage" as HeartbeatKey : "consistency" as HeartbeatKey;
          const updatedCredits = { ...userCredits, [hbKey]: (userCredits[hbKey] || 0) + 1 };
          await storage.updateUser(userId, {
            heartbeatCredits: updatedCredits as any,
            lastVerifiedActionAt: new Date(),
            consecutiveIOCount: 0,
            cBurnActive: 0,
          } as any);

          console.log(`[TITAN-PHOTO] apDelta=${effectiveAP} | heartbeat=${hbKey} | goalAP=${remainingAP} | waterUnits=${waterUnits} | cBurnWasActive=${!!user.cBurnActive}`);
        }
      }

      const matchGoalForPhoto = targetedGoal || untargetedGoal;
      const effectivePhotoAP = user.cBurnActive ? 0 : photoAP;
      const photoWaterAck = (effectivePhotoAP > 0 && matchGoalForPhoto) ? " Water added to your cup." : "";
      const jaeResponse = await storage.createMessage({
        userId,
        text: analysis.next_prompt + photoWaterAck,
        sender: "jae",
        messageType: "text",
        status: "sent",
        analysisJson: analysis as any,
      });

      console.log(`[PHOTO] Complete: ${Date.now() - startTime}ms | validation=${validationStatus} | AP=${photoAP} | water_award=${analysis.water_award}`);

      return res.json({
        ok: true,
        validation,
        photoMessage,
        jaeResponse,
        analysis,
        photoMemory,
        water: (effectivePhotoAP > 0 && matchGoalForPhoto) ? (() => {
          const mg = matchGoalForPhoto;
          const we = photoGrowthResult?.waterEvents ?? (mg?.waterEvents ?? 0);
          const cf = photoGrowthResult?.cupsFilled ?? (mg?.cupsFilled ?? 0);
          const ap = photoGrowthResult ? 0 : ((mg?.actionPoints ?? 0) + effectivePhotoAP);
          const remainAP = photoGrowthResult ? ((mg?.actionPoints ?? 0) + effectivePhotoAP) % 10 : ap;
          const fillPct = Math.min(100, Math.round(we * 10 + remainAP));
          return {
            awarded: true,
            fillPercent: fillPct,
            cupsFilled: cf,
            cupJustFilled: photoGrowthResult?.cupJustFilled ?? false,
            stageAdvanced: photoGrowthResult?.stageAdvanced ?? false,
            preResetFillPercent: photoGrowthResult?.preResetFillPercent ?? fillPct,
          };
        })() : null,
      });
    } catch (err: any) {
      console.error(`[PHOTO] Error after ${Date.now() - startTime}ms:`, err?.message || err);
      return res.status(500).json({ ok: false, message: "Photo upload failed. Please try again.", code: "SERVER_ERROR" });
    }
  });

  app.get("/api/users/:userId/photo-memories", async (req, res) => {
    try {
      const memories = await storage.getPhotoMemories(req.params.userId);
      return res.json(memories);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to get photo memories" });
    }
  });

  // ─── Store Receipt Validation (Apple / Google) ───
  // These endpoints are ready to plug in native app store receipt validation.
  // The native app sends a receipt, the server validates with the store,
  // and updates the user's subscription state accordingly.

  app.post("/api/users/:userId/validate-receipt", async (req, res) => {
    try {
      const userId = req.params.userId;
      const { platform, receipt, productId } = req.body;

      if (!platform || !["APPLE", "GOOGLE"].includes(platform)) {
        return res.status(400).json({ message: "platform must be 'APPLE' or 'GOOGLE'" });
      }
      if (!receipt) {
        return res.status(400).json({ message: "receipt is required" });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      // TODO: Implement actual store validation when native app is built
      // For Apple: Send receipt to Apple's verifyReceipt endpoint
      // For Google: Use Google Play Developer API to verify purchase token
      //
      // For now, return the current subscription state without modifying it.
      // When implementing:
      // 1. Validate receipt with store
      // 2. Extract expiration date, trial status, cancellation status
      // 3. Call validateReceiptUpdate() from subscriptionEngine
      // 4. Update user in database

      const effective = deriveEffectiveState(user);

      return res.json({
        validated: false,
        message: "Receipt validation not yet implemented for native stores. Use Stripe checkout for web subscriptions.",
        subscriptionState: effective.subscriptionState,
        subscriptionTier: effective.subscriptionTier,
        platform,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Receipt validation error" });
    }
  });

  app.post("/api/users/:userId/sync-subscription", async (req, res) => {
    try {
      const userId = req.params.userId;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const effective = deriveEffectiveState(user);

      if (effective.subscriptionState !== user.subscriptionState || effective.subscriptionTier !== user.subscriptionTier) {
        await storage.updateUser(userId, {
          subscriptionState: effective.subscriptionState,
          subscriptionTier: effective.subscriptionTier,
        } as any);
      }

      return res.json({
        subscriptionState: effective.subscriptionState,
        subscriptionTier: effective.subscriptionTier,
        badge: getSubscriptionBadge({ ...user, ...effective } as any),
        trialDaysRemaining: getTrialDaysRemaining(user),
        featureLimits: getFeatureLimits({ ...user, ...effective } as any),
        platform: user.subscriptionPlatform || null,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Sync error" });
    }
  });

  return httpServer;
}
