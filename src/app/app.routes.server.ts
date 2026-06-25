import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Auth-gated pages: render on client only (no SSR needed)
  { path: 'edit/:id', renderMode: RenderMode.Client },
  { path: 'create', renderMode: RenderMode.Client },
  { path: 'my-stories', renderMode: RenderMode.Client },
  { path: 'bookmarks', renderMode: RenderMode.Client },
  { path: 'feed', renderMode: RenderMode.Client },
  { path: 'analytics', renderMode: RenderMode.Client },
  { path: 'settings', renderMode: RenderMode.Client },
  { path: 'ai-assistant', renderMode: RenderMode.Client },
  // All other routes: SSR at request time (auth session is available via headers)
  { path: '**', renderMode: RenderMode.Server },
];
