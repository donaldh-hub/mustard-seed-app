import Stripe from 'stripe';

// Creates the Mustard Seed Premium product and its four prices in
// whichever Stripe mode STRIPE_SECRET_KEY belongs to (test or live).
// Safe to re-run: existing product/prices with the right amount are reused.
// Annual = 10 × monthly (two months free).
//
//   standard         → $17.99/month  → STRIPE_PRICE_ID
//   rebuild          → $15.99/month  → STRIPE_PRICE_ID_REBUILD (users who completed the paid Rebuild)
//   standard_annual  → $179.90/year  → STRIPE_PRICE_ID_ANNUAL
//   rebuild_annual   → $159.90/year  → STRIPE_PRICE_ID_REBUILD_ANNUAL
const PLANS = [
  { plan: 'standard', unitAmount: 1799, interval: 'month', envVar: 'STRIPE_PRICE_ID' },
  { plan: 'rebuild', unitAmount: 1599, interval: 'month', envVar: 'STRIPE_PRICE_ID_REBUILD' },
  { plan: 'standard_annual', unitAmount: 1799 * 10, interval: 'year', envVar: 'STRIPE_PRICE_ID_ANNUAL' },
  { plan: 'rebuild_annual', unitAmount: 1599 * 10, interval: 'year', envVar: 'STRIPE_PRICE_ID_REBUILD_ANNUAL' },
] as const;

async function seedProducts() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    throw new Error('STRIPE_SECRET_KEY is not set.');
  }
  const stripe = new Stripe(stripeKey, { apiVersion: '2025-04-30.basil' } as any);
  console.log(`Stripe mode: ${stripeKey.startsWith('sk_live_') ? 'LIVE' : 'test'}`);

  const existing = await stripe.products.search({ query: "name:'Mustard Seed Premium'" });
  let product = existing.data[0];
  if (product) {
    console.log('Mustard Seed Premium product already exists:', product.id);
  } else {
    product = await stripe.products.create({
      name: 'Mustard Seed Premium',
      description: 'Full access to the Five Heartbeats engine, dual goals, weighted water system, heartbeat trend analytics, deep weekly reviews, and monthly recalibration.',
      metadata: {
        tier: 'premium',
        app: 'mustard_seed',
      },
    });
    console.log('Created product:', product.id);
  }

  const activePrices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });

  for (const { plan, unitAmount, interval, envVar } of PLANS) {
    const dollars = `$${(unitAmount / 100).toFixed(2)}/${interval}`;
    let price = activePrices.data.find(
      (p) => p.unit_amount === unitAmount && p.currency === 'usd' && p.recurring?.interval === interval,
    );
    if (price) {
      console.log(`Reusing ${plan} price:`, price.id, `— ${dollars}`);
    } else {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: unitAmount,
        currency: 'usd',
        recurring: { interval },
        metadata: { plan },
      });
      console.log(`Created ${plan} price:`, price.id, `— ${dollars}`);
    }
    console.log(`  → set ${envVar}=${price.id}`);
  }

  const otherPrices = activePrices.data.filter(
    (p) => !PLANS.some(({ unitAmount, interval }) => p.unit_amount === unitAmount && p.recurring?.interval === interval),
  );
  for (const p of otherPrices) {
    console.log(`Note: other active price ${p.id} — $${((p.unit_amount ?? 0) / 100).toFixed(2)}/${p.recurring?.interval} (left unchanged; archive it in the dashboard if unused)`);
  }
}

seedProducts()
  .then(() => { console.log('Done'); process.exit(0); })
  .catch((err) => { console.error(err); process.exit(1); });
