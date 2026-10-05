import { PRICING, formatUsd } from "@shared/pricing";
import { describePriceMismatch } from "./stripeShapes";

// Startup check: the app shows the Rebuild price from shared/pricing.ts, but
// Stripe charges whatever STRIPE_PRICE_ID_REBUILD_PROGRAM points to. Warn when
// they disagree. Never throws and never blocks startup.
export async function checkRebuildPriceConfig(): Promise<void> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID_REBUILD_PROGRAM;
  if (!stripeKey || !priceId) return;

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-04-30.basil" } as any);
    const price = await stripe.prices.retrieve(priceId);
    const mismatch = describePriceMismatch(PRICING.rebuildProgramCents, price);
    if (mismatch) {
      console.warn(
        `[CONFIG_WARNING] Rebuild price mismatch for STRIPE_PRICE_ID_REBUILD_PROGRAM=${priceId}: ${mismatch}. ` +
        `The app shows ${formatUsd(PRICING.rebuildProgramCents)}. Re-run scripts/seed-stripe-products.ts and update the secret.`
      );
    } else {
      console.log(`[STRIPE] Rebuild price check OK: ${priceId} = ${formatUsd(PRICING.rebuildProgramCents)}`);
    }
  } catch (err: any) {
    console.warn(`[CONFIG_WARNING] Could not verify STRIPE_PRICE_ID_REBUILD_PROGRAM=${priceId}: ${err?.message || err}`);
  }
}
