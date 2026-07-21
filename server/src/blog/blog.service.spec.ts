import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BlogService } from './blog.service';

/** Draft privacy: ids are sequential and slugs exist from creation, so the
 *  single-story endpoint must never hand an unpublished draft to anyone but
 *  its owner, whether the row comes from the database or the cache. */

const draft = {
  id: 5,
  slug: 'secret-draft-5',
  title: 'Secret draft',
  status: 'draft',
  userId: 'author-1',
};
const published = { ...draft, id: 6, slug: 'live-story-6', status: 'published' };

function makeService(row: any, cached: any = null) {
  const prisma = { blog: { findFirst: vi.fn().mockResolvedValue(row) } } as any;
  const cache = { get: vi.fn(() => cached), set: vi.fn(), invalidate: vi.fn() } as any;
  const notify = { postPublished: vi.fn() } as any;
  return new BlogService(prisma, cache, notify);
}

describe('draft visibility', () => {
  beforeEach(() => vi.clearAllMocks());

  it('hides a draft from anonymous readers, by id and by slug', async () => {
    const svc = makeService(draft);
    expect(await svc.findBySlugOrId('5')).toBeNull();
    expect(await svc.findBySlugOrId('secret-draft-5')).toBeNull();
  });

  it('hides a draft from a different signed-in user', async () => {
    const svc = makeService(draft);
    expect(await svc.findBySlugOrId('5', 'someone-else')).toBeNull();
  });

  it('returns the draft to its owner', async () => {
    const svc = makeService(draft);
    expect(await svc.findBySlugOrId('5', 'author-1')).toEqual(draft);
  });

  it('serves published stories to everyone', async () => {
    const svc = makeService(published);
    expect(await svc.findBySlugOrId('6')).toEqual(published);
    expect(await svc.findBySlugOrId('6', 'someone-else')).toEqual(published);
  });

  it('gates cache hits too, not just database reads', async () => {
    const svc = makeService(null, draft);
    expect(await svc.findBySlugOrId('5')).toBeNull();
    expect(await svc.findBySlugOrId('5', 'author-1')).toEqual(draft);
  });
});
