import { storage } from "./storage";
import type { ReleaseItem, ReleaseItemType } from "@shared/schema";

// ─── Technical & Release Ops Agent (Agent 10) ────────────────────────────────
// Centralizes bugs/feature requests, gates "verified" behind real recorded
// checks, and writes the changelog. HARD CONSTRAINT: no production deploy
// authority anywhere in this file — "shipped" means the internal record is
// marked ready and a changelog entry exists, never that anything was
// deployed. This codebase deploys via git push to GitHub (which
// auto-deploys the hosting environment per this repo's own CLAUDE.md) —
// this agent has no hook into that and doesn't try to build one.
//
// This repo doesn't use GitHub Issues yet (checked via the GitHub API at
// build time: 0 open or closed issues), so releaseItems is the primary
// tracker. GitHub Issue creation is wired in as an optional real mirror —
// harmless no-op unless GITHUB_TOKEN and GITHUB_REPO_FULL_NAME are set.

async function mirrorToGitHubIssue(title: string, body: string, type: ReleaseItemType): Promise<number | null> {
  const token = process.env.GITHUB_TOKEN;
  const repoFullName = process.env.GITHUB_REPO_FULL_NAME;
  if (!token || !repoFullName) {
    console.warn("[RELEASE_OPS] GitHub mirror skipped — set GITHUB_TOKEN and GITHUB_REPO_FULL_NAME to enable it.");
    return null;
  }
  try {
    const res = await fetch(`https://api.github.com/repos/${repoFullName}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, body, labels: [type] }),
    });
    if (!res.ok) {
      console.error("[RELEASE_OPS] GitHub issue creation failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const json: any = await res.json();
    return json.number ?? null;
  } catch (err: any) {
    console.error("[RELEASE_OPS] GitHub issue creation unexpected error:", err?.message || err);
    return null;
  }
}

export async function logItem(type: ReleaseItemType, title: string, description: string): Promise<ReleaseItem> {
  const githubIssueNumber = await mirrorToGitHubIssue(title, description, type);
  return storage.createReleaseItem({
    type,
    title,
    description,
    status: "logged",
    githubIssueNumber,
    verificationChecks: null,
    stagedAt: null,
    verifiedAt: null,
    shippedAt: null,
  });
}

export async function listReleaseItems(status?: string): Promise<ReleaseItem[]> {
  return storage.getReleaseItems(status);
}

export async function stageItem(id: string): Promise<ReleaseItem | undefined> {
  const item = await storage.getReleaseItem(id);
  if (!item) return undefined;
  if (item.status !== "logged") {
    throw new Error(`Item is "${item.status}" — only a logged item can be staged.`);
  }
  return storage.updateReleaseItem(id, { status: "staged", stagedAt: new Date() });
}

export interface VerificationCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

/**
 * verifyItem — records the real functional checks that were run (supplied
 * by the caller — this function doesn't invent or fabricate results) and
 * only moves the item to "verified" if every check passed. If any check
 * failed, the item stays "staged" with the failures attached, so a
 * placeholder or partial check can never produce a false "verified" status.
 */
export async function verifyItem(id: string, checks: VerificationCheck[]): Promise<ReleaseItem | undefined> {
  const item = await storage.getReleaseItem(id);
  if (!item) return undefined;
  if (item.status !== "staged") {
    throw new Error(`Item is "${item.status}" — only a staged item can be verified.`);
  }
  if (checks.length === 0) {
    throw new Error("At least one real verification check is required — verification can't be skipped.");
  }

  const allPassed = checks.every((c) => c.passed);
  return storage.updateReleaseItem(id, {
    status: allPassed ? "verified" : "staged",
    verificationChecks: checks,
    verifiedAt: allPassed ? new Date() : null,
  });
}

/**
 * markShipped — the ceiling of what this agent can do: marks the internal
 * record ready and writes a changelog entry. It does NOT deploy anything —
 * there's no deploy mechanism in this codebase for it to hook into, and
 * even if there were, this agent has no production deploy authority by
 * design (every production release still goes through the founder,
 * matching how the founder already works).
 */
export async function markShipped(id: string, changelogSummary: string): Promise<{ item: ReleaseItem; changelog: { id: string } }> {
  const item = await storage.getReleaseItem(id);
  if (!item) throw new Error("Release item not found.");
  if (item.status !== "verified") {
    throw new Error(`Item is "${item.status}" — only a verified item can be marked shipped.`);
  }

  const updated = await storage.updateReleaseItem(id, { status: "shipped", shippedAt: new Date() });
  const entry = await storage.createChangelogEntry({ summary: changelogSummary, releaseItemId: id });

  return { item: updated!, changelog: { id: entry.id } };
}

export async function rejectItem(id: string, reason: string): Promise<ReleaseItem | undefined> {
  const item = await storage.getReleaseItem(id);
  if (!item) return undefined;
  const description = reason ? `${item.description}\n\nRejected: ${reason}` : item.description;
  return storage.updateReleaseItem(id, { status: "rejected", description });
}

export async function getChangelog(limit?: number): Promise<{ id: string; summary: string; releaseItemId: string; createdAt: Date | null }[]> {
  return storage.getChangelogEntries(limit);
}
