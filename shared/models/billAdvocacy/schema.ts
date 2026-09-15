import { sql } from "drizzle-orm";
import { pgTable, varchar, text, integer, timestamp, real, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Real, multi-client data model from day one — this is going into
// production, not staying a single-user experiment.
export const billAdvocacyClients = pgTable("bill_advocacy_clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  // TCPA requires prior express consent for SMS. Collected at intake now
  // even though SMS notifications aren't built yet — far easier than
  // retrofitting consent later.
  smsConsentGiven: boolean("sms_consent_given").notNull().default(false),
  smsConsentAt: timestamp("sms_consent_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const billAdvocacyCases = pgTable("bill_advocacy_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => billAdvocacyClients.id, { onDelete: "cascade" }),
  providerName: text("provider_name"),
  insuranceInvolved: boolean("insurance_involved").notNull().default(false),
  // Contingency % agreed for this case (20-35 typical) — set once the
  // authorization document is signed.
  feePercentAgreed: real("fee_percent_agreed"),
  // Placeholder reference to the signed authorization document. The legal
  // text of that document is drafted by an attorney, never generated here —
  // this column only ever holds a pointer (e-signature envelope ID / file ref).
  authorizationDocRef: text("authorization_doc_ref"),
  authorizationSignedAt: timestamp("authorization_signed_at"),
  // Outcome data, logged from day one so case timing and win rate can
  // eventually be forecast from real history.
  disputeAmount: numeric("dispute_amount", { precision: 10, scale: 2 }),
  amountSaved: numeric("amount_saved", { precision: 10, scale: 2 }),
  resolutionType: text("resolution_type"), // "reduction" | "settlement" | "collections"
  submittedAt: timestamp("submitted_at"), // formal dispute (stage 3) sent
  resolvedAt: timestamp("resolved_at"), // stage 6 reached
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// The milestone event log — the foundation everything else (notifications,
// invoicing, the status portal) subscribes to instead of being hardcoded
// into stage-transition logic.
export const billAdvocacyEvents = pgTable("bill_advocacy_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityId: varchar("entity_id").notNull(),
  entityType: text("entity_type").notNull(), // see EntityType in ./types
  stage: integer("stage").notNull(), // CaseStage 0-6
  dollarValue: numeric("dollar_value", { precision: 10, scale: 2 }),
  notes: text("notes"),
  // Required before a stage-6 (resolution) event may fire — see
  // server/billAdvocacy/eventLog.ts. Points at the provider's written
  // adjusted bill/EOB, the proof-of-reduction document.
  proofDocumentRef: text("proof_document_ref"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertBillAdvocacyClientSchema = createInsertSchema(billAdvocacyClients).omit({
  id: true,
  createdAt: true,
});

export const insertBillAdvocacyCaseSchema = createInsertSchema(billAdvocacyCases).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
  amountSaved: true,
  resolutionType: true,
});

export const insertBillAdvocacyEventSchema = createInsertSchema(billAdvocacyEvents).omit({
  id: true,
  createdAt: true,
});

export type BillAdvocacyClient = typeof billAdvocacyClients.$inferSelect;
export type InsertBillAdvocacyClient = z.infer<typeof insertBillAdvocacyClientSchema>;
export type BillAdvocacyCase = typeof billAdvocacyCases.$inferSelect;
export type InsertBillAdvocacyCase = z.infer<typeof insertBillAdvocacyCaseSchema>;
export type BillAdvocacyEvent = typeof billAdvocacyEvents.$inferSelect;
export type InsertBillAdvocacyEvent = z.infer<typeof insertBillAdvocacyEventSchema>;
