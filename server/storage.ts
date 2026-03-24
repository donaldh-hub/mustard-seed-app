import { 
  type User, type InsertUser, users,
  type Message, type InsertMessage, messages,
  type Entry, type InsertEntry, entries,
  type Assessment, type InsertAssessment, assessments,
  type Goal, type InsertGoal, goals,
  type WeeklyReview, type InsertWeeklyReview, weeklyReviews,
  type PhotoMemory, type InsertPhotoMemory, photoMemories,
  type Commitment, type InsertCommitment, commitments
} from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc, asc, and, gte } from "drizzle-orm";
import pg from "pg";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;

  getMessages(userId: string): Promise<Message[]>;
  createMessage(msg: InsertMessage): Promise<Message>;
  updateMessage(id: string, data: Partial<InsertMessage>): Promise<Message | undefined>;

  getEntries(userId: string): Promise<Entry[]>;
  getEntriesByGoalId(goalId: string): Promise<Entry[]>;
  createEntry(entry: InsertEntry): Promise<Entry>;

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
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
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
}

export const storage = new DatabaseStorage();
