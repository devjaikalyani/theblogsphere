import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import sharp from 'sharp';
import { extractPalette, AmbientPalette } from './palette.util';

/** Palettes are tiny; keep a generous in-process cache so repeat card renders
 *  never re-fetch the image. Evicted FIFO past the cap. */
const CACHE_MAX = 1000;
/** Refuse to pull absurdly large objects into memory for a color read. */
const MAX_BYTES = 15 * 1024 * 1024;

/**
 * GET /api/palette?src=<cover-image-url>
 *
 * Server-side color extraction for the ambient art direction system. Done
 * here rather than in a client canvas because the covers live on the R2
 * public domain (cross-origin: a canvas read would be tainted), and because
 * one extraction can serve every visitor. The URL must point at OUR bucket;
 * anything else is rejected, so this can't be used to probe internal hosts.
 * Responses are immutable (upload keys are unique), so browsers and the CDN
 * cache them forever.
 */
@Controller()
export class PaletteController {
  private cache = new Map<string, AmbientPalette>();

  @Get('api/palette')
  @SkipThrottle()
  async palette(@Query('src') src: string, @Res({ passthrough: true }) res: Response): Promise<AmbientPalette> {
    const base = (process.env.R2_PUBLIC_URL ?? '').replace(/\/+$/, '');
    if (!src || !base || !src.startsWith(`${base}/`)) {
      throw new BadRequestException('src must be a cover image URL on this site.');
    }

    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    const hit = this.cache.get(src);
    if (hit) return hit;

    const imgRes = await fetch(src);
    if (!imgRes.ok) throw new BadRequestException('Cover image could not be read.');
    const len = Number(imgRes.headers.get('content-length') ?? 0);
    if (len > MAX_BYTES) throw new BadRequestException('Cover image is too large.');
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new BadRequestException('Cover image is too large.');

    let palette: AmbientPalette;
    try {
      const { data, info } = await sharp(buf, { failOn: 'none' })
        .resize(48, 48, { fit: 'inside' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      palette = extractPalette(new Uint8Array(data), info.channels);
    } catch {
      throw new BadRequestException('Not a readable image.');
    }

    if (this.cache.size >= CACHE_MAX) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(src, palette);
    return palette;
  }
}
