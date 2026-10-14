# Stripe Test-Mode Setup Progress (Oct 5, 2026)
Done in Cowork by driving Donald's Chrome (Replit + Stripe).

## Verified DONE
- Replit runs `main` at 019f494 (PR #21 merged: $39.99 Rebuild, Stripe webhook fix, Replit sync). Working tree clean.
- `npm run build` passes on main (exit 0; only chunk-size warning).
- Secrets confirmed by type check: STRIPE_SECRET_KEY = sk_test_, STRIPE_WEBHOOK_SECRET = whsec_. Leftover unused SIGNING_SECRET_KEY can be deleted.
- Seed script ran in TEST mode. Products: Premium prod_VIx9jDE96a56zW, 7-Day Rebuild prod_VOAN4pCXmyxR3T.
- 5 price IDs added as Replit Configurations (not Secrets):
  - STRIPE_PRICE_ID = price_1UNO2VGRqjKTCUBIjtqRS9hu ($17.99/mo)
  - STRIPE_PRICE_ID_REBUILD = price_1UNO2WGRqjKTCUBIeNf72Lep ($15.99/mo graduate)
  - STRIPE_PRICE_ID_ANNUAL = price_1UNO2WGRqjKTCUBIs3ZyguKQ ($179.90/yr)
  - STRIPE_PRICE_ID_REBUILD_ANNUAL = price_1UNO2WGRqjKTCUBIeBDy7X9K ($159.90/yr)
  - STRIPE_PRICE_ID_REBUILD_PROGRAM = price_1UNO2WGRqjKTCUBIBYbPbeJR ($39.99 one-time)
- Test webhook we_1UNOGDGRqjKTCUBIFhUxy0AT -> https://mustardseeddap.com/api/stripe/webhook, API 2026-02-25.clover, 5 events.
- First republish blocked by Replit security scan (proxy-addr 2.0.7). Fixed in PR #22 (merged). Republished Oct 5 ~23:21 ET, live on both domains.
- Live log: "[STRIPE] Rebuild price check OK: price_1UNO2WGRqjKTCUBIBYbPbeJR = $39.99". No CONFIG_WARNING.
- `stripe trigger checkout.session.completed` -> live webhook returned HTTP 200 (synthetic event, unlocks nothing).

## Pending (Donald)
- Real test purchase: incognito -> sign up -> /rebuild -> 4242 card -> Day 1 unlocks.
- Test subscription on second account -> profile shows Premium (proves/disproves webhook field-shape bug) + one photo upload.
- ADMIN_API_KEY (needed for refunds).
- APP_BASE_URL not yet checked.
- Archive old $14.99/mo price on Premium product.
- Live site accepts TEST cards only. No invites until live keys.

## Update Oct 13
- Legal confirmed the Privacy Policy, Terms, and Subscription Explainer drafts. Using them as-is.
- Rebuild refund policy still unwritten (new text, not covered by legal review).
