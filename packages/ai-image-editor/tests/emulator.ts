// TEMPORARY: file: dependency, see tests/commands.ts.
import type { EmulatorSession } from '@uploadcare/api-emulator';
import { setupEmulator } from '@uploadcare/api-emulator/browser';
import { beforeEach } from 'vitest';

/**
 * The Uploadcare emulator, running in the page, for Uploadcare's hosts and `cdn.example.com` (the CDN cname the
 * editor tests configure). Any other Uploadcare host fails; every other origin passes through: the uploader tests import an Unsplash image from a URL,
 * and the emulator's `from_url` answers for that source without fetching it.
 */
const emulator = setupEmulator({ cdnHosts: ['cdn.example.com'], unhandled: 'passthrough' });

/** The current test's emulator session, for a test that registers a scenario or preset on it. */
export let session: EmulatorSession;

/** Every test starts against an empty session. */
beforeEach(async () => {
  session = await emulator.reset();
});
