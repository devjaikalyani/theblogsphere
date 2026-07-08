import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID, REQUEST } from '@angular/core';
import { isPlatformServer } from '@angular/common';

/**
 * Server-side only. During SSR, HttpClient runs on Node where `fetch()` rejects
 * relative URLs, and every service here calls `/api/...` (relative). Without
 * this, each server-side data request throws, the page serialises in its empty
 * loading shell (no list cards, no article body), per-page meta tags never run,
 * and Angular drops its hydration annotations because the render hit errors.
 *
 * This rewrites those relative URLs to an absolute loopback origin pointing at
 * the same combined NestJS+SSR server, and forwards the visitor's cookies so
 * authenticated pages render their real state (and match on the client, so
 * hydration stays clean). On the browser it is a no-op, relative URLs work
 * there and resolve same-origin.
 */
export const ssrApiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isPlatformServer(inject(PLATFORM_ID)) || !req.url.startsWith('/')) {
    return next(req);
  }

  // Loopback to this same process, no DNS, no TLS, no edge round-trip. An
  // explicit override is available for unusual deploy topologies.
  const origin =
    process.env['SSR_API_ORIGIN'] ?? `http://127.0.0.1:${process.env['PORT'] ?? 3000}`;

  const cookie = inject(REQUEST, { optional: true })?.headers?.get('cookie');

  return next(
    req.clone({
      url: origin + req.url,
      setHeaders: cookie ? { cookie } : {},
    }),
  );
};
