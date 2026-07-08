import { Directive, ElementRef, HostListener, Inject, Input, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { animate } from 'motion';

/**
 * Springy hover/press lift, powered by Motion. Gently raises and scales the
 * element on pointer-enter and settles it back on leave, the "soft, gentle
 * hover state" the design system calls for. Keyboard-focus triggers it too.
 * SSR-safe and disabled under prefers-reduced-motion.
 */
@Directive({ selector: '[appHover]', standalone: true })
export class HoverDirective {
  /** Vertical lift on hover, in px. */
  @Input() hoverLift = 6;
  /** Scale on hover. */
  @Input() hoverScale = 1.02;

  private browser = false;
  private reduce = false;

  constructor(
    private el: ElementRef<HTMLElement>,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {
    this.browser = isPlatformBrowser(this.platformId);
    if (this.browser) {
      this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }

  @HostListener('mouseenter')
  @HostListener('focusin')
  lift() {
    if (!this.browser || this.reduce) return;
    animate(
      this.el.nativeElement,
      { y: -this.hoverLift, scale: this.hoverScale },
      { type: 'spring', stiffness: 340, damping: 22 },
    );
  }

  @HostListener('mouseleave')
  @HostListener('focusout')
  settle() {
    if (!this.browser || this.reduce) return;
    animate(
      this.el.nativeElement,
      { y: 0, scale: 1 },
      { type: 'spring', stiffness: 340, damping: 26 },
    );
  }
}
