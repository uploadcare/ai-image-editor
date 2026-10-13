import { playwright } from '@vitest/browser-playwright';
import { msw } from 'msw/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Every spy and stubbed global is undone before the next test, so none leaks into a test that runs after it.
    restoreMocks: true,
    unstubGlobals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'ssr',
          include: ['tests/ssr/**/*.test.{ts,tsx}'],
          environment: 'node',
        },
      },
      {
        extends: true,
        // @lit/react ships an inert node-condition build (NODE_MODE strips the
        // property/listener application for SSR); the DOM tests need the real one
        resolve: { conditions: ['browser'] },
        test: {
          name: 'hydration',
          include: ['tests/hydration/**/*.test.{ts,tsx}'],
          environment: 'happy-dom',
        },
      },
      {
        extends: true,
        test: {
          name: 'types',
          // Type-only: compiled by tsc against the element's published
          // `.d.ts`, never executed. Build `@uploadcare/ai-image-editor` first.
          include: ['tests/types/**/*.test-d.tsx'],
          typecheck: {
            enabled: true,
            only: true,
            include: ['tests/types/**/*.test-d.tsx'],
            tsconfig: './tsconfig.types-test.json',
          },
        },
      },
      {
        extends: true,
        // Serves msw 3's /mockServiceWorker.js for the in-page emulator (tests/e2e/setup.ts).
        plugins: [msw({ mode: 'worker-only' })],
        test: {
          name: 'e2e',
          include: ['tests/e2e/**/*.test.{ts,tsx}'],
          setupFiles: ['tests/e2e/setup.ts'],
          browser: {
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            enabled: true,
            headless: true,
          },
        },
      },
    ],
  },
});
