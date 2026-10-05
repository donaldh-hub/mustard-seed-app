// Readers for Stripe objects whose shape changed in API version 2025-03-31.basil.
// The webhook pins "2025-04-30.basil" for API calls, but event payloads use the
// webhook endpoint's own API version, so both shapes can arrive. Kept free of
// imports so `node --test` can run stripeShapes.test.ts without dependencies.
//
//   Before basil: subscription.current_period_end, invoice.subscription
//   Basil+:       subscription.items.data[].current_period_end,
//                 invoice.parent.subscription_details.subscription

function toValidDate(unixSeconds: unknown): Date | null {
  if (typeof unixSeconds !== "number" || !Number.isFinite(unixSeconds) || unixSeconds <= 0) return null;
  const date = new Date(unixSeconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Period end of a subscription, or null when no valid timestamp is present.
// With several items, the latest end wins (Mustard Seed uses one item).
export function getSubscriptionPeriodEnd(subscription: any): Date | null {
  const topLevel = toValidDate(subscription?.current_period_end);
  if (topLevel) return topLevel;

  const items: any[] = Array.isArray(subscription?.items?.data) ? subscription.items.data : [];
  let latest: Date | null = null;
  for (const item of items) {
    const end = toValidDate(item?.current_period_end);
    if (end && (!latest || end > latest)) latest = end;
  }
  return latest;
}

// Subscription ID an invoice belongs to, or null for one-time invoices.
// Either field may be an ID string or an expanded object.
export function getInvoiceSubscriptionId(invoice: any): string | null {
  const idOf = (value: unknown): string | null => {
    if (typeof value === "string" && value) return value;
    const id = (value as any)?.id;
    return typeof id === "string" && id ? id : null;
  };
  return idOf(invoice?.subscription) ?? idOf(invoice?.parent?.subscription_details?.subscription);
}

// Why a configured Stripe price doesn't match the amount the app displays,
// or null when it matches.
export function describePriceMismatch(
  expectedCents: number,
  price: { unit_amount?: number | null; currency?: string | null; type?: string | null; active?: boolean | null },
): string | null {
  const problems: string[] = [];
  if (price.unit_amount !== expectedCents) {
    problems.push(`Stripe charges ${price.unit_amount ?? "no fixed amount"} cents, app shows ${expectedCents} cents`);
  }
  if (price.currency && price.currency !== "usd") problems.push(`currency is ${price.currency}, expected usd`);
  if (price.type && price.type !== "one_time") problems.push(`type is ${price.type}, expected one_time`);
  if (price.active === false) problems.push("price is archived");
  return problems.length ? problems.join("; ") : null;
}
