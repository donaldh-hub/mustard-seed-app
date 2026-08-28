import { storage } from "./storage";
import type { ABTest, ABTestVariant, ABTestPage } from "@shared/schema";

// ─── Funnel Optimization Agent (Agent 09) ────────────────────────────────────
// Proposes A/B tests on assessment/journal/subscription-page copy, checks
// results for real statistical significance before declaring a winner, and
// retires losing copy once a test concludes with one. HARD CONSTRAINT: no
// test can record traffic until the founder approves it by ID —
// recordImpression/recordConversion below refuse to write for any test that
// isn't in "approved" status, enforced in code, not just by convention.
//
// This agent is genuinely premature for Mustard Seed today — there's no
// meaningful traffic yet, per the job description's own "needs from you
// before build." It's built and correct, with nothing live to run against
// until Tier 1 is proven out.

const MIN_SAMPLE_PER_VARIANT = 100;
const SIGNIFICANCE_ALPHA = 0.05;

export async function proposeTest(
  name: string,
  page: ABTestPage,
  variants: { name: string; copy: string }[]
): Promise<{ test: ABTest; variants: ABTestVariant[] }> {
  if (variants.length < 2) {
    throw new Error("A test needs at least a control and one variant.");
  }
  const test = await storage.createABTest({ name, page, status: "proposed", winnerVariantId: null });
  const createdVariants: ABTestVariant[] = [];
  for (let i = 0; i < variants.length; i++) {
    const v = await storage.createABTestVariant({
      testId: test.id,
      name: variants[i].name,
      copy: variants[i].copy,
      isControl: i === 0,
      impressions: 0,
      conversions: 0,
      retired: false,
    });
    createdVariants.push(v);
  }
  return { test, variants: createdVariants };
}

/**
 * approveTest — the founder's explicit sign-off on THIS SPECIFIC test by
 * ID. This is the only function that moves a test into "approved," and
 * recordImpression/recordConversion below refuse to write to any test not
 * in that status — so approval is enforced structurally, not just by who
 * calls what.
 */
export async function approveTest(testId: string): Promise<ABTest | undefined> {
  const test = await storage.getABTest(testId);
  if (!test) return undefined;
  if (test.status !== "proposed") {
    throw new Error(`Test is already "${test.status}" — only a proposed test can be approved.`);
  }
  return storage.updateABTest(testId, { status: "approved", approvedAt: new Date() });
}

async function assertTestIsLive(testId: string): Promise<void> {
  const test = await storage.getABTest(testId);
  if (!test) throw new Error("Test not found.");
  if (test.status !== "approved") {
    throw new Error(`Refusing to record traffic — test status is "${test.status}", not "approved". No test goes live without founder sign-off.`);
  }
}

export async function recordImpression(testId: string, variantId: string): Promise<void> {
  await assertTestIsLive(testId);
  await storage.incrementABTestVariant(variantId, "impressions");
}

export async function recordConversion(testId: string, variantId: string): Promise<void> {
  await assertTestIsLive(testId);
  await storage.incrementABTestVariant(variantId, "conversions");
}

// Two-proportion z-test, normal approximation (Abramowitz & Stegun 7.1.26
// for the error function). Standard, well-known statistics — no external
// dependency needed for it.
function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

export interface VariantComparison {
  variantId: string;
  variantName: string;
  impressions: number;
  conversions: number;
  conversionRate: number | null;
  liftVsControl: number | null;
  pValue: number | null;
  significant: boolean;
  insufficientSample: boolean;
}

export interface SignificanceResult {
  testId: string;
  controlVariantId: string | null;
  comparisons: VariantComparison[];
  winnerVariantId: string | null;
  conclusion: "winner_found" | "no_significant_difference" | "insufficient_sample";
}

/**
 * checkSignificance — compares every non-control variant against control
 * with a two-proportion z-test. A variant only counts as a winner if BOTH
 * variants have at least MIN_SAMPLE_PER_VARIANT impressions AND the
 * difference is significant at p < 0.05 AND the lift is positive. Correctly
 * returns "insufficient_sample" or "no_significant_difference" rather than
 * forcing a winner when the data doesn't support one.
 */
