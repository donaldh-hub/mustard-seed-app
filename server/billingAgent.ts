import { Resend } from "resend";
import { storage } from "./storage";
import { PREMIUM_STATES } from "./subscriptionEngine";
import type { BillingEventType } from "@shared/schema";

// ─── Billing & Subscription Agent (Agent 04) ─────────────────────────────────
// Keeps the $/month subscription running: a staged dunning sequence on
// failed payments, weekly reconciliation against Stripe, and an MRR/churn/
// recovery report. HARD CONSTRAINT, matching the build's global rules: this
// agent NEVER issues a refund, discount, price change, or manual
// subscription override — those always require the founder's sign-off, and
// nothing in this file does any of them. Cancellation is handled by hand-off
// to Stripe's own hosted Billing Portal (server/routes.ts
// /stripe/create-portal-session) — Stripe executes it, not this agent.

const DUNNING_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

// DRAFT wording — pending founder approval, per the job description's "needs
// from you before build: approved dunning copy." Real sending is gated on
// DUNNING_COPY_APPROVED=true so this draft never reaches a real customer
// inbox before you've signed off on it; events are still logged either way.
const DUNNING_COPY_DRAFT: Record<1 | 2 | 3, { subject: string; body: (name: string) => string }> = {
  1: {
    subject: "There was a problem with your Mustard Seed payment",
    body: (name) =>
      `Hi ${name || "there"},\n\nWe tried to charge your card for your Mustard Seed subscription and it didn't go through — sometimes it's an expired card, sometimes just a bank hiccup. We'll try again automatically, and there's nothing you need to do right now unless you'd like to update your payment method from your Profile tab.\n\n— Mustard Seed`,
  },
  2: {
    subject: "Reminder: your Mustard Seed payment still hasn't gone through",
    body: (name) =>
      `Hi ${name || "there"},\n\nJust a heads up — we tried your card again and it still isn't going through. Your account is still active for now, but if it's not resolved soon your premium access will pause. You can update your payment method any time from your Profile tab.\n\n— Mustard Seed`,
  },
  3: {
    subject: "Final notice: update your payment method to keep Mustard Seed",
    body: (name) =>
      `Hi ${name || "there"},\n\nThis was the last retry on your card, and it still didn't go through. If we can't get a successful payment soon, your account will move back to the free tier. If you'd like to keep your premium access, please update your payment method from your Profile tab — we'd hate to see you go.\n\n— Mustard Seed`,
  },
};

export async function recordBillingEvent(
  userId: string,
  type: BillingEventType,
  detail?: Record<string, unknown>
) {
  return storage.createBillingEvent({ userId, type, detail: detail ?? null });
}

async function sendDunningEmail(userId: string, attemptNumber: 1 | 2 | 3): Promise<boolean> {
  if (process.env.DUNNING_COPY_APPROVED !== "true") {
    console.warn(
      `[BILLING] Dunning email NOT sent (set DUNNING_COPY_APPROVED=true once you've approved the wording) — ` +
      `attempt ${attemptNumber} for user ${userId}`
    );
    return false;
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[BILLING] Dunning email NOT sent — RESEND_API_KEY is not set.");
    return false;
  }

  const user = await storage.getUser(userId);
  if (!user?.email) return false;

  const fromEmail = process.env.FROM_EMAIL || "noreply@mustardseedapp.com";
  const copy = DUNNING_COPY_DRAFT[attemptNumber];

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: user.email,
      subject: copy.subject,
      text: copy.body(user.name || ""),
    });
    if (error) {
      console.error("[BILLING] dunning send error:", error.name, error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error("[BILLING] dunning unexpected error:", err?.message || err);
    return false;
  }
}

/**
 * recordAndDunFailedPayment — call from the Stripe webhook's
 * invoice.payment_failed handler, AFTER the existing state-transition logic
 * (this only logs and emails; it never touches subscription state itself).
 * Stages the copy by counting how many failures this user has had within
 * the current dunning window.
 */
export async function recordAndDunFailedPayment(userId: string): Promise<void> {
  const since = new Date(Date.now() - DUNNING_WINDOW_MS);
  const priorFailures = await storage.getRecentBillingEventsForUser(userId, "payment_failed", since);
  const attemptNumber = Math.min(priorFailures.length + 1, 3) as 1 | 2 | 3;

  await recordBillingEvent(userId, "payment_failed", { attemptNumber });
  const sent = await sendDunningEmail(userId, attemptNumber);
  await recordBillingEvent(userId, "dunning_sent", { attemptNumber, sent });
}

