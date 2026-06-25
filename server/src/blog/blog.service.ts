import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlogCacheService } from './blog.cache.service';
import { slugify } from './slug.util';

const BLOGS_PER_PAGE = 10;

const BLOG_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true, profilePicture: true } },
  tags: { include: { tag: true } },
};

@Injectable()
export class BlogService {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(BlogCacheService) private cache: BlogCacheService,
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

  async findById(id: number) {
    const cacheKey = `blogs:id:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const blog = await this.prisma.blog.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, profilePicture: true, bio: true } },
        tags: { include: { tag: true } },
      },
    });

    if (blog) this.cache.set(cacheKey, blog, 120);
    return blog;
  }

  /** Resolve a story by numeric id OR its SEO slug. */
  async findBySlugOrId(idOrSlug: string) {
    if (/^\d+$/.test(idOrSlug)) return this.findById(parseInt(idOrSlug, 10));

    const cacheKey = `blogs:slug:${idOrSlug}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const blog = await this.prisma.blog.findFirst({
      where: { slug: idOrSlug, deletedAt: null },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, profilePicture: true, bio: true } },
        tags: { include: { tag: true } },
      },
    });

    if (blog) this.cache.set(cacheKey, blog, 120);
    return blog;
  }

  async findByUser(userId: string) {
    return this.prisma.blog.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { tags: { include: { tag: true } } },
    });
  }

  /** Public, published, non-deleted stories — for the sitemap. */
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
        content: data.content,
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
        ...(data.content !== undefined && { content: data.content }),
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
    await this.prisma.blog.update({
      where: { id },
      data: { views: { increment: 1 } },
    });
    this.cache.invalidate(`blogs:id:${id}`);
  }

  async getTags() {
    return this.prisma.tag.findMany({ orderBy: { name: 'asc' } });
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
