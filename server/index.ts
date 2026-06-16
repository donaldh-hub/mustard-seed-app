import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
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
        ADD COLUMN IF NOT EXISTS last_weekly_summary_chat_at TIMESTAMP;
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
    console.log("[schema] auto-migration complete");
  } catch (err) {
    console.error("[schema] auto-migration error (non-fatal):", err);
  }
}

console.log("deployment refresh");

const app = express();
const httpServer = createServer(app);

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
