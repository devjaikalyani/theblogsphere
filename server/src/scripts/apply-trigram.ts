/**
 * Apply the pg_trgm search indexes WITHOUT needing the `psql` CLI.
 * Reads prisma/manual/trigram_search.sql and runs each statement via Prisma.
 * Idempotent (CREATE ... IF NOT EXISTS).
 *
 *   npm run db:trigram
 */
import 'reflect-metadata';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

async function main() {
  const sqlPath = resolve(process.cwd(), 'prisma/manual/trigram_search.sql');
  const raw = readFileSync(sqlPath, 'utf8');

  // Strip line comments, then split into individual statements.
  const statements = raw
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  const prisma = new PrismaClient();
  try {
    for (const stmt of statements) {
      console.log(`> ${stmt.replace(/\s+/g, ' ').slice(0, 80)}...`);
      await prisma.$executeRawUnsafe(stmt);
    }
    console.log(`Done. Applied ${statements.length} statement(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('Failed to apply trigram indexes:', e?.message ?? e);
  process.exit(1);
});
