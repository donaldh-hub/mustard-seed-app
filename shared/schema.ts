import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
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
  sender: text("sender").notNull(), // 'user' | 'jae'
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
  metricType: text("metric_type").notNull().default("actions"),
  targetDate: text("target_date"),
  weeklyTarget: integer("weekly_target").notNull().default(3),
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
  date: text("date").notNull(), // YYYY-MM-DD
  summary: text("summary").notNull(),
  mood: text("mood").notNull(), // 'happy' | 'neutral' | 'sad'
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEntrySchema = createInsertSchema(entries).omit({
  id: true,
  createdAt: true,
});
export type InsertEntry = z.infer<typeof insertEntrySchema>;
export type Entry = typeof entries.$inferSelect;

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
