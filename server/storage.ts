import {
  type User, type InsertUser, users,
  type Message, type InsertMessage, messages,
  type Entry, type InsertEntry, entries,
  type Assessment, type InsertAssessment, assessments,
  type Goal, type InsertGoal, goals,
  type WeeklyReview, type InsertWeeklyReview, weeklyReviews,
  type PhotoMemory, type InsertPhotoMemory, photoMemories,
  type Commitment, type InsertCommitment, commitments,
  type GroundingJournalEntry, groundingJournalEntries,
  type RebuildInstance, rebuildInstances,
  type SafetyEvent, type InsertSafetyEvent, safetyEvents,
  type StyleGuideVersion, styleGuideVersions,
  type QualityCheck, type InsertQualityCheck, qualityChecks,
  type SupportInquiry, type InsertSupportInquiry, supportInquiries,
  type BillingEvent, type InsertBillingEvent, billingEvents,
  type ContentDraft, type InsertContentDraft, contentDrafts,
  type ContentCalendarEntry, type InsertContentCalendarEntry, contentCalendarEntries,
  type RetentionNudge, type InsertRetentionNudge, retentionNudges,
  type AnalyticsAnomaly, type InsertAnalyticsAnomaly, analyticsAnomalies,
  passwordResetTokens, authEvents,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc, asc, and, gte, inArray } from "drizzle-orm";
