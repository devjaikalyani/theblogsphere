# Deploying TheBlogSphere

This app is two long-lived Node processes behind one reverse proxy on a single
origin (required for auth cookies + Google OAuth):

| Process            | Command                              | Port |
|--------------------|--------------------------------------|------|
| NestJS API         | `PORT=3000 npm run server:start`     | 3000 |
| Angular SSR server | `PORT=4000 npm run serve:ssr:TheBlogSphere` | 4000 |

The reverse proxy sends `/api/*` to the API and everything else to the SSR
server. Configs are in [`deploy/`](deploy/): `Caddyfile` (auto-HTTPS, simplest),
`nginx.conf`, and `ecosystem.config.cjs` (PM2 to run both processes).

## 1. Required, before first boot

1. **Env**: copy `.env.example` to `.env` and fill every value. The server now
   **fails fast** on boot if a required variable is missing (see
   `server/src/config/env.validation.ts`). In production that includes
   `BETTER_AUTH_URL`, `ALLOWED_ORIGINS`, the `R2_*` keys, `GOOGLE_*`, and
   `GROQ_API_KEY`. Set `NODE_ENV=production`.
2. **Point OAuth + auth at the prod domain**: `GOOGLE_CALLBACK_URL`,
   `BETTER_AUTH_URL`, and `ALLOWED_ORIGINS` must be your real HTTPS origin, and
   the same callback must be whitelisted in the Google Cloud console.
3. **Apply the schema** via Prisma migration history:
   ```bash
   npm run prisma:migrate:deploy   # applies prisma/migrations/* (idempotent)
   npm run db:trigram              # pg_trgm fast-search indexes (no psql needed)
   npm run backfill:slugs          # give pre-existing posts their slugs (idempotent)
   ```
   > ⚠️  The **existing production DB was built with `db push`**, so its
   > migration ledger is incomplete. Do the one-time reconciliation in
   > [`prisma/MIGRATIONS.md`](prisma/MIGRATIONS.md) **before** `migrate deploy`
   > there, or it will try to re-create existing columns and fail. Never run
   > `prisma migrate dev` against production (it can reset/wipe the database).
4. **R2 bucket CORS**: allow your origin to GET the public bucket URL.
5. **Reverse proxy**: edit `deploy/Caddyfile` (or `nginx.conf`), replace
   `yourdomain.com`, and start it. Update `Sitemap:` host in `public/robots.txt`.

## 2. Build

```bash
npm ci
npx prisma generate
NODE_OPTIONS=--max-old-space-size=4096 npm run build
```

CI runs this on every push/PR (`.github/workflows/ci.yml`).

## 3. What shipped in this pass (no action needed)

- Same-origin reverse-proxy configs + PM2 file.
- Boot-time env validation; brute-force rate limit on credential endpoints;
  upload magic-byte verification; `trust proxy` for correct client IPs.
- SEO slugs (`/blog/my-title-123`, numeric ids still resolve), dynamic
  `/api/sitemap.xml`, per-route meta/canonical, Article + FAQ JSON-LD,
  `robots.txt`.
- Self-hosted fonts (no render-blocking Google request), lazy-loaded images,
  PWA web manifest, `/api/health` probe, soft-delete for posts.

## 4. Recommended next

**Done in the reliability pass:**

- **Node 22** pinned for prod (`nixpacks.toml`, `.nvmrc`) to match CI.
- **Error monitoring**: `@sentry/node` initialised in `server/src/main.ts`
  (env-gated on `SENTRY_DSN`), with a global filter reporting unexpected 5xx.
- **Image processing**: `sharp` re-encodes uploads to strip EXIF/GPS metadata,
  apply orientation, and cap dimensions (`UploadService.sanitizeImage`).
- **Server type gate**: `npm run typecheck:server` (`tsc --noEmit`) runs in CI,
  the SWC runtime does not type-check on its own.
- **Server tests**: `npm run test:server` (Vitest) covers the billing money
  paths (signature verification, idempotency, char-budget metering).
