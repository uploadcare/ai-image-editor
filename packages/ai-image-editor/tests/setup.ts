import { beforeEach } from 'vitest';
import { useEmulator } from './emulator';

/** Every test starts against an empty Uploadcare emulator — see `tests/emulator.ts`. */
beforeEach(async () => {
  await useEmulator();
});
