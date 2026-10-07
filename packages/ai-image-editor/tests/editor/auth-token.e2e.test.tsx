import { mintAuthToken } from '@uploadcare/api-emulator';
import { describe, expect, it, vi } from 'vitest';
import type { UcAiImageEditorType } from './harness';
import { clickSend, mount, recordRequests, STAGING, typePrompt } from './harness';

/**
 * The emulator checks every Bearer token it gets, so the tokens here are real
 * ones it accepts, and a run that finishes is itself proof the token was good.
 */
describe('<uc-ai-image-editor> authToken', () => {
  /**
   * Runs one generation and waits for its finished result, counted rather than
   * observed through the canvas: after the first run the canvas already holds
   * the result URL, so waiting on it would return immediately and the second
   * generation would never be awaited.
   */
  const generate = async (el: UcAiImageEditorType, prompt: string, results: string[]) => {
    const before = results.length;
    typePrompt(el, prompt);
    await el.updateComplete;
    clickSend(el);
    // A finished result, so a status poll the emulator refused fails the test.
    await vi.waitFor(() => {
      expect(results).toHaveLength(before + 1);
    });
    await el.updateComplete;
  };

  it.each([undefined, null, ''])('sends no Authorization header when authToken is %p', async (value) => {
    // The common case: a project without signing. The provider gets no token
    // function, so nothing has to stand in for a missing token.
    const { auth, results } = recordRequests();
    const el = mount(STAGING);
    el.authToken = value as unknown as undefined;
    await el.updateComplete;

    await generate(el, 'a tiger', results);

    expect(auth.length).toBeGreaterThan(1);
    expect(auth.every((value) => value === null)).toBe(true);
  });

  it('signs once authToken is set and stops once it is unset', async () => {
    const { auth, results } = recordRequests();
    const token = await mintAuthToken({ tokenId: 'plain' });
    const el = mount(STAGING);
    el.authToken = token;
    await el.updateComplete;
    await generate(el, 'a tiger', results);
    const signed = auth.length;

    el.authToken = undefined;
    await el.updateComplete;
    await generate(el, 'a lion', results);

    expect(auth.slice(0, signed).every((value) => value === `Bearer ${token}`)).toBe(true);
    expect(auth.slice(signed).every((value) => value === null)).toBe(true);
  });

  it('sends a plain token on every request', async () => {
    const { auth, results } = recordRequests();
    const token = await mintAuthToken({ tokenId: 'plain' });
    const el = mount(STAGING);
    el.authToken = token;
    await el.updateComplete;

    await generate(el, 'a tiger', results);

    expect(auth.length).toBeGreaterThan(1);
    expect(auth.every((value) => value === `Bearer ${token}`)).toBe(true);
  });

  it('calls an authToken function once and reuses the token across requests', async () => {
    // Standalone, the editor owns the cache: a generate makes several
    // authenticated requests and must not ask the app for a token each time.
    const { auth, results } = recordRequests();
    const token = await mintAuthToken({ tokenId: 'fetched' });
    const fetchToken = vi.fn(async () => token);
    const el = mount(STAGING);
    el.authToken = fetchToken;
    await el.updateComplete;

    await generate(el, 'a tiger', results);

    expect(auth.length).toBeGreaterThan(1);
    expect(auth.every((value) => value === `Bearer ${token}`)).toBe(true);
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it('keeps the cached token when the function identity changes', async () => {
    // A React parent hands over a new closure on every render.
    const { auth, results } = recordRequests();
    const [firstToken, secondToken] = [
      await mintAuthToken({ tokenId: 'first' }),
      await mintAuthToken({ tokenId: 'second' }),
    ];
    const first = vi.fn(async () => firstToken);
    const el = mount(STAGING);
    el.authToken = first;
    await el.updateComplete;
    await generate(el, 'a tiger', results);

    const second = vi.fn(async () => secondToken);
    el.authToken = second;
    await el.updateComplete;
    await generate(el, 'a lion', results);

    expect(second).not.toHaveBeenCalled();
    expect(auth.every((value) => value === `Bearer ${firstToken}`)).toBe(true);
  });

  it('refetches after invalidateAuthToken()', async () => {
    // The escape hatch for a sign-out, and the only recovery when a token's
    // `exp` cannot be read and so never goes stale on its own.
    const { results } = recordRequests();
    const token = await mintAuthToken({ tokenId: 'fetched' });
    const fetchToken = vi.fn(async () => token);
    const el = mount(STAGING);
    el.authToken = fetchToken;
    await el.updateComplete;
    await generate(el, 'a tiger', results);
    expect(fetchToken).toHaveBeenCalledTimes(1);

    el.invalidateAuthToken();
    await generate(el, 'a lion', results);

    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it('does not cache when cacheAuthToken is false', async () => {
    // What the file-uploader plugin sets: the uploader already caches, so the
    // editor must resolve through to it rather than hold its own copy.
    const { results } = recordRequests();
    const token = await mintAuthToken({ tokenId: 'fetched' });
    const fetchToken = vi.fn(async () => token);
    const el = mount(STAGING);
    el.cacheAuthToken = false;
    el.authToken = fetchToken;
    await el.updateComplete;

    await generate(el, 'a tiger', results);

    expect(fetchToken.mock.calls.length).toBeGreaterThan(1);
  });

  it('accepts a provider and lets it own the caching', async () => {
    // What the File Uploader plugin hands over: the uploader's cache, which
    // the editor must use rather than wrap in a second one.
    const { auth, results } = recordRequests();
    const token = await mintAuthToken({ tokenId: 'provider' });
    const getToken = vi.fn(async () => token);
    const invalidate = vi.fn();
    const el = mount(STAGING);
    el.authToken = { getToken, invalidate };
    await el.updateComplete;

    await generate(el, 'a tiger', results);

    expect(auth.every((value) => value === `Bearer ${token}`)).toBe(true);
    // Called per request: the provider decides what to cache, not the editor.
    expect(getToken.mock.calls.length).toBeGreaterThan(1);
  });

  it('forwards invalidateAuthToken() to a provider', async () => {
    const getToken = vi.fn(async () => 'eyJ.from.provider');
    const invalidate = vi.fn();
    const el = mount(STAGING);
    el.authToken = { getToken, invalidate };
    await el.updateComplete;

    el.invalidateAuthToken();

    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});
