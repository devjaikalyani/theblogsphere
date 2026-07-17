import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { httpCacheInterceptor } from './interceptors/http-cache.interceptor';
import { ssrApiBaseUrlInterceptor } from './interceptors/ssr-api-base-url.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Every navigation lands at the top of the new page (fixes footer/other
    // links opening the next page mid-scroll); back/forward still restore the
    // previous position, and #fragment links still scroll to their anchor.
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      // Cross-page navigations dissolve via the View Transitions API where
      // the browser supports it; elsewhere it is a no-op and routing behaves
      // exactly as before. Reduced-motion users get the browser's default
      // instant swap.
      withViewTransitions(),
    ),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch(), withInterceptors([ssrApiBaseUrlInterceptor, httpCacheInterceptor])),
    provideAnimations(),
  ],
};
