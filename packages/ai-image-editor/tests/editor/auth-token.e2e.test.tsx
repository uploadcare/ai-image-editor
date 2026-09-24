import { describe, expect, it, vi } from 'vitest';
import type { UcAiImageEditorType } from './harness';
import { clickSend, installFetch, jsonResponse, mount, STAGING, successFrame, typePrompt } from './harness';

describe('<uc-ai-image-editor> authToken', () => {
  /** Like `stubFetch`, but records the Authorization header of every request. */
  function stubFetchCapturingAuth(): { auth: Array<string | null> } {
    const auth: Array<string | null> = [];
    installFetch((async (_input: RequestInfo | URL, init?: RequestInit) => {
      auth.push(new Headers(init?.headers).get('Authorization'));
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return jsonResponse({ type: 'job', job_id: 'job-1' });
      }
      return jsonResponse(successFrame('result'));
    }) as typeof fetch);
    return { auth };
  }

  /**
   * Runs one generation and waits for its requests, counted rather than
   * observed through the canvas: after the first run the canvas already holds
   * the result URL, so waiting on it would return immediately and the second
   * generation would never be awaited.
   */
  const generate = async (el: UcAiImageEditorType, prompt: string, auth: Array<string | null>) => {
    const before = auth.length;
    typePrompt(el, prompt);
    await el.updateComplete;
    clickSend(el);
    // The POST that starts the job, then at least one status GET.
    await vi.waitFor(() => {
      expect(auth.length).toBeGreaterThanOrEqual(before + 2);
    });
    await el.updateComplete;
  };

  it('sends a plain token on every request', async () => {
    const { auth } = stubFetchCapturingAuth();
    const el = mount(STAGING);
    el.authToken = 'eyJ.plain.sig';
    await el.updateComplete;

    await generate(el, 'a tiger', auth);

    expect(auth.length).toBeGreaterThan(1);
    expect(auth.every((value) => value === 'Bearer eyJ.plain.sig')).toBe(true);
  });

  it('calls an authToken function once and reuses the token across requests', async () => {
    // Standalone, the editor owns the cache: a generate makes several
    // authenticated requests and must not ask the app for a token each time.
    const { auth } = stubFetchCapturingAuth();
    const fetchToken = vi.fn(async () => 'eyJ.fetched.sig');
    const el = mount(STAGING);
    el.authToken = fetchToken;
    await el.updateComplete;

    await generate(el, 'a tiger', auth);

    expect(auth.length).toBeGreaterThan(1);
    expect(auth.every((value) => value === 'Bearer eyJ.fetched.sig')).toBe(true);
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it('keeps the cached token when the function identity changes', async () => {
    // A React parent hands over a new closure on every render.
    const { auth } = stubFetchCapturingAuth();
    const first = vi.fn(async () => 'eyJ.first.sig');
    const el = mount(STAGING);
    el.authToken = first;
    await el.updateComplete;
    await generate(el, 'a tiger', auth);

    const second = vi.fn(async () => 'eyJ.second.sig');
    el.authToken = second;
    await el.updateComplete;
    await generate(el, 'a lion', auth);

    expect(second).not.toHaveBeenCalled();
    expect(auth.every((value) => value === 'Bearer eyJ.first.sig')).toBe(true);
  });

  it('refetches after invalidateAuthToken()', async () => {
    // The escape hatch for a sign-out, and the only recovery when a token's
    // `exp` cannot be read and so never goes stale on its own.
    const { auth } = stubFetchCapturingAuth();
    const fetchToken = vi.fn(async () => 'eyJ.fetched.sig');
    const el = mount(STAGING);
    el.authToken = fetchToken;
    await el.updateComplete;
    await generate(el, 'a tiger', auth);
    expect(fetchToken).toHaveBeenCalledTimes(1);

    el.invalidateAuthToken();
    await generate(el, 'a lion', auth);

    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it('does not cache when cacheAuthToken is false', async () => {
    // What the file-uploader plugin sets: the uploader already caches, so the
    // editor must resolve through to it rather than hold its own copy.
    const { auth } = stubFetchCapturingAuth();
    const fetchToken = vi.fn(async () => 'eyJ.fetched.sig');
    const el = mount(STAGING);
    el.cacheAuthToken = false;
    el.authToken = fetchToken;
    await el.updateComplete;

    await generate(el, 'a tiger', auth);

    expect(fetchToken.mock.calls.length).toBeGreaterThan(1);
  });
});
