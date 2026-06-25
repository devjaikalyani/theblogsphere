import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { of, tap } from 'rxjs';

const cache = new Map<string, { response: HttpResponse<any>; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;
const CACHEABLE_PATHS = ['/api/blogs'];

export const httpCacheInterceptor: HttpInterceptorFn = (req, next) => {
  const isCacheable = req.method === 'GET' &&
    CACHEABLE_PATHS.some((p) => req.url.includes(p));

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
