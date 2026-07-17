import { describe, it, expect } from 'vitest';
import { extractPalette, rgbToHsl, hslToHex } from './palette.util';

/** Build a fake raw-RGB pixel buffer from [r,g,b,count] runs. */
function pixels(runs: Array<[number, number, number, number]>): Uint8Array {
  const total = runs.reduce((n, [, , , c]) => n + c, 0);
  const out = new Uint8Array(total * 3);
  let i = 0;
  for (const [r, g, b, c] of runs) {
    for (let k = 0; k < c; k++) { out[i++] = r; out[i++] = g; out[i++] = b; }
  }
  return out;
}

describe('palette extraction', () => {
  it('round-trips color conversion sanely', () => {
    const { h, s, l } = rgbToHsl(168, 71, 46); // the site clay
    expect(hslToHex(h, s, l)).toBe('#a8472e');
  });

  it('keys on the saturated minority color, not the gray majority', () => {
    // A gray photo with a red umbrella: 90% gray, 10% strong red.
    const p = extractPalette(pixels([
      [128, 128, 128, 900],
      [200, 40, 40, 100],
    ]));
    expect(p.neutral).toBe(false);
    const { h } = rgbToHsl(
      parseInt(p.accent.slice(1, 3), 16),
      parseInt(p.accent.slice(3, 5), 16),
      parseInt(p.accent.slice(5, 7), 16),
    );
    // Accent hue stays in the red band.
    expect(h < 0.06 || h > 0.94).toBe(true);
  });

  it('clamps the accent dark enough to read on paper', () => {
    // A blown-out pastel image must still yield a deep accent.
    const p = extractPalette(pixels([[255, 200, 190, 1000]]));
    if (!p.neutral) {
      const l = rgbToHsl(
        parseInt(p.accent.slice(1, 3), 16),
        parseInt(p.accent.slice(3, 5), 16),
        parseInt(p.accent.slice(5, 7), 16),
      ).l;
      expect(l).toBeLessThanOrEqual(0.41);
    }
  });

  it('flags grayscale images as neutral so the site accent is kept', () => {
    const p = extractPalette(pixels([
      [40, 40, 40, 300],
      [128, 128, 128, 400],
      [220, 220, 220, 300],
    ]));
    expect(p.neutral).toBe(true);
    expect(p.accent).toBe('#A8472E');
  });

  it('reports luminance for scrim strength decisions', () => {
    const dark = extractPalette(pixels([[10, 10, 10, 100]]));
    const light = extractPalette(pixels([[245, 245, 245, 100]]));
    expect(dark.lum).toBeLessThan(0.1);
    expect(light.lum).toBeGreaterThan(0.9);
  });

  it('survives an empty buffer', () => {
    const p = extractPalette(new Uint8Array(0));
    expect(p.neutral).toBe(true);
  });
});