export async function checkSignificance(testId: string): Promise<SignificanceResult> {
  const variants = await storage.getABTestVariants(testId);
  const control = variants.find((v) => v.isControl);
  if (!control) {
    return { testId, controlVariantId: null, comparisons: [], winnerVariantId: null, conclusion: "insufficient_sample" };
  }

  const controlRate = control.impressions > 0 ? control.conversions / control.impressions : null;
  const comparisons: VariantComparison[] = [];
  let anyInsufficientSample = control.impressions < MIN_SAMPLE_PER_VARIANT;
  let bestWinner: { variantId: string; lift: number } | null = null;

  for (const variant of variants) {
    if (variant.id === control.id) {
      comparisons.push({
        variantId: variant.id, variantName: variant.name,
        impressions: variant.impressions, conversions: variant.conversions,
        conversionRate: controlRate, liftVsControl: 0, pValue: null,
        significant: false, insufficientSample: control.impressions < MIN_SAMPLE_PER_VARIANT,
      });
      continue;
    }

    const insufficientSample = variant.impressions < MIN_SAMPLE_PER_VARIANT || control.impressions < MIN_SAMPLE_PER_VARIANT;
    if (insufficientSample) anyInsufficientSample = true;

    const variantRate = variant.impressions > 0 ? variant.conversions / variant.impressions : null;
    let pValue: number | null = null;
    let significant = false;
    let lift: number | null = null;

    if (!insufficientSample && controlRate !== null && variantRate !== null) {
      const n1 = control.impressions, c1 = control.conversions;
      const n2 = variant.impressions, c2 = variant.conversions;
      const pooled = (c1 + c2) / (n1 + n2);
      const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
      const z = se > 0 ? (variantRate - controlRate) / se : 0;
      pValue = 2 * (1 - normalCdf(Math.abs(z)));
      significant = pValue < SIGNIFICANCE_ALPHA;
      lift = controlRate > 0 ? (variantRate - controlRate) / controlRate : null;

      if (significant && lift !== null && lift > 0) {
        if (!bestWinner || lift > bestWinner.lift) {
          bestWinner = { variantId: variant.id, lift };
        }
      }
    }

    comparisons.push({
      variantId: variant.id, variantName: variant.name,
      impressions: variant.impressions, conversions: variant.conversions,
      conversionRate: variantRate, liftVsControl: lift, pValue,
      significant, insufficientSample,
    });
  }

  let conclusion: SignificanceResult["conclusion"];
  if (bestWinner) {
    conclusion = "winner_found";
  } else if (anyInsufficientSample) {
    conclusion = "insufficient_sample";
  } else {
    conclusion = "no_significant_difference";
  }

  return { testId, controlVariantId: control.id, comparisons, winnerVariantId: bestWinner?.variantId ?? null, conclusion };
}

/**
 * concludeTest — runs checkSignificance and closes the test out either way.
 * On a real winner, retires every other variant (per "retire losing copy
 * rather than leaving both versions live") and records the winner. On no
 * significant difference or insufficient sample, concludes as inconclusive
 * WITHOUT retiring anything or picking a winner — declining to declare one
 * is a correct outcome, not a failure.
 */
export async function concludeTest(testId: string): Promise<{ test: ABTest; result: SignificanceResult }> {
  const result = await checkSignificance(testId);

  if (result.conclusion === "winner_found" && result.winnerVariantId) {
    const variants = await storage.getABTestVariants(testId);
    for (const v of variants) {
      if (v.id !== result.winnerVariantId) {
        await storage.retireABTestVariant(v.id);
      }
    }
    const test = await storage.updateABTest(testId, {
      status: "concluded_winner",
      winnerVariantId: result.winnerVariantId,
      concludedAt: new Date(),
    });
    return { test: test!, result };
  }

  const test = await storage.updateABTest(testId, { status: "concluded_inconclusive", concludedAt: new Date() });
  return { test: test!, result };
}

export async function listTests(): Promise<ABTest[]> {
  return storage.getABTests();
}

export async function getTestWithVariants(testId: string): Promise<{ test: ABTest | undefined; variants: ABTestVariant[] }> {
  const [test, variants] = await Promise.all([storage.getABTest(testId), storage.getABTestVariants(testId)]);
  return { test, variants };
}
