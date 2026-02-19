import type { User, SubscriptionState, SubscriptionPlatform } from "@shared/schema";

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

const PREMIUM_STATES: SubscriptionState[] = [
  "PREMIUM_TRIAL_ACTIVE",
  "PREMIUM_ACTIVE",
  "PREMIUM_GRACE_PERIOD",
  "CANCELED_PENDING_EXPIRATION",
];

export function hasPremiumAccess(user: User): boolean {
  const { subscriptionState } = deriveEffectiveState(user);
  return PREMIUM_STATES.includes(subscriptionState);
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
      return "Premium (Ends Soon)";
    case "PAYMENT_FAILED":
      return "Payment Issue";
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

export type SubscriptionEventAction =
  | { platform: SubscriptionPlatform; type: "subscription_created"; subscriptionId: string; productId?: string; planInterval?: string; expiresAt: Date }
  | { platform: SubscriptionPlatform; type: "trial_started"; expiresAt: Date; productId?: string }
  | { platform: SubscriptionPlatform; type: "subscription_renewed"; expiresAt: Date }
  | { platform: SubscriptionPlatform; type: "subscription_canceled"; expiresAt: Date }
  | { platform: SubscriptionPlatform; type: "payment_failed" }
  | { platform: SubscriptionPlatform; type: "payment_recovered"; expiresAt: Date };

export function computeStateTransition(
  currentState: SubscriptionState,
  action: SubscriptionEventAction
): {
  subscriptionState: SubscriptionState;
  subscriptionTier: string;
  subscriptionPlatform?: SubscriptionPlatform;
  subscriptionProductId?: string;
  subscriptionExpiresAt?: Date;
  trialStartedAt?: Date;
  trialExpiresAt?: Date;
  lastReceiptValidation?: Date;
} {
  const now = new Date();

  switch (action.type) {
    case "trial_started":
      return {
        subscriptionState: "PREMIUM_TRIAL_ACTIVE",
        subscriptionTier: "premium",
        subscriptionPlatform: action.platform,
        subscriptionProductId: action.productId,
        trialStartedAt: now,
        trialExpiresAt: action.expiresAt,
        lastReceiptValidation: now,
      };

    case "subscription_created":
      return {
        subscriptionState: "PREMIUM_ACTIVE",
        subscriptionTier: "premium",
        subscriptionPlatform: action.platform,
        subscriptionProductId: action.productId,
        subscriptionExpiresAt: action.expiresAt,
        lastReceiptValidation: now,
      };

    case "subscription_renewed":
      return {
        subscriptionState: "PREMIUM_ACTIVE",
        subscriptionTier: "premium",
        subscriptionExpiresAt: action.expiresAt,
        lastReceiptValidation: now,
      };

    case "subscription_canceled":
      return {
        subscriptionState: "CANCELED_PENDING_EXPIRATION",
        subscriptionTier: "premium",
        subscriptionExpiresAt: action.expiresAt,
        lastReceiptValidation: now,
      };

    case "payment_failed":
      return {
        subscriptionState: "PAYMENT_FAILED",
        subscriptionTier: "premium",
        lastReceiptValidation: now,
      };

    case "payment_recovered":
      return {
        subscriptionState: "PREMIUM_ACTIVE",
        subscriptionTier: "premium",
        subscriptionExpiresAt: action.expiresAt,
        lastReceiptValidation: now,
      };

    default:
      return {
        subscriptionState: currentState,
        subscriptionTier: currentState === "LITE" || currentState === "PREMIUM_EXPIRED" ? "lite" : "premium",
      };
  }
}

export function validateReceiptUpdate(
  user: User,
  storeExpiresAt: Date,
  storeIsActive: boolean,
  storeIsTrial: boolean,
  platform: SubscriptionPlatform
): Partial<User> & { subscriptionState: SubscriptionState; subscriptionTier: string } {
  const now = new Date();

  if (storeIsTrial && storeIsActive) {
    return {
      subscriptionState: "PREMIUM_TRIAL_ACTIVE",
      subscriptionTier: "premium",
      subscriptionPlatform: platform,
      subscriptionExpiresAt: storeExpiresAt,
      lastReceiptValidation: now,
    } as any;
  }

  if (storeIsActive && !storeIsTrial) {
    return {
      subscriptionState: "PREMIUM_ACTIVE",
      subscriptionTier: "premium",
      subscriptionPlatform: platform,
      subscriptionExpiresAt: storeExpiresAt,
      lastReceiptValidation: now,
    } as any;
  }

  if (!storeIsActive && storeExpiresAt > now) {
    return {
      subscriptionState: "CANCELED_PENDING_EXPIRATION",
      subscriptionTier: "premium",
      subscriptionPlatform: platform,
      subscriptionExpiresAt: storeExpiresAt,
      lastReceiptValidation: now,
    } as any;
  }

  return {
    subscriptionState: "LITE",
    subscriptionTier: "lite",
    subscriptionPlatform: platform,
    lastReceiptValidation: now,
  } as any;
}
