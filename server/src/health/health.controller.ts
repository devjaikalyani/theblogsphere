import { Controller, Get, Inject, Res } from '@nestjs/common';
import { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Liveness/readiness probe for load balancers, uptime monitors and container
 * orchestrators. Returns 200 when the DB is reachable, 503 otherwise.
 */
@Controller('api')
export class HealthController {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  @Get('health')
  @SkipThrottle()
  async health(@Res() res: Response) {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return res.status(200).json({
        status: 'ok',
        db: 'up',
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      });
    } catch {
      return res.status(503).json({ status: 'error', db: 'down' });
    }
  }
}
