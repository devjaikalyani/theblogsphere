import { Directive, ElementRef, Inject, Input, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Directive({ selector: '[appCounter]', standalone: true })
export class CounterDirective implements OnInit {
  @Input('appCounter') target = 0;
  @Input() suffix = '';

  constructor(
    private el: ElementRef<HTMLElement>,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.el.nativeElement.textContent = '0' + this.suffix;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          this.animate();
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(this.el.nativeElement);
  }

  private animate() {
    const duration = 1600;
    const start = performance.now();
    const target = this.target;
    const el = this.el.nativeElement;
    const suffix = this.suffix;

    const tick = (now: number) => {
      const elapsed = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - elapsed, 4);
      el.textContent = Math.floor(eased * target).toLocaleString() + suffix;
      if (elapsed < 1) requestAnimationFrame(tick);
      else el.textContent = target.toLocaleString() + suffix;
    };
    requestAnimationFrame(tick);
  }
}
