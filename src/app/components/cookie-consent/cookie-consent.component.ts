import { Component, Inject, PLATFORM_ID, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

const CONSENT_KEY = 'tbs-cookie-consent';

/**
 * Minimal, honest cookie notice. TheBlogSphere only sets essential cookies
 * (the Better Auth session + a couple of preferences), no advertising or
 * cross-site tracking, so this is a notice-and-accept, not a full preference
 * manager. It renders only in the browser (SSR-safe) and only until the visitor
 * has acknowledged it (persisted in localStorage).
 */
@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (visible()) {
      <div class="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4" role="region" aria-label="Cookie notice">
        <div class="mx-auto max-w-3xl bg-raised border border-gray-200 rounded-2xl elev-3 p-4 sm:p-5
                    flex flex-col sm:flex-row sm:items-center gap-3">
          <p class="flex-1 text-sm font-reading text-gray-600 leading-relaxed">
            We use essential cookies to keep you signed in and remember your preferences, never for
            advertising or tracking.
            <a routerLink="/privacy" class="link-underline text-gray-800 font-medium">Learn more</a>.
          </p>
          <button type="button" (click)="accept()"
            class="shrink-0 self-start sm:self-auto px-6 py-2 text-sm font-semibold rounded-full btn-ink btn-press">
            Accept
          </button>
        </div>
      </div>
    }
  `,
})
export class CookieConsentComponent {
  visible = signal(false);

  constructor(@Inject(PLATFORM_ID) private platformId: object) {
    if (isPlatformBrowser(this.platformId)) {
      try {
        if (!localStorage.getItem(CONSENT_KEY)) this.visible.set(true);
      } catch {
        // Private-mode / storage disabled, show the notice but don't crash.
        this.visible.set(true);
      }
    }
  }

  accept() {
    try { localStorage.setItem(CONSENT_KEY, new Date().toISOString()); } catch { /* ignore */ }
    this.visible.set(false);
  }
}