export async function recordPaymentRecovered(userId: string): Promise<void> {
  await recordBillingEvent(userId, "payment_recovered");
}

export async function recordCancellationRequested(userId: string): Promise<void> {
  await recordBillingEvent(userId, "cancellation_requested");
}

export interface ReconciliationMismatch {
  userId: string;
  localState: string;
  stripeStatus: string;
}

export interface ReconciliationResult {
  configured: boolean;
  checked: number;
  mismatches: ReconciliationMismatch[];
}

/**
 * runReconciliation — compares every locally "should be paying" user against
 * their real Stripe subscription status and flags mismatches. Flags only —
 * it never corrects a user's subscription state itself, even when it finds
 * a mismatch; that's a human call. No cron exists in this codebase (same
 * gap noted in Phases 2 and 3), so this runs on demand via the admin
 * endpoint rather than on a real weekly timer.
 */
export async function runReconciliation(): Promise<ReconciliationResult> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return { configured: false, checked: 0, mismatches: [] };
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(stripeKey, { apiVersion: "2025-04-30.basil" } as any);

  const users = await storage.getUsersBySubscriptionStates([...PREMIUM_STATES, "PAYMENT_FAILED"]);
  const mismatches: ReconciliationMismatch[] = [];

  for (const user of users) {
    if (!user.stripeCustomerId) continue;
    try {
      const subs: any = await stripe.subscriptions.list({ customer: user.stripeCustomerId, limit: 5 });
      const activeSub = subs.data.find((s: any) => ["active", "trialing", "past_due"].includes(s.status));
      const stripeStatus: string = activeSub?.status ?? "none";

      const expectedActive = user.subscriptionState === "PREMIUM_ACTIVE" || user.subscriptionState === "PREMIUM_TRIAL_ACTIVE";
      const stripeActive = stripeStatus === "active" || stripeStatus === "trialing";

      if (expectedActive !== stripeActive) {
        mismatches.push({ userId: user.id, localState: user.subscriptionState, stripeStatus });
        await recordBillingEvent(user.id, "reconciliation_mismatch", {
          localState: user.subscriptionState,
          stripeStatus,
        });
      }
    } catch (err: any) {
      console.error(`[BILLING] reconciliation error for user ${user.id}:`, err?.message || err);
    }
  }

  return { configured: true, checked: users.length, mismatches };
}

export interface BillingReport {
  windowDays: number;
  activePremiumSubscribers: number;
  mrrEstimateCents: number | null;
  paymentFailedEvents: number;
  paymentRecoveredEvents: number;
  recoveryRate: number | null;
  cancellationsRequested: number;
  reconciliationMismatches: number;
}

/**
 * generateBillingReport — MRR/churn/recovery-rate report from real logged
 * events and current subscription state, no fabricated numbers. MRR is only
 * estimated (activePremiumSubscribers × STRIPE_STANDARD_PRICE_CENTS) when
 * that env var is set — this product has two different price points
 * (standard vs. post-Rebuild rate) so a flat multiply is an approximation,
 * not a precise figure; left null rather than guessing when unset.
 */
export async function generateBillingReport(windowDays = 30): Promise<BillingReport> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const [activeUsers, events] = await Promise.all([
    storage.getUsersBySubscriptionStates([...PREMIUM_STATES]),
    storage.getBillingEventsSince(since),
  ]);

  const priceCentsEnv = process.env.STRIPE_STANDARD_PRICE_CENTS;
  const priceCents = priceCentsEnv ? parseInt(priceCentsEnv, 10) : NaN;
  const mrrEstimateCents = Number.isFinite(priceCents) ? activeUsers.length * priceCents : null;

  const count = (type: BillingEventType) => events.filter((e) => e.type === type).length;
  const failed = count("payment_failed");
  const recovered = count("payment_recovered");

  return {
    windowDays,
    activePremiumSubscribers: activeUsers.length,
    mrrEstimateCents,
    paymentFailedEvents: failed,
    paymentRecoveredEvents: recovered,
    recoveryRate: failed > 0 ? Math.round((recovered / failed) * 1000) / 1000 : null,
    cancellationsRequested: count("cancellation_requested"),
    reconciliationMismatches: count("reconciliation_mismatch"),
  };
}
