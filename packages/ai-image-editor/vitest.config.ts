import { playwright } from '@vitest/browser-playwright';
import { msw } from 'msw/vite';
import { configDefaults, defineConfig } from 'vitest/config';

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
        test: {
          // The derivative API contract: against the emulator by default, against the real API with
          // `UC_CONTRACT_TARGET=live` (`npm run test:contract:live`), where a generation takes a while.
          name: 'contract',
          include: ['tests/contract/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['tests/contract/setup.ts'],
          testTimeout: process.env.UC_CONTRACT_TARGET === 'live' ? 180_000 : undefined,
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
          // The contract tests run in node, in their own project.
          exclude: [...configDefaults.exclude, 'tests/contract/**'],
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
