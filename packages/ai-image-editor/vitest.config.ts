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
          name: 'specs',
          include: ['src/**/*.test.ts'],
          environment: 'happy-dom',
          setupFiles: ['tests/specs/setup.ts'],
        },
      },
      {
        extends: true,
        // Serves msw 3's /mockServiceWorker.js, which the browser emulator registers, from this repo's msw
        // rather than whichever copy @vitest/browser happens to resolve.
        plugins: [msw({ mode: 'worker-only' })],
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
