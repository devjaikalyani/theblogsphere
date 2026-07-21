import { Injectable, Inject } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import { PrismaService } from '../prisma/prisma.service';
import { BlogCacheService } from './blog.cache.service';
import { NotifyService } from '../mail/notify.service';
import { slugify } from './slug.util';

const BLOGS_PER_PAGE = 10;

// Defence in depth + content normalisation: the Angular client sanitises at
// render, but the API stores and re-serves this HTML to future consumers (RSS,
// emails, mobile), so scripts/handlers must never reach the database. Inline
// style/class are stripped on purpose: pasted content (Medium spans etc.)
// otherwise carries foreign font sizing that fights the design system and
// dark mode.
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'div', 'br', 'span', 'b', 'i', 'u', 's', 'strong', 'em', 'mark', 'sub', 'sup',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
    'a', 'img', 'figure', 'figcaption', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  // Drop empty paste artifacts like <span></span> but keep intentional breaks.
  exclusiveFilter: (frame) => frame.tag === 'span' && !frame.text.trim() && !frame.mediaChildren,
};

function sanitizeContent(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

const BLOG_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true, profilePicture: true } },
  tags: { include: { tag: true } },
};

// Lean projection for "read next" cards; omits the (potentially large) body.
const RELATED_SELECT = {
  id: true,
  slug: true,
  title: true,
  coverImage: true,
  author: true,
  publishDate: true,
  user: { select: { id: true, firstName: true, lastName: true } },
  tags: { include: { tag: true } },
};

