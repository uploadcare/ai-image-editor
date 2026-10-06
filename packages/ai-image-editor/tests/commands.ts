// TEMPORARY: `@uploadcare/api-emulator` is a `file:` dependency on an unreleased
// checkout (see packages/ai-image-editor/package.json); swap it for a version
// range once the package ships, and drop this comment.
import { SIGNED_UPLOADS_SECRET_KEY } from '@uploadcare/api-emulator';
import { generateAuthToken } from '@uploadcare/signed-uploads/server';
import type { BrowserCommand } from 'vitest/node';

/** A Bearer token the emulator accepts; `id` keeps tokens minted in the same second apart. */
const mintAuthToken: BrowserCommand<[id?: string]> = async (_context, id = 'token') =>
  generateAuthToken(SIGNED_UPLOADS_SECRET_KEY, { lifetime: 600_000, tokenId: id });

/** Node-side browser command: `@uploadcare/signed-uploads/server` signs with `node:crypto`, so tokens are minted outside the page. */
export const emulatorCommands = { mintAuthToken };

declare module 'vitest/browser' {
  interface BrowserCommands {
    mintAuthToken: (id?: string) => Promise<string>;
  }
}
