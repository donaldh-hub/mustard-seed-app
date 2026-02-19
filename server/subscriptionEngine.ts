import type { User, SubscriptionState } from "@shared/schema";

const TRIAL_DURATION_DAYS = 14;
const GRACE_PERIOD_DAYS = 3;

export function computeTrialExpiresAt(trialStartedAt: Date): Date {
  const expires = new Date(trialStartedAt);
  expires.setDate(expires.getDate() + TRIAL_DURATION_DAYS);
  return expires;
}

export function deriveEffectiveState(user: User): {
  subscriptionState: SubscriptionState;
  subscriptionTier: string;
} {
  const now = new Date();
  const state = user.subscriptionState as SubscriptionState;

  if (state === "PREMIUM_TRIAL_ACTIVE") {
    let trialExpires = user.trialExpiresAt ? new Date(user.trialExpiresAt) : null;
    if (!trialExpires && user.trialStartedAt) {
      trialExpires = computeTrialExpiresAt(new Date(user.trialStartedAt));
    }
    if (!trialExpires && user.createdAt) {
      trialExpires = computeTrialExpiresAt(new Date(user.createdAt));
    }
    if (trialExpires && now > trialExpires) {
      return { subscriptionState: "PREMIUM_EXPIRED", subscriptionTier: "lite" };
    }
    return { subscriptionState: "PREMIUM_TRIAL_ACTIVE", subscriptionTier: "premium" };
  }

  if (state === "PREMIUM_ACTIVE") {
    return { subscriptionState: "PREMIUM_ACTIVE", subscriptionTier: "premium" };
  }

  if (state === "PREMIUM_GRACE_PERIOD") {
    const subExpires = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null;
    if (subExpires && now > subExpires) {
      return { subscriptionState: "PREMIUM_EXPIRED", subscriptionTier: "lite" };
    }
    return { subscriptionState: "PREMIUM_GRACE_PERIOD", subscriptionTier: "premium" };
  }

  if (state === "CANCELED_PENDING_EXPIRATION") {
    const subExpires = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null;
    if (subExpires && now > subExpires) {
      return { subscriptionState: "PREMIUM_EXPIRED", subscriptionTier: "lite" };
    }
    return { subscriptionState: "CANCELED_PENDING_EXPIRATION", subscriptionTier: "premium" };
  }

  if (state === "PAYMENT_FAILED") {
    const subExpires = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null;
    if (subExpires && now > subExpires) {
      return { subscriptionState: "PREMIUM_EXPIRED", subscriptionTier: "lite" };
    }
    return { subscriptionState: "PAYMENT_FAILED", subscriptionTier: "premium" };
  }

  return { subscriptionState: "LITE", subscriptionTier: "lite" };
}

export function isPremium(user: User): boolean {
  const { subscriptionTier } = deriveEffectiveState(user);
  return subscriptionTier === "premium";
}

export function getSubscriptionBadge(user: User): string {
  const { subscriptionState } = deriveEffectiveState(user);

  switch (subscriptionState) {
    case "PREMIUM_TRIAL_ACTIVE":
      return "Premium (Trial)";
    case "PREMIUM_ACTIVE":
      return "Premium";
    case "PREMIUM_GRACE_PERIOD":
      return "Premium (Grace)";
    case "CANCELED_PENDING_EXPIRATION":
      return "Premium (Canceling)";
    case "PAYMENT_FAILED":
      return "Premium (Payment Issue)";
    case "PREMIUM_EXPIRED":
      return "Lite";
    case "LITE":
    default:
      return "Lite";
  }
}

export function getTrialDaysRemaining(user: User): number | null {
  if (user.subscriptionState !== "PREMIUM_TRIAL_ACTIVE") return null;
  let trialExpires = user.trialExpiresAt ? new Date(user.trialExpiresAt) : null;
  if (!trialExpires && user.trialStartedAt) {
    trialExpires = computeTrialExpiresAt(new Date(user.trialStartedAt));
  }
  if (!trialExpires && user.createdAt) {
    trialExpires = computeTrialExpiresAt(new Date(user.createdAt));
  }
  if (!trialExpires) return null;
  const now = new Date();
  const diff = trialExpires.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export const LITE_LIMITS = {
  maxGoals: 1,
  chatDepth: "standard",
  heartbeatScoring: false,
  heartbeatTrends: false,
  monthlyRecalibration: false,
  weeklyReviewDepth: "summary",
  trendAnalytics: false,
  progressPhotos: false,
  waterWeighting: false,
} as const;

export const PREMIUM_FEATURES = {
  maxGoals: 2,
  chatDepth: "depth",
  heartbeatScoring: true,
  heartbeatTrends: true,
  monthlyRecalibration: true,
  weeklyReviewDepth: "full",
  trendAnalytics: true,
  progressPhotos: true,
  waterWeighting: true,
} as const;

export function getFeatureLimits(user: User) {
  return isPremium(user) ? PREMIUM_FEATURES : LITE_LIMITS;
}

export type StripeEventAction =
  | { type: "subscription_created"; stripeCustomerId: string; stripeSubscriptionId: string; planInterval: string; expiresAt: Date }
  | { type: "subscription_renewed"; expiresAt: Date }
  | { type: "subscription_canceled"; expiresAt: Date }
  | { type: "payment_failed" }
  | { type: "payment_recovered"; expiresAt: Date };

export function computeStateTransition(
  currentState: SubscriptionState,
  action: StripeEventAction
): { subscriptionState: SubscriptionState; subscriptionTier: string; subscriptionExpiresAt?: Date } {
  switch (action.type) {
    case "subscription_created":
      return {
        subscriptionState: "PREMIUM_ACTIVE",
        subscriptionTier: "premium",
        subscriptionExpiresAt: action.expiresAt,
      };

    case "subscription_renewed":
      return {
        subscriptionState: "PREMIUM_ACTIVE",
        subscriptionTier: "premium",
        subscriptionExpiresAt: action.expiresAt,
      };

    case "subscription_canceled":
      return {
        subscriptionState: "CANCELED_PENDING_EXPIRATION",
        subscriptionTier: "premium",
        subscriptionExpiresAt: action.expiresAt,
      };

    case "payment_failed":
      return {
        subscriptionState: "PAYMENT_FAILED",
        subscriptionTier: "premium",
      };

    case "payment_recovered":
      return {
        subscriptionState: "PREMIUM_ACTIVE",
        subscriptionTier: "premium",
        subscriptionExpiresAt: action.expiresAt,
      };

    default:
      return {
        subscriptionState: currentState,
        subscriptionTier: currentState === "LITE" || currentState === "PREMIUM_EXPIRED" ? "lite" : "premium",
      };
  }
}
