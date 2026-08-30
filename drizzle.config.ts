import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  tablesFilter: ["!user_sessions"],
  // Scope db:push to the app's own schema only. Without this, drizzle-kit
  // introspects every schema in the database — including the `stripe`
  // schema the Replit Stripe integration manages on its own (accounts,
  // migrations, managed webhooks) — and halts with data-loss warnings on
  // tables this project never declared and must never touch.
  schemaFilter: ["public"],
});
