import { storage } from "./storage";
import { getFeatureLimits } from "./subscriptionEngine";
import type { Goal } from "@shared/schema";

// The one way a goal gets planted — the Growth tab form (POST /goals), the
// chat "save: my goal is…" path, and Jai's guided setup all call this.
//
// Planting: saves the goal, sets it on the profile (user.goals), and writes
// the "Goal planted" Memory entry. That entry is the goal's first water: a
// rewarded ("happy") entry written after planting is what the garden counts
// (routes.ts rewardedEntriesForGoal).

export interface PlantGoalInput {
  goalType: "targeted" | "untargeted";
  title: string;
  emotionalWhy?: string;
  // Free text on the goal. Guided setup stores the Heartbeat the goal leans
  // on here (full name).
  focusArea?: string;
  metricType?: string;
  deadline?: string | null;
  baselineMetric?: number | null;
  targetMetric?: number | null;
  microHabit?: string;
  weeklyTarget?: number;
  localDate?: string;
  userTimezone?: string;
}

export type PlantGoalResult =
  | { ok: true; goal: Goal }
  | { ok: false; status: 404 | 409 | 403; message: string; upgradeRequired?: boolean };

export async function plantGoal(userId: string, input: PlantGoalInput): Promise<PlantGoalResult> {
  const user = await storage.getUser(userId);
  if (!user) return { ok: false, status: 404, message: "User not found" };

  const activeGoals = await storage.getActiveGoals(userId);
  if (activeGoals.some((g) => g.goalType === input.goalType)) {
    return {
      ok: false,
      status: 409,
      message: input.goalType === "targeted"
        ? "You already have an active targeted goal. Complete or archive it before starting another."
        : "Focus builds growth. Complete or archive your current identity goal before adding another.",
    };
  }
  if (activeGoals.length >= getFeatureLimits(user).maxGoals) {
    return { ok: false, status: 403, message: "Upgrade to Premium to plant a second goal.", upgradeRequired: true };
  }

  const title = input.title || "";
  const goal = await storage.createGoal({
    userId,
    title,
    goalType: input.goalType,
    status: "active",
    emotionalWhy: input.emotionalWhy || "",
    focusArea: input.focusArea || "",
    metricType: input.metricType || "actions",
    deadline: input.deadline || null,
    baselineMetric: input.baselineMetric ?? null,
    targetMetric: input.targetMetric ?? null,
    percentComplete: 0,
    microHabit: input.microHabit || "",
    weeklyTarget: input.weeklyTarget ?? 3,
    streakCount: 0,
    momentumScore: 0,
    consistencyRate: 0,
    treeGrowthScore: 0,
    isActive: 1,
  });

  const index = input.goalType === "targeted" ? 0 : 1;
  const profileGoals = [...(user.goals || [])];
  while (profileGoals.length <= index) profileGoals.push("");
  profileGoals[index] = title;
  await storage.updateUser(userId, { goals: profileGoals });

  await storage.createEntry({
    userId,
    goalId: goal.id,
    date: input.localDate || new Date().toLocaleDateString("en-CA"),
    summary: `Goal planted: ${title}`,
    mood: "happy",
    waterUnits: 1,
    ...(input.userTimezone ? { userTimezone: input.userTimezone } : {}),
  });

  return { ok: true, goal };
}