import pg from "pg";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;

  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  getPasswordResetToken(token: string): Promise<{ userId: string; expiresAt: Date; usedAt: Date | null } | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<void>;

  logAuthEvent(userId: string | null, event: string, provider?: string, metadata?: Record<string, any>): Promise<void>;

  getMessages(userId: string): Promise<Message[]>;
  createMessage(msg: InsertMessage): Promise<Message>;
  updateMessage(id: string, data: Partial<InsertMessage>): Promise<Message | undefined>;

  getEntries(userId: string): Promise<Entry[]>;
  getEntriesByGoalId(goalId: string): Promise<Entry[]>;
  createEntry(entry: InsertEntry): Promise<Entry>;
  updateEntry(id: string, data: Partial<InsertEntry>): Promise<Entry | undefined>;

  getActiveGoals(userId: string): Promise<Goal[]>;
  getAllGoals(userId: string): Promise<Goal[]>;
  getGoal(id: string): Promise<Goal | undefined>;
  createGoal(data: InsertGoal): Promise<Goal>;
  updateGoal(id: string, data: Partial<InsertGoal>): Promise<Goal | undefined>;

  getLatestAssessment(userId: string): Promise<Assessment | undefined>;
  createAssessment(data: InsertAssessment): Promise<Assessment>;

  getWeeklyReviewStatus(userId: string): Promise<{ pending: boolean; review?: WeeklyReview; daysSinceCycleStart?: number }>;
  getPendingWeeklyReview(userId: string): Promise<WeeklyReview | undefined>;
  getLatestCompletedReview(userId: string): Promise<WeeklyReview | undefined>;
  createWeeklyReview(data: InsertWeeklyReview): Promise<WeeklyReview>;
  completeWeeklyReview(id: string): Promise<WeeklyReview | undefined>;
  getMessagesSince(userId: string, since: Date): Promise<Message[]>;

  createPhotoMemory(data: InsertPhotoMemory): Promise<PhotoMemory>;
  updatePhotoMemory(id: string, data: Partial<InsertPhotoMemory>): Promise<PhotoMemory | undefined>;
  getPhotoMemories(userId: string): Promise<PhotoMemory[]>;
  getPhotoMemoriesByDate(userId: string, dateKey: string): Promise<PhotoMemory[]>;
  getPhotoMemoryByUrl(userId: string, photoUrl: string): Promise<PhotoMemory | undefined>;
  getMessageById(id: string): Promise<Message | undefined>;

  createCommitment(data: InsertCommitment): Promise<Commitment>;
  getPendingCommitments(userId: string): Promise<Commitment[]>;
  resolveCommitment(id: string, status: "completed" | "missed"): Promise<Commitment | undefined>;
  getRecentCommitments(userId: string, limit?: number): Promise<Commitment[]>;

  getGroundingJournalEntries(userId: string): Promise<GroundingJournalEntry[]>;
  createGroundingJournalEntry(data: Omit<GroundingJournalEntry, "id" | "createdAt">): Promise<GroundingJournalEntry>;
  updateGroundingJournalEntry(id: string, data: Partial<GroundingJournalEntry>): Promise<GroundingJournalEntry | undefined>;

  createSafetyEvent(data: InsertSafetyEvent): Promise<SafetyEvent>;
  updateSafetyEvent(id: string, data: Partial<SafetyEvent>): Promise<SafetyEvent | undefined>;
  getRecentSafetyEvents(userId: string, since: Date): Promise<SafetyEvent[]>;
  getAllSafetyEvents(limit?: number): Promise<SafetyEvent[]>;

  createStyleGuideDraft(content: string): Promise<StyleGuideVersion>;
  getAnyStyleGuide(): Promise<StyleGuideVersion | undefined>;
  getApprovedStyleGuide(): Promise<StyleGuideVersion | undefined>;
  getLatestStyleGuideDraft(): Promise<StyleGuideVersion | undefined>;
  approveStyleGuide(id: string): Promise<StyleGuideVersion | undefined>;

  createQualityCheck(data: InsertQualityCheck): Promise<QualityCheck>;
  getSampledMessageIds(source: string, candidateIds: string[]): Promise<Set<string>>;
  getRecentJaeMessages(limit: number): Promise<Message[]>;
  getOpenQualityFlags(limit?: number): Promise<QualityCheck[]>;

  createSupportInquiry(data: InsertSupportInquiry): Promise<SupportInquiry>;
  getSupportInquiriesSince(since: Date): Promise<SupportInquiry[]>;

  createBillingEvent(data: InsertBillingEvent): Promise<BillingEvent>;
  getBillingEventsSince(since: Date): Promise<BillingEvent[]>;
  getRecentBillingEventsForUser(userId: string, type: string, since: Date): Promise<BillingEvent[]>;
  getUsersBySubscriptionStates(states: string[]): Promise<User[]>;

  createContentDraft(data: InsertContentDraft): Promise<ContentDraft>;
  getContentDraft(id: string): Promise<ContentDraft | undefined>;
  getContentDrafts(status?: string): Promise<ContentDraft[]>;
  updateContentDraft(id: string, data: Partial<ContentDraft>): Promise<ContentDraft | undefined>;

  createCalendarEntry(data: InsertContentCalendarEntry): Promise<ContentCalendarEntry>;
  getCalendarEntries(): Promise<ContentCalendarEntry[]>;
  updateCalendarEntry(id: string, data: Partial<ContentCalendarEntry>): Promise<ContentCalendarEntry | undefined>;

  getAllUsers(limit?: number): Promise<User[]>;
  createRetentionNudge(data: InsertRetentionNudge): Promise<RetentionNudge>;
  getLastRetentionNudge(userId: string): Promise<RetentionNudge | undefined>;
  getRetentionNudgesSince(since: Date): Promise<RetentionNudge[]>;

  createAnalyticsAnomaly(data: InsertAnalyticsAnomaly): Promise<AnalyticsAnomaly>;
  updateAnalyticsAnomaly(id: string, data: Partial<AnalyticsAnomaly>): Promise<AnalyticsAnomaly | undefined>;
  getAnalyticsAnomaliesSince(since: Date): Promise<AnalyticsAnomaly[]>;
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user;
  }

  async getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, stripeCustomerId));
    return user;
  }

  async createUser(data: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await db.insert(passwordResetTokens).values({ userId, token, expiresAt });
  }

  async getPasswordResetToken(token: string): Promise<{ userId: string; expiresAt: Date; usedAt: Date | null } | undefined> {
    const [row] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    if (!row) return undefined;
    return { userId: row.userId, expiresAt: row.expiresAt, usedAt: row.usedAt };
  }

  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.token, token));
  }

  async logAuthEvent(userId: string | null, event: string, provider?: string, metadata?: Record<string, any>): Promise<void> {
    await db.insert(authEvents).values({ userId, event, provider, metadata }).catch(() => {});
  }


  async getMessages(userId: string): Promise<Message[]> {
    return db.select().from(messages).where(eq(messages.userId, userId)).orderBy(asc(messages.createdAt));
  }

  async createMessage(msg: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(msg).returning();
    return message;
  }

  async updateMessage(id: string, data: Partial<InsertMessage>): Promise<Message | undefined> {
    const [message] = await db.update(messages).set(data).where(eq(messages.id, id)).returning();
    return message;
  }

  async getEntries(userId: string): Promise<Entry[]> {
    return db.select().from(entries).where(eq(entries.userId, userId)).orderBy(desc(entries.createdAt));
  }

  async getEntriesByGoalId(goalId: string): Promise<Entry[]> {
    return db.select().from(entries).where(eq(entries.goalId, goalId)).orderBy(desc(entries.createdAt));
  }

  async createEntry(entry: InsertEntry): Promise<Entry> {
    const [e] = await db.insert(entries).values(entry).returning();
    return e;
  }

  async updateEntry(id: string, data: Partial<InsertEntry>): Promise<Entry | undefined> {
    const [e] = await db.update(entries).set(data).where(eq(entries.id, id)).returning();
    return e;
  }

  async getActiveGoals(userId: string): Promise<Goal[]> {
    return db.select().from(goals).where(and(eq(goals.userId, userId), eq(goals.status, "active"))).orderBy(desc(goals.createdAt));
  }

  async getAllGoals(userId: string): Promise<Goal[]> {
    return db.select().from(goals).where(eq(goals.userId, userId)).orderBy(desc(goals.createdAt));
  }

  async getGoal(id: string): Promise<Goal | undefined> {
    const [g] = await db.select().from(goals).where(eq(goals.id, id));
    return g;
  }

  async createGoal(data: InsertGoal): Promise<Goal> {
    const [g] = await db.insert(goals).values(data).returning();
    return g;
  }

  async updateGoal(id: string, data: Partial<InsertGoal>): Promise<Goal | undefined> {
    const [g] = await db.update(goals).set(data).where(eq(goals.id, id)).returning();
    return g;
  }

  async getLatestAssessment(userId: string): Promise<Assessment | undefined> {
    const [assessment] = await db.select().from(assessments).where(eq(assessments.userId, userId)).orderBy(desc(assessments.createdAt)).limit(1);
    return assessment;
  }

  async createAssessment(data: InsertAssessment): Promise<Assessment> {
    const [assessment] = await db.insert(assessments).values(data).returning();
    return assessment;
  }

  async getWeeklyReviewStatus(userId: string): Promise<{ pending: boolean; review?: WeeklyReview; daysSinceCycleStart?: number }> {
    const user = await this.getUser(userId);
    if (!user) return { pending: false };

    const existingPending = await this.getPendingWeeklyReview(userId);
    if (existingPending) {
      return { pending: true, review: existingPending };
    }

    const cycleStart = user.weeklyCycleStart;
    if (!cycleStart) return { pending: false };

    const now = new Date();
    const diffMs = now.getTime() - new Date(cycleStart).getTime();
    const daysSince = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return { pending: daysSince >= 7, daysSinceCycleStart: daysSince };
  }

  async getPendingWeeklyReview(userId: string): Promise<WeeklyReview | undefined> {
    const [review] = await db.select().from(weeklyReviews)
      .where(and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.status, "pending")))
      .orderBy(desc(weeklyReviews.createdAt))
      .limit(1);
    return review;
  }

  async getLatestCompletedReview(userId: string): Promise<WeeklyReview | undefined> {
    const [review] = await db.select().from(weeklyReviews)
      .where(and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.status, "completed")))
      .orderBy(desc(weeklyReviews.createdAt))
      .limit(1);
    return review;
  }

  async createWeeklyReview(data: InsertWeeklyReview): Promise<WeeklyReview> {
    const [review] = await db.insert(weeklyReviews).values(data).returning();
    return review;
  }

  async completeWeeklyReview(id: string): Promise<WeeklyReview | undefined> {
    const [review] = await db.update(weeklyReviews)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(weeklyReviews.id, id))
      .returning();
    return review;
  }

  async getMessagesSince(userId: string, since: Date): Promise<Message[]> {
    return db.select().from(messages)
      .where(and(eq(messages.userId, userId), gte(messages.createdAt, since)))
      .orderBy(asc(messages.createdAt));
  }

  async createPhotoMemory(data: InsertPhotoMemory): Promise<PhotoMemory> {
    const [pm] = await db.insert(photoMemories).values(data).returning();
    return pm;
  }

  async updatePhotoMemory(id: string, data: Partial<InsertPhotoMemory>): Promise<PhotoMemory | undefined> {
    const [pm] = await db.update(photoMemories).set(data).where(eq(photoMemories.id, id)).returning();
    return pm;
  }

  async getPhotoMemories(userId: string): Promise<PhotoMemory[]> {
    return db.select().from(photoMemories).where(eq(photoMemories.userId, userId)).orderBy(desc(photoMemories.createdAt));
  }

  async getPhotoMemoriesByDate(userId: string, dateKey: string): Promise<PhotoMemory[]> {
    return db.select().from(photoMemories)
      .where(and(eq(photoMemories.userId, userId), eq(photoMemories.dateKey, dateKey)))
      .orderBy(desc(photoMemories.createdAt));
  }

  async getPhotoMemoryByUrl(userId: string, photoUrl: string): Promise<PhotoMemory | undefined> {
    const [pm] = await db.select().from(photoMemories)
      .where(and(eq(photoMemories.userId, userId), eq(photoMemories.photoUrl, photoUrl)))
      .limit(1);
    return pm;
  }

  async getMessageById(id: string): Promise<Message | undefined> {
    const [msg] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
    return msg;
  }

  async createCommitment(data: InsertCommitment): Promise<Commitment> {
    const [c] = await db.insert(commitments).values(data).returning();
    return c;
  }

  async getPendingCommitments(userId: string): Promise<Commitment[]> {
    return db.select().from(commitments)
      .where(and(eq(commitments.userId, userId), eq(commitments.status, "pending")))
      .orderBy(desc(commitments.createdAt));
  }

  async resolveCommitment(id: string, status: "completed" | "missed"): Promise<Commitment | undefined> {
    const [c] = await db.update(commitments)
      .set({ status, resolvedAt: new Date() })
      .where(eq(commitments.id, id))
      .returning();
    return c;
  }

  async getRecentCommitments(userId: string, limit = 10): Promise<Commitment[]> {
    return db.select().from(commitments)
      .where(eq(commitments.userId, userId))
      .orderBy(desc(commitments.createdAt))
      .limit(limit);
  }

  async getGroundingJournalEntries(userId: string): Promise<GroundingJournalEntry[]> {
    return db.select().from(groundingJournalEntries)
      .where(eq(groundingJournalEntries.userId, userId))
      .orderBy(asc(groundingJournalEntries.createdAt));
  }

  async createGroundingJournalEntry(data: Omit<GroundingJournalEntry, "id" | "createdAt">): Promise<GroundingJournalEntry> {
    const [entry] = await db.insert(groundingJournalEntries).values(data as any).returning();
    return entry;
  }

  async updateGroundingJournalEntry(id: string, data: Partial<GroundingJournalEntry>): Promise<GroundingJournalEntry | undefined> {
    const [entry] = await db.update(groundingJournalEntries).set(data as any).where(eq(groundingJournalEntries.id, id)).returning();
    return entry;
  }

  // ─── 7-Day Rebuild ───────────────────────────────────────────────────────────

  async getRebuildInstances(userId: string): Promise<RebuildInstance[]> {
    return db.select().from(rebuildInstances)
      .where(eq(rebuildInstances.userId, userId))
      .orderBy(asc(rebuildInstances.instanceNumber));
  }

  async getRebuildInstance(userId: string, instanceNumber: number): Promise<RebuildInstance | undefined> {
    const [row] = await db.select().from(rebuildInstances)
      .where(and(eq(rebuildInstances.userId, userId), eq(rebuildInstances.instanceNumber, instanceNumber)));
    return row;
  }

  async initRebuildInstances(userId: string, totalInstances: number): Promise<RebuildInstance[]> {
    const existing = await this.getRebuildInstances(userId);
    if (existing.length > 0) return existing;
    const rows = Array.from({ length: totalInstances }, (_, i) => ({
      userId,
      instanceNumber: i + 1,
      status: i === 0 ? "unlocked" : "locked",
    }));
    const created = await db.insert(rebuildInstances).values(rows as any).returning();
    return created.sort((a, b) => a.instanceNumber - b.instanceNumber);
  }

  async updateRebuildInstance(userId: string, instanceNumber: number, data: Partial<RebuildInstance>): Promise<RebuildInstance | undefined> {
    const [row] = await db.update(rebuildInstances)
      .set({ ...data as any, lastActivityAt: new Date() })
      .where(and(eq(rebuildInstances.userId, userId), eq(rebuildInstances.instanceNumber, instanceNumber)))
      .returning();
    return row;
  }

  // ─── Trust & Safety (Agent 01) ─────────────────────────────────────────────

  async createSafetyEvent(data: InsertSafetyEvent): Promise<SafetyEvent> {
    const [event] = await db.insert(safetyEvents).values(data).returning();
    return event;
  }

  async updateSafetyEvent(id: string, data: Partial<SafetyEvent>): Promise<SafetyEvent | undefined> {
    const [event] = await db.update(safetyEvents).set(data).where(eq(safetyEvents.id, id)).returning();
    return event;
  }

  async getRecentSafetyEvents(userId: string, since: Date): Promise<SafetyEvent[]> {
    return db.select().from(safetyEvents)
      .where(and(eq(safetyEvents.userId, userId), gte(safetyEvents.createdAt, since)))
      .orderBy(desc(safetyEvents.createdAt));
  }

  async getAllSafetyEvents(limit = 200): Promise<SafetyEvent[]> {
    return db.select().from(safetyEvents).orderBy(desc(safetyEvents.createdAt)).limit(limit);
  }

  // ─── Jai Quality Supervisor (Agent 02) ─────────────────────────────────────

  async createStyleGuideDraft(content: string): Promise<StyleGuideVersion> {
    const [row] = await db.insert(styleGuideVersions).values({ content, status: "draft" }).returning();
    return row;
  }

  async getAnyStyleGuide(): Promise<StyleGuideVersion | undefined> {
    const [row] = await db.select().from(styleGuideVersions).orderBy(desc(styleGuideVersions.createdAt)).limit(1);
    return row;
  }

  async getApprovedStyleGuide(): Promise<StyleGuideVersion | undefined> {
    const [row] = await db.select().from(styleGuideVersions)
      .where(eq(styleGuideVersions.status, "approved"))
      .orderBy(desc(styleGuideVersions.approvedAt))
      .limit(1);
    return row;
  }

  async getLatestStyleGuideDraft(): Promise<StyleGuideVersion | undefined> {
    const [row] = await db.select().from(styleGuideVersions)
      .where(eq(styleGuideVersions.status, "draft"))
      .orderBy(desc(styleGuideVersions.createdAt))
      .limit(1);
    return row;
  }

  async approveStyleGuide(id: string): Promise<StyleGuideVersion | undefined> {
    await db.update(styleGuideVersions).set({ status: "superseded" }).where(eq(styleGuideVersions.status, "approved"));
    const [row] = await db.update(styleGuideVersions)
      .set({ status: "approved", approvedAt: new Date() })
      .where(eq(styleGuideVersions.id, id))
      .returning();
    return row;
  }

  async createQualityCheck(data: InsertQualityCheck): Promise<QualityCheck> {
    const [row] = await db.insert(qualityChecks).values(data).returning();
    return row;
  }

  async getSampledMessageIds(source: string, candidateIds: string[]): Promise<Set<string>> {
    if (candidateIds.length === 0) return new Set();
    const rows = await db.select({ sourceRef: qualityChecks.sourceRef }).from(qualityChecks)
      .where(and(eq(qualityChecks.source, source), inArray(qualityChecks.sourceRef, candidateIds)));
    return new Set(rows.map((r) => r.sourceRef).filter((id): id is string => !!id));
  }

  async getRecentJaeMessages(limit: number): Promise<Message[]> {
    return db.select().from(messages).where(eq(messages.sender, "jae")).orderBy(desc(messages.createdAt)).limit(limit);
  }

  async getOpenQualityFlags(limit = 100): Promise<QualityCheck[]> {
    return db.select().from(qualityChecks).where(eq(qualityChecks.passed, false)).orderBy(desc(qualityChecks.createdAt)).limit(limit);
  }

  // ─── Support & Onboarding (Agent 03) ───────────────────────────────────────

  async createSupportInquiry(data: InsertSupportInquiry): Promise<SupportInquiry> {
    const [row] = await db.insert(supportInquiries).values(data).returning();
    return row;
  }

  async getSupportInquiriesSince(since: Date): Promise<SupportInquiry[]> {
    return db.select().from(supportInquiries).where(gte(supportInquiries.createdAt, since)).orderBy(desc(supportInquiries.createdAt));
  }

  // ─── Billing & Subscription (Agent 04) ─────────────────────────────────────

  async createBillingEvent(data: InsertBillingEvent): Promise<BillingEvent> {
    const [row] = await db.insert(billingEvents).values(data).returning();
    return row;
  }

  async getBillingEventsSince(since: Date): Promise<BillingEvent[]> {
    return db.select().from(billingEvents).where(gte(billingEvents.createdAt, since)).orderBy(desc(billingEvents.createdAt));
  }

  async getRecentBillingEventsForUser(userId: string, type: string, since: Date): Promise<BillingEvent[]> {
    return db.select().from(billingEvents)
      .where(and(eq(billingEvents.userId, userId), eq(billingEvents.type, type), gte(billingEvents.createdAt, since)))
      .orderBy(desc(billingEvents.createdAt));
  }

  async getUsersBySubscriptionStates(states: string[]): Promise<User[]> {
    if (states.length === 0) return [];
    return db.select().from(users).where(inArray(users.subscriptionState, states));
  }

  // ─── Content Repurposing (Agent 05) ────────────────────────────────────────

  async createContentDraft(data: InsertContentDraft): Promise<ContentDraft> {
    const [row] = await db.insert(contentDrafts).values(data).returning();
    return row;
  }

  async getContentDraft(id: string): Promise<ContentDraft | undefined> {
    const [row] = await db.select().from(contentDrafts).where(eq(contentDrafts.id, id));
    return row;
  }

  async getContentDrafts(status?: string): Promise<ContentDraft[]> {
    if (status) {
      return db.select().from(contentDrafts).where(eq(contentDrafts.status, status)).orderBy(desc(contentDrafts.createdAt));
    }
    return db.select().from(contentDrafts).orderBy(desc(contentDrafts.createdAt));
  }

  async updateContentDraft(id: string, data: Partial<ContentDraft>): Promise<ContentDraft | undefined> {
    const [row] = await db.update(contentDrafts).set(data).where(eq(contentDrafts.id, id)).returning();
    return row;
  }

  async createCalendarEntry(data: InsertContentCalendarEntry): Promise<ContentCalendarEntry> {
    const [row] = await db.insert(contentCalendarEntries).values(data).returning();
    return row;
  }

  async getCalendarEntries(): Promise<ContentCalendarEntry[]> {
    return db.select().from(contentCalendarEntries).orderBy(desc(contentCalendarEntries.createdAt));
  }

  async updateCalendarEntry(id: string, data: Partial<ContentCalendarEntry>): Promise<ContentCalendarEntry | undefined> {
    const [row] = await db.update(contentCalendarEntries).set(data).where(eq(contentCalendarEntries.id, id)).returning();
    return row;
  }

  // ─── Retention & Engagement (Agent 06) ─────────────────────────────────────

  async getAllUsers(limit = 1000): Promise<User[]> {
    return db.select().from(users).limit(limit);
  }

  async createRetentionNudge(data: InsertRetentionNudge): Promise<RetentionNudge> {
    const [row] = await db.insert(retentionNudges).values(data).returning();
    return row;
  }

  async getLastRetentionNudge(userId: string): Promise<RetentionNudge | undefined> {
    const [row] = await db.select().from(retentionNudges)
      .where(eq(retentionNudges.userId, userId))
      .orderBy(desc(retentionNudges.createdAt))
      .limit(1);
    return row;
  }

  async getRetentionNudgesSince(since: Date): Promise<RetentionNudge[]> {
    return db.select().from(retentionNudges).where(gte(retentionNudges.createdAt, since)).orderBy(desc(retentionNudges.createdAt));
  }

  // ─── Analytics & Reporting (Agent 07) ──────────────────────────────────────

  async createAnalyticsAnomaly(data: InsertAnalyticsAnomaly): Promise<AnalyticsAnomaly> {
    const [row] = await db.insert(analyticsAnomalies).values(data).returning();
    return row;
  }

  async updateAnalyticsAnomaly(id: string, data: Partial<AnalyticsAnomaly>): Promise<AnalyticsAnomaly | undefined> {
    const [row] = await db.update(analyticsAnomalies).set(data).where(eq(analyticsAnomalies.id, id)).returning();
    return row;
  }

  async getAnalyticsAnomaliesSince(since: Date): Promise<AnalyticsAnomaly[]> {
    return db.select().from(analyticsAnomalies).where(gte(analyticsAnomalies.createdAt, since)).orderBy(desc(analyticsAnomalies.createdAt));
  }
}

export const storage = new DatabaseStorage();
