import Stripe from 'stripe';
import { PRICING, standardAnnualCents, rebuildGradAnnualCents } from '../shared/pricing';

// Creates Mustard Seed's Stripe products and prices in whichever Stripe mode
// STRIPE_SECRET_KEY belongs to (test or live). Amounts come from
// shared/pricing.ts. Safe to re-run: existing products/prices with the right
// amount are reused.
//
// Mustard Seed Premium (subscription; annual = 10 × monthly):
//   standard         → $17.99/month  → STRIPE_PRICE_ID
//   rebuild          → $15.99/month  → STRIPE_PRICE_ID_REBUILD (users who completed the Rebuild)
//   standard_annual  → $179.90/year  → STRIPE_PRICE_ID_ANNUAL
//   rebuild_annual   → $159.90/year  → STRIPE_PRICE_ID_REBUILD_ANNUAL
// Mustard Seed 7-Day Rebuild (one-time):
//   rebuild_program  → $25          → STRIPE_PRICE_ID_REBUILD_PROGRAM
type PlanSpec = {
  plan: string;
  unitAmount: number;
  interval: 'month' | 'year' | null; // null = one-time
  envVar: string;
};

const PRODUCTS: {
  name: string;
  description: string;
  metadata: Record<string, string>;
  plans: PlanSpec[];
}[] = [
  {
    name: 'Mustard Seed Premium',
    description: 'Full access to the Five Heartbeats engine, dual goals, weighted water system, heartbeat trend analytics, deep weekly reviews, and monthly recalibration.',
    metadata: { tier: 'premium', app: 'mustard_seed' },
    plans: [
      { plan: 'standard', unitAmount: PRICING.standardMonthlyCents, interval: 'month', envVar: 'STRIPE_PRICE_ID' },
      { plan: 'rebuild', unitAmount: PRICING.rebuildGradMonthlyCents, interval: 'month', envVar: 'STRIPE_PRICE_ID_REBUILD' },
      { plan: 'standard_annual', unitAmount: standardAnnualCents, interval: 'year', envVar: 'STRIPE_PRICE_ID_ANNUAL' },
      { plan: 'rebuild_annual', unitAmount: rebuildGradAnnualCents, interval: 'year', envVar: 'STRIPE_PRICE_ID_REBUILD_ANNUAL' },
    ],
  },
  {
    name: 'Mustard Seed 7-Day Rebuild',
    description: 'Seven guided days through the Five Heartbeats with Jai, ending in your own Actionable Goal Plan. One-time purchase.',
    metadata: { product: 'rebuild_program', app: 'mustard_seed' },
    plans: [
      { plan: 'rebuild_program', unitAmount: PRICING.rebuildProgramCents, interval: null, envVar: 'STRIPE_PRICE_ID_REBUILD_PROGRAM' },
    ],
  },
];

const describe = (amount: number, interval: string | null | undefined) =>
  `$${(amount / 100).toFixed(2)}${interval ? `/${interval}` : ' one-time'}`;

async function seedProducts() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    throw new Error('STRIPE_SECRET_KEY is not set.');
  }
  const stripe = new Stripe(stripeKey, { apiVersion: '2025-04-30.basil' } as any);
  console.log(`Stripe mode: ${stripeKey.startsWith('sk_live_') ? 'LIVE' : 'test'}`);

  for (const spec of PRODUCTS) {
    const existing = await stripe.products.search({ query: `name:'${spec.name}'` });
    let product = existing.data[0];
    if (product) {
      console.log(`${spec.name} product already exists:`, product.id);
    } else {
      product = await stripe.products.create({
        name: spec.name,
        description: spec.description,
        metadata: spec.metadata,
      });
      console.log(`Created product ${spec.name}:`, product.id);
    }

    const activePrices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
    const matches = (p: Stripe.Price, { unitAmount, interval }: PlanSpec) =>
      p.unit_amount === unitAmount &&
      p.currency === 'usd' &&
      (interval ? p.recurring?.interval === interval : p.type === 'one_time');

    for (const planSpec of spec.plans) {
      const { plan, unitAmount, interval, envVar } = planSpec;
      let price = activePrices.data.find((p) => matches(p, planSpec));
      if (price) {
        console.log(`Reusing ${plan} price:`, price.id, `— ${describe(unitAmount, interval)}`);
      } else {
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: unitAmount,
          currency: 'usd',
          ...(interval ? { recurring: { interval } } : {}),
          metadata: { plan },
        });
        console.log(`Created ${plan} price:`, price.id, `— ${describe(unitAmount, interval)}`);
      }
      console.log(`  → set ${envVar}=${price.id}`);
    }

    const otherPrices = activePrices.data.filter((p) => !spec.plans.some((planSpec) => matches(p, planSpec)));
    for (const p of otherPrices) {
      console.log(`Note: other active price ${p.id} — ${describe(p.unit_amount ?? 0, p.recurring?.interval)} (left unchanged; archive it in the dashboard if unused)`);
    }
  }
}

seedProducts()
  .then(() => { console.log('Done'); process.exit(0); })
  .catch((err) => { console.error(err); process.exit(1); });
