import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { emulatorCommands } from './tests/commands';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'specs',
          include: ['src/**/*.test.ts'],
          environment: 'happy-dom',
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
            commands: emulatorCommands,
          },
        },
      },
    ],
  },
});
