import { Controller, Post, Body, Req, Res, Inject } from '@nestjs/common';
import { Response, Request } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/auth.config';
import { PrismaService } from '../prisma/prisma.service';

const REASONS = ['spam', 'harassment', 'copyright', 'illegal', 'misinformation', 'other'];

@Controller('api/reports')
export class ReportController {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  // Optional auth: signed-in reporters are recorded by id; anonymous reporters
  // must leave an email so we can follow up (IT Rules 2021 grievance handling).
  @Post()
  async create(
    @Body() body: { blogId?: number; reason?: string; details?: string; email?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const reason = (body.reason ?? '').trim();
    if (!REASONS.includes(reason)) {
      return res.status(400).json({ error: 'Please choose a valid reason.' });
    }

    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    const reporterId = session?.user?.id ?? null;
    const email = (body.email ?? '').trim();
    if (!reporterId && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email so we can respond.' });
    }

    const details = (body.details ?? '').trim().slice(0, 4000);
    const blogId = Number.isInteger(body.blogId) ? body.blogId! : null;

    await this.prisma.report.create({
      data: {
        blogId,
        reporterId,
        reporterEmail: reporterId ? null : email,
        reason,
        details: details || null,
      },
    });

    return res.json({ ok: true });
  }
}
