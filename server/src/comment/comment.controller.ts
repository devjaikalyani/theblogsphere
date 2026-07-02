import {
  Controller, Get, Post, Delete, Param, Body, UseGuards, Inject,
  BadRequestException, NotFoundException, HttpCode, HttpStatus, ParseIntPipe,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

const COMMENT_AUTHOR = {
  user: { select: { id: true, firstName: true, lastName: true, profilePicture: true } },
};

@Controller('api')
export class CommentController {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  @Get('blogs/:blogId/comments')
  async list(@Param('blogId', ParseIntPipe) blogId: number) {
    return this.prisma.comment.findMany({
      where: { blogId },
      orderBy: { createdAt: 'desc' },
      include: COMMENT_AUTHOR,
    });
  }

  @Post('blogs/:blogId/comments')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('blogId', ParseIntPipe) blogId: number,
    @Body() body: { content: string },
    @CurrentUser('id') userId: string,
  ) {
    if (!body.content?.trim()) throw new BadRequestException('Content is required');
    // 404 for a missing/deleted story instead of bubbling an FK violation as 500.
    const blog = await this.prisma.blog.findFirst({ where: { id: blogId, deletedAt: null }, select: { id: true } });
    if (!blog) throw new NotFoundException('Story not found.');
    return this.prisma.comment.create({
      data: {
        content: body.content.trim().slice(0, 1000),
        userId,
        blogId,
      },
      include: COMMENT_AUTHOR,
    });
  }

  @Delete('comments/:id')
  @UseGuards(AuthGuard)
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: string) {
    await this.prisma.comment.deleteMany({
      where: { id, userId },
    });
    return { deleted: true };
  }
}
