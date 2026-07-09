-- Narration character-budget metering.
--
-- These three columns were first applied to the live database with `db push`
-- during the narration rework. This migration captures that same change as
-- history so the schema is reproducible from migrations on a fresh database.
--
-- On the EXISTING production database the columns already exist, so do NOT run
-- this migration there. Mark it applied instead (see prisma/MIGRATIONS.md):
--   npx prisma migrate resolve --applied 20260709000000_narration_char_budget
ALTER TABLE "User" ADD COLUMN     "narrationCharsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN     "narrationPeriodStart" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN     "narrationCreditChars" INTEGER NOT NULL DEFAULT 0;
