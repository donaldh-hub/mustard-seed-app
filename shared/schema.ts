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
  email: text("email").unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  passwordHash: text("password_hash"),
  authProvider: text("auth_provider").default("email"),
  googleId: text("google_id").unique(),
  profileImage: text("profile_image"),
  lastLoginAt: timestamp("last_login_at"),
  assessmentCompleted: boolean("assessment_completed").notNull().default(false),
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
  stripeCustomerId: text("stripe_customer_id"),
  trialStartedAt: timestamp("trial_started_at").defaultNow(),
  trialExpiresAt: timestamp("trial_expires_at"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  lastReceiptValidation: timestamp("last_receipt_validation"),
  firstGoalMomentumUsed: boolean("first_goal_momentum_used").notNull().default(false),
  assessmentReminderCadenceMonths: integer("assessment_reminder_cadence_months").notNull().default(3),
  notifyDailyEncouragement: boolean("notify_daily_encouragement").notNull().default(true),
  notifyWeeklySummary: boolean("notify_weekly_summary").notNull().default(true),
  notifyAssessmentReminder: boolean("notify_assessment_reminder").notNull().default(true),
  themePreference: text("theme_preference").notNull().default("light"),
  groundingJournalCompleted: boolean("grounding_journal_completed").notNull().default(false),
  hasCompletedRebuild: boolean("has_completed_rebuild").notNull().default(false),
  lastRebuildActivityAt: timestamp("last_rebuild_activity_at"),
  lastAssessmentReminderSentAt: timestamp("last_assessment_reminder_sent_at"),
  lastDailyEncouragementSentAt: timestamp("last_daily_encouragement_sent_at"),
  lastWeeklySummaryChatAt: timestamp("last_weekly_summary_chat_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const groundingJournalEntries = pgTable("grounding_journal_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  dayNumber: integer("day_number").notNull(),
  session: text("session").notNull(),
  prompts: jsonb("prompts").notNull().default(sql`'[]'::jsonb`),
  jaeReflection: text("jae_reflection"),
  jaeFollowUpQuestion: text("jae_follow_up_question"),
  userFollowUpResponse: text("user_follow_up_response"),
  keyTheme: text("key_theme"),
  releasePoint: text("release_point"),
  valueNamed: text("value_named"),
  possibleFirstSeed: text("possible_first_seed"),
  isComplete: boolean("is_complete").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export type GroundingJournalEntry = typeof groundingJournalEntries.$inferSelect;

// ─── 7-Day Rebuild ───────────────────────────────────────────────────────────
// Each row = one instance (1–7). Status drives unlock gating.
// memoryData stores per-instance reflection fields (see rebuildContent.ts for shape).
// day7Stages is only populated for instance 7 (multi-stage, no calendar gate).
export const rebuildInstances = pgTable("rebuild_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  instanceNumber: integer("instance_number").notNull(),
  status: text("status").notNull().default("locked"), // locked | unlocked | in_progress | completed
  memoryData: jsonb("memory_data").notNull().default(sql`'{}'::jsonb`),
  day7Stages: jsonb("day7_stages").notNull().default(sql`'{}'::jsonb`),
  lastActivityAt: timestamp("last_activity_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type RebuildInstance = typeof rebuildInstances.$inferSelect;

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const authEvents = pgTable("auth_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  event: text("event").notNull(),
  provider: text("provider"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

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
  userTimezone: text("user_timezone"),
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

// ─── Trust & Safety (Agent 01) ───────────────────────────────────────────────
// Crisis-language screening across every Jai/Jio/Jazz turn. Locked response
// wording lives in server/trustSafety.ts — this table is the audit log.
export const SAFETY_TRIGGER_CATEGORIES = [
  "passive_ideation",
  "active_ideation",
  "ideation_with_plan_or_means",
  "hopelessness_finality",
  "direct_self_harm",
  "abuse_in_progress",
  "medical_emergency",
  "disordered_eating",
] as const;
export type SafetyTriggerCategory = typeof SAFETY_TRIGGER_CATEGORIES[number];

export const SAFETY_RESPONSE_TYPES = ["primary", "backtrack_followup"] as const;
export type SafetyResponseType = typeof SAFETY_RESPONSE_TYPES[number];

export const safetyEvents = pgTable("safety_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  category: text("category").notNull(),
  responseType: text("response_type").notNull().default("primary"),
  triggeringMessage: text("triggering_message").notNull(),
  surface: text("surface").notNull().default("chat"), // chat | grounding_journal | rebuild
  alertSent: boolean("alert_sent").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSafetyEventSchema = createInsertSchema(safetyEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertSafetyEvent = z.infer<typeof insertSafetyEventSchema>;
export type SafetyEvent = typeof safetyEvents.$inferSelect;

// ─── Jai Quality Supervisor (Agent 02) ───────────────────────────────────────
// Samples Jai conversation and pre-publish drafts against a style guide that
// only the founder can promote to "approved". Flags drift with the rule and
// line quoted — never edits Jai's core prompt or any content directly.
export const STYLE_GUIDE_STATUSES = ["draft", "approved", "superseded"] as const;
export type StyleGuideStatus = typeof STYLE_GUIDE_STATUSES[number];

export const styleGuideVersions = pgTable("style_guide_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
});

export const insertStyleGuideVersionSchema = createInsertSchema(styleGuideVersions).omit({
  id: true,
  createdAt: true,
});
export type InsertStyleGuideVersion = z.infer<typeof insertStyleGuideVersionSchema>;
export type StyleGuideVersion = typeof styleGuideVersions.$inferSelect;

export const QUALITY_CHECK_SOURCES = ["jai_sample", "content_repurposing", "curriculum"] as const;
export type QualityCheckSource = typeof QUALITY_CHECK_SOURCES[number];

export const qualityChecks = pgTable("quality_checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  source: text("source").notNull(), // jai_sample | content_repurposing | curriculum
  sourceRef: text("source_ref"), // message id for jai_sample; a draft id/slug once Phase 5/8 exist
  excerpt: text("excerpt").notNull(),
  passed: boolean("passed").notNull(),
  ruleBroken: text("rule_broken"),
  quotedLine: text("quoted_line"),
  explanation: text("explanation"),
  checkedAgainstApprovedGuide: boolean("checked_against_approved_guide").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertQualityCheckSchema = createInsertSchema(qualityChecks).omit({
  id: true,
  createdAt: true,
});
export type InsertQualityCheck = z.infer<typeof insertQualityCheckSchema>;
export type QualityCheck = typeof qualityChecks.$inferSelect;

// ─── Support & Onboarding Agent (Agent 03) ───────────────────────────────────
// Answers onboarding questions from an approved response library only, and
// routes anything outside it — plus refunds, deletions, and payment disputes
// — to a human instead of improvising. Every inquiry is logged here so the
// weekly "where are users getting stuck" report has real data to run on.
export const SUPPORT_OUTCOMES = ["library", "escalated", "unhandled"] as const;
export type SupportOutcome = typeof SUPPORT_OUTCOMES[number];

export const SUPPORT_ESCALATION_REASONS = ["refund", "account_deletion", "payment_dispute"] as const;
export type SupportEscalationReason = typeof SUPPORT_ESCALATION_REASONS[number];

export const supportInquiries = pgTable("support_inquiries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  text: text("text").notNull(),
  outcome: text("outcome").notNull(), // library | escalated | unhandled
  libraryEntryId: text("library_entry_id"),
  escalationReason: text("escalation_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSupportInquirySchema = createInsertSchema(supportInquiries).omit({
  id: true,
  createdAt: true,
});
export type InsertSupportInquiry = z.infer<typeof insertSupportInquirySchema>;
export type SupportInquiry = typeof supportInquiries.$inferSelect;

// ─── Billing & Subscription Agent (Agent 04) ─────────────────────────────────
// Audit log for the dunning sequence, reconciliation, and the MRR/churn
// report. This agent never issues refunds, discounts, pricing changes, or
// manual subscription overrides — those always require the founder's
// explicit sign-off, per the build's global constraints.
export const BILLING_EVENT_TYPES = [
  "payment_failed",
  "dunning_sent",
  "payment_recovered",
  "cancellation_requested",
  "reconciliation_mismatch",
  "subscription_started",
] as const;
export type BillingEventType = typeof BILLING_EVENT_TYPES[number];

export const billingEvents = pgTable("billing_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(),
  detail: jsonb("detail"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBillingEventSchema = createInsertSchema(billingEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertBillingEvent = z.infer<typeof insertBillingEventSchema>;
export type BillingEvent = typeof billingEvents.$inferSelect;

// ─── Content Repurposing Agent (Agent 05) ────────────────────────────────────
// Turns a transcript into drafted show notes / email nudges / social
// captions. Every draft routes through Jai Quality Supervisor's pre-publish
// gate (server/qualitySupervisor.ts) before it can reach the founder's
// approval queue, and nothing here ever auto-publishes — "approved" just
// means the founder signed off on the copy; there's no real publish target
// wired up in this codebase to push it to.
export const CONTENT_SOURCE_TYPES = ["video_transcript", "rebuild_script"] as const;
export type ContentSourceType = typeof CONTENT_SOURCE_TYPES[number];

export const CONTENT_DRAFT_STATUSES = ["pending_review", "blocked_needs_revision", "approved", "rejected"] as const;
export type ContentDraftStatus = typeof CONTENT_DRAFT_STATUSES[number];

export const contentDrafts = pgTable("content_drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceType: text("source_type").notNull(),
  sourceExcerpt: text("source_excerpt").notNull(),
  showNotes: text("show_notes").notNull(),
  emailNudges: jsonb("email_nudges").notNull().default(sql`'[]'::jsonb`),
  socialCaptions: jsonb("social_captions").notNull().default(sql`'[]'::jsonb`),
  qualityCheckPassed: boolean("quality_check_passed").notNull(),
  qualityCheckDetail: jsonb("quality_check_detail"),
  status: text("status").notNull().default("pending_review"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export const insertContentDraftSchema = createInsertSchema(contentDrafts).omit({
  id: true,
  createdAt: true,
});
export type InsertContentDraft = z.infer<typeof insertContentDraftSchema>;
export type ContentDraft = typeof contentDrafts.$inferSelect;

export const CALENDAR_DRAFT_STATUSES = ["idea", "drafted", "approved"] as const;
export type CalendarDraftStatus = typeof CALENDAR_DRAFT_STATUSES[number];

export const contentCalendarEntries = pgTable("content_calendar_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  notes: text("notes").notNull().default(""),
  plannedDate: text("planned_date"),
  status: text("status").notNull().default("idea"),
  contentDraftId: varchar("content_draft_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertContentCalendarEntrySchema = createInsertSchema(contentCalendarEntries).omit({
  id: true,
  createdAt: true,
});
export type InsertContentCalendarEntry = z.infer<typeof insertContentCalendarEntrySchema>;
export type ContentCalendarEntry = typeof contentCalendarEntries.$inferSelect;

// ─── Retention & Engagement Agent (Agent 06) ─────────────────────────────────
// Streak nudges, "falling behind your own goal" prompts, and win-back
// messaging from approved templates only — never freeform generation, so
// tone stays locked without needing a per-message quality check. Any user
// with a recent Trust & Safety flag is skipped entirely; that's a human
// follow-up, never an engagement nudge.
export const RETENTION_NUDGE_TYPES = ["streak_nudge", "falling_behind", "win_back"] as const;
export type RetentionNudgeType = typeof RETENTION_NUDGE_TYPES[number];

export const RETENTION_SEGMENTS = ["starting", "building", "locked_in", "slipping", "lapsed"] as const;
export type RetentionSegment = typeof RETENTION_SEGMENTS[number];

export const retentionNudges = pgTable("retention_nudges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  nudgeType: text("nudge_type").notNull(),
  segment: text("segment").notNull(),
  messageId: varchar("message_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRetentionNudgeSchema = createInsertSchema(retentionNudges).omit({
  id: true,
  createdAt: true,
});
export type InsertRetentionNudge = z.infer<typeof insertRetentionNudgeSchema>;
export type RetentionNudge = typeof retentionNudges.$inferSelect;

// ─── Analytics & Reporting Agent (Agent 07) ──────────────────────────────────
// Read-only, always. This agent never takes automated action on anything it
// finds — every table and function it touches is for reporting and anomaly
// flagging only.
export const analyticsAnomalies = pgTable("analytics_anomalies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  metric: text("metric").notNull(),
  detail: jsonb("detail"),
  alertSent: boolean("alert_sent").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAnalyticsAnomalySchema = createInsertSchema(analyticsAnomalies).omit({
  id: true,
  createdAt: true,
});
export type InsertAnalyticsAnomaly = z.infer<typeof insertAnalyticsAnomalySchema>;
export type AnalyticsAnomaly = typeof analyticsAnomalies.$inferSelect;

// ─── Curriculum Production Agent (Agent 08) ──────────────────────────────────
// Drafts a talk track, worksheet questions, a slide outline, and a
// voiceover-ready script for a Rebuild module — matching Day 1's real,
// locked structure and pacing. Every draft routes through Jai Quality
// Supervisor's gate, same as Content Repurposing. Nothing here finalizes on
// its own: every module is still recorded on camera by the founder, and
// "approved" only means the script is signed off, never that a video exists.
export const CURRICULUM_DRAFT_STATUSES = ["pending_review", "blocked_needs_revision", "approved", "rejected"] as const;
export type CurriculumDraftStatus = typeof CURRICULUM_DRAFT_STATUSES[number];

export const curriculumDrafts = pgTable("curriculum_drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  forDay: integer("for_day").notNull(),
  heartbeatFocus: text("heartbeat_focus"),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  talkTrack: text("talk_track").notNull(),
  worksheetQuestions: jsonb("worksheet_questions").notNull().default(sql`'[]'::jsonb`),
  slideOutline: jsonb("slide_outline").notNull().default(sql`'[]'::jsonb`),
  voiceoverScript: text("voiceover_script").notNull(),
  qualityCheckPassed: boolean("quality_check_passed").notNull(),
  qualityCheckDetail: jsonb("quality_check_detail"),
  status: text("status").notNull().default("pending_review"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export const insertCurriculumDraftSchema = createInsertSchema(curriculumDrafts).omit({
  id: true,
  createdAt: true,
});
export type InsertCurriculumDraft = z.infer<typeof insertCurriculumDraftSchema>;
export type CurriculumDraft = typeof curriculumDrafts.$inferSelect;
