import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateJaeResponse, getWeakestHeartbeat, computeHeartbeatScores } from "./heartbeat";
import { insertUserSchema, assessments } from "@shared/schema";
import type { InsertAssessment, Assessment } from "@shared/schema";

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
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

          if (asksStage) {
            const goalRef = goal ? ` Goal: "${goal}".` : "";
            const weakRef = ` Focus: ${weakest.label.toLowerCase()}.`;
            jaeText = `${greeting}you're in **${stageName}** ${emoji}.${goalRef}${weakRef}\nKeep building from here.\n\nWhat's one move you're making today?`;
          } else if (asksFocus) {
            jaeText = `${greeting}${weakest.label.toLowerCase()} is your lowest heartbeat — ${weakest.score.toFixed(1)} out of 5. That's not a weakness. It's a signal.\nFive minutes on ${weakest.label.toLowerCase()} today will compound.\n\nWhat does that look like for you?`;
          } else if (asksWeakest) {
            jaeText = `${greeting}${weakest.label.toLowerCase()} is at ${weakest.score.toFixed(1)} out of 5. That's where the biggest growth lives.\nLet's sharpen it.\n\nWhat's one thing you can do this week to raise that number?`;
          } else if (asksSmallStep) {
            jaeText = `${greeting}you're in ${stageName} ${emoji}. ${weakest.label} needs attention.\nOne move: five minutes on ${weakest.label.toLowerCase()}.\n\nWhat will you choose?`;
          }

          const jaeMsg = await storage.createMessage({ userId, text: jaeText, sender: "jae" });
          return res.json({ userMessage: userMsg, jaeMessage: jaeMsg });
        } else {
          jaeText = `${greeting}I need your Self Check-In first. Without it, I'm guessing — and that's not how we work. Take it, and I'll know exactly where to coach you.`;
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
        const parts: string[] = [];
        if (asksGoal) {
          parts.push(goal ? `your goal is "${goal}"` : "no goal locked in yet. Send me one and I'll hold you to it");
        }
        if (asksObstacle) {
          parts.push(obstacle ? `your main obstacle is "${obstacle}"` : "no obstacle saved yet. Name it so we can work around it");
        }
        const next = goal
          ? `\n\nWhat's one move toward "${goal}" in the next 24 hours?`
          : `\n\nSend "Save: [your goal]" and I'll lock it in.`;
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

        const confirmLines: string[] = [`${greeting}locked in.`];
        if (patch.goals) confirmLines.push(`Goal: "${patch.goals[0]}".`);
        if (patch.struggles) confirmLines.push(`Obstacle: "${patch.struggles[0]}". Now I know what to watch for.`);
        confirmLines.push(`\nWhat's one move you can make in the next 24 hours?`);
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

        const goalRef = goal ? `Progress toward "${goal}".` : "That's a rep.";
        const obstacleRef = obstacle ? ` "${obstacle}" didn't win today.` : "";
        const streakRef = streak > 0 ? ` Day ${streak + 1}.` : "";
        jaeText = `${greeting}logged.${streakRef}\n${goalRef}${obstacleRef}\n\nWhat's the next move you can repeat tomorrow?`;

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

  return httpServer;
}
