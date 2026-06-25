import 'reflect-metadata';

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { authRateLimit } from './auth/auth-rate-limit.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Behind a reverse proxy in production: honour X-Forwarded-* so client IPs
  // (used by rate limiting) and secure-cookie detection work correctly.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  if (process.env.NODE_ENV === 'production' && !process.env.ALLOWED_ORIGINS) {
    console.warn('[SECURITY] ALLOWED_ORIGINS is not set in production — CORS will be open to all localhost origins');
  }

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:4200', 'http://localhost:3000'];

  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", ...allowedOrigins],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
  }));

  // Brute-force protection on credential endpoints (runs before Better Auth).
  app.use(authRateLimit);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Public, cacheable endpoints set their own Cache-Control; everything else
  // (auth, data reads/writes) stays no-store — the in-memory server cache
  // handles efficiency without risking stale data in browsers/CDNs.
  const CACHEABLE = new Set(['/api/sitemap.xml']);
  app.use((req: any, res: any, next: any) => {
    if (!CACHEABLE.has(req.path)) res.setHeader('Cache-Control', 'no-store');
    next();
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`NestJS server running on http://localhost:${port}`);
}

bootstrap();
