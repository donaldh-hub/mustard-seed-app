import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateJaeResponse } from "./heartbeat";
import { insertUserSchema, insertMessageSchema, insertEntrySchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ── User / Profile ──────────────────────────────────────
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

  // ── Messages / Chat ─────────────────────────────────────
  app.get("/api/users/:userId/messages", async (req, res) => {
    const msgs = await storage.getMessages(req.params.userId);
    return res.json(msgs);
  });

  app.post("/api/users/:userId/messages", async (req, res) => {
    const userId = req.params.userId;
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: "Text is required" });

    // Save user message
    const userMsg = await storage.createMessage({ userId, text, sender: "user" });

    // Generate Jae response via Heartbeat Relay
    const jaeResult = generateJaeResponse(text);

    // Save Jae response
    const jaeMsg = await storage.createMessage({ userId, text: jaeResult.text, sender: "jae" });

    // If positive, water the tree and add memory entry
    if (jaeResult.shouldWater) {
      const user = await storage.getUser(userId);
      if (user) {
        const newLevel = Math.min(user.waterLevel + 20, 100);
        const newStage = newLevel >= 100 && user.treeStage < 5 ? user.treeStage + 1 : user.treeStage;
        await storage.updateUser(userId, {
          waterLevel: newLevel >= 100 ? 0 : newLevel,
          treeStage: newStage,
          streak: user.streak + 1,
        });
      }

      // Add memory bank entry
      const today = new Date().toISOString().split("T")[0];
      await storage.createEntry({ userId, date: today, summary: text, mood: jaeResult.mood });
    }

    return res.json({ userMessage: userMsg, jaeMessage: jaeMsg });
  });

  // ── Entries / Calendar ──────────────────────────────────
  app.get("/api/users/:userId/entries", async (req, res) => {
    const list = await storage.getEntries(req.params.userId);
    return res.json(list);
  });

  return httpServer;
}
