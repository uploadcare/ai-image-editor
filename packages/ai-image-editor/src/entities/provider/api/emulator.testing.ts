// TEMPORARY: `@uploadcare/api-emulator` is a `file:` dependency on an unreleased
// checkout (see packages/ai-image-editor/package.json); swap it for a version
// range once the package ships, and drop this comment.
import { handle, SIGNED_UPLOADS_SECRET_KEY } from '@uploadcare/api-emulator';
import { generateAuthToken } from '@uploadcare/signed-uploads/server';
import { vi } from 'vitest';

/**
 * A `fetch` answered by the Uploadcare API emulator instead of the network,
 * spied so a spec can read back what was sent: `requests` holds a copy of every
 * request it answered, in order. Reset the emulator's state with
 * `resetSession()` between tests.
 */
export const emulatorFetch = () => {
  const requests: Request[] = [];
  const spy = vi.fn<typeof fetch>(async (input, init) => {
    // What a real fetch does with a signal that is already aborted.
    init?.signal?.throwIfAborted();
    const request = new Request(input, init);
    // A copy, since the emulator reads the body of the one it answers.
    requests.push(request.clone());
    const response = await handle(request);
    if (!response) throw new TypeError(`The emulator does not implement ${request.method} ${request.url}`);
    return response;
  });
  return Object.assign(spy, { requests });
};

/**
 * The emulator answers every refusal with the JSON error envelope, so it can't
 * produce the bare non-2xx, non-JSON response a proxy or an outage would. This
 * stub stands in for that.
 */
export const plainTextFailure = (status: number, statusText: string) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response('upstream failure', { status, statusText }));

/** A Bearer token the emulator accepts; `id` keeps two tokens minted in the same second apart. */
export const mintAuthToken = (id = 'token') =>
  generateAuthToken(SIGNED_UPLOADS_SECRET_KEY, { lifetime: 60_000, tokenId: id });

/** A stored image every fresh emulator session starts with. */
export const SEEDED_IMAGE_UUID = '49b4c5a1-31b3-4349-ba07-d97a2d883c37';
