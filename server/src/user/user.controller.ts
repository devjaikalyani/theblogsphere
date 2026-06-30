import { Controller, Get, Patch, Param, Body, Req, Res, UseGuards, Inject } from '@nestjs/common';
import { Response, Request } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/auth.config';
import { PrismaService } from '../prisma/prisma.service';
import { BlogCacheService } from '../blog/blog.cache.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('api/users')
export class UserController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(BlogCacheService) private blogCache: BlogCacheService,
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
}
