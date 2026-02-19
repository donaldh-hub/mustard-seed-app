import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  weeklyCycleStart: timestamp("weekly_cycle_start"),
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
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

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
