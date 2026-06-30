import { Module } from '@nestjs/common';
import { BlogController } from './blog.controller';
import { SitemapController } from './sitemap.controller';
import { BlogService } from './blog.service';
import { BlogCacheService } from './blog.cache.service';

@Module({
  controllers: [BlogController, SitemapController],
  providers: [BlogService, BlogCacheService],
  exports: [BlogCacheService],
})
export class BlogModule {}
