/**
 * REWARD ENGINE — Single source of truth for all credit/water/AP transactions.
 *
 * All verified progress rewards MUST pass through `processRewardTransaction()`.
 * Celebration text must only fire after this function returns { success: true }.
 */

import { storage } from "./storage";
import { computeWaterFromAP } from "./titan";
import { computeGrowthUpdate } from "./waterEngine";
import type { Goal } from "@shared/schema";

// ---------------------------------------------------------------------------
// REWARD CONFIG — canonical mapping for every rewardable action type
// ---------------------------------------------------------------------------

export type RewardActionType =
  | "VA"            // Verified Action (TITAN-detected)
  | "AR"            // Adaptive Recovery (TITAN-detected)
  | "RW"            // Reflection Without Action — no reward
  | "IO"            // Intention Only — no reward
  | "AD"            // Avoidance / Drift — no reward
  | "GOAL_CREATED"  // New goal planted
  | "PHOTO_PROOF"   // Vision analysis proof passed
  | "MILESTONE"     // Milestone explicitly completed
  | "CONVERSATION"; // General chat — no reward

export interface RewardConfig {
  actionType: RewardActionType;
  baseActionPoints: number;
  awardsWater: boolean;
  awardsEntry: boolean;
  triggersCelebration: boolean;
  verificationRule: string;
  description: string;
}

export const REWARD_CONFIG: Record<RewardActionType, RewardConfig> = {
  VA: {
    actionType: "VA",
    baseActionPoints: 3,
    awardsWater: true,
    awardsEntry: true,
    triggersCelebration: true,
    verificationRule: "TITAN VA_PATTERNS keyword match",
    description: "Real completed action reported by user",
  },
  AR: {
    actionType: "AR",
    baseActionPoints: 2,
    awardsWater: true,
    awardsEntry: true,
    triggersCelebration: true,
    verificationRule: "TITAN AR_PATTERNS keyword match",
    description: "Bounced back or adapted after a setback",
  },
  RW: {
    actionType: "RW",
    baseActionPoints: 0,
    awardsWater: false,
    awardsEntry: false,
    triggersCelebration: false,
    verificationRule: "TITAN RW_PATTERNS keyword match",
    description: "Reflection shared — no physical action taken",
  },
  IO: {
    actionType: "IO",
    baseActionPoints: 0,
    awardsWater: false,
    awardsEntry: false,
    triggersCelebration: false,
    verificationRule: "TITAN IO_PATTERNS keyword match",
    description: "Intention stated — no reward until action confirmed",
  },
  AD: {
    actionType: "AD",
    baseActionPoints: 0,
    awardsWater: false,
    awardsEntry: false,
    triggersCelebration: false,
    verificationRule: "TITAN AD_PATTERNS keyword match",
    description: "Avoidance or drift — drift marker applied",
  },
  GOAL_CREATED: {
    actionType: "GOAL_CREATED",
    baseActionPoints: 0,
    awardsWater: false,
    awardsEntry: true,
    triggersCelebration: false,
    verificationRule: "Goal saved to DB with active status",
    description: "New goal planted — entry only, no AP",
  },
  PHOTO_PROOF: {
    actionType: "PHOTO_PROOF",
    baseActionPoints: 5,
    awardsWater: true,
    awardsEntry: true,
    triggersCelebration: true,
    verificationRule: "Vision analysis confidence >= 60%",
    description: "Photo proof verified by vision analysis",
  },
  MILESTONE: {
    actionType: "MILESTONE",
    baseActionPoints: 5,
    awardsWater: true,
    awardsEntry: true,
    triggersCelebration: true,
    verificationRule: "Milestone marked complete by user confirmation",
    description: "Declared sub-goal or milestone completed",
  },
  CONVERSATION: {
    actionType: "CONVERSATION",
    baseActionPoints: 0,
    awardsWater: false,
    awardsEntry: false,
    triggersCelebration: false,
    verificationRule: "No VA/AR TITAN match — general conversation",
    description: "General chat or unclassified input",
  },
};

// ---------------------------------------------------------------------------
// In-memory deduplication (prevents double-reward on network retry / double-click)
// Resets on server restart — acceptable; persistent state is in the DB.
// ---------------------------------------------------------------------------

const _rewardHashes = new Map<string, number>();

function _hashKey(userId: string, rawText: string, todayStr: string): string {
  const normalized = rawText.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  return `${userId}::${todayStr}::${normalized}`;
}

function _isDuplicateReward(userId: string, rawText: string, todayStr: string): boolean {
  const key = _hashKey(userId, rawText, todayStr);
  const last = _rewardHashes.get(key);
  return !!(last && Date.now() - last < 90_000);
}

