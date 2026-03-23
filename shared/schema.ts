import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const SUBSCRIPTION_STATES = [
  "LITE",
  "PREMIUM_TRIAL_ACTIVE",
  "PREMIUM_ACTIVE",
  "PREMIUM_GRACE_PERIOD",
  "PREMIUM_EXPIRED",
  "PAYMENT_FAILED",
  "CANCELED_PENDING_EXPIRATION",
] as const;
export type SubscriptionState = typeof SUBSCRIPTION_STATES[number];

export const SUBSCRIPTION_PLATFORMS = ["STRIPE", "APPLE", "GOOGLE"] as const;
export type SubscriptionPlatform = typeof SUBSCRIPTION_PLATFORMS[number];

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().default(""),
  goals: text("goals").array().notNull().default(sql`'{}'::text[]`),
  struggles: text("struggles").array().notNull().default(sql`'{}'::text[]`),
  commitmentLevel: text("commitment_level").notNull().default("serious"),
  isOnboarded: integer("is_onboarded").notNull().default(0),
  waterLevel: integer("water_level").notNull().default(30),
  treeStage: integer("tree_stage").notNull().default(1),
  streak: integer("streak").notNull().default(0),
  previousStreak: integer("previous_streak").notNull().default(0),
  driftMarkers: integer("drift_markers").notNull().default(0),
  consecutiveIOCount: integer("consecutive_io_count").notNull().default(0),
  cBurnActive: integer("c_burn_active").notNull().default(0),
  lastVerifiedActionAt: timestamp("last_verified_action_at"),
  lastDriftWarningAt: timestamp("last_drift_warning_at"),
  driftWarningCount14d: integer("drift_warning_count_14d").notNull().default(0),
  heartbeatCredits: jsonb("heartbeat_credits").notNull().default(sql`'{"clarity":0,"consistency":0,"mindset":0,"adaptation":0,"courage":0}'::jsonb`),
  weeklyCycleStart: timestamp("weekly_cycle_start"),
  subscriptionTier: text("subscription_tier").notNull().default("lite"),
  subscriptionState: text("subscription_state").notNull().default("LITE"),
  subscriptionPlatform: text("subscription_platform"),
  subscriptionProductId: text("subscription_product_id"),
  trialStartedAt: timestamp("trial_started_at").defaultNow(),
  trialExpiresAt: timestamp("trial_expires_at"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  lastReceiptValidation: timestamp("last_receipt_validation"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planInterval: text("plan_interval"),
  lastPaymentStatus: text("last_payment_status"),
  firstGoalMomentumUsed: boolean("first_goal_momentum_used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  text: text("text").notNull(),
  sender: text("sender").notNull(),
  messageType: text("message_type").notNull().default("text"),
  status: text("status").notNull().default("sent"),
  photoUrl: text("photo_url"),
  analysisJson: jsonb("analysis_json"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export const photoMemories = pgTable("photo_memories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  messageId: varchar("message_id").notNull(),
  dateKey: text("date_key").notNull(),
  photoUrl: text("photo_url").notNull(),
  status: text("status").notNull().default("pending_analysis"),
  analysisJson: jsonb("analysis_json"),
  waterAwarded: integer("water_awarded").notNull().default(0),
  waterReason: text("water_reason"),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  visibility: text("visibility").notNull().default("private"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPhotoMemorySchema = createInsertSchema(photoMemories).omit({
  id: true,
  createdAt: true,
});
export type InsertPhotoMemory = z.infer<typeof insertPhotoMemorySchema>;
export type PhotoMemory = typeof photoMemories.$inferSelect;

export const goals = pgTable("goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  goalType: text("goal_type").notNull().default("untargeted"),
  status: text("status").notNull().default("active"),
  emotionalWhy: text("emotional_why").notNull().default(""),
  focusArea: text("focus_area").notNull().default(""),
  metricType: text("metric_type").notNull().default("actions"),
  deadline: text("deadline"),
  baselineMetric: real("baseline_metric"),
  targetMetric: real("target_metric"),
  percentComplete: real("percent_complete").notNull().default(0),
  microHabit: text("micro_habit").notNull().default(""),
  weeklyTarget: integer("weekly_target").notNull().default(3),
  streakCount: integer("streak_count").notNull().default(0),
  momentumScore: real("momentum_score").notNull().default(0),
  consistencyRate: real("consistency_rate").notNull().default(0),
  treeGrowthScore: real("tree_growth_score").notNull().default(0),
  waterEvents: integer("water_events").notNull().default(0),
  actionPoints: integer("action_points").notNull().default(0),
  insightPoints: integer("insight_points").notNull().default(0),
  cupsFilled: integer("cups_filled").notNull().default(0),
  seedStage: integer("seed_stage").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGoalSchema = createInsertSchema(goals).omit({
  id: true,
  createdAt: true,
});
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goals.$inferSelect;

export const entries = pgTable("entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  goalId: varchar("goal_id"),
  date: text("date").notNull(),
  summary: text("summary").notNull(),
  mood: text("mood").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEntrySchema = createInsertSchema(entries).omit({
  id: true,
  createdAt: true,
});
export type InsertEntry = z.infer<typeof insertEntrySchema>;
export type Entry = typeof entries.$inferSelect;

export const weeklyReviews = pgTable("weekly_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  cycleStartDate: text("cycle_start_date").notNull(),
  status: text("status").notNull().default("pending"),
  targetedGoalSnapshot: jsonb("targeted_goal_snapshot"),
  heartbeatDirections: jsonb("heartbeat_directions"),
  collectiveAnalysis: text("collective_analysis"),
  previousMeasurable: real("previous_measurable"),
  currentMeasurable: real("current_measurable"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWeeklyReviewSchema = createInsertSchema(weeklyReviews).omit({
  id: true,
  createdAt: true,
});
export type InsertWeeklyReview = z.infer<typeof insertWeeklyReviewSchema>;
export type WeeklyReview = typeof weeklyReviews.$inferSelect;

export const commitments = pgTable("commitments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  action: text("action").notNull(),
  expectedTime: text("expected_time"),
  status: text("status").notNull().default("pending"),
  sourceMessageId: varchar("source_message_id"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCommitmentSchema = createInsertSchema(commitments).omit({
  id: true,
  createdAt: true,
});
export type InsertCommitment = z.infer<typeof insertCommitmentSchema>;
export type Commitment = typeof commitments.$inferSelect;

export const assessments = pgTable("assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  answers: jsonb("answers").notNull(),
  totalScore: integer("total_score").notNull(),
  stage: text("stage").notNull(),
  motivationalMessage: text("motivational_message").notNull(),
  heartbeatScores: jsonb("heartbeat_scores").notNull().default(sql`'{}'::jsonb`),
  weakestHeartbeat: text("weakest_heartbeat").notNull().default(''),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAssessmentSchema = createInsertSchema(assessments).omit({
  id: true,
  createdAt: true,
});
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
export type Assessment = typeof assessments.$inferSelect;
