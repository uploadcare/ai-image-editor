import { setupEmulator } from '@uploadcare/api-emulator/node';
import { afterAll, beforeEach } from 'vitest';
import { failOnSchemaDrift } from '../schema-drift';

/**
 * The contract tests run the same assertions against one of two targets: by default the emulator (part of
 * `npm test`), or with `UC_CONTRACT_TARGET=live` the real `upload.uploadcare.com`, so a difference between the two
 * fails one of them. A live run needs `UC_CONTRACT_PUBLIC_KEY`, a project with AI derivatives enabled and signed
 * uploads off; without it the run fails rather than skipping, so missing credentials never look like a pass.
 */
export const LIVE = process.env.UC_CONTRACT_TARGET === 'live';

function livePublicKey(): string {
  const key = process.env.UC_CONTRACT_PUBLIC_KEY;
  if (!key) throw new Error('UC_CONTRACT_TARGET=live needs UC_CONTRACT_PUBLIC_KEY');
  return key;
}

export const PUBLIC_KEY = LIVE ? livePublicKey() : 'demopublickey';

/** Live, a job takes seconds to finish; the emulator walks it in four instant polls. */
export const POLL_INTERVAL_MS = LIVE ? 1500 : 0;

if (!LIVE) {
  const emulator = setupEmulator();
  beforeEach(async () => {
    await emulator.reset();
  });
  afterAll(() => emulator.stop());
}

failOnSchemaDrift();
