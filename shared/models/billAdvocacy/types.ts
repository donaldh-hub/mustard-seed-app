// The 7-stage case model. A case can be in more than one stage at once
// (stage 4, insurance appeal, runs parallel to stages 2/3/5) — this list is
// the set of possible milestones, not a linear chain.
export const CASE_STAGES = [
  { value: 0, key: "intake_authorization", label: "Intake & Authorization", customerFacing: false },
  { value: 1, key: "initial_bill_review", label: "Initial Bill Review", customerFacing: false },
  { value: 2, key: "informal_resolution", label: "Informal Resolution", customerFacing: false },
  { value: 3, key: "formal_written_dispute", label: "Formal Written Dispute Submitted", customerFacing: true },
  { value: 4, key: "insurance_appeal", label: "Insurance Appeal", customerFacing: true },
  { value: 5, key: "external_review_escalation", label: "External Review / Escalation", customerFacing: true },
  { value: 6, key: "resolution", label: "Resolution", customerFacing: true },
] as const;

export type CaseStage = (typeof CASE_STAGES)[number]["value"];

export const CUSTOMER_FACING_STAGES = new Set<number>(
  CASE_STAGES.filter((s) => s.customerFacing).map((s) => s.value),
);

export function getStageLabel(stage: number): string {
  return CASE_STAGES.find((s) => s.value === stage)?.label ?? `Unknown stage (${stage})`;
}

// The event log is entity-agnostic on purpose — "case" is the only type
// logged today, but bills, appeals, and letters can log their own events
// later without a schema change.
export const ENTITY_TYPES = ["case", "client", "bill", "insurance_appeal", "dispute_letter"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const RESOLUTION_TYPES = ["reduction", "settlement", "collections"] as const;
export type ResolutionType = (typeof RESOLUTION_TYPES)[number];
