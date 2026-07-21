import { Controller, Get, Post, Body, Param, Req, Res, Inject, ParseIntPipe } from '@nestjs/common';
import { Response, Request } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/auth.config';
import { PrismaService } from '../prisma/prisma.service';

/** Tip amounts are rupees a reader says they sent over UPI. Bounds keep the
 *  self-reported log honest enough to publish: no zero rows, no absurd ones. */
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 50000;

/** The tip proof loop. Tips move directly reader -> writer over UPI, so the
 *  platform never sees the transaction; what it can do is let the reader
 *  confirm one. Optional auth (an anonymous reader's confirmation still
 *  counts), global throttling applies. The aggregate feeds the tip count on
 *  every story and the monthly "writers earned" marketing posts. */
@Controller('api/tips')
export class TipController {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  @Post()
  async confirm(
    @Body() body: { blogId?: number; amount?: number },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const blogId = Number.isInteger(body.blogId) ? (body.blogId as number) : NaN;
    const amount = Math.round(Number(body.amount));
    if (!Number.isInteger(blogId) || !Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
      return res.status(400).json({ error: 'A valid story and tip amount are required.' });
    }

    const blog = await this.prisma.blog.findFirst({
      where: { id: blogId, deletedAt: null },
      select: { userId: true, user: { select: { tippingEnabled: true } } },
    });
    if (!blog || !blog.user?.tippingEnabled) {
      return res.status(404).json({ error: 'This story does not accept tips.' });
    }

    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });

    await this.prisma.tip.create({
      data: {
        blogId,
        writerId: blog.userId,
        reporterId: session?.user?.id ?? null,
        amount,
      },
    });

    const summary = await this.summarize(blogId);
    return res.json({ ok: true, ...summary });
  }

  @Get(':blogId/summary')
  async summary(@Param('blogId', ParseIntPipe) blogId: number) {
    return this.summarize(blogId);
  }

  private async summarize(blogId: number) {
    const agg = await this.prisma.tip.aggregate({
      where: { blogId },
      _count: true,
      _sum: { amount: true },
    });
    return { count: agg._count, total: agg._sum.amount ?? 0 };
  }
}
