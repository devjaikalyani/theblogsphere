import { Controller, Get, Patch, Delete, Param, Body, Req, Res, UseGuards, Inject } from '@nestjs/common';
import { Response, Request } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/auth.config';
import { PrismaService } from '../prisma/prisma.service';
import { BlogCacheService } from '../blog/blog.cache.service';
import { UploadService } from '../upload/upload.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('api/users')
export class UserController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(BlogCacheService) private blogCache: BlogCacheService,
    @Inject(UploadService) private uploads: UploadService,
  ) {}

  // Optional auth: `isFollowing` is computed only when a session is present.
  @Get(':id')
  async getProfile(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profilePicture: true,
          bio: true,
          website: true,
          tippingEnabled: true,
          tipUrl: true,
          upiId: true,
          createdAt: true,
          _count: {
            select: { followers: true, following: true },
          },
          blogs: {
            where: { status: 'published' },
            orderBy: { publishDate: 'desc' },
            include: { tags: { include: { tag: true } } },
          },
        },
      });
      if (!user) return res.status(404).json({ error: 'User not found' });

      let isFollowing = false;
      if (session && session.user.id !== id) {
        const follow = await this.prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: session.user.id, followingId: id } },
        });
        isFollowing = !!follow;
      }

      return res.json({ ...user, isFollowing });
    } catch (e: any) {
      console.error('[GET /users/:id] error:', e?.message ?? e);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  async updateProfile(
    @Body() body: { firstName?: string; lastName?: string; bio?: string; website?: string; writingStyle?: string; tippingEnabled?: boolean; tipUrl?: string; upiId?: string },
    @CurrentUser('id') userId: string,
  ) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.firstName !== undefined && { firstName: body.firstName }),
        ...(body.lastName !== undefined && { lastName: body.lastName }),
        ...(body.bio !== undefined && { bio: body.bio }),
        ...(body.website !== undefined && { website: body.website }),
        ...(body.writingStyle !== undefined && { writingStyle: body.writingStyle }),
        ...(body.tippingEnabled !== undefined && { tippingEnabled: body.tippingEnabled }),
        ...(body.tipUrl !== undefined && { tipUrl: body.tipUrl }),
        ...(body.upiId !== undefined && { upiId: body.upiId }),
      },
      select: { id: true, firstName: true, lastName: true, bio: true, website: true, writingStyle: true, tippingEnabled: true, tipUrl: true, upiId: true },
    });

    // The author name is denormalised onto every Blog (`author`) and onto the
    // auth `name` field. When the name changes, propagate it so existing posts
    // (and new ones) always show the latest name, then drop cached listings.
    if (body.firstName !== undefined || body.lastName !== undefined) {
      const fullName = `${user.firstName} ${user.lastName}`.trim();
      await this.prisma.$transaction([
        this.prisma.user.update({ where: { id: userId }, data: { name: fullName } }),
        this.prisma.blog.updateMany({ where: { userId }, data: { author: fullName } }),
      ]);
      this.blogCache.invalidate('blogs:');
    }

    return user;
  }

  @Get('me/writing-style')
  @UseGuards(AuthGuard)
  async getWritingStyle(@CurrentUser('id') userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { writingStyle: true },
    });
    return { writingStyle: user?.writingStyle ?? '' };
  }

  // DPDP Act 2023 / GDPR data-portability: hand the user a machine-readable copy
  // of everything we hold about them. Excludes secrets (password hashes, OAuth
  // tokens, session tokens) — those are auth-internal, not personal data to port.
  @Get('me/export')
  @UseGuards(AuthGuard)
  async exportData(@CurrentUser('id') userId: string, @Res() res: Response) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, firstName: true, lastName: true, email: true,
        emailVerified: true, image: true, profilePicture: true, bio: true,
        website: true, writingStyle: true, tippingEnabled: true, tipUrl: true,
        upiId: true, plan: true, planRenewsAt: true, billingProvider: true,
        aiUsageCount: true, narrationCount: true, createdAt: true, updatedAt: true,
        blogs: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, title: true, slug: true, content: true, visibility: true,
            status: true, coverImage: true, views: true, publishDate: true,
            createdAt: true, updatedAt: true, deletedAt: true,
            tags: { select: { tag: { select: { name: true } } } },
          },
        },
        comments: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, content: true, blogId: true, createdAt: true },
        },
        bookmarks: { select: { blogId: true, createdAt: true } },
        likes: { select: { blogId: true, createdAt: true } },
        following: { select: { followingId: true, createdAt: true } },
        followers: { select: { followerId: true, createdAt: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const payload = {
      exportedAt: new Date().toISOString(),
      note: 'This is a copy of the personal data TheBlogSphere holds about your account.',
      account: {
        ...user,
        blogs: user.blogs.map((b) => ({ ...b, tags: b.tags.map((t) => t.tag.name) })),
      },
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="theblogsphere-data-export.json"');
    return res.send(JSON.stringify(payload, null, 2));
  }

  // DPDP Act 2023 / GDPR right to erasure. Every relation on User is
  // `onDelete: Cascade` in the schema (blogs, comments, bookmarks, likes,
  // follows, sessions, accounts), so a single delete removes the whole graph.
  @Delete('me')
  @UseGuards(AuthGuard)
  async deleteAccount(@CurrentUser('id') userId: string, @Res() res: Response) {
    try {
      // Collect the R2 objects this user owns BEFORE the cascade wipes the rows,
      // so we can purge them from the bucket (DB delete doesn't touch storage).
      const owned = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { profilePicture: true, blogs: { select: { coverImage: true } } },
      });

      await this.prisma.user.delete({ where: { id: userId } });
      // The user's posts vanish from public listings — drop cached pages.
      this.blogCache.invalidate('blogs:');
      // The session row was cascade-deleted, so the cookie is now inert; clear it.
      res.clearCookie('better-auth.session_token', { path: '/' });

      // Best-effort orphan cleanup — never blocks/fails the erasure.
      if (owned) {
        const urls = [owned.profilePicture, ...owned.blogs.map((b) => b.coverImage)];
        await this.uploads.deleteFiles(urls).catch(() => {});
      }

      return res.json({ ok: true });
    } catch (e: any) {
      console.error('[DELETE /users/me] error:', e?.message ?? e);
      return res.status(500).json({ error: 'Could not delete account' });
    }
  }
}
