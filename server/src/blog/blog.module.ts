import { Module } from '@nestjs/common';
import { BlogController } from './blog.controller';
import { SitemapController } from './sitemap.controller';
import { RssController } from './rss.controller';
import { ImportController } from './import.controller';
import { BlogService } from './blog.service';
import { BlogCacheService } from './blog.cache.service';

@Module({
  controllers: [BlogController, SitemapController, RssController, ImportController],
  providers: [BlogService, BlogCacheService],
  exports: [BlogCacheService],
})
export class BlogModule {}
