import type { EmulatorSession } from '@uploadcare/api-emulator';
import { setupEmulator } from '@uploadcare/api-emulator/node';
import { beforeEach } from 'vitest';

/**
 * The Uploadcare emulator behind this process's `fetch` and `node:http(s)`, for Uploadcare's hosts and
 * `upload.example.com` (the specs' custom `baseUrl`; the emulator routes by path, so it answers there too). Every
 * other origin fails.
 */
const emulator = setupEmulator({ cdnHosts: ['upload.example.com'] });

/** The current test's emulator session, for a spec that registers a scenario or reads `requests`. */
export let session: EmulatorSession;

/** Every test starts against an empty session. */
beforeEach(async () => {
  session = await emulator.reset();
});
