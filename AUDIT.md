# TheBlogSphere: Full Audit

Date: 2026-07-17 (supersedes the 2026-07-13 audit). Scope: codebase, security, ops, live
production, and product readiness, re-run after the growth-feature batch shipped
(follower emails, annual pass, RSS, write-time sanitization, report alerts, annual
upgrade path).

Live at https://www.theblogsphere.co.in (Vercel frontend, Railway backend, Postgres, R2).

## Executive summary

The July 13 audit's three highest-impact engineering gaps are now closed: the retention
loop exists (follower publish emails with signed one-click unsubscribe), RSS is live,
and HTML is sanitized on write. Billing gained an annual pass with carry-over and a
subscription-conflict guard. Live production is healthy: bad credentials return 401,
RSS serves with the right content type, 18/18 server tests and the type gate pass.

This pass found one genuine security/privacy bug (drafts are publicly readable by id),
one operational landmine (the production migration ledger now provably disagrees with
the schema after the manual ALTER TABLE), and a set of quality gaps in the new email
loop that will matter exactly when it starts working (deliverability headers, no email
verification). The distribution problem from the last audit is unchanged and is still
the binding constraint; nothing below changes that priority.

## Scorecard

| Area | Score | Change | Note |
|---|---|---|---|
| Architecture | 8.5/10 | = | Clean modules; new mail/notify code follows house style |
| Security | 7.5/10 | -0.5 | Draft-privacy leak found; everything else still strong |
| Cost engineering | 9/10 | = | Metering order verified: assert, generate, then record |
| Retention loop | 7/10 | +6 | Emails + RSS exist; deliverability and verification gaps remain |
| SEO | 8.5/10 | +0.5 | RSS autodiscovery added |
| Legal/compliance | 9/10 | = | Report alerts now start the grievance clock immediately |
| Testing | 5.5/10 | +0.5 | 18 billing tests incl. carry-over math; still no e2e |
| Ops | 6.5/10 | -0.5 | Migration-ledger drift is now real, not theoretical |
| Traction | 1/10 | = | The GTM work has not started; the platform is ready for it |

## Findings by severity

### High

