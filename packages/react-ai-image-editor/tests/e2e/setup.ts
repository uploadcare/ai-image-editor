import { setupEmulator } from '@uploadcare/api-emulator/browser';
import { beforeEach } from 'vitest';

/**
 * The Uploadcare emulator, running in the page. These tests mount the real element and only drive the React
 * wrapper, so nothing should reach the network today; if the element starts to, Uploadcare requests are answered
 * here and any other origin fails the request loudly instead of going out.
 */
const emulator = setupEmulator();

beforeEach(async () => {
  await emulator.reset();
});
