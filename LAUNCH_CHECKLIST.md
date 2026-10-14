# Mustard Seed — Pre-Launch Checklist

Everything that must be true before Mustard Seed takes its first real payment.
Items are grounded in the current code; file references point to where each
setting is read.

## 1. Blocking decisions (need Donald)

- [x] **Price decided:** **$17.99/month** standard, **$15.99/month** for
  Rebuild graduates. Annual = 10 months' price: **$179.90/year** standard,
  **$159.90/year** Rebuild. `scripts/seed-stripe-products.ts` creates exactly
  these four prices. The upgrade screens show a Monthly / Annual toggle once
  `STRIPE_PRICE_ID_ANNUAL` is set; Stripe checkout shows the exact amount.
- [x] **7-Day Rebuild is $39.99, one time, for everyone.** Day 1 stays locked
  until the payment clears. The purchase screen explains the graduate rate.
  All amounts live in `shared/pricing.ts`, the single source of truth.
- [x] **Graduates only ever see graduate prices** ($15.99/mo, $159.90/yr).
  Checkout never falls back to the $17.99/$179.90 price for a graduate. If
  a graduate price isn't configured, checkout errors instead of overcharging.
- [ ] **Rebuild refund policy.** Terms §5.3 says the Rebuild "may require
  payment" but says nothing about refunds for a one-time purchase. Decide
  the policy and add it before launch (attorney review item).
- [ ] **Legal review.** `client/src/content/termsOfService.ts` and
  `privacyPolicy.ts` are marked as drafts that need attorney review before
  taking payments (especially Terms sections 5, 10, 12).
- [ ] **Approve dunning email copy.** Failed-payment emails stay off until
  `DUNNING_COPY_APPROVED=true` (`server/billingAgent.ts`).

## 2. Environment variables (Replit Secrets)

### Required — the app won't start or core features break
| Variable | Used in | Notes |
|---|---|---|
| `DATABASE_URL` | `server/storage.ts`, `drizzle.config.ts` | Production Postgres. |
| `SESSION_SECRET` | `server/auth.ts` | App **refuses to start** in production without it. 32+ random characters. |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Jae coach, weekly review, vision | Set by Replit AI Integrations. |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | same | Set by Replit AI Integrations. |
| `NODE_ENV` | many | `production` in the deployment. |

### Required for payments
| Variable | Used in | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | `server/routes.ts`, `billingAgent.ts` | Live key starts with `sk_live_`. |
| `STRIPE_PRICE_ID` | checkout | Live standard price ID (`price_...`). |
| `STRIPE_PRICE_ID_REBUILD` | checkout | Live Rebuild-graduate price ID. **Required**: without it, graduates can't subscribe (they never fall back to $17.99). |
| `STRIPE_PRICE_ID_ANNUAL` | checkout, `/api/stripe/config` | Live $179.90/yr price ID. The annual toggle stays hidden until this **and** `STRIPE_PRICE_ID_REBUILD_ANNUAL` are set. |
| `STRIPE_PRICE_ID_REBUILD_PROGRAM` | Rebuild checkout, `/api/stripe/config` | Live **$39.99 one-time** Rebuild price ID. Must match `PRICING.rebuildProgramCents`; the server logs a `[CONFIG_WARNING]` at startup if it doesn't. Until set, the Rebuild shows "opens for purchase soon" and nobody can start it (except admin grants). |
| `STRIPE_PRICE_ID_REBUILD_ANNUAL` | checkout, `/api/stripe/config` | Live $159.90/yr Rebuild price ID. Required for the annual toggle to appear. |
| `STRIPE_WEBHOOK_SECRET` | `/api/stripe/webhook` | From the **live** webhook endpoint (`whsec_...`). Without it, subscriptions never activate. |
| `APP_BASE_URL` | checkout/portal return URLs | e.g. `https://mustardseeddap.com`. Falls back to the request host. |
| `STRIPE_STANDARD_PRICE_CENTS` | `billingAgent.ts` MRR report | Optional; set to `1799`. |
| `DUNNING_COPY_APPROVED` | `server/billingAgent.ts` | Failed-payment emails stay off until this is `true`. Set it after approving the copy (section 1). |

### Sign-in, email, storage
| Variable | Used in | Notes |
|---|---|---|
| `GOOGLE_CLIENT_ID` | `server/auth.ts` | Google sign-in. Add the production domain to the OAuth client's authorized origins. |
| `RESEND_API_KEY` | auth, analytics, billing, trust & safety | Transactional email. |
| `FROM_EMAIL` | same | Defaults to `noreply@mustardseeddap.com`; domain must be verified in Resend. |
| `FOUNDER_ALERT_EMAIL` | analytics, trust & safety | Where alerts go. |
| `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS` | object storage | Set by Replit Object Storage (photo uploads). |

