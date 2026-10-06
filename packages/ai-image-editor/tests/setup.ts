import { beforeEach } from 'vitest';
import { commands } from 'vitest/browser';

/** Every test starts against an empty Uploadcare emulator — see `tests/emulator.ts`. */
beforeEach(async () => {
  await commands.useEmulator();
});
