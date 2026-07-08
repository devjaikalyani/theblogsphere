import { Inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from './auth.service';

/**
 * First-run onboarding tour. Shown once per user (keyed by user id in
 * localStorage) after a new signup or an email sign-in. SSR-safe: the visible
 * signal starts false and is only ever set true in the browser.
 */
@Injectable({ providedIn: 'root' })
export class TutorialService {
  readonly visible = signal(false);

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    @Inject(AuthService) private auth: AuthService,
  ) {}

  private storageKey(): string {
    const id = this.auth.session()?.user?.id ?? 'anon';
    return `tbs-tutorial-seen:${id}`;
  }

  /** Show the tour the first time this user reaches the app. */
  maybeStart() {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      if (!localStorage.getItem(this.storageKey())) this.visible.set(true);
    } catch {
      // Storage blocked (private mode), show it anyway.
      this.visible.set(true);
    }
  }

  /** Force the tour open (e.g. a "How it works" link). */
  start() {
    this.visible.set(true);
  }

  /** Mark as seen and close. */
  complete() {
    if (isPlatformBrowser(this.platformId)) {
      try { localStorage.setItem(this.storageKey(), new Date().toISOString()); } catch { /* ignore */ }
    }
    this.visible.set(false);
  }
}
