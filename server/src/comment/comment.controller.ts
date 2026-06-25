import {
  Controller, Get, Post, Delete, Param, Body, UseGuards, Inject,
  BadRequestException, HttpCode, HttpStatus,
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
  async list(@Param('blogId') blogId: string) {
    return this.prisma.comment.findMany({
      where: { blogId: Number(blogId) },
      orderBy: { createdAt: 'desc' },
      include: COMMENT_AUTHOR,
    });
  }

  @Post('blogs/:blogId/comments')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('blogId') blogId: string,
    @Body() body: { content: string },
    @CurrentUser('id') userId: string,
  ) {
    if (!body.content?.trim()) throw new BadRequestException('Content is required');
    return this.prisma.comment.create({
      data: {
        content: body.content.trim().slice(0, 1000),
        userId,
        blogId: Number(blogId),
      },
      include: COMMENT_AUTHOR,
    });
  }

  @Delete('comments/:id')
  @UseGuards(AuthGuard)
  async remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    await this.prisma.comment.deleteMany({
      where: { id: Number(id), userId },
    });
    return { deleted: true };
  }
}
