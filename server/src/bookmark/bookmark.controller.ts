import { Controller, Get, Post, Delete, Param, Req, UseGuards, Inject } from '@nestjs/common';
import { Request } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/auth.config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('api/bookmarks')
export class BookmarkController {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  @Get()
  @UseGuards(AuthGuard)
  async list(@CurrentUser('id') userId: string) {
    const bookmarks = await this.prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        blog: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            tags: { include: { tag: true } },
          },
        },
      },
    });
    return bookmarks.map(b => b.blog);
  }

  // Optional auth: anonymous callers simply get `bookmarked: false`.
  @Get('check/:blogId')
  async check(@Param('blogId') blogId: string, @Req() req: Request) {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return { bookmarked: false };
    const bm = await this.prisma.bookmark.findUnique({
      where: { userId_blogId: { userId: session.user.id, blogId: Number(blogId) } },
    });
    return { bookmarked: !!bm };
  }

  @Post(':blogId')
  @UseGuards(AuthGuard)
  async add(@Param('blogId') blogId: string, @CurrentUser('id') userId: string) {
    await this.prisma.bookmark.upsert({
      where: { userId_blogId: { userId, blogId: Number(blogId) } },
      update: {},
      create: { userId, blogId: Number(blogId) },
    });
    return { bookmarked: true };
  }

  @Delete(':blogId')
  @UseGuards(AuthGuard)
  async remove(@Param('blogId') blogId: string, @CurrentUser('id') userId: string) {
    await this.prisma.bookmark.deleteMany({
      where: { userId, blogId: Number(blogId) },
    });
    return { bookmarked: false };
  }
}
