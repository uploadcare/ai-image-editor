import { mintAuthToken } from '@uploadcare/api-emulator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { session } from '../emulator';
import type { UcAiImageEditorType } from './harness';
import { clickSend, historyEl, mount, STAGING, typePrompt } from './harness';

/**
 * The project here has Signed Uploads on, so the emulator refuses every
 * derivative request (the POST and each status poll) that carries no valid
 * Bearer token: a run that finishes is itself proof every request was signed.
 * What the header looks like is pinned by the `uploadcareApiClient` and
 * `uploadcareDerivativeApi` specs.
 */
describe('<uc-ai-image-editor> authToken', () => {
  beforeEach(() => {
    // derivativesInstant again, so it wraps the signing gate like it did the plain routes.
    session.use('signedUploads').use('derivativesInstant');
  });

  /**
   * Runs one generation and waits for it to land in the history, counted rather
   * than observed through the canvas: after the first run the canvas already
   * holds a result URL, so waiting on it would return immediately and the
   * second generation would never be awaited.
   */
  const generate = async (el: UcAiImageEditorType, prompt: string) => {
    const before = historyEl(el)?.entries.length ?? 0;
    typePrompt(el, prompt);
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(historyEl(el)?.entries).toHaveLength(before + 1));
    await el.updateComplete;
  };

  /** Runs one generation and answers the `uc:error` the signing gate's refusal raises. */
  const generateRefused = async (el: UcAiImageEditorType, prompt: string) => {
    const onError = vi.fn();
    el.addEventListener('uc:error', onError);
    typePrompt(el, prompt);
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    el.removeEventListener('uc:error', onError);
    return onError.mock.calls[0]![0].detail.error;
  };

  it.each([undefined, null, ''])('signs nothing when authToken is %p', async (value) => {
    // The common case: a project without signing. The provider gets no token
    // function, so nothing has to stand in for a missing token.
    const el = mount(STAGING);
    el.authToken = value as unknown as undefined;
    await el.updateComplete;

    expect((await generateRefused(el, 'a tiger')).code).toBe('SignatureRequiredError');
  });

  it('signs once authToken is set and stops once it is unset', async () => {
    const el = mount(STAGING);
    await el.updateComplete;
    expect((await generateRefused(el, 'a tiger')).code).toBe('SignatureRequiredError');

    el.authToken = await mintAuthToken({ tokenId: 'plain' });
    await el.updateComplete;
    await generate(el, 'a lion');

    el.authToken = undefined;
    await el.updateComplete;
    expect((await generateRefused(el, 'a bear')).code).toBe('SignatureRequiredError');
  });

  it('calls an authToken function once and reuses the token across requests', async () => {
    // Standalone, the editor owns the cache: a generate makes several
    // authenticated requests and must not ask the app for a token each time.
    const token = await mintAuthToken({ tokenId: 'fetched' });
    const fetchToken = vi.fn(async () => token);
    const el = mount(STAGING);
    el.authToken = fetchToken;
    await el.updateComplete;

    await generate(el, 'a tiger');

    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it('keeps the cached token when the function identity changes', async () => {
    // A React parent hands over a new closure on every render.
    const [firstToken, secondToken] = [
      await mintAuthToken({ tokenId: 'first' }),
      await mintAuthToken({ tokenId: 'second' }),
    ];
    const first = vi.fn(async () => firstToken);
    const el = mount(STAGING);
    el.authToken = first;
    await el.updateComplete;
    await generate(el, 'a tiger');

    const second = vi.fn(async () => secondToken);
    el.authToken = second;
    await el.updateComplete;
    await generate(el, 'a lion');

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it('refetches after invalidateAuthToken()', async () => {
    // The escape hatch for a sign-out, and the only recovery when a token's
    // `exp` cannot be read and so never goes stale on its own.
    const token = await mintAuthToken({ tokenId: 'fetched' });
    const fetchToken = vi.fn(async () => token);
    const el = mount(STAGING);
    el.authToken = fetchToken;
    await el.updateComplete;
    await generate(el, 'a tiger');
    expect(fetchToken).toHaveBeenCalledTimes(1);

    el.invalidateAuthToken();
    await generate(el, 'a lion');

    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it('does not cache when cacheAuthToken is false', async () => {
    // What the file-uploader plugin sets: the uploader already caches, so the
    // editor must resolve through to it rather than hold its own copy.
    const token = await mintAuthToken({ tokenId: 'fetched' });
    const fetchToken = vi.fn(async () => token);
    const el = mount(STAGING);
    el.cacheAuthToken = false;
    el.authToken = fetchToken;
    await el.updateComplete;

    await generate(el, 'a tiger');

    expect(fetchToken.mock.calls.length).toBeGreaterThan(1);
  });

  it('accepts a provider and lets it own the caching', async () => {
    // What the File Uploader plugin hands over: the uploader's cache, which
    // the editor must use rather than wrap in a second one.
    const token = await mintAuthToken({ tokenId: 'provider' });
    const getToken = vi.fn(async () => token);
    const invalidate = vi.fn();
    const el = mount(STAGING);
    el.authToken = { getToken, invalidate };
    await el.updateComplete;

    await generate(el, 'a tiger');

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
