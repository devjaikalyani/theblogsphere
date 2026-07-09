import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Server unit tests run through the same SWC transform as production
// (@swc/core), so NestJS decorators behave identically to runtime. Scoped to
// server specs only; the Angular app keeps using `ng test` (Karma) for its own
// *.spec.ts files.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['server/src/**/*.spec.ts'],
    environment: 'node',
    globals: true,
  },
});
