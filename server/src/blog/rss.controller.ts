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

/** Plain-text excerpt of stored HTML for the item description. */
function excerpt(html: string, max = 280): string {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}...` : text;
}

/**
 * RSS 2.0 feed of the latest public stories. Served under /api like the
 * sitemap so it travels over the existing reverse-proxy rule. Writers ask for
 * this, feed readers keep readers coming back, and newsletter tools can
 * ingest it, all without any of them touching the API's JSON shape.
 */
@Controller()
export class RssController {
  constructor(@Inject(BlogService) private blogService: BlogService) {}

  @Get('api/rss.xml')
  @SkipThrottle()
  @Header('Content-Type', 'application/rss+xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=900')
  async feed(): Promise<string> {
    const base = (process.env.BETTER_AUTH_URL || process.env.SITE_URL || 'https://yourdomain.com')
      .replace(/\/+$/, '');

    const blogs = await this.blogService.findRecentForRss();

    const items = blogs
      .map((b) => {
        const link = `${base}/blog/${b.slug ?? b.id}`;
        const pub = b.publishDate ? new Date(b.publishDate).toUTCString() : '';
        return [
          '  <item>',
          `    <title>${escapeXml(b.title)}</title>`,
          `    <link>${escapeXml(link)}</link>`,
          `    <guid isPermaLink="true">${escapeXml(link)}</guid>`,
          pub ? `    <pubDate>${pub}</pubDate>` : '',
          `    <dc:creator>${escapeXml(b.author)}</dc:creator>`,
          `    <description>${escapeXml(excerpt(b.content))}</description>`,
          '  </item>',
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n');

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">',
      '<channel>',
      '  <title>TheBlogSphere</title>',
      `  <link>${escapeXml(base)}</link>`,
      '  <description>Long-form writing and the people who read it. Essays, stories and ideas from independent writers.</description>',
      '  <language>en</language>',
      `  <atom:link href="${escapeXml(`${base}/api/rss.xml`)}" rel="self" type="application/rss+xml"/>`,
      items,
      '</channel>',
      '</rss>',
    ].join('\n');
  }
}
