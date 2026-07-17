/**
 * Cover-image palette math for the ambient art direction system. The client
 * asks /api/palette for a story cover's colors and re-tunes the page's clay
 * accent to that story: cards glow in the cover's key color, the article page
 * washes its header in it, and every accent (drop caps, section numerals,
 * progress bars) follows. Pure functions, no I/O, unit-tested directly.
 */

export interface AmbientPalette {
  /** Deep, contrast-safe version of the image's key color. Meant to REPLACE
   *  the clay accent for text-adjacent uses, so lightness is clamped low
   *  enough to read on the warm paper background. */
  accent: string;
  /** Livelier mid-lightness sibling of the accent, for gradients and hovers. */
  soft: string;
  /** The image's overall (most frequent) color, for background washes. */
  dominant: string;
  /** Mean luminance of the image, 0..1. Lets the client pick scrim strength. */
  lum: number;
  /** True when the image is effectively colorless (grayscale, near-mono).
   *  The client keeps the site's own clay accent in that case. */
  neutral: boolean;
}

interface Hsl { h: number; s: number; l: number }

export function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

export function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Reduce raw RGB pixels (from a small sharp resize) to an ambient palette.
 * Colors are binned into a coarse 4-bit-per-channel histogram; the dominant
 * bucket gives the wash color, and the accent is the bucket that best balances
 * frequency with saturation, so a mostly-gray photo with one red umbrella
 * still keys on the umbrella.
 */
export function extractPalette(pixels: Uint8Array, channels = 3): AmbientPalette {
  type Bucket = { n: number; r: number; g: number; b: number };
  const buckets = new Map<number, Bucket>();
  let lumSum = 0;
  let count = 0;

  for (let i = 0; i + channels <= pixels.length; i += channels) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    lumSum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    count++;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bkt = buckets.get(key);
    if (bkt) { bkt.n++; bkt.r += r; bkt.g += g; bkt.b += b; }
    else buckets.set(key, { n: 1, r, g, b });
  }
  if (!count) return { accent: '#A8472E', soft: '#C15C3D', dominant: '#8A8378', lum: 0.5, neutral: true };

  let dominant: Bucket | null = null;
  let best: Bucket | null = null;
  let bestScore = -1;
  for (const bkt of buckets.values()) {
    if (!dominant || bkt.n > dominant.n) dominant = bkt;
    const { s, l } = rgbToHsl(bkt.r / bkt.n, bkt.g / bkt.n, bkt.b / bkt.n);
    // Accent candidates: chromatic, not blown out, not near-black.
    if (l < 0.12 || l > 0.88 || s < 0.14) continue;
    const score = bkt.n * (0.15 + Math.pow(s, 1.2));
    if (score > bestScore) { bestScore = score; best = bkt; }
  }

  const dom = dominant!;
  const domHsl = rgbToHsl(dom.r / dom.n, dom.g / dom.n, dom.b / dom.n);
  const lum = lumSum / count;

  if (!best) {
    // Colorless image: report the dominant tone for washes, flag neutral so
    // the client keeps the site's own accent.
    return {
      accent: '#A8472E',
      soft: '#C15C3D',
      dominant: hslToHex(domHsl.h, clamp(domHsl.s, 0, 0.08), clamp(domHsl.l, 0.2, 0.85)),
      lum,
      neutral: true,
    };
  }

  const { h, s } = rgbToHsl(best.r / best.n, best.g / best.n, best.b / best.n);
  // Deep accent: dark enough to read on paper, desaturated off neon.
  const accent = hslToHex(h, clamp(s, 0.25, 0.62), clamp(rgbToHsl(best.r / best.n, best.g / best.n, best.b / best.n).l, 0.28, 0.4));
  const soft = hslToHex(h, clamp(s, 0.3, 0.68), 0.55);
  const dominantHex = hslToHex(domHsl.h, clamp(domHsl.s, 0, 0.6), clamp(domHsl.l, 0.2, 0.85));

  return { accent, soft, dominant: dominantHex, lum, neutral: false };
}
