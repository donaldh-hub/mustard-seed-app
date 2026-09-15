import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes, registerStripeWebhook } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupSession, registerAuthRoutes } from "./auth";
import { pool } from "./storage";

// Idempotent schema guard — adds missing columns without touching existing data
async function ensureSchema() {
  try {
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS last_daily_encouragement_sent_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS last_weekly_summary_chat_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS grounding_journal_entries (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL,
        day_number INTEGER NOT NULL,
        session TEXT NOT NULL,
        prompts JSONB NOT NULL DEFAULT '[]'::jsonb,
        jae_reflection TEXT,
        jae_follow_up_question TEXT,
        user_follow_up_response TEXT,
        key_theme TEXT,
        release_point TEXT,
        value_named TEXT,
        possible_first_seed TEXT,
        is_complete BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT now()
      );
    `);
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS has_completed_rebuild BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS last_rebuild_activity_at TIMESTAMP;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rebuild_instances (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL,
        instance_number INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'locked',
        memory_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        day7_stages JSONB NOT NULL DEFAULT '{}'::jsonb,
        last_activity_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT now()
      );
    `);
    // Bill Advocacy — medical bill dispute product. Isolated tables, no FKs
    // into the Mustard Seed schema above.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bill_advocacy_clients (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        sms_consent_given BOOLEAN NOT NULL DEFAULT false,
        sms_consent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bill_advocacy_cases (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id VARCHAR NOT NULL REFERENCES bill_advocacy_clients(id) ON DELETE CASCADE,
        provider_name TEXT,
        insurance_involved BOOLEAN NOT NULL DEFAULT false,
        fee_percent_agreed REAL,
        authorization_doc_ref TEXT,
        authorization_signed_at TIMESTAMP,
        dispute_amount NUMERIC(10, 2),
        amount_saved NUMERIC(10, 2),
        resolution_type TEXT,
        submitted_at TIMESTAMP,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bill_advocacy_events (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_id VARCHAR NOT NULL,
        entity_type TEXT NOT NULL,
        stage INTEGER NOT NULL,
        dollar_value NUMERIC(10, 2),
        notes TEXT,
        proof_document_ref TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS bill_advocacy_events_entity_idx
        ON bill_advocacy_events (entity_id, entity_type);
    `);
    console.log("[schema] auto-migration complete");
  } catch (err) {
    console.error("[schema] auto-migration error (non-fatal):", err);
  }
}

console.log("deployment refresh");

const app = express();
const httpServer = createServer(app);

// Must be registered before express.json() — Stripe signature verification
// requires the raw, unparsed request body.
registerStripeWebhook(app);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));

setupSession(app);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

registerAuthRoutes(app);

(async () => {
  await ensureSchema();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
