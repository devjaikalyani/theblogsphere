# TheBlogSphere

A full-stack blogging platform built with Angular 19, NestJS, PostgreSQL (Prisma), Better Auth, and AI-assisted writing.

---

## Features

- Write, publish, and discover blog posts (SEO-friendly slug URLs, e.g. `/blog/my-title-123`)
- AI writing assistant with streaming output (Groq / llama-3.3-70b)
- AI writing memory — stores your style, uses it in every generation
- AI "key takeaways" — a one-tap summary of any post (cached)
- Immersive reading view — reading-progress bar, auto-built table of contents with scroll-spy, and a "Read next" related-posts rail
- Cover image upload (Cloudflare R2), with server-side magic-byte validation
- Comments, bookmarks, follow system, and personalized feed
- Writer analytics dashboard (views, top posts, monthly trends)
- Author profiles with tipping support (Buy Me a Coffee, Ko-fi, etc.)
- Google OAuth + email/password auth (Better Auth), with brute-force rate limiting
- Soft-delete for posts (recoverable, not destroyed)

### Design & front-end

- **"Refined Editorial" design system** — warm paper/ink/clay palette; Fraunces (display), Newsreader (reading), Inter (UI)
- **Editorial signature layer** — masthead rails, ink section rules, and running index numerals shared across home, explore, and the reading view
- Subtle **motion** throughout (scroll-reveal, hover lift, route page-transitions), all reduced-motion aware
- **Light / dark / system theme** with a nav toggle and no flash on load (theme set before first paint)
- Self-hosted fonts (no render-blocking third-party request), lazy-loaded images, reduced-motion support, skip-to-content link
- **PWA installable** (web app manifest)
- Server-side rendering (Angular SSR) + Tailwind CSS v4
- i18n + RTL support (English and Arabic, extensible)

### SEO

- Per-route title / description / Open Graph / Twitter / canonical (SSR-rendered)
- Structured data (JSON-LD): `Article` on posts, `FAQPage` on the FAQ
- Dynamic `sitemap.xml` and `robots.txt`

### Ops & security

- Boot-time environment validation (fails fast on missing config)
- Helmet CSP, CORS allowlist, global rate limiting, `/api/health` probe
- Deploy configs: same-origin [`vercel.json`](vercel.json) rewrite (Vercel + managed backend), plus Caddy / nginx reverse-proxy + PM2 process file in [`deploy/`](deploy/) for single-VPS

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 19 + SSR + Tailwind CSS v4 |
| Backend | NestJS (TypeScript) |
| Database | PostgreSQL via Prisma ORM |
| Authentication | Better Auth (email/password + Google OAuth) |
| AI | Groq API with SSE streaming |
| File Storage | Cloudflare R2 |

---

## Prerequisites

