import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';
import { NotifyService } from './notify.service';

/** Fan-out cap, same reasoning as the publish notifications: one run can never
 *  trigger an unbounded email burst. Raise alongside a queue, not before. */
const MAX_RECIPIENTS = 5000;
const STORIES_IN_DIGEST = 5;

/** The weekly "best of TheBlogSphere" digest: the reader-retention loop that
 *  works before the follow graph is dense enough to do the job. Triggered by
 *  an external weekly cron hitting the digest endpoint (there is no in-process
 *  scheduler on purpose: a single-instance restart-prone process is the wrong
 *  place for one). */
@Injectable()
export class DigestService {
  /** In-memory re-run guard so a double-fired cron doesn't double-mail. Resets
   *  on deploy, which is fine: the window it protects is hours, not weeks. */
  private lastRunAt = 0;

  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(MailService) private mail: MailService,
    @Inject(NotifyService) private notify: NotifyService,
  ) {}

  private siteUrl(): string {
    return (process.env.BETTER_AUTH_URL || process.env.SITE_URL || 'http://localhost:4200')
      .trim()
      .replace(/\/+$/, '');
  }

  async run(): Promise<{ sent: number; stories: number; skipped?: string }> {
    if (!this.mail.enabled) return { sent: 0, stories: 0, skipped: 'mail disabled (RESEND_API_KEY unset)' };

    const now = Date.now();
    if (now - this.lastRunAt < 20 * 60 * 60 * 1000) {
      return { sent: 0, stories: 0, skipped: 'already ran in the last 20 hours' };
    }

    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const candidates = await this.prisma.blog.findMany({
      where: { status: 'published', visibility: 'public', deletedAt: null, publishDate: { gte: weekAgo } },
      select: {
        id: true, slug: true, title: true, author: true, views: true,
        _count: { select: { likes: true, comments: true, bookmarks: true } },
      },
      orderBy: { views: 'desc' },
      take: 100,
    });

    // Same engagement weighting as the trending rail; no recency decay needed
    // inside a one-week window.
    const top = candidates
      .map((b) => ({ ...b, score: b.views + b._count.likes * 5 + b._count.comments * 4 + b._count.bookmarks * 6 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, STORIES_IN_DIGEST);

    // A digest with one story reads as an empty room; skip until there is a week
    // worth showing.
    if (top.length < 2) return { sent: 0, stories: top.length, skipped: 'fewer than 2 stories this week' };

    const recipients = await this.prisma.user.findMany({
      where: { notifyWeeklyDigest: true, email: { not: '' } },
      select: { id: true, email: true, firstName: true },
      take: MAX_RECIPIENTS,
    });
    if (!recipients.length) return { sent: 0, stories: top.length, skipped: 'no recipients' };

    const base = this.siteUrl();
    const list = top
      .map((b, i) => `${i + 1}. ${b.title}\n   by ${b.author}\n   ${base}/blog/${b.slug ?? b.id}`)
      .join('\n\n');

    const messages = recipients.map((u) => ({
      to: u.email,
      subject: 'The five most-read stories on TheBlogSphere this week',
      text:
        `Hi ${u.firstName || 'there'},\n\n` +
        `The stories readers spent the most time with this week:\n\n` +
        `${list}\n\n` +
        `Every story can also be listened to as audio, and you can tip a writer\n` +
        `directly over UPI. They keep all of it.\n\n` +
        `Happy reading,\nTheBlogSphere\n\n` +
        `--\n` +
        `You get this weekly digest because you have a TheBlogSphere account.\n` +
        `Stop these emails:\n` +
        `${base}/api/notifications/unsubscribe?u=${encodeURIComponent(u.id)}&t=${this.notify.digestUnsubscribeToken(u.id)}&k=digest`,
    }));

    this.lastRunAt = now;
    const sent = await this.mail.sendBatch(messages);
    console.log(`[DIGEST] sent ${sent}/${recipients.length} digests covering ${top.length} stories`);
    return { sent, stories: top.length };
  }
}
