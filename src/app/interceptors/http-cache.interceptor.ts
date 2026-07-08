import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of, tap } from 'rxjs';

const cache = new Map<string, { response: HttpResponse<any>; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

/** Drop everything cached, called on login/logout/account deletion so a
 *  response fetched under one session can never be replayed into another. */
export function clearHttpCache() {
  cache.clear();
}

/** Only public, session-independent blog reads are cacheable. A substring
 *  match would also catch `/api/blogs/my` (the signed-in user's stories) and
 *  leak them across accounts sharing this browser, or across visitors during
 *  SSR, where this module-level map is shared by every request. */
function isPublicBlogUrl(url: string): boolean {
  const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
  if (path === '/api/blogs') return true;
  if (!path.startsWith('/api/blogs/')) return false;
  const rest = path.slice('/api/blogs/'.length);
  return rest !== 'my' && !rest.startsWith('my/');
}

export const httpCacheInterceptor: HttpInterceptorFn = (req, next) => {
  const isCacheable = req.method === 'GET' && isPublicBlogUrl(req.url);

  if (!isCacheable) return next(req);

  const cached = cache.get(req.url);
  if (cached && Date.now() < cached.expiresAt) {
    return of(cached.response.clone());
  }

  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) {
        cache.set(req.url, { response: event.clone(), expiresAt: Date.now() + CACHE_TTL_MS });
      }
    }),
  );
};
