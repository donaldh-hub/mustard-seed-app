import { onBillAdvocacyEvent, isCustomerFacingStage } from "../eventLog";
import { getStageLabel } from "@shared/models/billAdvocacy/types";
import { PRODUCT_NAME } from "@shared/models/billAdvocacy/config";

// Milestone notifications — email only (step 5 of the build order wires up
// a real sender). Only customer-facing stages notify; internal stages
// (intake, initial review, informal contact) stay silent. Stage 6 can only
// ever reach here with proofDocumentRef already set, since eventLog.ts
// refuses to record it otherwise — so this never fires speculatively.
onBillAdvocacyEvent(async (event) => {
  if (!isCustomerFacingStage(event.stage)) return;

  // TODO(build step 5): send a real email via the notification layer.
  // Until then, this proves the subscription wiring works end to end.
  console.log(
    `[BILL_ADVOCACY][NOTIFY] Would email client re: case ${event.entityId} — ` +
      `"${getStageLabel(event.stage)}" (${PRODUCT_NAME})`,
  );
});
