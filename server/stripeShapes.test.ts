// Run: node --experimental-strip-types --test server/stripeShapes.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { getSubscriptionPeriodEnd, getInvoiceSubscriptionId, describePriceMismatch } from "./stripeShapes.ts";

const END = 1_767_225_600; // 2026-01-01T00:00:00Z

test("period end: pre-basil top-level field", () => {
  assert.equal(getSubscriptionPeriodEnd({ current_period_end: END })?.toISOString(), "2026-01-01T00:00:00.000Z");
});

test("period end: basil shape reads subscription items", () => {
  const sub = { items: { data: [{ current_period_end: END }] } };
  assert.equal(getSubscriptionPeriodEnd(sub)?.toISOString(), "2026-01-01T00:00:00.000Z");
});

test("period end: basil shape with several items takes the latest", () => {
  const sub = { items: { data: [{ current_period_end: END - 86_400 }, { current_period_end: END }] } };
  assert.equal(getSubscriptionPeriodEnd(sub)?.toISOString(), "2026-01-01T00:00:00.000Z");
});

test("period end: missing or invalid values give null, never an invalid Date", () => {
  for (const sub of [
    undefined,
    {},
    { current_period_end: undefined, items: { data: [] } },
    { current_period_end: null },
    { current_period_end: "1767225600" },
    { current_period_end: Number.NaN },
    { current_period_end: 0 },
    { items: { data: [{ current_period_end: undefined }] } },
    { items: { data: [{ current_period_end: 1e20 }] } },
  ]) {
    assert.equal(getSubscriptionPeriodEnd(sub), null, JSON.stringify(sub));
  }
});

test("invoice subscription: pre-basil string field", () => {
  assert.equal(getInvoiceSubscriptionId({ subscription: "sub_old" }), "sub_old");
});

test("invoice subscription: pre-basil expanded object", () => {
  assert.equal(getInvoiceSubscriptionId({ subscription: { id: "sub_obj" } }), "sub_obj");
});

test("invoice subscription: basil parent.subscription_details", () => {
  const invoice = { parent: { type: "subscription_details", subscription_details: { subscription: "sub_new" } } };
  assert.equal(getInvoiceSubscriptionId(invoice), "sub_new");
});

test("invoice subscription: basil expanded object", () => {
  const invoice = { parent: { subscription_details: { subscription: { id: "sub_new_obj" } } } };
  assert.equal(getInvoiceSubscriptionId(invoice), "sub_new_obj");
});

test("invoice subscription: one-time invoice gives null", () => {
  assert.equal(getInvoiceSubscriptionId({ subscription: null, parent: null }), null);
  assert.equal(getInvoiceSubscriptionId({}), null);
});

test("price check: matching one-time USD price passes", () => {
  assert.equal(describePriceMismatch(3999, { unit_amount: 3999, currency: "usd", type: "one_time", active: true }), null);
});

test("price check: old $25 price behind the $39.99 code is flagged", () => {
  const msg = describePriceMismatch(3999, { unit_amount: 2500, currency: "usd", type: "one_time", active: true });
  assert.match(msg ?? "", /2500 cents, app shows 3999 cents/);
});

test("price check: archived, recurring or non-USD prices are flagged", () => {
  const msg = describePriceMismatch(3999, { unit_amount: 3999, currency: "eur", type: "recurring", active: false });
  assert.match(msg ?? "", /currency is eur/);
  assert.match(msg ?? "", /type is recurring/);
  assert.match(msg ?? "", /archived/);
});