@Injectable()
export class BlogService {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(BlogCacheService) private cache: BlogCacheService,
    @Inject(NotifyService) private notify: NotifyService,
  ) {}

  async findPaginated(page: number, q?: string, tagSlug?: string) {
    const useCache = !q && !tagSlug;
    const cacheKey = `blogs:page:${page}`;
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    const where: any = { status: 'published', deletedAt: null };
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (tagSlug) {
      where.tags = { some: { tag: { slug: tagSlug } } };
    }

    const skip = (page - 1) * BLOGS_PER_PAGE;
    const [blogs, total] = await Promise.all([
      this.prisma.blog.findMany({
        where,
        skip,
        take: BLOGS_PER_PAGE,
        orderBy: { publishDate: 'desc' },
        include: BLOG_INCLUDE,
      }),
      this.prisma.blog.count({ where }),
    ]);

    const result = {
      blogs,
      total,
      totalPages: Math.ceil(total / BLOGS_PER_PAGE) || 1,
      currentPage: page,
    };
    if (useCache) this.cache.set(cacheKey, result, 60);
    return result;
  }

  /** Drafts are private: ids are sequential integers and slugs are assigned
   *  at creation, so without this gate anyone could enumerate /api/blogs/1..N
   *  and read unpublished work. Applied AFTER the cache (the cache stores the
   *  raw row; visibility is per-viewer). */
  private visibleTo(blog: any, viewerId?: string) {
    if (!blog) return null;
    if (blog.status === 'published') return blog;
    return viewerId && blog.userId === viewerId ? blog : null;
  }

  async findById(id: number, viewerId?: string) {
    const cacheKey = `blogs:id:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return this.visibleTo(cached, viewerId);

    const blog = await this.prisma.blog.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, profilePicture: true, bio: true, tippingEnabled: true, tipUrl: true, upiId: true } },
        tags: { include: { tag: true } },
      },
    });

    if (blog) this.cache.set(cacheKey, blog, 120);
    return this.visibleTo(blog, viewerId);
  }

  /** Resolve a story by numeric id OR its SEO slug. */
  async findBySlugOrId(idOrSlug: string, viewerId?: string) {
    if (/^\d+$/.test(idOrSlug)) return this.findById(parseInt(idOrSlug, 10), viewerId);

    const cacheKey = `blogs:slug:${idOrSlug}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return this.visibleTo(cached, viewerId);

    const blog = await this.prisma.blog.findFirst({
      where: { slug: idOrSlug, deletedAt: null },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, profilePicture: true, bio: true, tippingEnabled: true, tipUrl: true, upiId: true } },
        tags: { include: { tag: true } },
      },
    });

    if (blog) this.cache.set(cacheKey, blog, 120);
    return this.visibleTo(blog, viewerId);
  }

  async findByUser(userId: string) {
    return this.prisma.blog.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { tags: { include: { tag: true } } },
    });
  }

  /** Latest public stories with body text, for the RSS feed. */
  async findRecentForRss(take = 50) {
    return this.prisma.blog.findMany({
      where: { status: 'published', visibility: 'public', deletedAt: null },
      select: { id: true, slug: true, title: true, content: true, author: true, publishDate: true },
      orderBy: { publishDate: 'desc' },
      take,
    });
  }

  /** Public, published, non-deleted stories, for the sitemap. */
  async findAllPublicForSitemap() {
    return this.prisma.blog.findMany({
      where: { status: 'published', visibility: 'public', deletedAt: null },
      select: { id: true, slug: true, updatedAt: true, publishDate: true },
      orderBy: { publishDate: 'desc' },
      take: 5000,
    });
  }

  async create(data: {
    title: string;
    content: string;
    userId: string;
    author: string;
    status: string;
    tags: string[];
    coverImage?: string;
  }) {
    const tagConnections = await this.resolveTagConnections(data.tags);
    const created = await this.prisma.blog.create({
      data: {
        title: data.title,
        content: sanitizeContent(data.content),
        author: data.author,
        publishDate: data.status === 'published' ? new Date() : null,
        visibility: 'public',
        status: data.status,
        userId: data.userId,
        ...(data.coverImage && { coverImage: data.coverImage }),
        ...(tagConnections.length && { tags: { create: tagConnections } }),
      },
      include: BLOG_INCLUDE,
    });

    // Slug includes the id, so it is globally unique and stable for SEO.
    const blog = await this.prisma.blog.update({
      where: { id: created.id },
      data: { slug: `${slugify(data.title)}-${created.id}` },
      include: BLOG_INCLUDE,
    });

    this.cache.invalidate('blogs:');
    // Fire-and-forget: followers are emailed in the background; a mail outage
    // must never fail (or slow) the publish request itself.
    if (blog.status === 'published' && blog.visibility === 'public') {
      this.notify
        .postPublished(blog)
        .catch((e) => console.error('[NOTIFY] publish fan-out failed:', e?.message ?? e));
    }
    return blog;
  }

  async update(
    id: number,
    userId: string,
    data: { title?: string; content?: string; status?: string; tags?: string[]; coverImage?: string },
  ) {
    const existing = await this.prisma.blog.findFirst({ where: { id, userId, deletedAt: null } });
    if (!existing) throw new Error('Not found or unauthorized');

    const nowPublishing = data.status === 'published' && existing.status !== 'published';
    // Backfill a slug for legacy rows on first edit (kept stable thereafter).
    const slug = (existing as any).slug ?? `${slugify(data.title ?? existing.title)}-${existing.id}`;

    if (data.tags !== undefined) {
      await this.prisma.blogTag.deleteMany({ where: { blogId: id } });
    }

    const tagConnections = data.tags ? await this.resolveTagConnections(data.tags) : [];

    const blog = await this.prisma.blog.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.content !== undefined && { content: sanitizeContent(data.content) }),
        ...(data.status !== undefined && { status: data.status }),
        ...(nowPublishing && { publishDate: new Date() }),
        ...(data.coverImage !== undefined && { coverImage: data.coverImage }),
        ...((existing as any).slug ? {} : { slug }),
        ...(data.tags !== undefined && tagConnections.length && {
          tags: { create: tagConnections },
        }),
      },
      include: BLOG_INCLUDE,
    });

    this.cache.invalidate('blogs:');
    // Notify followers only on the FIRST publish (draft -> published with no
    // prior publishDate); edits and re-publishes never re-mail people.
    if (nowPublishing && !existing.publishDate && blog.visibility === 'public') {
      this.notify
        .postPublished(blog)
        .catch((e) => console.error('[NOTIFY] publish fan-out failed:', e?.message ?? e));
    }
    return blog;
  }

  /** Soft delete: keep the row (and its comments/bookmarks) but hide it. */
  async delete(id: number, userId: string) {
    const result = await this.prisma.blog.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    this.cache.invalidate('blogs:');
    return result;
  }

  async incrementViews(id: number) {
    // updateMany: a view ping for a missing/deleted story is a no-op, not a 500.
    await this.prisma.blog.updateMany({
      where: { id, deletedAt: null },
      data: { views: { increment: 1 } },
    });
    this.cache.invalidate(`blogs:id:${id}`);
  }

  async getTags() {
    return this.prisma.tag.findMany({ orderBy: { name: 'asc' } });
  }

  /** Top 100 stories by a popularity score: readership plus weighted
   *  engagement (a comment counts more than a view, a bookmark more still),
   *  multiplied by a gentle recency decay so fresh hits can rise above stale
   *  ones without erasing genuinely popular older posts. Cached; invalidated
   *  whenever a story is created/updated/deleted via the `blogs:` prefix. */
  async findTrending() {
    const cacheKey = 'blogs:trending';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const candidates = await this.prisma.blog.findMany({
      where: { status: 'published', visibility: 'public', deletedAt: null },
      orderBy: { views: 'desc' },
      take: 500,
      select: {
        id: true,
        slug: true,
        title: true,
        coverImage: true,
        author: true,
        publishDate: true,
        createdAt: true,
        views: true,
        user: { select: { id: true, firstName: true, lastName: true, profilePicture: true } },
        tags: { include: { tag: true } },
        _count: { select: { comments: true, bookmarks: true, likes: true } },
      },
    });

    const now = Date.now();
    const DAY = 86_400_000;
    const scored = candidates.map((b) => {
      const comments = b._count.comments;
      const bookmarks = b._count.bookmarks;
      const likes = b._count.likes;
      const ageDays = Math.max(0, (now - new Date(b.publishDate ?? b.createdAt).getTime()) / DAY);
      const recencyWeight = 1 / (1 + ageDays / 45);
      const score = (b.views + likes * 5 + comments * 4 + bookmarks * 6 + 1) * recencyWeight;
      return { blog: b, comments, bookmarks, likes, score };
    });

    scored.sort((a, b) => b.score - a.score || b.blog.views - a.blog.views);

    const top = scored.slice(0, 100).map(({ blog, comments, bookmarks, likes }, i) => {
      const { _count, createdAt, ...rest } = blog;
      return { ...rest, commentCount: comments, bookmarkCount: bookmarks, likeCount: likes, rank: i + 1 };
    });

    this.cache.set(cacheKey, top, 120);
    return top;
  }

  /** Stories to read next: those sharing tags with this one, topped up with
   *  recent posts if there aren't enough tag matches. (Tag-overlap now; an
   *  embedding-based version can replace this later without touching callers.) */
  async findRelated(id: number, take = 3) {
    const cacheKey = `blogs:related:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const base = await this.prisma.blog.findUnique({
      where: { id },
      select: { tags: { select: { tagId: true } } },
    });
    const tagIds = base?.tags.map((t) => t.tagId) ?? [];
    const publicWhere = { status: 'published', visibility: 'public', deletedAt: null };

    let related: any[] = [];
    if (tagIds.length) {
      related = await this.prisma.blog.findMany({
        where: { ...publicWhere, id: { not: id }, tags: { some: { tagId: { in: tagIds } } } },
        orderBy: { publishDate: 'desc' },
        take,
        select: RELATED_SELECT,
      });
    }

    if (related.length < take) {
      const exclude = [id, ...related.map((r) => r.id)];
      const filler = await this.prisma.blog.findMany({
        where: { ...publicWhere, id: { notIn: exclude } },
        orderBy: { publishDate: 'desc' },
        take: take - related.length,
        select: RELATED_SELECT,
      });
      related = [...related, ...filler];
    }

    this.cache.set(cacheKey, related, 300);
    return related;
  }

  private async resolveTagConnections(tagNames: string[]) {
    const connections: { tagId: number }[] = [];
    for (const raw of tagNames.slice(0, 5)) {
      const name = raw.trim();
      if (!name) continue;
      const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      if (!slug) continue;
      const tag = await this.prisma.tag.upsert({
        where: { slug },
        update: {},
        create: { name, slug },
      });
      connections.push({ tagId: tag.id });
    }
    return connections;
  }
}