- **Pro AI fair-use backstop**: silent cap in `BillingService.consumeAiCredit`.

**Still open:**

- **PWA icons**: add real PNGs at `public/icons/icon-192.png`, `icon-512.png`,
  `icon-maskable-512.png` (referenced by `manifest.webmanifest`).
- **Dynamic OG images**: `npm i satori @resvg/resvg-js`, render a per-post PNG
  from the title/author and serve it from a NestJS route; reference it in
  `blog-detail` `og:image`.
- **Distributed rate limit**: the auth limiter is in-memory (per process). For
  multiple instances, back it with Redis (`@nestjs/throttler` + a Redis store,
  or `rate-limiter-flexible`).
- **E2E tests**: `npm i -D @playwright/test && npx playwright install`, then add
  specs for sign-in, publish, and read flows.
- **Full-text search** beyond trigram: consider a `tsvector` column +
  `websearch_to_tsquery` for ranked relevance if search volume grows.

## 5. Enable billing: Razorpay (India, INR/UPI)

Two modes; partial config fails boot on purpose.

**Checkout mode (default, API keys only).** Set just:

```
RAZORPAY_KEY_ID=rzp_test_... (or rzp_live_...)
RAZORPAY_KEY_SECRET=...
```

The pricing page's "Pay in INR, UPI / Cards" button opens the Razorpay
Standard Checkout modal for a one-time ₹399 payment that grants 30 days of
Writer Pro. The server creates the order (`POST /api/billing/razorpay/order`)
and verifies the returned payment signature (`POST /api/billing/razorpay/verify`,
HMAC-SHA256 of `order_id|payment_id`), synchronous, no webhook required.
Replayed payment ids are ignored via the BillingEvent ledger, and expiry is
applied lazily on the next billing read.

**Narration budgets + top-up packs.** Narration is metered by characters (what
OpenAI bills), so the cost ceiling holds regardless of article length. Free
readers get a lifetime taste; Writer Pro gets a monthly budget (resets like the
AI quota) then buys prepaid top-up packs. Re-listening to an already-narrated
story is free for everyone (audio is cached), so only new generation is metered.
A top-up is one more one-time order through the same modal + verify flow
(`POST /api/billing/razorpay/topup`, Pro only), tagged `notes.purpose:
"narration-topup"` so verify adds characters instead of granting Pro. Tune the
numbers in `billing.service.ts` (`FREE_NARRATION_CHARS`, `PRO_NARRATION_CHARS`,
`NARRATION_TOPUP_CHARS`, `NARRATION_TOPUP_PRICES`).

**Subscription mode (auto-renewing).** Additionally set:

```
RAZORPAY_PLAN_PRO=plan_...        (Subscriptions -> Plans: monthly, INR 399)
RAZORPAY_WEBHOOK_SECRET=...       (Webhooks: <domain>/api/billing/razorpay-webhook,
                                   subscribe to the subscription.* events)
```

The same button then redirects to Razorpay's hosted subscription page and Pro
is granted/revoked by the webhook. Subscriptions must be enabled on the
Razorpay account (new accounts may need to request activation) and live
payments require completed KYC.

**International cards (USD).** Razorpay declines non-Indian cards until
International payments are approved on the account: Account & Settings ->
Payment methods -> International (needs a fully activated/KYC'd account;
approval can take a few days, and international transactions carry a higher
fee, ~3% + currency conversion). Once approved, set:

```
RAZORPAY_INTERNATIONAL=true
```

The pricing page then shows "Pay with international card ($7.99)", which cuts a
USD order through the same checkout modal and verify flow (30 days of Pro).
When Stripe keys are configured, Stripe takes precedence for that button.

**Verify**: `/api/billing/status` returns `razorpayEnabled: true` plus
`razorpayMode: "checkout" | "subscription"` and `razorpayInternational`;
complete a test-mode payment and confirm the user's `plan` flips to `pro`.
