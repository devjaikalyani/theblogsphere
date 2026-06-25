import { Controller, Get, UseGuards, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('api/analytics')
export class AnalyticsController {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  @Get('my')
  @UseGuards(AuthGuard)
  async myAnalytics(@CurrentUser() user: any) {
    const blogs = await this.prisma.blog.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        title: true,
        views: true,
        status: true,
        publishDate: true,
        createdAt: true,
        _count: { select: { comments: true, bookmarks: true } },
      },
      orderBy: { views: 'desc' },
    });

    const published = blogs.filter(b => b.status === 'published');
    const totalViews = blogs.reduce((s, b) => s + b.views, 0);
    const totalComments = blogs.reduce((s, b) => s + b._count.comments, 0);
    const totalBookmarks = blogs.reduce((s, b) => s + b._count.bookmarks, 0);

    // Monthly views bucketed by publish month (last 6 months)
    const now = new Date();
    const months: { label: string; views: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const views = published
        .filter(b => {
          const pd = b.publishDate ? new Date(b.publishDate) : null;
          return pd && pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth();
        })
        .reduce((s, b) => s + b.views, 0);
      months.push({ label, views });
    }

    return {
      totalViews,
      totalComments,
      totalBookmarks,
      publishedCount: published.length,
      draftCount: blogs.length - published.length,
      topPosts: published.slice(0, 5).map(b => ({
        id: b.id,
        title: b.title,
        views: b.views,
        comments: b._count.comments,
        bookmarks: b._count.bookmarks,
        publishDate: b.publishDate,
      })),
      monthlyViews: months,
    };
  }
}