### Admin
| Variable | Used in | Notes |
|---|---|---|
| `ADMIN_API_KEY` | admin routes (`x-admin-key` header) | **REQUIRED for refunds.** A Stripe refund does not remove Rebuild access; revoking it needs this key (section 6). Admin API returns 503 until set. |

### Agents (optional)
| Variable | Used in | Notes |
|---|---|---|
| `GITHUB_TOKEN`, `GITHUB_REPO_FULL_NAME` | `server/releaseOpsAgent.ts` | Release Ops agent only. |

## 3. Stripe live-mode steps

1. In the Stripe dashboard, switch to **live mode** and finish account
   activation (business details for HARDAWAYAI LLC, bank account).
2. With the live `STRIPE_SECRET_KEY` set, run
   `npx tsx scripts/seed-stripe-products.ts`. It creates the product plus the
   Premium product with four prices ($17.99/mo, $15.99/mo, $179.90/yr,
   $159.90/yr) and the 7-Day Rebuild product ($39.99 one-time), or reuses them
   if they exist. If an older $25 Rebuild price exists, the script lists it as
   "other active price": archive it in the dashboard. Wait a few minutes
   between runs (Stripe's product search can lag, which could create a
   duplicate product). It prints the five `STRIPE_PRICE_ID*` values to copy into
   Replit Secrets. The first line of output says `LIVE` or `test`, so check it.
3. Add a webhook endpoint: `https://<your domain>/api/stripe/webhook`,
   subscribed to these events (the ones the server handles):
   - `checkout.session.completed` (activates subscriptions **and** records
     $39.99 Rebuild purchases)
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Turn on the **customer billing portal** (Settings → Billing → Customer
   portal), because the app links users there. Leave **"customers can switch
   plans" off**: the portal would list every price, so graduates could see
   (and switch to) $17.99, and non-graduates could switch to $15.99.
6. Put the live `STRIPE_SECRET_KEY` in Replit Secrets and redeploy.

## 4. Go-live smoke test (real card, real money)

- [ ] Sign up as a brand-new user with Google sign-in on the production domain.
- [ ] Complete onboarding and plant a seed; send Jae a message and get a reply.
- [ ] Log a verified action and confirm water and the reward card appear.
- [ ] Upload a photo and confirm it saves.
- [ ] Finish the Grounding Journal, open the Rebuild, and confirm Day 1 is
      locked behind the $39.99 card with the graduate-rate note.
- [ ] Buy the Rebuild with a real card. You should land back on the Rebuild
      page, see "Confirming your payment…", then Day 1 unlocks.
- [ ] Subscribe **monthly** with a real card, then confirm the user shows as
      Premium and the webhook shows `200` in the Stripe dashboard.
- [ ] Repeat with **annual** on a second account and confirm checkout shows
      $179.90/year (or $159.90/year for a Rebuild graduate).
- [ ] Open the billing portal, cancel, and confirm the status updates.
- [ ] Refund the test charge in Stripe.
- [ ] Confirm the founder alert and transactional emails arrive.

## 5. Code health (done in this pass)

- `npm run check` (TypeScript) passed with **0 errors** and `npm run build`
  succeeded on PR #20 alone. **Re-run both on the combined launch branch**
  (`npx tsc --noEmit && npm run build` in the Replit shell) before merging.
- Webhook shape tests: `node --experimental-strip-types --test server/stripeShapes.test.ts`
  (no install needed). They cover old and new Stripe API shapes for the
  subscription period end and the invoice's subscription.
- Unused Replit scaffolding (`server/replit_integrations/{audio,batch,chat,image}`)
  is excluded from type-checking. Nothing imports it, and `chat/storage.ts`
  references a `db` module and `conversations` table that don't exist. It can
  be deleted in a follow-up once confirmed unneeded.

## 6. Rebuild access for testers, comps, and refunds

Grant or revoke Rebuild access without a payment (needs `ADMIN_API_KEY`):

```
curl -X POST https://<your domain>/api/admin/users/<userId>/rebuild-access \
  -H "x-admin-key: $ADMIN_API_KEY" -H "Content-Type: application/json" \
  -d '{"granted": true}'      # false to revoke (e.g. after a refund)
```

Refunding in Stripe does **not** remove access automatically. Revoke it with
the call above. Users who already finished the Rebuild before it became paid
keep access.
