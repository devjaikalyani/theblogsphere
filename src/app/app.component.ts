import { Component, HostListener, Inject, OnInit, PLATFORM_ID, computed, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { filter } from 'rxjs/operators';
import { AuthService } from './services/auth.service';
import { ToastService } from './services/toast.service';
import { I18nService } from './services/i18n.service';
import { TutorialService } from './services/tutorial.service';
import { PageTransitionDirective } from './directives/page-transition.directive';
import { CookieConsentComponent } from './components/cookie-consent/cookie-consent.component';
import { TutorialComponent } from './components/tutorial/tutorial.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PageTransitionDirective, CookieConsentComponent, TutorialComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  menuOpen = signal(false);
  profileMenuOpen = signal(false);
  scrolled = signal(false);
  readingProgress = signal(0);

  /** Routes that open on full-bleed footage (home reel, article hero). There
   *  the nav overlays the film as a transparent light-on-dark bar, and
   *  dissolves to the usual glass paper once the reader scrolls, or whenever
   *  a dropdown needs a solid surface behind it. */
  private cineRoute = signal(false);
  private navOverlay = computed(
    () => this.cineRoute() && !this.scrolled() && !this.menuOpen() && !this.profileMenuOpen(),
  );
  navClass = computed(() => {
    const base = 'sticky top-0 z-50 transition-[background-color,border-color,box-shadow] duration-300 ';
    const overlayLayout = this.cineRoute() ? 'nav-cine ' : '';
    if (this.navOverlay()) return base + overlayLayout + 'nav-transparent';
    return base + overlayLayout + 'glass-nav' + (this.scrolled() ? ' shadow-elevated' : '');
  });

  initials = computed(() => {
    const user = this.auth.session()?.user;
    if (!user) return '';
    return ((user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')).toUpperCase();
  });

  constructor(
    readonly auth: AuthService,
    private router: Router,
    readonly toast: ToastService,
    readonly i18n: I18nService,
    readonly tour: TutorialService,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {
    // Not browser-guarded: SSR must also render the transparent overlay nav
    // on cinematic routes, or the first paint flashes a paper bar over the film.
    this.cineRoute.set(this.isCineUrl(this.router.url));
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.cineRoute.set(this.isCineUrl(e.urlAfterRedirects ?? e.url)));

    if (isPlatformBrowser(this.platformId)) {
      this.router.events
        .pipe(filter(e => e instanceof NavigationEnd))
        .subscribe(() => {
          this.menuOpen.set(false);
          this.profileMenuOpen.set(false);
        });
    }
  }

  private isCineUrl(url: string): boolean {
    const path = url.split('?')[0].split('#')[0];
    return path === '/' || path.startsWith('/blog/');
  }

  ngOnInit() {
    this.auth.refreshSession().subscribe();
  }

  @HostListener('window:scroll')
  onScroll() {
    if (!isPlatformBrowser(this.platformId)) return;
    const scrollTop = window.scrollY;
    this.scrolled.set(scrollTop > 16);
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    this.readingProgress.set(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
  }

  logout() {
    this.auth.logout().subscribe(() => {
      window.location.href = '/';
    });
  }
}
