# Mustard Seed — Pre-Launch Checklist

Everything that must be true before Mustard Seed takes its first real payment.
Items are grounded in the current code; file references point to where each
setting is read.

## 1. Blocking decisions (need Donald)

- [x] **Price decided:** **$17.99/month** standard, **$15.99/month** for
  Rebuild graduates. `scripts/seed-stripe-products.ts` now creates exactly
  these two monthly prices (the old $9.99/month and $79.99/year prices are gone).
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
| `STRIPE_PRICE_ID_REBUILD` | checkout | Live Rebuild-graduate price ID. |
| `STRIPE_WEBHOOK_SECRET` | `/api/stripe/webhook` | From the **live** webhook endpoint (`whsec_...`). Without it, subscriptions never activate. |
| `APP_BASE_URL` | checkout/portal return URLs | e.g. `https://mustardseeddap.com`. Falls back to the request host. |
| `STRIPE_STANDARD_PRICE_CENTS` | `billingAgent.ts` MRR report | Optional; set to `1799`. |

### Sign-in, email, storage
| Variable | Used in | Notes |
|---|---|---|
| `GOOGLE_CLIENT_ID` | `server/auth.ts` | Google sign-in. Add the production domain to the OAuth client's authorized origins. |
| `RESEND_API_KEY` | auth, analytics, billing, trust & safety | Transactional email. |
| `FROM_EMAIL` | same | Defaults to `noreply@mustardseeddap.com`; domain must be verified in Resend. |
| `FOUNDER_ALERT_EMAIL` | analytics, trust & safety | Where alerts go. |
| `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS` | object storage | Set by Replit Object Storage (photo uploads). |

### Admin and agents (optional)
| Variable | Used in | Notes |
|---|---|---|
| `ADMIN_API_KEY` | admin routes (`x-admin-key` header) | Admin API returns 503 until set. |
| `GITHUB_TOKEN`, `GITHUB_REPO_FULL_NAME` | `server/releaseOpsAgent.ts` | Release Ops agent only. |

## 3. Stripe live-mode steps

1. In the Stripe dashboard, switch to **live mode** and finish account
   activation (business details for HARDAWAYAI LLC, bank account).
2. With the live `STRIPE_SECRET_KEY` set, run
   `npx tsx scripts/seed-stripe-products.ts`. It creates the product plus the
   $17.99 and $15.99 monthly prices (or reuses them if they exist) and prints
   the `STRIPE_PRICE_ID` / `STRIPE_PRICE_ID_REBUILD` values to copy into
   Replit Secrets. The first line of output says `LIVE` or `test`, so check it.
3. Add a webhook endpoint: `https://<your domain>/api/stripe/webhook`,
   subscribed to these events (the ones the server handles):
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Turn on the **customer billing portal** (Settings → Billing → Customer
   portal), because the app links users there.
6. Put the live `STRIPE_SECRET_KEY` in Replit Secrets and redeploy.

## 4. Go-live smoke test (real card, real money)

- [ ] Sign up as a brand-new user with Google sign-in on the production domain.
- [ ] Complete onboarding and plant a seed; send Jae a message and get a reply.
- [ ] Log a verified action and confirm water and the reward card appear.
- [ ] Upload a photo and confirm it saves.
- [ ] Subscribe with a real card, then confirm the user shows as Premium and
      the webhook shows `200` in the Stripe dashboard.
- [ ] Open the billing portal, cancel, and confirm the status updates.
- [ ] Refund the test charge in Stripe.
- [ ] Confirm the founder alert and transactional emails arrive.

## 5. Code health (done in this pass)

- `npm run check` (TypeScript) passes with **0 errors** (was 28).
- `npm run build` succeeds.
- Unused Replit scaffolding (`server/replit_integrations/{audio,batch,chat,image}`)
  is excluded from type-checking. Nothing imports it, and `chat/storage.ts`
  references a `db` module and `conversations` table that don't exist. It can
  be deleted in a follow-up once confirmed unneeded.
