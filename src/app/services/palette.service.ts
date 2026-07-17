import { Injectable } from '@angular/core';

export interface AmbientPalette {
  accent: string;
  soft: string;
  dominant: string;
  lum: number;
  neutral: boolean;
}

/**
 * Client half of the ambient art direction system: asks the server for a
 * cover image's palette (/api/palette) and memoizes hard. Cover URLs are
 * immutable, so a palette never changes; the server also sends immutable
 * cache headers, making repeat visits free. Failures resolve to null and the
 * caller keeps the site's default clay accent.
 */
@Injectable({ providedIn: 'root' })
export class PaletteService {
  private cache = new Map<string, Promise<AmbientPalette | null>>();

  get(src: string): Promise<AmbientPalette | null> {
    const hit = this.cache.get(src);
    if (hit) return hit;

    const p: Promise<AmbientPalette | null> = fetch(`/api/palette?src=${encodeURIComponent(src)}`)
      .then((res) => (res.ok ? (res.json() as Promise<AmbientPalette>) : null))
      .catch(() => null);
    this.cache.set(src, p);
    return p;
  }
}
