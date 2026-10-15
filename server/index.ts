import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes, registerStripeWebhook } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupSession, registerAuthRoutes } from "./auth";
import { pool } from "./storage";
import { checkRebuildPriceConfig } from "./stripePriceCheck";

// Idempotent schema guard — adds missing columns without touching existing data
async function ensureSchema() {
  // Login columns. Production was once created from an older schema without
  // users.email, which broke sign-up; this keeps any database in step with
  // shared/schema.ts. Its own try so a failure here can't skip the rest.
  try {
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
        ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS password_hash TEXT,
        ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email',
        ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE,
        ADD COLUMN IF NOT EXISTS profile_image TEXT,
        ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
    `);
  } catch (err) {
    console.error("[schema] login column check failed (non-fatal):", err);
  }
  try {
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS last_daily_encouragement_sent_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS last_weekly_summary_chat_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
        ADD COLUMN IF NOT EXISTS goal_setup JSONB;
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
        ADD COLUMN IF NOT EXISTS has_paid_rebuild BOOLEAN NOT NULL DEFAULT false,
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
    await pool.query(`
      ALTER TABLE entries
        ADD COLUMN IF NOT EXISTS water_units INTEGER NOT NULL DEFAULT 1;
    `);
    await pool.query(`
      ALTER TABLE grounding_journal_entries
        ADD COLUMN IF NOT EXISTS reflection_planned_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS focus_summary TEXT,
        ADD COLUMN IF NOT EXISTS jae_follow_up_reply TEXT,
        ADD COLUMN IF NOT EXISTS safety_tier TEXT,
        ADD COLUMN IF NOT EXISTS safety_event_id VARCHAR,
        ADD COLUMN IF NOT EXISTS safety_thread JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS next_step TEXT;
    `);
    // Login sessions (connect-pg-simple). Its own createTableIfMissing reads a
    // table.sql file that isn't in the production bundle, so a fresh database
    // would fail every login — create the table here instead.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON user_sessions (expire);
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS safety_events (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL,
        category TEXT NOT NULL,
        response_type TEXT NOT NULL DEFAULT 'primary',
        triggering_message TEXT NOT NULL,
        surface TEXT NOT NULL DEFAULT 'chat',
        alert_sent BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT now()
      );
      ALTER TABLE photo_memories
        ADD COLUMN IF NOT EXISTS content_hash TEXT,
        ADD COLUMN IF NOT EXISTS entry_id VARCHAR;
      ALTER TABLE safety_events
        ADD COLUMN IF NOT EXISTS tier TEXT,
        ADD COLUMN IF NOT EXISTS outcome TEXT;
    `);
    console.log("[schema] auto-migration complete");
  } catch (err) {
    console.error("[schema] auto-migration error (non-fatal):", err);
  }
}

console.log("deployment refresh");

const app = express();
const httpServer = createServer(app);

// Replit serves the app over HTTPS through a proxy that forwards plain HTTP.
// Trusting it lets Express see the original https request, which the
// secure-only login cookie requires — without this no session cookie is set.
app.set("trust proxy", 1);

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
  void checkRebuildPriceConfig();

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
