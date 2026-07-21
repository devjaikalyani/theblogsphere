import { Controller, Post, Headers, Query, Res, Inject } from '@nestjs/common';
import { Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { DigestService } from './digest.service';

/** Cron target for the weekly digest. External scheduling (Railway cron,
 *  cron-job.org, a VPS crontab) POSTs here once a week with the shared secret,
 *  either as an `x-digest-secret` header or a `?secret=` query for schedulers
 *  that cannot set headers. With DIGEST_SECRET unset the endpoint is inert. */
@Controller('api/digest')
export class DigestController {
  constructor(@Inject(DigestService) private digest: DigestService) {}

  @Post('run')
  async run(
    @Headers('x-digest-secret') headerSecret: string | undefined,
    @Query('secret') querySecret: string | undefined,
    @Res() res: Response,
  ) {
    const expected = process.env.DIGEST_SECRET;
    if (!expected) return res.status(404).json({ error: 'Digest is not configured.' });

    const given = headerSecret || querySecret || '';
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await this.digest.run();
    return res.json(result);
  }
}
