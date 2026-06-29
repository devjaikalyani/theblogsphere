import { Directive, ElementRef, Inject, Input, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { animate, inView, stagger } from 'motion';

/**
 * Reveal-on-scroll, powered by Motion (the framework-agnostic engine behind
 * Framer Motion). Fades + rises the element the first time it scrolls into
 * view — or, with [revealStagger], cascades its direct children.
 *
 * Backwards-compatible: `[appReveal]="120"` still sets a 120ms delay.
 * SSR-safe and fully disabled under prefers-reduced-motion.
 */
@Directive({ selector: '[appReveal]', standalone: true })
export class RevealDirective implements OnInit, OnDestroy {
  /** Delay before the reveal, in ms. */
  @Input('appReveal') delay: number | string = 0;
  /** Vertical travel distance, in px. */
  @Input() revealY = 24;
  /** When > 0, animates the host's direct children with this per-item stagger (seconds). */
  @Input() revealStagger = 0;

  private stop?: () => void;

  constructor(
    private el: ElementRef<HTMLElement>,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    const host = this.el.nativeElement;

    // Respect the user's motion preference — leave everything visible, no animation.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const delaySec = (Number(this.delay) || 0) / 1000;
    const targets: HTMLElement[] =
      this.revealStagger > 0 ? (Array.from(host.children) as HTMLElement[]) : [host];
    if (!targets.length) return;

    for (const t of targets) {
      t.style.opacity = '0';
      t.style.transform = `translateY(${this.revealY}px)`;
      t.style.willChange = 'opacity, transform';
    }

    this.stop = inView(
      host,
      () => {
        animate(
          targets,
          { opacity: [0, 1], y: [this.revealY, 0] },
          {
            duration: 0.7,
            delay:
              this.revealStagger > 0
                ? stagger(this.revealStagger, { startDelay: delaySec })
                : delaySec,
            ease: [0.16, 1, 0.3, 1],
          },
        );
      },
      { margin: '0px 0px -10% 0px' },
    );
  }

  ngOnDestroy() {
    this.stop?.();
  }
}
