import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // Primary: dist/index.js and dist/public/ are siblings — __dirname resolves to dist/
  const fromBundleDir = path.resolve(__dirname, "public");
  // Fallback: resolve from the process working directory (project root in deployment)
  const fromCwd = path.join(process.cwd(), "dist", "public");

  const distPath = fs.existsSync(fromBundleDir) ? fromBundleDir : fromCwd;

  console.log(`[static] __dirname=${__dirname}`);
  console.log(`[static] cwd=${process.cwd()}`);
  console.log(`[static] serving frontend from: ${distPath}`);

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory. Tried:\n  1. ${fromBundleDir}\n  2. ${fromCwd}\nRun npm run build first.`,
    );
  }

  app.use(express.static(distPath));

  // Catch-all: serve index.html for all non-API client-side routes (SPA routing)
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