function _markRewardGranted(userId: string, rawText: string, todayStr: string): void {
  const key = _hashKey(userId, rawText, todayStr);
  _rewardHashes.set(key, Date.now());
  // Prune entries older than 10 minutes
  const cutoff = Date.now() - 600_000;
  for (const [k, v] of _rewardHashes) {
    if (v < cutoff) _rewardHashes.delete(k);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RewardInput {
  userId: string;
  rawText: string;
  apDelta: number;
  matchGoal: Goal | null;
  actionType: RewardActionType;
  todayStr: string;
}

export type RewardSkipReason =
  | "no_verified_action"
  | "no_action_points"
  | "no_active_goal"
  | "duplicate_submission"
  | "db_write_failure"
  | "entry_write_failure";

export interface RewardResult {
  success: boolean;
  skipReason: RewardSkipReason | null;
  waterAwarded: boolean;
  entryCreated: boolean;
  apActuallyAwarded: number;
  postUpdateAP: number | null;
  growthResult: {
    waterEvents: number;
    cupsFilled: number;
    seedStage: number;
    cupJustFilled: boolean;
    stageAdvanced: boolean;
    preResetFillPercent: number;
  } | null;
  waterGoalId: string | null;
}

// ---------------------------------------------------------------------------
// Core transaction function
// ---------------------------------------------------------------------------

/**
 * processRewardTransaction — the ONLY place where AP, water, and goal state
 * are updated for a verified progress event.
 *
 * Flow:
 *  1. Validate inputs and action type
 *  2. Deduplication check (90-second in-memory window)
 *  3. Compute new AP total and any full water units earned
 *  4. Write updated AP (and water if threshold crossed) to goals table
 *  5. Create progress entry in entries table (mood: happy)
 *  6. Mark dedup hash as granted
 *  7. Return result — caller must check success before triggering celebration
 */
export async function processRewardTransaction(
  input: RewardInput
): Promise<RewardResult> {
  const { userId, rawText, apDelta, matchGoal, actionType, todayStr } = input;

  const skip = (reason: RewardSkipReason): RewardResult => {
    console.log(`[REWARD] SKIP | reason=${reason} | actionType=${actionType} | ap=${apDelta} | text="${rawText.substring(0, 60)}"`);
    return {
      success: false,
      skipReason: reason,
      waterAwarded: false,
      entryCreated: false,
      apActuallyAwarded: 0,
      postUpdateAP: null,
      growthResult: null,
      waterGoalId: null,
    };
  };

  // 1. Validate: only VA, AR, PHOTO_PROOF, MILESTONE trigger rewards
  const config = REWARD_CONFIG[actionType];
  if (!config || !config.triggersCelebration) {
    return skip("no_verified_action");
  }

  if (apDelta <= 0) {
    return skip("no_action_points");
  }

  // 2. Deduplication
  if (_isDuplicateReward(userId, rawText, todayStr)) {
    return skip("duplicate_submission");
  }

  // If no goal exists, AP is still acknowledged but no water/DB update on goal
  if (!matchGoal) {
    console.log(`[REWARD] NO_GOAL | apDelta=${apDelta} | no water awarded | text="${rawText.substring(0, 60)}"`);
    _markRewardGranted(userId, rawText, todayStr);
    return {
      success: true,
      skipReason: "no_active_goal",
      waterAwarded: false,
      entryCreated: false,
      apActuallyAwarded: apDelta,
      postUpdateAP: null,
      growthResult: null,
      waterGoalId: null,
    };
  }

  // 3. Compute AP and water
  const currentAP = matchGoal.actionPoints || 0;
  const { waterUnits, remainingAP } = computeWaterFromAP(currentAP, apDelta);

  let growthResult: RewardResult["growthResult"] = null;
  let waterAwarded = false;
  let waterGoalId: string | null = null;

  // 4. Write goal update to DB
  try {
    if (waterUnits > 0) {
      growthResult = computeGrowthUpdate(
        matchGoal.waterEvents,
        matchGoal.cupsFilled,
        matchGoal.seedStage,
        waterUnits
      );
      waterAwarded = true;
      waterGoalId = matchGoal.id;

      await storage.updateGoal(matchGoal.id, {
        actionPoints: remainingAP,
        waterEvents: growthResult.waterEvents,
        cupsFilled: growthResult.cupsFilled,
        seedStage: growthResult.seedStage,
      });

      console.log(
        `[REWARD] WATER | goalId=${matchGoal.id} | waterUnits=${waterUnits} ` +
        `| newWE=${growthResult.waterEvents} | cups=${growthResult.cupsFilled} ` +
        `| stage=${growthResult.seedStage} | cupJustFilled=${growthResult.cupJustFilled}`
      );
    } else {
      await storage.updateGoal(matchGoal.id, { actionPoints: remainingAP });
      console.log(
        `[REWARD] AP_ONLY | goalId=${matchGoal.id} | apAdded=${apDelta} ` +
        `| totalAP=${remainingAP} | next_water_in=${10 - remainingAP}AP`
      );
    }
  } catch (err) {
    console.error(
      `[REWARD_FLOW_ERROR] db_write | goalId=${matchGoal.id} | err="${(err as Error).message}" ` +
      `| celebration_blocked=true`
    );
    return skip("db_write_failure");
  }

  // 5. Create progress entry
  let entryCreated = false;
  try {
    await storage.createEntry({ userId, date: todayStr, summary: rawText, mood: "happy" });
    entryCreated = true;
  } catch (err) {
    // Non-fatal — reward already written; log but don't block
    console.error(`[MEMORY_WRITE_ERROR] entry_create | userId=${userId} | err="${(err as Error).message}"`);
  }

  // 6. Mark dedup so retry within 90s is blocked
  _markRewardGranted(userId, rawText, todayStr);

  console.log(
    `[REWARD] SUCCESS | actionType=${actionType} | apAwarded=${apDelta} ` +
    `| remainingAP=${remainingAP} | waterAwarded=${waterAwarded} ` +
    `| entryCreated=${entryCreated} | goal="${matchGoal.title}"`
  );

  return {
    success: true,
    skipReason: null,
    waterAwarded,
    entryCreated,
    apActuallyAwarded: apDelta,
    postUpdateAP: remainingAP,
    growthResult,
    waterGoalId,
  };
}
