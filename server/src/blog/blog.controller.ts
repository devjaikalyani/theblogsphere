import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Res, UseGuards,
  ParseIntPipe, HttpCode, HttpStatus, Inject,
} from '@nestjs/common';
import { Response } from 'express';
import { BlogService } from './blog.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('api/blogs')
export class BlogController {
  constructor(@Inject(BlogService) private blogService: BlogService) {}

  @Get()
  async getBlogs(
    @Query('page') page = '1',
    @Query('q') q?: string,
    @Query('tag') tag?: string,
  ) {
    return this.blogService.findPaginated(parseInt(page), q, tag);
  }

  @Get('my')
  @UseGuards(AuthGuard)
  async getMyBlogs(@CurrentUser('id') userId: string) {
    return this.blogService.findByUser(userId);
  }

  @Get('tags')
  async getTags() {
    return this.blogService.getTags();
  }

  // Must be declared before the ':idOrSlug' catch-all, or it would be matched
  // as a story lookup with id="trending".
  @Get('trending')
  async getTrending() {
    return this.blogService.findTrending();
  }

  @Get(':id/related')
  async getRelated(@Param('id', ParseIntPipe) id: number) {
    return this.blogService.findRelated(id);
  }

  @Get(':idOrSlug')
  async getBlog(@Param('idOrSlug') idOrSlug: string) {
    return this.blogService.findBySlugOrId(idOrSlug);
  }

  @Post()
  @UseGuards(AuthGuard)
  async createBlog(
    @Body() body: CreateBlogDto,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    try {
      const author = (`${user.firstName ?? ''} ${user.lastName ?? ''}`).trim() || user.name;
      const blog = await this.blogService.create({
        title: body.title,
        content: body.content,
        userId: user.id,
        author,
        status: body.status ?? 'published',
        tags: body.tags ?? [],
        coverImage: body.coverImage,
      });
      return res.status(201).json(blog);
    } catch (e: any) {
      console.error('[POST /blogs] error:', e?.message ?? e);
      return res.status(500).json({ error: e?.message ?? 'Failed to publish story.' });
    }
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  async updateBlog(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateBlogDto,
    @CurrentUser('id') userId: string,
    @Res() res: Response,
  ) {
    try {
      const blog = await this.blogService.update(id, userId, body);
      return res.json(blog);
    } catch (e: any) {
      console.error('[PATCH /blogs/:id] error:', e?.message ?? e);
      const status = e?.message === 'Not found or unauthorized' ? 403 : 500;
      return res.status(status).json({ error: e?.message ?? 'Failed to update story.' });
    }
  }

  @Post(':id/view')
  @HttpCode(HttpStatus.OK)
  async incrementView(@Param('id', ParseIntPipe) id: number) {
    await this.blogService.incrementViews(id);
    return { ok: true };
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBlog(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: string,
    @Res() res: Response,
  ) {
    try {
      await this.blogService.delete(id, userId);
      return res.status(204).send();
    } catch (e: any) {
      console.error('[DELETE /blogs/:id] error:', e?.message ?? e);
      return res.status(500).json({ error: 'Failed to delete story.' });
    }
  }
}
