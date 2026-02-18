import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateJaeResponse } from "./heartbeat";
import { insertUserSchema } from "@shared/schema";

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
          parts.push(goal ? `your current goal is: "${goal}"` : "I don't have your goal saved yet. Tell me and I'll lock it in.");
        }
        if (asksObstacle) {
          parts.push(obstacle ? `what usually gets in the way is: "${obstacle}"` : "I don't have your main obstacle saved yet.");
        }
        const next = goal
          ? `\n\nWhat's one move you can make toward "${goal}" in the next 24 hours?`
          : `\n\nReply "Save: <your goal>" and I'll remember it for you.`;
        jaeText = `${greeting}${parts.join(". And ")}.${next}`;

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

        const confirmLines: string[] = [`${greeting}got it — saved to your memory bank.`];
        if (patch.goals) confirmLines.push(`Goal locked in: "${patch.goals[0]}".`);
        if (patch.struggles) confirmLines.push(`Obstacle noted: "${patch.struggles[0]}".`);
        confirmLines.push(`\nWhat's ONE small step you can take in the next 24 hours?`);
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

        const goalRef = goal ? `This is progress toward "${goal}".` : "This is a strong win.";
        const obstacleRef = obstacle ? `When "${obstacle}" shows up, remember — you beat it today.` : "Keep stacking these.";
        jaeText = `${greeting}logged and locked in.\n\n${goalRef}\n${obstacleRef}\n\nWhat's the next small step you can repeat tomorrow?`;

      } else {
        const result = generateJaeResponse(rawText, {
          name,
          goal,
          obstacle,
          streak,
          treeStage,
          waterLevel,
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

  return httpServer;
}
