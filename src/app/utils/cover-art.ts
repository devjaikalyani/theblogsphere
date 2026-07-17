/**
 * Deterministic art direction for stories WITHOUT a cover image, shared by the
 * generative cover (the SVG art itself) and the ambient directive (so the
 * card's glow matches the art). The same story always gets the same palette
 * and composition, on every device, with zero network calls.
 */

export interface ArtPalette {
  /** Dark ground the art sits on. */
  deep: string;
  /** Primary orb color. */
  mid: string;
  /** Luminous highlight color (orbs, rings, ghost letter). */
  glow: string;
  /** Contrast-safe accent handed to the ambient system (reads on paper). */
  accent: string;
  /** Livelier sibling of the accent for gradients. */
  soft: string;
}

/** Eight curated duotones tuned to sit beside the warm-paper editorial system.
 *  Every `accent` is dark enough for AA text on the paper background. */
export const ART_PALETTES: ArtPalette[] = [
  { deep: '#3B1D12', mid: '#A8472E', glow: '#E8B29A', accent: '#8C3A26', soft: '#C15C3D' }, // terracotta
  { deep: '#20263E', mid: '#4B5885', glow: '#A9B4DC', accent: '#3E4A78', soft: '#6572A5' }, // indigo dusk
  { deep: '#252F1D', mid: '#5C7440', glow: '#B9C98F', accent: '#48602F', soft: '#6C8348' }, // moss
  { deep: '#4A320E', mid: '#A6771F', glow: '#EACC84', accent: '#7D5A0F', soft: '#B98A2E' }, // ochre
  { deep: '#3A141B', mid: '#8A3242', glow: '#D998A4', accent: '#6E2733', soft: '#96434F' }, // oxblood
  { deep: '#122E30', mid: '#2F686B', glow: '#8FC3C5', accent: '#235052', soft: '#3A7376' }, // deep teal
  { deep: '#2F1B32', mid: '#6C4673', glow: '#C29FC8', accent: '#573959', soft: '#7D5583' }, // plum
  { deep: '#1F2830', mid: '#4A5D73', glow: '#A2B6CB', accent: '#3C4C5F', soft: '#5E7188' }, // slate
];

export interface CoverArt {
  palette: ArtPalette;
  /** Orb centers/radii in a 400x260 viewBox. */
  orbs: Array<{ x: number; y: number; r: number; color: 'mid' | 'glow' | 'soft'; o: number }>;
  /** Concentric ring center. */
  rings: { x: number; y: number };
  /** Ghost letterform: the story's initial. */
  initial: { char: string; x: number; y: number; size: number };
}

/** djb2: tiny, stable, good spread for short strings. */
export function hashSeed(seed: string | number, title = ''): number {
  const s = `${seed}::${title}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Map a hash into art parameters. Pure and total: any seed yields art. */
export function artFor(seed: string | number, title = ''): CoverArt {
  const h = hashSeed(seed, title);
  const pick = (n: number, mod: number) => Math.floor((h / Math.pow(7, n)) % mod);

  const palette = ART_PALETTES[h % ART_PALETTES.length];
  const left = pick(1, 2) === 0;

  const x1 = left ? 70 + pick(2, 60) : 270 + pick(2, 60);
  const y1 = 40 + pick(3, 120);
  const x2 = left ? 250 + pick(4, 110) : 20 + pick(4, 110);
  const y2 = 140 + pick(5, 100);
  const x3 = 120 + pick(6, 160);
  const y3 = pick(7, 80);

  const letterSource = (title || String(seed)).trim();
  const char = (letterSource.charAt(0) || 'B').toUpperCase();

  return {
    palette,
    orbs: [
      { x: x1, y: y1, r: 130 + pick(8, 40), color: 'mid', o: 0.95 },
      { x: x2, y: y2, r: 95 + pick(9, 35), color: 'glow', o: 0.7 },
      { x: x3, y: y3, r: 70 + pick(10, 30), color: 'soft', o: 0.55 },
    ],
    rings: { x: left ? 320 : 80, y: 65 + pick(11, 110) },
    initial: {
      char,
      x: left ? 268 : 132,
      y: 208,
      size: 190 + pick(12, 50),
    },
  };
}

/** hex -> rgba() string, for the tint variables the ambient system sets. */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
