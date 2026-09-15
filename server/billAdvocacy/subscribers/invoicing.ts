import { onBillAdvocacyEvent } from "../eventLog";

// Fires only on stage 6 (resolution) — triggered by confirmed savings, never
// by the client receiving a refund. eventLog.ts already refuses to record
// stage 6 without proofDocumentRef, so by the time this runs the reduction
// is confirmed, not speculative.
onBillAdvocacyEvent(async (event) => {
  if (event.stage !== 6) return;

  // TODO: once billAdvocacyCases.feePercentAgreed is read here alongside
  // amountSaved, compute the contingency fee and write a real internal
  // invoice draft. For now this proves the same stage-6 event independently
  // triggers both a customer notification and an internal invoice signal.
  console.log(
    `[BILL_ADVOCACY][INVOICE] Would draft internal invoice for case ${event.entityId} ` +
      `(confirmed savings: ${event.dollarValue ?? "unspecified"})`,
  );
});