1. Unpublished drafts are publicly readable. `GET /api/blogs/:idOrSlug`
   ([blog.controller.ts:51](server/src/blog/blog.controller.ts#L51)) resolves through
   `findById` / `findBySlugOrId` ([blog.service.ts:102-137](server/src/blog/blog.service.ts#L102-L137)),
   which filter only on `deletedAt`, never on `status` or ownership. Blog ids are
   sequential integers, so anyone can walk `/api/blogs/1..N` and read every draft's
   full text; drafts also get slugs at creation. Writers reasonably believe drafts are
   private, and the marketing positions the platform as writer-first. Fix: return
   drafts only to their owner (optional-session check in the controller), keep the
   published-only path cacheable, and never cache owner reads of drafts.

2. Production migration ledger is out of sync with the schema. The
   `notifyFollowedPosts` column was applied to prod by hand (Railway Data tab) during
   the July 16 incident, so `_prisma_migrations` does not record
   `20260713000000_notify_followed_posts`, and the original `db push` baseline
   reconciliation in [prisma/MIGRATIONS.md](prisma/MIGRATIONS.md) has not been run
   either. The first `prisma migrate deploy` against prod will attempt to re-create
   existing tables/columns and fail mid-deploy. Fix (10 minutes, one-time): follow
   MIGRATIONS.md and `migrate resolve --applied` all three migrations (`0_init`,
   `20260709000000_narration_char_budget`, `20260713000000_notify_followed_posts`),
   confirm with `migrate status`, then use `migrate deploy` forever after. Do this
   before the next schema change, not during it.

### Medium

3. Follower emails lack deliverability plumbing. The unsubscribe link lives only in
   the body text; there is no `List-Unsubscribe` / `List-Unsubscribe-Post` header.
   Gmail and Yahoo's bulk-sender rules require one-click unsubscribe headers, and
   without them the retention loop's emails start landing in spam right when a writer
   gets popular. Resend passes custom headers through. Fix: extend `MailService` to
   accept per-message headers and set both on every notification.

4. Notification emails go to unverified addresses. Password signups store
   `emailVerified: false` and no verification flow is configured
   ([auth.config.ts](server/src/auth/auth.config.ts)), so a typo'd signup address
   becomes a hard bounce or a spam complaint against the sending domain the first time
   someone they follow publishes. Fix: now that the mail rail exists, enable Better
   Auth email verification (non-blocking at signup), and have the fan-out prefer
   verified addresses once a meaningful share of accounts are verified.

5. View counts are trivially inflatable. `POST /api/blogs/:id/view` is anonymous and
   only limited by the global 30/min/IP throttle, which still allows ~43k views/day
   from one IP. Views are the biggest input to the trending score and to the "prove
   the money" positioning, so fake numbers become a credibility risk the moment
   anyone looks. Fix: per-(IP, blog) dedupe with a short-TTL in-memory set; it does
   not need to be perfect, only to make inflation boring.

6. Sessions expire after 24 hours (`expiresIn: 60*60*24` in auth.config.ts). A reader
   who returns every few days signs in again every visit, which taxes the exact
   retention loop the emails are building. Better Auth's default is 7 days; 30 days
   with `updateAge` of a day is normal for a content platform. One-line change; weigh
   against the convenience of the current stricter posture.

7. Secrets still on disk in the project root (`client_secret_*.json`, `rzp-key.csv`,
   `.env.production`). Flagged on July 13, still present. Never committed (verified
   again), but Downloads is the least defensible place on a laptop for live payment
   and OAuth credentials. Move to a password manager, delete from the tree.

8. README's deployment checklist still instructs `prisma db push` on prod
   ([README.md:202](README.md#L202)) while MIGRATIONS.md forbids it. Whichever
   document is read second wins; make them agree (migrate deploy after the one-time
   reconciliation in finding 2).

### Low

9. In-memory caches (AI summaries, blog cache, and now palette/billing ledgers'
   read paths) reset per deploy and assume one instance. Fine today; documented
   constraint stands.
10. Anonymous `/api/ai/generate` remains the only external-cost endpoint without
    auth (5 req/min/IP). Unchanged recommendation: require auth once real traffic
    exists.
11. No uptime monitor on `/api/health`. Five minutes with any free monitor.
12. Backend region: API round trips observed ~0.6-1.0s. For an India-first audience
    the Railway US region taxes every interaction. Options unchanged: Railway
    Southeast Asia region or the Mumbai VPS configs in [deploy/](deploy/).
13. Report handling is still SQL-only (email alert now exists; no admin UI). Fine at
    current volume.

## What improved since July 13

- Retention loop: publish fan-out (first publish only, capped at 2000 recipients,
  batched 100/call, fire-and-forget), HMAC-signed unsubscribe verified with
  `timingSafeEqual`, settings toggle, and the column is live in prod.
- RSS 2.0 with autodiscovery, XML-escaped, throttle-exempt, edge-cacheable.
- Write-time sanitization via `sanitize-html`: scripts/handlers can no longer reach
  the database, and pasted Medium inline styles are stripped on write.
- Annual pass (Rs 2,999/365d) on the one-time checkout path with per-term amount
  validation, expiry carry-over, and a guard preventing subscription-Pro users from
  double-paying. Three tests cover the carry-over math.
- Report alerts email ADMIN_EMAIL immediately (IT Rules grievance clock).
- Live prod verified healthy end to end during this audit.

## Best upgrades, in order of leverage

1. Ambient visual system (in progress, this session): palette-driven per-story
   theming plus generative covers, so the site looks deliberate no matter what image
   a writer uploads. Details in the implementation notes below.
2. Draft privacy fix (finding 1), a prerequisite for the Medium importer, whose
   imports land as drafts.
3. Medium importer: export-zip upload -> parsed posts -> sanitized drafts. The
   sanitizer built last week does the heavy lifting; this removes the main switching
   cost for the exact writers the strategy targets.
4. Deliverability hardening (findings 3, 4) before any writer with real followers
   joins; retrofitting sender reputation is much harder than starting clean.
5. Migration-ledger reconciliation (finding 2) before the next schema change.
6. Uptime monitor + session-length bump (findings 6, 11): trivial, immediate.
7. Backend region move (finding 12) when GTM starts driving Indian traffic.

## Market-readiness verdict

Unchanged from July 13, but sharper: the product gaps that excused inaction are gone.
The platform now notifies, syndicates, sanitizes, and takes annual money. What it does
not have is writers, and no finding in this document produces them. The 90-day GTM
calendar in MARKET-STRATEGY.md is the critical path; everything above is either a
quick hardening pass or leverage for that calendar.
