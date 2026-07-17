import { Component, Input, OnChanges, signal } from '@angular/core';
import { artFor, CoverArt } from '../../utils/cover-art';

/**
 * Generative cover art for stories published without an image, so no card or
 * article ever opens on a blank rectangle. Deterministic: the story's id and
 * title hash into one of eight curated editorial duotones and a composition
 * of soft light orbs, fine contour rings, film grain, and the story's initial
 * as a ghost letterform. Pure inline SVG: no requests, renders identically
 * under SSR, and stays crisp at any size.
 */
@Component({
  selector: 'app-gen-cover',
  standalone: true,
  host: { class: 'block overflow-hidden', 'aria-hidden': 'true' },
  template: `
    <svg class="w-full h-full block" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" role="img">
      <defs>
        <filter [attr.id]="uid() + '-blur'" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="42"/>
        </filter>
        <filter [attr.id]="uid() + '-grain'">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/>
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.28 0"/>
        </filter>
      </defs>

      <rect width="400" height="260" [attr.fill]="art().palette.deep"/>

      <g [attr.filter]="'url(#' + uid() + '-blur)'">
        @for (orb of art().orbs; track $index) {
          <circle [attr.cx]="orb.x" [attr.cy]="orb.y" [attr.r]="orb.r"
                  [attr.fill]="orbColor(orb.color)" [attr.opacity]="orb.o"/>
        }
      </g>

      <!-- Fine contour rings, the cartographic gesture -->
      <g fill="none" [attr.stroke]="art().palette.glow" stroke-width="0.75">
        @for (r of ringRadii; track r) {
          <circle [attr.cx]="art().rings.x" [attr.cy]="art().rings.y" [attr.r]="r" stroke-opacity="0.16"/>
        }
      </g>

      <!-- Ghost letterform: the story's initial, set in the display serif -->
      <text [attr.x]="art().initial.x" [attr.y]="art().initial.y"
            [attr.font-size]="art().initial.size"
            [attr.fill]="art().palette.glow"
            font-family="Fraunces, Georgia, serif" font-style="italic" font-weight="600"
            text-anchor="middle" opacity="0.17">{{ art().initial.char }}</text>

      <!-- Hairline plate edge + film grain -->
      <rect x="6" y="6" width="388" height="248" fill="none"
            [attr.stroke]="art().palette.glow" stroke-opacity="0.22" stroke-width="0.75"/>
      <rect width="400" height="260" [attr.filter]="'url(#' + uid() + '-grain)'" opacity="0.5"/>
    </svg>
  `,
})
export class GenCoverComponent implements OnChanges {
  @Input({ required: true }) seed!: string | number;
  @Input() title = '';

  readonly ringRadii = [26, 44, 62, 80];
  art = signal<CoverArt>(artFor('b', ''));
  uid = signal('gc0');

  ngOnChanges(): void {
    this.art.set(artFor(this.seed, this.title));
    // Filter ids must be unique per instance or one card's <defs> would
    // shadow every other card's on the same page.
    this.uid.set(`gc${Math.abs(this.hashCode(`${this.seed}${this.title}`))}`);
  }

  orbColor(kind: 'mid' | 'glow' | 'soft'): string {
    const p = this.art().palette;
    return kind === 'mid' ? p.mid : kind === 'glow' ? p.glow : p.soft;
  }

  private hashCode(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  }
}
