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
3. **Apply the schema** — it changed (slug, soft-delete, new indexes). This
   project tracks schema with `prisma db push` (there is no `prisma/migrations`
   folder), so use:
   ```bash
   npx prisma db push        # additive: slug, deletedAt, indexes (no data loss)
   npm run db:trigram        # pg_trgm fast-search indexes (no psql needed)
   npm run backfill:slugs    # give pre-existing posts their slugs (idempotent)
   ```
   > ⚠️  Do NOT run `prisma migrate dev` / `migrate deploy`. With no migration
   > baseline, `migrate dev` prints "We need to reset the public schema… All
   > data will be lost" and will WIPE the database. Always use `db push` here.
   > (Adopting migration history later means baselining against a throwaway DB
   > first — a separate roadmap task.)
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

## 4. Recommended next (need an install or external service)

These were intentionally **not** auto-installed to avoid disturbing the working
`node_modules`. Each is a single command on your deploy host / better hardware:

- **Node 22**: clears the AWS SDK `<22` warning. `engines` already allows `>=20`.
- **PWA icons**: add real PNGs at `public/icons/icon-192.png`, `icon-512.png`,
  `icon-maskable-512.png` (referenced by `manifest.webmanifest`).
- **Error monitoring**: `npm i @sentry/node @sentry/angular`, init Sentry in
  `server/src/main.ts` (before `bootstrap`) and `src/main.ts`.
- **Image processing** (EXIF strip + thumbnails): `npm i sharp`, then process
  `file.buffer` in `UploadService.uploadFile` before the R2 PUT.
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

## 5. Enable billing — Razorpay (India, INR/UPI)

Two modes; partial config fails boot on purpose.

**Checkout mode (default — API keys only).** Set just:

```
RAZORPAY_KEY_ID=rzp_test_... (or rzp_live_...)
RAZORPAY_KEY_SECRET=...
```

The pricing page's "Pay in INR — UPI / Cards" button opens the Razorpay
Standard Checkout modal for a one-time ₹199 payment that grants 30 days of
Writer Pro. The server creates the order (`POST /api/billing/razorpay/order`)
and verifies the returned payment signature (`POST /api/billing/razorpay/verify`,
HMAC-SHA256 of `order_id|payment_id`) — synchronous, no webhook required.
Replayed payment ids are ignored via the BillingEvent ledger, and expiry is
applied lazily on the next billing read.

**Subscription mode (auto-renewing).** Additionally set:

```
RAZORPAY_PLAN_PRO=plan_...        (Subscriptions -> Plans: monthly, INR 199)
RAZORPAY_WEBHOOK_SECRET=...       (Webhooks: <domain>/api/billing/razorpay-webhook,
                                   subscribe to the subscription.* events)
```

The same button then redirects to Razorpay's hosted subscription page and Pro
is granted/revoked by the webhook. Subscriptions must be enabled on the
Razorpay account (new accounts may need to request activation) and live
payments require completed KYC.

**Verify** — `/api/billing/status` returns `razorpayEnabled: true` plus
`razorpayMode: "checkout" | "subscription"`; complete a test-mode payment and
confirm the user's `plan` flips to `pro`.