- Node.js 20+
- PostgreSQL instance (local or hosted)
- Groq API key — [console.groq.com](https://console.groq.com)
- Cloudflare R2 bucket (for cover images and profile pictures)
- Google OAuth credentials (for social login)

---

## Environment Setup

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_URL` | Your production domain (e.g. `https://yourdomain.com`) |
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins (e.g. `https://yourdomain.com`) |
| `GROQ_API_KEY` | Groq API key for AI generation |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL (e.g. `https://yourdomain.com/api/auth/callback/google`) |
| `R2_ACCOUNT_ID` | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET_NAME` | R2 bucket name |
| `R2_PUBLIC_URL` | Public URL for R2 bucket |

---

## Database Setup

Run once after cloning, and after any schema changes:

```bash
# Generate Prisma client
npm run prisma:generate

# Apply schema to your database (dev AND production — this project uses db push)
npm run prisma:push

# Fast-search indexes + slug backfill (no psql needed)
npm run db:trigram
npm run backfill:slugs
```

> Note: there is no `prisma/migrations` folder. Use `prisma db push`, NOT
> `prisma migrate dev`/`migrate deploy` — `migrate dev` would reset and wipe the
> database.

---

## Development

Run Angular and NestJS together:

```bash
npm run dev
```

- Angular: `http://localhost:4200`
- NestJS API: `http://localhost:3000`
- Angular dev server proxies all `/api` requests to NestJS automatically

Run separately:

```bash
npm run server:dev   # NestJS only
npm run start        # Angular only
```

---

## Production Build

The NestJS backend is **not** compiled to a `dist/` bundle. `tsc` cannot build
it (the source uses extensionless ESM imports), so both dev and production run
`server/src` directly through the SWC runtime loader (`@swc-node/register`),
which is fast and avoids a brittle compile step. `server:build` therefore only
generates the Prisma client; `server:start` runs the server with
`NODE_ENV=production`.

```bash
# Generate the Prisma client (run after install / schema changes)
npm run server:build

# Build the Angular SSR bundle
npm run build

# Start the NestJS API (runs server/src via the SWC loader)
npm run server:start

# Serve the Angular SSR bundle
npm run serve:ssr:TheBlogSphere
```

> `@swc-node/register` and `@swc/core` live in `dependencies` (not
> `devDependencies`) so a production install (`npm ci --omit=dev`) can still run
> the server.

---

## Deployment Checklist

Before going live:

- [ ] Set `BETTER_AUTH_URL` to your production domain
- [ ] Set `ALLOWED_ORIGINS` to your production domain
- [ ] Update `GOOGLE_CALLBACK_URL` to production OAuth callback URL
- [ ] Apply schema on the production DB: `npx prisma db push` (NOT `migrate dev` — it would wipe data)
- [ ] Run `npm run db:trigram` and `npm run backfill:slugs` on production
- [ ] Set `NODE_ENV=production`
- [ ] Ensure R2 bucket CORS policy allows your domain
- [ ] Route `/api/*` to the backend on one public origin (Vercel [`vercel.json`](vercel.json) rewrite, or a reverse proxy)

---

## API Reference

### Blogs

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/blogs?page=1&q=&tag=` | No | Paginated blog list (published, non-deleted) |
| GET | `/api/blogs/:idOrSlug` | No | Single blog post — resolves by numeric id **or** SEO slug |
| POST | `/api/blogs` | Yes | Create blog post (auto-generates a slug) |
| PATCH | `/api/blogs/:id` | Yes | Update blog post |
| DELETE | `/api/blogs/:id` | Yes | Soft-delete blog post |
| POST | `/api/blogs/:id/view` | No | Increment view count |
| GET | `/api/blogs/:id/related` | No | Related posts ("Read next") — shared-tag matches, topped up with recent (cached) |
| GET | `/api/blogs/my` | Yes | Current user's blogs |
| GET | `/api/blogs/tags` | No | All tags |

### Comments

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/blogs/:blogId/comments` | No | Get comments for a blog |
| POST | `/api/blogs/:blogId/comments` | Yes | Add a comment |
| DELETE | `/api/comments/:id` | Yes | Delete own comment |

### Bookmarks

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/bookmarks` | Yes | List bookmarked blogs |
| GET | `/api/bookmarks/check/:blogId` | Optional | Check bookmark status (returns `false` when signed out) |
| POST | `/api/bookmarks/:blogId` | Yes | Add bookmark |
| DELETE | `/api/bookmarks/:blogId` | Yes | Remove bookmark |

### Follow

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/follow/:userId/status` | Optional | Follow/follower counts (`following: false` when signed out) |
| POST | `/api/follow/:userId` | Yes | Follow a user |
| DELETE | `/api/follow/:userId` | Yes | Unfollow a user |
| GET | `/api/feed` | Yes | Personalized feed from followed users |

### Users

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/users/:id` | Optional | Author profile + blogs (adds `isFollowing` when signed in) |
| PATCH | `/api/users/me` | Yes | Update profile (bio, website, writingStyle, tippingEnabled, tipUrl) |
| GET | `/api/users/me/writing-style` | Yes | Get AI writing style |

### Analytics

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/analytics/my` | Yes | Writer dashboard stats |

### AI

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/ai/generate` | Optional | Stream AI content (SSE); uses your saved writing style when signed in. Rate-limited to 5 req/min per IP |
| GET | `/api/ai/summary/:blogId` | No | AI "key takeaways" for a post (cached). Rate-limited to 10 req/min per IP |

### Uploads

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/upload/profile-picture` | Yes | Upload profile picture to R2 (JPEG/PNG/GIF/WebP, max 5 MB) |
| POST | `/api/upload/cover-image` | Yes | Upload blog cover image to R2 (JPEG/PNG/GIF/WebP, max 5 MB) |

> Both upload routes require a valid session and validate file type and size
> server-side. (The old unauthenticated `presign` endpoint was removed.)

### System

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/health` | No | Liveness/readiness probe (`200` when DB is up, `503` otherwise) |
| GET | `/api/sitemap.xml` | No | Dynamic XML sitemap (static pages + all public posts) |

### Auth (Better Auth)

Credential endpoints (`sign-in/email`, `sign-up/email`, password reset) are
rate-limited to 10 attempts / 5 min per IP to blunt brute-force attacks.

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/sign-up/email` | Register |
| POST | `/api/auth/sign-in/email` | Login |
| POST | `/api/auth/sign-out` | Logout |
| GET | `/api/auth/get-session` | Current session |
| POST | `/api/auth/sign-in/social` | Start Google OAuth — body `{ "provider": "google", "callbackURL": "..." }`, returns the URL to redirect to |
| GET | `/api/auth/callback/google` | Google OAuth callback (redirect target) |

---

## Project Structure

```
TheBlogSphere/
├── src/                         # Angular frontend
│   └── app/
│       ├── directives/          # reveal, hover, page-transition (Motion-powered)
│       ├── interceptors/        # HTTP cache interceptor
│       ├── pages/               # Route components
│       │   ├── home/
│       │   ├── explore/
│       │   ├── blog-detail/
│       │   ├── create/
│       │   ├── edit/
│       │   ├── author/
│       │   ├── my-stories/
│       │   ├── bookmarks/
│       │   ├── feed/
│       │   ├── analytics/
│       │   ├── settings/
│       │   ├── ai-assistant/
│       │   ├── about/
│       │   └── faqs/
│       ├── pipes/               # markdown, translate
│       └── services/            # auth, blog, ai, theme, seo, i18n, toast
├── server/                      # NestJS backend
│   └── src/
│       ├── ai/                  # Groq streaming
│       ├── analytics/           # Writer dashboard
│       ├── auth/                # Better Auth + brute-force rate limit
│       ├── blog/                # Blog CRUD + cache, sitemap, slug util
│       ├── bookmark/            # Bookmark endpoints
│       ├── comment/             # Comment endpoints
│       ├── config/              # Env validation (fail-fast on boot)
│       ├── follow/              # Follow system + feed
│       ├── health/              # /api/health probe
│       ├── scripts/             # backfill-slugs, apply-trigram (psql-free)
│       ├── upload/              # Cloudflare R2 uploads (magic-byte validated)
│       ├── user/                # User profile endpoints
│       └── prisma/              # Prisma service
├── prisma/
│   ├── schema.prisma            # Database schema (db push, no migrations folder)
│   └── manual/                  # trigram_search.sql (run via npm run db:trigram)
├── public/
│   ├── fonts/                   # Self-hosted woff2 + fonts.css
│   ├── robots.txt
│   └── manifest.webmanifest     # PWA manifest
├── deploy/                      # Caddyfile, nginx.conf, ecosystem.config.cjs (PM2)
├── vercel.json                  # Same-origin /api rewrite (Vercel frontend + managed backend)
├── railway.json                 # Railway backend service (Prisma generate + SWC start, no Angular build)
├── .github/workflows/ci.yml     # CI: install, prisma generate, build, test
├── DEPLOYMENT.md                # Full production deploy guide
├── .env.example                 # Environment variable template
└── .env                         # Your local credentials (not committed)
```

---

## Deployment

This is a two-tier app (Angular SSR frontend + NestJS/Postgres backend). Auth
cookies and Google OAuth require both to be reachable on **one origin**, so every
deploy routes `/api/*` to the backend and everything else to the frontend.

### Option A — Vercel (frontend) + managed Node host (backend)

Recommended when the frontend lives on Vercel. The NestJS API **cannot** run on
Vercel's serverless runtime, so host it on a platform that runs a persistent Node
process (Render, Railway, Fly.io) with a managed Postgres (Neon, Supabase, Render
Postgres).

1. **Backend** → deploy this repo to your Node host as a web service:
   - Build: `npm ci --include=dev && npx prisma generate`
     (the `prisma` CLI is a devDependency, so `--include=dev` is required)
   - Start: `npm run server:start` — binds to `$PORT`, serves under `/api/*`
   - Health check path: `/api/health`
   - One-off, once the DB is connected:
     `npx prisma db push && npm run db:trigram && npm run backfill:slugs`
   - **Railway:** [`railway.json`](railway.json) already sets the build, start, and
     health check. Just add a **PostgreSQL** plugin (it provides `DATABASE_URL`),
     set the env below, and optionally `NIXPACKS_NODE_VERSION=22`. Run the one-off
     DB commands once via the Railway shell (or `railway run …`).
2. **Same-origin glue** → [`vercel.json`](vercel.json) proxies `/api/*` on the
   Vercel domain to the backend. Replace `REPLACE-WITH-BACKEND-HOST` with your
   backend's URL, then redeploy the frontend.
3. **Origin env** — set the public Vercel domain everywhere the browser sees it.
   These go on the **backend host** (the API issues the cookies and OAuth redirect):
   ```
   BETTER_AUTH_URL=https://<your-app>.vercel.app
   ALLOWED_ORIGINS=https://<your-app>.vercel.app
   GOOGLE_CALLBACK_URL=https://<your-app>.vercel.app/api/auth/callback/google
   SITE_URL=https://<your-app>.vercel.app
   ```
   Whitelist that callback URL (and the JS origin) in the Google Cloud console.
4. **Verify:** `curl https://<your-app>.vercel.app/api/health` returns `200`.

### Option B — Single VPS (self-hosted)

One box running both processes (NestJS `:3000`, Angular SSR `:4000`) behind one
reverse proxy. See **[DEPLOYMENT.md](DEPLOYMENT.md)**; Caddy / nginx / PM2 configs
are in [`deploy/`](deploy/).
