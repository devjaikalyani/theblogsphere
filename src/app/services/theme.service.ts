import { Inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * SSR-safe theme controller.
 *
 * The actual `.dark` class is set on <html> by a tiny inline script in
 * index.html BEFORE first paint (so there is no flash). This service keeps
 * the Angular side in sync after hydration, persists the user's explicit
 * choice, and reacts to OS changes while in `system` mode.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'theme';
  private mql?: MediaQueryList;

  /** User intent: explicit light/dark, or follow the OS. */
  readonly mode = signal<ThemeMode>('system');
  /** The theme actually on screen right now. */
  readonly resolved = signal<'light' | 'dark'>('light');

  constructor(@Inject(PLATFORM_ID) private platformId: object) {
    if (!isPlatformBrowser(this.platformId)) return;

    const stored = localStorage.getItem(this.storageKey) as ThemeMode | null;
    this.mode.set(stored === 'light' || stored === 'dark' ? stored : 'system');

    this.mql = window.matchMedia('(prefers-color-scheme: dark)');
    this.mql.addEventListener('change', () => {
      if (this.mode() === 'system') this.apply();
    });

    this.apply();
  }

  private systemPrefersDark(): boolean {
    return !!this.mql?.matches;
  }

  private apply(): void {
    const dark = this.mode() === 'dark' || (this.mode() === 'system' && this.systemPrefersDark());
    this.resolved.set(dark ? 'dark' : 'light');

    const el = document.documentElement;
    el.classList.toggle('dark', dark);
    el.style.colorScheme = dark ? 'dark' : 'light';

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#15120E' : '#FAF8F3');
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    if (!isPlatformBrowser(this.platformId)) return;
    if (mode === 'system') localStorage.removeItem(this.storageKey);
    else localStorage.setItem(this.storageKey, mode);
    this.apply();
  }

  /** Flip between light and dark from whatever is currently on screen. */
  toggle(): void {
    this.setMode(this.resolved() === 'dark' ? 'light' : 'dark');
  }
}
