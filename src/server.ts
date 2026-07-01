import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();

/**
 * Angular 19.2's SSR has an SSRF guard that rejects any request whose Host
 * isn't in `allowedHosts` — and an empty list rejects *everything* (even
 * localhost), silently falling back to client-side rendering. Behind Railway's
 * proxy the real Host arrives via `X-Forwarded-Host`, so we also trust proxy
 * headers. We derive the allow-list from the same `ALLOWED_ORIGINS` used for
 * CORS (accepting full origins or bare hosts) plus localhost/loopback for dev.
 */
function resolveAllowedHosts(): string[] {
  const hosts = new Set(['localhost', '127.0.0.1']);
  const raw = process.env['NG_ALLOWED_HOSTS'] ?? process.env['ALLOWED_ORIGINS'] ?? '';
  for (const entry of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    try {
      hosts.add(entry.includes('://') ? new URL(entry).hostname : entry.replace(/:\d+$/, ''));
    } catch {
      // Skip malformed entries rather than crashing the render path.
    }
  }
  return [...hosts];
}

const angularApp = new AngularNodeAppEngine({
  allowedHosts: resolveAllowedHosts(),
  trustProxyHeaders: true,
});

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/**', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use('/**', (req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);

/**
 * The raw Express app (static asset serving + Angular SSR catch-all). The NestJS
 * server imports this from the built bundle and mounts it as the fallback for
 * every non-`/api` route, so one process serves the API and the rendered app
 * at the same origin.
 */
export const ssrApp = app;
