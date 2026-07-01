import { Component, HostListener, Inject, OnInit, PLATFORM_ID, computed, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { filter } from 'rxjs/operators';
import { AuthService } from './services/auth.service';
import { ToastService } from './services/toast.service';
import { I18nService } from './services/i18n.service';
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
    @Inject(PLATFORM_ID) private platformId: object,
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.router.events
        .pipe(filter(e => e instanceof NavigationEnd))
        .subscribe(() => {
          this.menuOpen.set(false);
          this.profileMenuOpen.set(false);
        });
    }
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
