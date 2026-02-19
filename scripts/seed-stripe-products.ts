import { getUncachableStripeClient } from '../server/stripeClient';

async function seedProducts() {
  const stripe = await getUncachableStripeClient();

  const existing = await stripe.products.search({ query: "name:'Mustard Seed Premium'" });
  if (existing.data.length > 0) {
    console.log('Mustard Seed Premium product already exists:', existing.data[0].id);
    const prices = await stripe.prices.list({ product: existing.data[0].id, active: true });
    for (const p of prices.data) {
      console.log(`  Price: ${p.id} — $${(p.unit_amount! / 100).toFixed(2)}/${p.recurring?.interval}`);
    }
    return;
  }

  const product = await stripe.products.create({
    name: 'Mustard Seed Premium',
    description: 'Full access to the Five Heartbeats engine, dual goals, weighted water system, heartbeat trend analytics, deep weekly reviews, and monthly recalibration.',
    metadata: {
      tier: 'premium',
      app: 'mustard_seed',
    },
  });

  console.log('Created product:', product.id);

  const monthlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 999,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { plan: 'monthly' },
  });
  console.log('Created monthly price:', monthlyPrice.id, '— $9.99/month');

  const annualPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 7999,
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: { plan: 'annual' },
  });
  console.log('Created annual price:', annualPrice.id, '— $79.99/year');
}

seedProducts()
  .then(() => { console.log('Done'); process.exit(0); })
  .catch((err) => { console.error(err); process.exit(1); });
