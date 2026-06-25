import { Controller, Get, Post, Delete, Param, Req, UseGuards, Inject, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/auth.config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

const BLOG_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true } },
  tags: { include: { tag: true } },
};

@Controller('api')
export class FollowController {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  // Optional auth: anonymous callers get the follower count with following=false.
  @Get('follow/:userId/status')
  async status(@Param('userId') userId: string, @Req() req: Request) {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return { following: false, followers: 0 };
    const [follow, followers] = await Promise.all([
      this.prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: session.user.id, followingId: userId } },
      }),
      this.prisma.follow.count({ where: { followingId: userId } }),
    ]);
    return { following: !!follow, followers };
  }

  @Post('follow/:userId')
  @UseGuards(AuthGuard)
  async follow(@Param('userId') userId: string, @CurrentUser('id') currentUserId: string) {
    if (currentUserId === userId) throw new BadRequestException('Cannot follow yourself');
    await this.prisma.follow.upsert({
      where: { followerId_followingId: { followerId: currentUserId, followingId: userId } },
      update: {},
      create: { followerId: currentUserId, followingId: userId },
    });
    return { following: true };
  }

  @Delete('follow/:userId')
  @UseGuards(AuthGuard)
  async unfollow(@Param('userId') userId: string, @CurrentUser('id') currentUserId: string) {
    await this.prisma.follow.deleteMany({
      where: { followerId: currentUserId, followingId: userId },
    });
    return { following: false };
  }

  @Get('feed')
  @UseGuards(AuthGuard)
  async feed(@CurrentUser('id') userId: string) {
    const following = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const ids = following.map(f => f.followingId);
    return this.prisma.blog.findMany({
      where: { userId: { in: ids }, status: 'published' },
      orderBy: { publishDate: 'desc' },
      take: 30,
      include: BLOG_INCLUDE,
    });
  }
}
