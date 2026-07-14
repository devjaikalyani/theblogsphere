import { Injectable, Inject } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';

/** Cap a single publish fan-out so one post can never trigger an unbounded
 *  email run. Revisit alongside a queue if any writer approaches this. */
const MAX_RECIPIENTS = 2000;

/** "A writer you follow just published" notifications. This is the platform's
 *  retention loop: without it every reader visit is a re-acquisition. Called
 *  fire-and-forget from the blog service on FIRST publish only, so edits and
 *  re-publishes never re-mail followers. */
@Injectable()
export class NotifyService {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(MailService) private mail: MailService,
  ) {}

  private siteUrl(): string {
    return (process.env.BETTER_AUTH_URL || process.env.SITE_URL || 'http://localhost:4200')
      .trim()
      .replace(/\/+$/, '');
  }

  private secret(): string {
    return process.env.BETTER_AUTH_SECRET || process.env.SESSION_SECRET || 'dev-secret';
  }

  /** Signed unsubscribe token: HMAC(userId). Lets the email carry a one-click
   *  opt-out link that needs no login and cannot be forged for another user. */
  unsubscribeToken(userId: string): string {
    return createHmac('sha256', this.secret()).update(`unsub:${userId}`).digest('hex');
  }

  verifyUnsubscribeToken(userId: string, token: string): boolean {
    const expected = Buffer.from(this.unsubscribeToken(userId), 'hex');
    let given: Buffer;
    try {
      given = Buffer.from(token, 'hex');
    } catch {
      return false;
    }
    return given.length === expected.length && timingSafeEqual(expected, given);
  }

  async postPublished(blog: { id: number; slug?: string | null; title: string; author: string; userId: string }) {
    if (!this.mail.enabled) return;

    const follows = await this.prisma.follow.findMany({
      where: { followingId: blog.userId },
      take: MAX_RECIPIENTS,
      select: {
        follower: {
          select: { id: true, email: true, firstName: true, notifyFollowedPosts: true },
        },
      },
    });
    const recipients = follows
      .map((f) => f.follower)
      .filter((u) => u.notifyFollowedPosts && u.email);
    if (!recipients.length) return;

    const base = this.siteUrl();
    const storyUrl = `${base}/blog/${blog.slug ?? blog.id}`;
    const messages = recipients.map((u) => ({
      to: u.email,
      subject: `${blog.author} published "${blog.title}"`,
      text:
        `Hi ${u.firstName || 'there'},\n\n` +
        `${blog.author}, a writer you follow on TheBlogSphere, just published a new story:\n\n` +
        `${blog.title}\n${storyUrl}\n\n` +
        `Happy reading.\n\n` +
        `--\n` +
        `You get this because you follow ${blog.author}. Stop these emails:\n` +
        `${base}/api/notifications/unsubscribe?u=${encodeURIComponent(u.id)}&t=${this.unsubscribeToken(u.id)}`,
    }));

    const sent = await this.mail.sendBatch(messages);
    console.log(`[NOTIFY] blog ${blog.id}: notified ${sent}/${recipients.length} followers`);
  }
}
