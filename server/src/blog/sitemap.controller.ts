import { Controller, Get, Header, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { BlogService } from './blog.service';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Dynamic sitemap. Served at /api/sitemap.xml so it travels over the existing
 * `/api` reverse-proxy rule (no extra proxy config). Point robots.txt and
 * Search Console at https://yourdomain.com/api/sitemap.xml.
 *
 * The base URL comes from BETTER_AUTH_URL (your production origin) or SITE_URL.
 */
@Controller()
export class SitemapController {
  constructor(@Inject(BlogService) private blogService: BlogService) {}

  @Get('api/sitemap.xml')
  @SkipThrottle()
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  async sitemap(): Promise<string> {
    const base = (process.env.BETTER_AUTH_URL || process.env.SITE_URL || 'https://yourdomain.com')
      .replace(/\/+$/, '');

    const staticPaths = ['', '/explore', '/about', '/faq'];
    const blogs = await this.blogService.findAllPublicForSitemap();

    const urls = [
      ...staticPaths.map(
        (p) => `  <url><loc>${escapeXml(base + p)}</loc><changefreq>daily</changefreq></url>`,
      ),
      ...blogs.map((b) => {
        const path = b.slug ? `/blog/${b.slug}` : `/blog/${b.id}`;
        const last = b.updatedAt ?? b.publishDate;
        const lastmod = last ? `<lastmod>${new Date(last).toISOString()}</lastmod>` : '';
        return `  <url><loc>${escapeXml(base + path)}</loc>${lastmod}<changefreq>weekly</changefreq></url>`;
      }),
    ];

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
  }
}
