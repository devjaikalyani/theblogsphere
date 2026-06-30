import { Controller, Get, Post, Delete, Param, ParseIntPipe, Req, UseGuards, Inject } from '@nestjs/common';
import { Request } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/auth.config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('api/likes')
export class LikeController {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  // Optional auth: anonymous callers still get the public like count, just
  // `liked: false` for their own state.
  @Get('check/:blogId')
  async check(@Param('blogId', ParseIntPipe) blogId: number, @Req() req: Request) {
    const count = await this.prisma.like.count({ where: { blogId } });
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return { liked: false, count };
    const like = await this.prisma.like.findUnique({
      where: { userId_blogId: { userId: session.user.id, blogId } },
    });
    return { liked: !!like, count };
  }

  @Post(':blogId')
  @UseGuards(AuthGuard)
  async like(@Param('blogId', ParseIntPipe) blogId: number, @CurrentUser('id') userId: string) {
    await this.prisma.like.upsert({
      where: { userId_blogId: { userId, blogId } },
      update: {},
      create: { userId, blogId },
    });
    const count = await this.prisma.like.count({ where: { blogId } });
    return { liked: true, count };
  }

  @Delete(':blogId')
  @UseGuards(AuthGuard)
  async unlike(@Param('blogId', ParseIntPipe) blogId: number, @CurrentUser('id') userId: string) {
    await this.prisma.like.deleteMany({ where: { userId, blogId } });
    const count = await this.prisma.like.count({ where: { blogId } });
    return { liked: false, count };
  }
}
