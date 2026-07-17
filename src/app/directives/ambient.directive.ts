import { Directive, ElementRef, Input, OnChanges, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PaletteService } from '../services/palette.service';
import { artFor, hexToRgba } from '../utils/cover-art';

/**
 * Ambient art direction: gives the host element a color identity derived from
 * the story it represents. With a cover image, the accent comes from the
 * image itself (via /api/palette); without one, from the same curated palette
 * the generative cover draws with, so card and art always agree.
 *
 * The directive sets `--amb*` custom properties inline and then adds the
 * `amb-on` class. Inside an `.amb-scope.amb-on` element the stylesheet remaps
 * the site's clay tokens to these values, so every existing accent (drop
 * caps, section numerals, progress bars, chips, hovers) re-tunes to the story
 * with no per-component styling. Browser-only: on the server the page renders
 * with the default clay and the color arrives as a progressive enhancement.
 */
@Directive({
  selector: '[appAmbient]',
  standalone: true,
})
export class AmbientDirective implements OnChanges {
  /** Cover image URL. Optional; falls back to seed-derived art palette. */
  @Input('appAmbient') src: string | null | undefined;
  /** Stable story identifier for the no-image fallback palette. */
  @Input() ambSeed: string | number | null | undefined;
  /** Story title; folded into the fallback hash for better spread. */
  @Input() ambTitle: string | undefined;

  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private palettes = inject(PaletteService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  /** Guards against a slow palette response landing after inputs changed. */
  private epoch = 0;

  ngOnChanges(): void {
    if (!this.isBrowser) return;
    const epoch = ++this.epoch;

    if (this.src) {
      this.palettes.get(this.src).then((p) => {
        if (epoch !== this.epoch) return;
        if (p && !p.neutral) this.apply(p.accent, p.soft);
        // Neutral/unreadable image: keep the site's own clay accent.
      });
      return;
    }

    if (this.ambSeed !== null && this.ambSeed !== undefined) {
      const { palette } = artFor(this.ambSeed, this.ambTitle ?? '');
      this.apply(palette.accent, palette.soft);
    }
  }

  private apply(accent: string, soft: string): void {
    const style = this.el.nativeElement.style;
    style.setProperty('--amb', accent);
    style.setProperty('--amb-soft', soft);
    style.setProperty('--amb-tint', hexToRgba(accent, 0.07));
    style.setProperty('--amb-tint-2', hexToRgba(accent, 0.14));
    style.setProperty('--amb-glow', hexToRgba(accent, 0.2));
    this.el.nativeElement.classList.add('amb-on');
  }
}
