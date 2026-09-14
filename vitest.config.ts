import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      // Only the Workers runtime provides this module. The stub lets the tests
      // drive the shipped route handlers instead of a copy of their logic.
      'cloudflare:workers': fileURLToPath(new URL('./tests/support/cloudflare-workers.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
  },
});
