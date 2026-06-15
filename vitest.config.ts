import { defineConfig } from 'vitest/config';

// Test-only config, kept separate from vite.config.ts so the production build
// config stays untouched. Tests live in /test (outside tsconfig's "src" include),
// so they never enter the `npm run build` typecheck.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
