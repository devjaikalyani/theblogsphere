import { Directive, ElementRef, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

/**
 * Route transition: fades + rises the routed content into view on each
 * client-side navigation. Uses the native Web Animations API (zero bundle
 * cost) since this directive ships in the eager root bundle, Motion is
 * reserved for the lazy-loaded reveal/hover work where its springs and
 * scroll detection actually earn their weight.
 *
 * The first navigation (initial load / hydration) is skipped so server-
 * rendered content isn't re-animated, and it's disabled under
 * prefers-reduced-motion.
 */
@Directive({ selector: '[appPageTransition]', standalone: true })
export class PageTransitionDirective implements OnInit, OnDestroy {
  private sub?: Subscription;
  private first = true;

  constructor(
    private el: ElementRef<HTMLElement>,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof this.el.nativeElement.animate !== 'function') return; // WAAPI unsupported

    this.sub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        if (this.first) {
          this.first = false; // initial load is already painted by SSR
          return;
        }
        this.play();
      });
  }

  private play() {
    this.el.nativeElement.animate(
      [
        { opacity: 0, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 420, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    );
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
