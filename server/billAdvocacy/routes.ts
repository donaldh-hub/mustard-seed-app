import { type Express, type Request, type Response, type NextFunction } from "express";
import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "../storage";
import {
  billAdvocacyClients,
  billAdvocacyCases,
  insertBillAdvocacyClientSchema,
  insertBillAdvocacyCaseSchema,
} from "@shared/models/billAdvocacy/schema";
import { recordStageEvent, getEntityTimeline } from "./eventLog";
// Side-effect imports — registers the notification and invoicing
// subscribers on the shared event log.
import "./subscribers/notifications";
import "./subscribers/invoicing";

const db = drizzle(pool);

// There's no client-facing auth yet (the magic-link status portal is a
// later build step), so every route here is founder-only, gated the same
// way as the app's other internal admin surfaces.
function requireAdminKey(req: Request, res: Response, next: NextFunction) {
  const configuredKey = process.env.ADMIN_API_KEY;
  if (!configuredKey) {
    return res.status(503).json({ message: "Admin API not configured — set ADMIN_API_KEY to enable." });
  }
  if (req.header("x-admin-key") !== configuredKey) {
    return res.status(403).json({ message: "Forbidden" });
  }
  return next();
}

export function registerBillAdvocacyRoutes(app: Express) {
  app.post("/api/bill-advocacy/clients", requireAdminKey, async (req, res) => {
    try {
      const parsed = insertBillAdvocacyClientSchema.parse(req.body);
      const [client] = await db.insert(billAdvocacyClients).values(parsed).returning();
      return res.status(201).json(client);
    } catch (err) {
      console.error("[BILL_ADVOCACY] create client error:", err);
      return res.status(400).json({ message: err instanceof Error ? err.message : "Invalid client data" });
    }
  });

  app.post("/api/bill-advocacy/cases", requireAdminKey, async (req, res) => {
    try {
      const parsed = insertBillAdvocacyCaseSchema.parse(req.body);
      const [caseRow] = await db.insert(billAdvocacyCases).values(parsed).returning();
      // Stage 0 (intake) fires as soon as the case exists.
      await recordStageEvent({ entityId: caseRow.id, entityType: "case", stage: 0, notes: "Case created" });
      return res.status(201).json(caseRow);
    } catch (err) {
      console.error("[BILL_ADVOCACY] create case error:", err);
      return res.status(400).json({ message: err instanceof Error ? err.message : "Invalid case data" });
    }
  });

  app.post("/api/bill-advocacy/cases/:caseId/events", requireAdminKey, async (req, res) => {
    try {
      const caseId = req.params.caseId as string;
      const { stage, dollarValue, notes, proofDocumentRef, allowRepeat } = req.body as {
        stage?: number;
        dollarValue?: number | string;
        notes?: string;
        proofDocumentRef?: string;
        allowRepeat?: boolean;
      };
      if (typeof stage !== "number" || stage < 0 || stage > 6) {
        return res.status(400).json({ message: "stage (0-6) is required" });
      }
      const event = await recordStageEvent({
        entityId: caseId,
        entityType: "case",
        stage,
        dollarValue,
        notes,
        proofDocumentRef,
        allowRepeat,
      });
      return res.status(201).json(event);
    } catch (err) {
      console.error("[BILL_ADVOCACY] record event error:", err);
      return res.status(400).json({ message: err instanceof Error ? err.message : "Failed to record event" });
    }
  });

  app.get("/api/bill-advocacy/cases/:caseId/timeline", requireAdminKey, async (req, res) => {
    try {
      const timeline = await getEntityTimeline(req.params.caseId as string, "case");
      return res.json(timeline);
    } catch (err) {
      console.error("[BILL_ADVOCACY] timeline error:", err);
      return res.status(500).json({ message: "Failed to load timeline" });
    }
  });
}
