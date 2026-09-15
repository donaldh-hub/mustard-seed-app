import { and, asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "../storage";
import {
  billAdvocacyEvents,
  type BillAdvocacyEvent,
} from "@shared/models/billAdvocacy/schema";
import { CUSTOMER_FACING_STAGES } from "@shared/models/billAdvocacy/types";

// Reuses the app's shared connection pool rather than opening a second one.
const db = drizzle(pool);

export type BillAdvocacySubscriber = (event: BillAdvocacyEvent) => void | Promise<void>;

const subscribers: BillAdvocacySubscriber[] = [];

// Subscribe to every recorded event. A subscriber decides for itself whether
// an event is relevant (e.g. filtering by stage) — the log itself doesn't
// know what a notification or an invoice is.
export function onBillAdvocacyEvent(fn: BillAdvocacySubscriber): void {
  subscribers.push(fn);
}

export interface RecordStageEventInput {
  entityId: string;
  entityType: string;
  stage: number;
  dollarValue?: number | string;
  notes?: string;
  proofDocumentRef?: string;
  // Set true for stages that can legitimately happen more than once for the
  // same entity (e.g. successive insurance-appeal status changes).
  allowRepeat?: boolean;
}

// A stage transition fires once by default: if this exact (entity, stage)
// pair already has an event, the existing one is returned instead of writing
// a duplicate row or re-notifying subscribers.
export async function recordStageEvent(input: RecordStageEventInput): Promise<BillAdvocacyEvent> {
  if (input.stage === 6 && !input.proofDocumentRef) {
    throw new Error(
      "Stage 6 (resolution) requires proofDocumentRef — never log a reduction as confirmed " +
        "without the provider's written adjusted bill/EOB in hand.",
    );
  }

  if (!input.allowRepeat) {
    const [existing] = await db
      .select()
      .from(billAdvocacyEvents)
      .where(
        and(
          eq(billAdvocacyEvents.entityId, input.entityId),
          eq(billAdvocacyEvents.entityType, input.entityType),
          eq(billAdvocacyEvents.stage, input.stage),
        ),
      )
      .limit(1);
    if (existing) return existing;
  }

  const [event] = await db
    .insert(billAdvocacyEvents)
    .values({
      entityId: input.entityId,
      entityType: input.entityType,
      stage: input.stage,
      dollarValue: input.dollarValue !== undefined ? String(input.dollarValue) : undefined,
      notes: input.notes,
      proofDocumentRef: input.proofDocumentRef,
    })
    .returning();

  for (const subscriber of subscribers) {
    try {
      await subscriber(event);
    } catch (err) {
      console.error("[BILL_ADVOCACY] event subscriber failed:", err);
    }
  }

  return event;
}

export async function getEntityTimeline(entityId: string, entityType: string): Promise<BillAdvocacyEvent[]> {
  return db
    .select()
    .from(billAdvocacyEvents)
    .where(and(eq(billAdvocacyEvents.entityId, entityId), eq(billAdvocacyEvents.entityType, entityType)))
    .orderBy(asc(billAdvocacyEvents.createdAt));
}

export function isCustomerFacingStage(stage: number): boolean {
  return CUSTOMER_FACING_STAGES.has(stage);
}
