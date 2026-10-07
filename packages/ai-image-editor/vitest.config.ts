import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'specs',
          include: ['src/**/*.test.ts'],
          environment: 'happy-dom',
          // happy-dom's fetch preflights a cross-origin request, and the emulator answers no OPTIONS; the specs test
          // the clients, not CORS.
          environmentOptions: { happyDOM: { settings: { fetch: { disableSameOriginPolicy: true } } } },
          setupFiles: ['tests/specs/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['tests/**/*.test.{ts,tsx}'],
          setupFiles: ['tests/setup.ts'],
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
