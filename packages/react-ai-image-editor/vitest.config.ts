import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
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
          name: 'e2e',
          include: ['tests/e2e/**/*.test.{ts,tsx}'],
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
