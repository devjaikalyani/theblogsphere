import { Controller, Get, Query, Res, Inject } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { NotifyService } from './notify.service';

/** One-click unsubscribe target for notification emails. GET (not POST) on
 *  purpose: it must work from a plain link in any mail client, with no login.
 *  The HMAC token scopes the action to exactly one user, so the worst a
 *  forged/replayed link can do is turn the same user's emails off again. */
@Controller('api/notifications')
export class NotificationController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(NotifyService) private notify: NotifyService,
  ) {}

  @Get('unsubscribe')
  async unsubscribe(
    @Query('u') userId: string,
    @Query('t') token: string,
    @Query('k') kind: string | undefined,
    @Res() res: Response,
  ) {
    const page = (title: string, body: string) =>
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>` +
      `<body style="font-family: Georgia, serif; background:#FAF8F3; color:#1A1714; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0;">` +
      `<div style="max-width:26rem; padding:2rem; text-align:center;"><h1 style="font-size:1.4rem; margin-bottom:0.75rem;">${title}</h1>` +
      `<p style="color:#555; line-height:1.6;">${body}</p></div></body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    // `k` selects which email stream the link turns off; each stream's token
    // has its own HMAC scope so links cannot be repurposed across streams.
    const isDigest = kind === 'digest';
    const valid = isDigest
      ? this.notify.verifyDigestUnsubscribeToken(userId ?? '', token ?? '')
      : this.notify.verifyUnsubscribeToken(userId ?? '', token ?? '');
    if (!userId || !token || !valid) {
      return res.status(400).send(page('Link not valid', 'This unsubscribe link is incomplete or expired. You can also turn off notifications in Settings on TheBlogSphere.'));
    }

    await this.prisma.user.updateMany({
      where: { id: userId },
      data: isDigest ? { notifyWeeklyDigest: false } : { notifyFollowedPosts: false },
    });

    return res.send(page("You're unsubscribed", isDigest
      ? 'You will no longer get the weekly digest. You can turn it back on any time in Settings.'
      : 'You will no longer get an email when writers you follow publish. You can turn these back on any time in Settings.'));
  }
}
