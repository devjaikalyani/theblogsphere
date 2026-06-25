import { Controller, Post, Body, Req, Res, Inject } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/auth.config';
import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/ai')
export class AiController {
  constructor(
    @Inject(AiService) private aiService: AiService,
    @Inject(PrismaService) private prisma: PrismaService,
  ) {}

  // Public by design, but each call spends Groq budget — cap it tighter than
  // the global 30/min limit to blunt anonymous abuse.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('generate')
  async generate(
    @Body() body: { prompt: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!body.prompt) return res.status(400).json({ error: 'Prompt is required' });

    let writingStyle: string | undefined;
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (session) {
      const user = await this.prisma.user.findUnique({
        where: { id: session.user.id },
        select: { writingStyle: true },
      });
      writingStyle = user?.writingStyle ?? undefined;
    }

    await this.aiService.streamBlogContent(body.prompt, res, writingStyle);
  }
}
