# Database migrations

This project is moving from `prisma db push` (no history, no rollback) to real
Prisma migration history. Migrations live in `prisma/migrations/`.

## One-time reconciliation on the existing production database

The production database was built with `db push`, so its columns already exist
but its `_prisma_migrations` ledger does not yet list every migration. Run this
**once** to line the ledger up with reality, then never `db push` prod again.

1. Temporarily expose the DB: Railway -> Postgres -> Settings -> Networking ->
   add the TCP proxy back (you removed it for security). Copy `DATABASE_PUBLIC_URL`.
2. Point at prod and check status:
   ```bash
   DATABASE_URL="<DATABASE_PUBLIC_URL>" npx prisma migrate status
   ```
3. Mark the already-present migrations as applied **without running them** (the
   tables/columns already exist, so running would error):
   ```bash
   DATABASE_URL="<DATABASE_PUBLIC_URL>" npx prisma migrate resolve --applied 0_init
   DATABASE_URL="<DATABASE_PUBLIC_URL>" npx prisma migrate resolve --applied 20260709000000_narration_char_budget
   ```
   (Skip `0_init` if `migrate status` already shows it applied.)
4. Confirm a clean state:
   ```bash
   DATABASE_URL="<DATABASE_PUBLIC_URL>" npx prisma migrate status   # "Database schema is up to date!"
   ```
5. Remove the TCP proxy again.

## Ongoing workflow

- **Change the schema**: edit `prisma/schema.prisma`, then locally
  `npm run prisma:migrate` (`prisma migrate dev`) to generate a new migration
  and apply it to your dev DB. Commit the generated `prisma/migrations/*` folder.
- **Deploy**: apply pending migrations to prod with
  `npm run prisma:migrate:deploy` (`prisma migrate deploy`), which is safe and
  idempotent (it only runs migrations not yet in the ledger).
  - Do this from your machine against the public URL, or add it as a Railway
    pre-deploy/release step. **Do not** wire it into the app's start command
    until after the one-time reconciliation above, or a boot would try to
    re-create existing columns and fail.
- **Never run** `prisma migrate dev` against production (it can reset/wipe), and
  stop using `prisma db push` on prod now that history is tracked.
