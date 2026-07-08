/**
 * One-time backfill: give existing posts (created before slugs existed) a
 * stable SEO slug. Idempotent; only touches rows where slug IS NULL, and the
 * slug it writes is identical to what BlogService produces on create.
 *
 *   npm run backfill:slugs
 *
 * Safe to run more than once. Run from the project root so it finds .env.
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { slugify } from '../blog/slug.util';

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.blog.findMany({
      where: { slug: null },
      select: { id: true, title: true },
    });

    console.log(`Found ${rows.length} post(s) without a slug.`);
    let updated = 0;
    for (const r of rows) {
      const slug = `${slugify(r.title)}-${r.id}`;
      await prisma.blog.update({ where: { id: r.id }, data: { slug } });
      console.log(`  #${r.id}  ->  ${slug}`);
      updated++;
    }
    console.log(`Done. Backfilled ${updated} slug(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('Backfill failed:', e);
  process.exit(1);
});
