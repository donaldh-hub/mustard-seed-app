import { Resend } from "resend";
import { storage } from "./storage";
import { PREMIUM_STATES } from "./subscriptionEngine";
import { generateBillingReport, type BillingReport } from "./billingAgent";
import { generateEngagementLiftReport, getSegmentSnapshot, type EngagementLiftReport, type SegmentSnapshot } from "./retentionAgent";
import { generateWeeklyStuckReport, type WeeklyStuckReport } from "./supportAgent";
import type { User } from "@shared/schema";

// ─── Analytics & Reporting Agent (Agent 07) ──────────────────────────────────
// Read-only, always. Nothing in this file takes automated action on
// anything it finds — it only counts, compares against a baseline, and
// (on a real anomaly) tells a human. It never adjusts a user's state,
// billing, or content.

export interface FunnelSnapshot {
  totalUsers: number;
  assessmentCompleted: number;
  groundingJournalCompleted: number;
  rebuildCompleted: number;
  subscribed: number;
  conversionRates: {
    assessmentToJournal: number | null;
    journalToRebuild: number | null;
    rebuildToSubscription: number | null;
  };
}

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 1000 : null;
}

export async function computeFunnelSnapshot(): Promise<FunnelSnapshot> {
  const users = await storage.getAllUsers();
  const assessmentCompleted = users.filter((u) => u.assessmentCompleted).length;
  const groundingJournalCompleted = users.filter((u) => u.groundingJournalCompleted).length;
  const rebuildCompleted = users.filter((u) => u.hasCompletedRebuild).length;
  const subscribed = users.filter((u) => PREMIUM_STATES.includes(u.subscriptionState as any)).length;

  return {
    totalUsers: users.length,
    assessmentCompleted,
    groundingJournalCompleted,
    rebuildCompleted,
    subscribed,
    conversionRates: {
      assessmentToJournal: rate(groundingJournalCompleted, assessmentCompleted),
      journalToRebuild: rate(rebuildCompleted, groundingJournalCompleted),
      rebuildToSubscription: rate(subscribed, rebuildCompleted),
    },
  };
}

export interface CohortRow {
  cohortMonth: string; // "2026-01"
  cohortSize: number;
  stillSubscribed: number;
  retentionRate: number | null;
}

export async function computeCohortRetention(monthsBack = 6): Promise<CohortRow[]> {
  const users = await storage.getAllUsers();
  const cohorts = new Map<string, User[]>();

  for (const user of users) {
    if (!user.createdAt) continue;
    const d = new Date(user.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!cohorts.has(key)) cohorts.set(key, []);
    cohorts.get(key)!.push(user);
  }

  const now = new Date();
  const rows: CohortRow[] = [];
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const cohort = cohorts.get(key) ?? [];
    const stillSubscribed = cohort.filter((u) => PREMIUM_STATES.includes(u.subscriptionState as any)).length;
    rows.push({
      cohortMonth: key,
      cohortSize: cohort.length,
      stillSubscribed,
      retentionRate: rate(stillSubscribed, cohort.length),
    });
  }
  return rows;
}

const ANOMALY_LOOKBACK_DAYS = 14;
const ANOMALY_MULTIPLIER = 3;
const ANOMALY_MIN_COUNT = 3; // floor so a near-zero baseline doesn't trigger on noise

interface AnomalyCheck {
  metric: string;
  todayCount: number;
  baselineDailyAvg: number;
}

async function sendAnomalyAlert(check: AnomalyCheck): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const alertTo = process.env.FOUNDER_ALERT_EMAIL;
  if (!apiKey || !alertTo) {
    console.warn(`[ANALYTICS] Anomaly alert NOT sent (RESEND_API_KEY/FOUNDER_ALERT_EMAIL not set) — ${check.metric}`);
    return false;
  }
  const fromEmail = process.env.FROM_EMAIL || "noreply@mustardseedapp.com";
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: alertTo,
      subject: `Analytics anomaly — ${check.metric}`,
      text: `${check.metric} spiked: ${check.todayCount} in the last 24h vs a ${check.baselineDailyAvg.toFixed(1)}/day baseline over the trailing ${ANOMALY_LOOKBACK_DAYS} days.\n\nThis is a flag only — no automated action was taken.`,
    });
    if (error) {
      console.error("[ANALYTICS] anomaly alert error:", error.name, error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error("[ANALYTICS] anomaly alert unexpected error:", err?.message || err);
    return false;
  }
}

export interface AnomalyResult {
  metric: string;
  flagged: boolean;
  todayCount: number;
  baselineDailyAvg: number;
}

/**
 * runAnomalyCheck — compares the last 24h against a trailing 14-day daily
 * average for two billing signals (cancellations, payment failures). Flags
 * only — never adjusts anything. No scheduler exists in this codebase (same
 * gap noted in every prior phase), so "as they happen" means each time this
 * runs, whether that's you calling the admin endpoint or a cron you wire up
 * later calling it on a schedule.
 */
export async function runAnomalyCheck(): Promise<AnomalyResult[]> {
  const since = new Date(Date.now() - ANOMALY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const events = await storage.getBillingEventsSince(since);

  const metrics: { metric: string; type: string }[] = [
    { metric: "Subscription cancellations", type: "cancellation_requested" },
    { metric: "Failed payments", type: "payment_failed" },
  ];

  const results: AnomalyResult[] = [];
  for (const { metric, type } of metrics) {
    const matching = events.filter((e) => e.type === type);
    const todayCount = matching.filter((e) => new Date(e.createdAt!) >= oneDayAgo).length;
    const priorCount = matching.length - todayCount;
    const baselineDailyAvg = priorCount / (ANOMALY_LOOKBACK_DAYS - 1);

    const threshold = Math.max(baselineDailyAvg * ANOMALY_MULTIPLIER, ANOMALY_MIN_COUNT);
    const flagged = todayCount >= threshold && todayCount >= ANOMALY_MIN_COUNT;

    if (flagged) {
      const alertSent = await sendAnomalyAlert({ metric, todayCount, baselineDailyAvg });
      await storage.createAnalyticsAnomaly({
        metric,
        detail: { todayCount, baselineDailyAvg },
        alertSent,
      });
    }

    results.push({ metric, flagged, todayCount, baselineDailyAvg: Math.round(baselineDailyAvg * 100) / 100 });
  }

  return results;
}

export interface WeeklyDigest {
  generatedAt: string;
  funnel: FunnelSnapshot;
  cohortRetention: CohortRow[];
  billing: BillingReport;
  engagement: EngagementLiftReport;
  segments: SegmentSnapshot[];
  supportStuckPoints: WeeklyStuckReport;
  anomalies: AnomalyResult[];
}

/**
 * generateWeeklyDigest — "one weekly digest so you know where the business
 * stands," pulling real numbers from every other agent's own report
 * function rather than re-deriving them. Read-only: this only calls other
 * agents' existing report/read functions, never anything that writes.
 */
export async function generateWeeklyDigest(): Promise<WeeklyDigest> {
  const [funnel, cohortRetention, billing, engagement, segments, supportStuckPoints, anomalies] = await Promise.all([
    computeFunnelSnapshot(),
    computeCohortRetention(),
    generateBillingReport(7),
    generateEngagementLiftReport(7),
    getSegmentSnapshot(),
    generateWeeklyStuckReport(7),
    runAnomalyCheck(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    funnel,
    cohortRetention,
    billing,
    engagement,
    segments,
    supportStuckPoints,
    anomalies,
  };
}
