import { Controller, Get, UseGuards, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { BillingService } from '../billing/billing.service';

@Controller('api/analytics')
export class AnalyticsController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(BillingService) private billing: BillingService,
  ) {}

  @Get('my')
  @UseGuards(AuthGuard)
  async myAnalytics(@CurrentUser() user: any) {
    const [plan, blogs] = await Promise.all([
      this.billing.currentPlan(user.id),
      this.prisma.blog.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          title: true,
          views: true,
          status: true,
          publishDate: true,
          createdAt: true,
          _count: { select: { comments: true, bookmarks: true, likes: true } },
        },
        orderBy: { views: 'desc' },
      }),
    ]);

    // Both paid tiers (Writer and Pro) get the deeper insights + full year of
    // history; only the narration budget separates them.
    const isPaid = this.billing.isPaid(plan);
    const published = blogs.filter(b => b.status === 'published');
    const totalViews = blogs.reduce((s, b) => s + b.views, 0);
    const totalComments = blogs.reduce((s, b) => s + b._count.comments, 0);
    const totalBookmarks = blogs.reduce((s, b) => s + b._count.bookmarks, 0);
    const totalLikes = blogs.reduce((s, b) => s + b._count.likes, 0);

    // Monthly views bucketed by publish month. Pro gets a full year of history;
    // free sees the last 6 months.
    const now = new Date();
    const monthsToShow = isPaid ? 12 : 6;
    const months: { label: string; views: number }[] = [];
    for (let i = monthsToShow - 1; i >= 0; i--) {
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

    // Premium-only deeper insights.
    let premium: {
      followers: number;
      interactions: number;
      engagementRate: number;
    } | null = null;
    if (isPaid) {
      const followers = await this.prisma.follow.count({ where: { followingId: user.id } });
      const interactions = totalLikes + totalComments + totalBookmarks;
      premium = {
        followers,
        interactions,
        engagementRate: totalViews > 0 ? interactions / totalViews : 0,
      };
    }

    return {
      pro: isPaid, // client shows premium insights when true (any paid tier)
      totalViews,
      totalComments,
      totalBookmarks,
      totalLikes,
      publishedCount: published.length,
      draftCount: blogs.length - published.length,
      topPosts: published.slice(0, 5).map(b => ({
        id: b.id,
        title: b.title,
        views: b.views,
        comments: b._count.comments,
        bookmarks: b._count.bookmarks,
        likes: b._count.likes,
        publishDate: b.publishDate,
      })),
      monthlyViews: months,
      premium,
    };
  }
}
