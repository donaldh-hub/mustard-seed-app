// Single source of truth for Mustard Seed prices (in cents). Used by the
// Stripe seed script to create prices and by the UI to describe them.
// Stripe price IDs live in env vars; these amounts must match those prices.
export const PRICING = {
  rebuildProgramCents: 2500, // 7-Day Rebuild, one-time
  standardMonthlyCents: 1799,
  rebuildGradMonthlyCents: 1599, // Premium rate after completing the Rebuild
  annualMonths: 10, // annual = 10 × monthly (two months free)
} as const;

export const standardAnnualCents = PRICING.standardMonthlyCents * PRICING.annualMonths;
export const rebuildGradAnnualCents = PRICING.rebuildGradMonthlyCents * PRICING.annualMonths;

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
}
