import { 
  type User, type InsertUser, users,
  type Message, type InsertMessage, messages,
  type Entry, type InsertEntry, entries,
  type Assessment, type InsertAssessment, assessments
} from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc, asc } from "drizzle-orm";
import pg from "pg";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;

  getMessages(userId: string): Promise<Message[]>;
  createMessage(msg: InsertMessage): Promise<Message>;

  getEntries(userId: string): Promise<Entry[]>;
  createEntry(entry: InsertEntry): Promise<Entry>;

  getLatestAssessment(userId: string): Promise<Assessment | undefined>;
  createAssessment(data: InsertAssessment): Promise<Assessment>;
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

  async getEntries(userId: string): Promise<Entry[]> {
    return db.select().from(entries).where(eq(entries.userId, userId)).orderBy(desc(entries.createdAt));
  }

  async createEntry(entry: InsertEntry): Promise<Entry> {
    const [e] = await db.insert(entries).values(entry).returning();
    return e;
  }

  async getLatestAssessment(userId: string): Promise<Assessment | undefined> {
    const [assessment] = await db.select().from(assessments).where(eq(assessments.userId, userId)).orderBy(desc(assessments.createdAt)).limit(1);
    return assessment;
  }

  async createAssessment(data: InsertAssessment): Promise<Assessment> {
    const [assessment] = await db.insert(assessments).values(data).returning();
    return assessment;
  }
}

export const storage = new DatabaseStorage();
