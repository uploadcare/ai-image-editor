// TEMPORARY: file: dependency, see emulator.testing.ts.
import { type EmulatorSession, mintAuthToken, resetSession } from '@uploadcare/api-emulator';
import { createEmulatorServer } from '@uploadcare/api-emulator/listen';
import { getPrefixedCdnBaseAsync } from '@uploadcare/cname-prefix/async';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiProviderError } from '../model/types';
import { emulatorFetch, plainTextFailure, SEEDED_IMAGE_UUID } from './emulator.testing';
import { UploadcareDerivativeApi } from './uploadcareDerivativeApi';

const PUBLIC_KEY = 'demopublickey';
const CDN = 'https://cdn.example.com';
const NO_DELAY = { pollIntervalMs: 0 } as const;

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });

/**
 * A job that never finishes. The emulator's jobs always reach a terminal frame
 * within four polls, so it can't keep `poll` waiting long enough to time out.
 */
const neverFinishingFetch = () =>
  vi.fn<typeof fetch>(async (_url, init) =>
    jsonResponse(init?.method === 'POST' ? { type: 'job', job_id: 'job-slow' } : { type: 'job', status: 'processing' }),
  );

/**
 * `getFileInfo` goes through upload-client's own transport (node:http here),
 * not the injected fetch, so it needs the emulator as a real origin. Both
 * paths share the emulator's default session.
 */
let uploadOrigin: string;
let closeEmulator: () => Promise<void>;
beforeAll(async () => {
  ({ origin: uploadOrigin, close: closeEmulator } = await createEmulatorServer({ delayMs: 0 }));
});
afterAll(() => closeEmulator());
let session: EmulatorSession;
beforeEach(() => {
  session = resetSession();
});

describe('UploadcareDerivativeApi', () => {
  it('throws when publicKey is missing', () => {
    expect(() => new UploadcareDerivativeApi({ publicKey: '' })).toThrow(/publicKey/);
  });

  it('POSTs the prompt + aspect ratio + pub_key to the derivative endpoint', async () => {
    const fetchImpl = emulatorFetch();
    const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, fetch: fetchImpl, ...NO_DELAY });
    await provider.generate({ prompt: 'a hat', mode: 'generate', aspectRatio: [16, 9] });

    expect(fetchImpl.requests[0].url).toBe('https://upload.uploadcare.com/derivative/image/generate/');
    expect(fetchImpl.requests[0].method).toBe('POST');
    expect(fetchImpl.requests[0].headers.get('Content-Type')).toBe('application/json');
    expect(await fetchImpl.requests[0].json()).toMatchObject({
      pub_key: PUBLIC_KEY,
      prompt: 'a hat',
      aspect_ratio: [16, 9],
      filename: 'generated.png',
    });
  });

  it('forwards request metadata to the generate endpoint', async () => {
    const fetchImpl = emulatorFetch();
    const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, fetch: fetchImpl, ...NO_DELAY });
    await provider.generate({ prompt: 'x', mode: 'generate', metadata: { source: 'ai-image-editor' } });
    expect((await fetchImpl.requests[0].json()).metadata).toEqual({ source: 'ai-image-editor' });
  });

  it('forwards request metadata to the edit endpoint', async () => {
    const fetchImpl = emulatorFetch();
    const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, fetch: fetchImpl, ...NO_DELAY });
    await provider.generate({
      prompt: 'x',
      mode: 'edit',
      source: SEEDED_IMAGE_UUID,
      metadata: { source: 'ai-image-editor' },
    });
    expect(fetchImpl.requests[0].url).toBe('https://upload.uploadcare.com/derivative/image/edit/');
    expect((await fetchImpl.requests[0].json()).metadata).toEqual({ source: 'ai-image-editor' });
  });

  it('uses 1:1 when aspectRatio is missing or invalid', async () => {
    const fetchImpl = emulatorFetch();
    const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, fetch: fetchImpl, ...NO_DELAY });
    await provider.generate({ prompt: 'x', mode: 'generate' });
    expect((await fetchImpl.requests[0].json()).aspect_ratio).toEqual([1, 1]);
  });

  it('polls the status endpoint with pub_key + job_id until the success frame reports is_ready', async () => {
    const fetchImpl = emulatorFetch();
    const provider = new UploadcareDerivativeApi({
      publicKey: PUBLIC_KEY,
      cdnBaseUrl: CDN,
      fetch: fetchImpl,
      ...NO_DELAY,
    });

    const result = await provider.generate({ prompt: 'x', mode: 'generate' });

    expect(result.url).toBe(`${CDN}/${result.uuid}/`);
    // 1 POST + 4 status polls: processing, uploading, success not yet ready, success ready.
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(fetchImpl.requests[1].url).toMatch(
      new RegExp(`^https://upload\\.uploadcare\\.com/derivative/status/\\?pub_key=${PUBLIC_KEY}&job_id=[\\w-]+$`),
    );
    expect(fetchImpl.requests[1].method).toBe('GET');
  });

  it('throws when the job ends in an error status', async () => {
    session.use('derivativeFailure', { code: 'content_moderated' });
    const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, fetch: emulatorFetch(), ...NO_DELAY });
    await expect(provider.generate({ prompt: 'x', mode: 'generate' })).rejects.toMatchObject({
      name: 'AiProviderError',
      errorCode: 'content_moderated',
    });
  });

  it('wraps an internal poll timeout as a generation_timeout provider error', async () => {
    // A zero timeout: `poll` gives up on its own, without the caller's signal ever aborting.
    const provider = new UploadcareDerivativeApi({
      publicKey: PUBLIC_KEY,
      fetch: neverFinishingFetch(),
      pollIntervalMs: 0,
      pollTimeoutMs: 0,
    });
    const err = await provider.generate({ prompt: 'x', mode: 'generate' }).catch((e) => e);
    expect(err).toBeInstanceOf(AiProviderError);
    expect(err.errorCode).toBe('generation_timeout');
    expect(err.message).toContain('job-slow');
  });

  it('times out when the job never reaches a terminal state', async () => {
    const provider = new UploadcareDerivativeApi({
      publicKey: PUBLIC_KEY,
      fetch: neverFinishingFetch(),
      pollIntervalMs: 0,
      pollTimeoutMs: 5,
    });
    await expect(provider.generate({ prompt: 'x', mode: 'generate' })).rejects.toThrow(/time/i);
  });

  it('honours baseUrl + cdnBaseUrl overrides for both generate and status', async () => {
    const fetchImpl = emulatorFetch();
    const provider = new UploadcareDerivativeApi({
      publicKey: PUBLIC_KEY,
      baseUrl: 'https://upload.example.com',
      cdnBaseUrl: CDN,
      fetch: fetchImpl,
      ...NO_DELAY,
    });
    const result = await provider.generate({ prompt: 'x', mode: 'generate' });
    expect(fetchImpl.requests[0].url).toBe('https://upload.example.com/derivative/image/generate/');
    expect(fetchImpl.requests[1].url).toMatch(
      new RegExp(`^https://upload\\.example\\.com/derivative/status/\\?pub_key=${PUBLIC_KEY}&job_id=`),
    );
    expect(result.url).toBe(`${CDN}/${result.uuid}/`);
  });

  it('returns an UploadcareFile on the result (with camelized fields)', async () => {
    const provider = new UploadcareDerivativeApi({
      publicKey: PUBLIC_KEY,
      cdnBaseUrl: CDN,
      fetch: emulatorFetch(),
      ...NO_DELAY,
    });
    const result = await provider.generate({ prompt: 'x', mode: 'generate', filename: 'f.png' });
    expect(result.file.uuid).toBe(result.uuid);
    expect(result.file.cdnUrl).toBe(`${CDN}/${result.uuid}/`);
    expect(result.file.originalFilename).toBe('f.png');
    expect(result.file.isImage).toBe(true);
    expect(result.file.imageInfo).toMatchObject({ width: expect.any(Number), height: expect.any(Number) });
    expect(result.url).toBe(`${CDN}/${result.uuid}/`);
  });

  it('derives the CDN base from the public key when cdnBaseUrl is left at the default', async () => {
    const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, fetch: emulatorFetch(), ...NO_DELAY });
    const result = await provider.generate({ prompt: 'x', mode: 'generate' });
    const base = await getPrefixedCdnBaseAsync(PUBLIC_KEY, 'https://ucarecd.net');
    expect(result.url).toBe(`${base}/${result.uuid}/`);
  });

  it('surfaces non-2xx generate responses with status text', async () => {
    const provider = new UploadcareDerivativeApi({
      publicKey: PUBLIC_KEY,
      fetch: plainTextFailure(400, 'Bad Request'),
      ...NO_DELAY,
    });
    await expect(provider.generate({ prompt: 'x', mode: 'generate' })).rejects.toThrow(/400/);
  });

  it('passes the abort signal to generate and status fetches', async () => {
    const fetchImpl = emulatorFetch();
    const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, fetch: fetchImpl, ...NO_DELAY });
    const controller = new AbortController();
    await provider.generate({ prompt: 'x', mode: 'generate', signal: controller.signal });
    const signals = fetchImpl.mock.calls.map(([, init]) => init?.signal);
    expect(signals.length).toBeGreaterThanOrEqual(2);
    expect(signals.every((s) => s === controller.signal)).toBe(true);
  });

  it('stops polling when the signal is aborted mid-flight', async () => {
    const controller = new AbortController();
    const emulator = emulatorFetch();
    const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
      const response = await emulator(url, init);
      // Abort while "processing": the next poll must never happen.
      if (init?.method === 'GET') controller.abort();
      return response;
    });
    const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, fetch: fetchImpl, ...NO_DELAY });

    await expect(provider.generate({ prompt: 'x', mode: 'generate', signal: controller.signal })).rejects.toThrow(
      /cancel/i,
    );
    // 1 POST + exactly 1 status poll, then it bails — no further polling.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not start polling when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = emulatorFetch();
    const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, fetch: fetchImpl, ...NO_DELAY });
    await expect(provider.generate({ prompt: 'x', mode: 'generate', signal: controller.signal })).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  describe('edit mode', () => {
    it('POSTs prompt + source uuid to the edit endpoint and resolves the result', async () => {
      const fetchImpl = emulatorFetch();
      const provider = new UploadcareDerivativeApi({
        publicKey: PUBLIC_KEY,
        cdnBaseUrl: CDN,
        fetch: fetchImpl,
        ...NO_DELAY,
      });

      const result = await provider.generate({
        prompt: 'remove the cat',
        mode: 'edit',
        source: SEEDED_IMAGE_UUID,
        aspectRatio: [16, 9],
      });

      expect(fetchImpl.requests[0].url).toBe('https://upload.uploadcare.com/derivative/image/edit/');
      expect(await fetchImpl.requests[0].json()).toMatchObject({
        pub_key: PUBLIC_KEY,
        prompt: 'remove the cat',
        source: SEEDED_IMAGE_UUID,
        aspect_ratio: [16, 9],
      });
      expect(result.uuid).not.toBe(SEEDED_IMAGE_UUID);
      expect(result.url).toBe(`${CDN}/${result.uuid}/`);
      expect(result.mode).toBe('edit');
    });

    it('omits aspect_ratio when none is provided', async () => {
      const fetchImpl = emulatorFetch();
      const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, fetch: fetchImpl, ...NO_DELAY });
      await provider.generate({ prompt: 'x', mode: 'edit', source: SEEDED_IMAGE_UUID });
      expect((await fetchImpl.requests[0].json()).aspect_ratio).toBeUndefined();
    });

    it('throws (without any request) when an edit has no source uuid', async () => {
      const fetchImpl = emulatorFetch();
      const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, fetch: fetchImpl, ...NO_DELAY });
      await expect(provider.generate({ prompt: 'x', mode: 'edit' })).rejects.toThrow(/source/i);
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('resolveCdnUrl maps a uuid to its CDN URL', async () => {
      const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, cdnBaseUrl: CDN });
      expect(await provider.resolveCdnUrl('some-uuid')).toBe(`${CDN}/some-uuid/`);
    });
  });

  describe('getFileInfo', () => {
    it('waits for the file to be ready and wraps it as an UploadcareFile on the CDN base', async () => {
      const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, baseUrl: uploadOrigin, cdnBaseUrl: CDN });

      const file = await provider.getFileInfo(SEEDED_IMAGE_UUID);

      expect(file.uuid).toBe(SEEDED_IMAGE_UUID);
      expect(file.cdnUrl).toBe(`${CDN}/${SEEDED_IMAGE_UUID}/`);
      expect(file.imageInfo).toMatchObject({ width: expect.any(Number), height: expect.any(Number) });
    });

    it('honours the abort signal', async () => {
      const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, baseUrl: uploadOrigin });
      const controller = new AbortController();
      controller.abort();
      await expect(provider.getFileInfo(SEEDED_IMAGE_UUID, controller.signal)).rejects.toThrow(/cancel/i);
    });

    it('propagates a lookup failure', async () => {
      const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, baseUrl: uploadOrigin });
      await expect(provider.getFileInfo('missing')).rejects.toThrow(/not found/i);
    });
  });

  describe('authToken', () => {
    // A signed-uploads project refuses every request without a valid Bearer
    // token, so each call below succeeding is the proof the token got there.
    beforeEach(() => {
      session.use('signedUploads');
    });

    it('carries the token on both network paths', async () => {
      // The two paths are independent: `generate`/`edit`/`status` go through
      // the client's own fetch, while `getFileInfo` hands options to
      // upload-client's isReadyPoll. Dropping either assignment would leave
      // half the provider unauthenticated.
      const token = await mintAuthToken();
      const fetchImpl = emulatorFetch();
      const provider = new UploadcareDerivativeApi({
        publicKey: PUBLIC_KEY,
        baseUrl: uploadOrigin,
        authToken: token,
        fetch: fetchImpl,
        ...NO_DELAY,
      });

      await provider.generate({ prompt: 'x', mode: 'generate' });
      expect(fetchImpl.requests[0].headers.get('Authorization')).toBe(`Bearer ${token}`);

      await expect(provider.getFileInfo(SEEDED_IMAGE_UUID)).resolves.toMatchObject({ uuid: SEEDED_IMAGE_UUID });
    });

    it('is refused on both network paths without one', async () => {
      const provider = new UploadcareDerivativeApi({
        publicKey: PUBLIC_KEY,
        baseUrl: uploadOrigin,
        fetch: emulatorFetch(),
        ...NO_DELAY,
      });
      await expect(provider.generate({ prompt: 'x', mode: 'generate' })).rejects.toThrow(/signature/i);
      await expect(provider.getFileInfo(SEEDED_IMAGE_UUID)).rejects.toThrow(/signature/i);
    });

    it('follows a token that changes, on both network paths', async () => {
      // The provider holds one resolver for its lifetime; whoever owns the
      // token changes what that resolver returns, and nothing is pushed in.
      let token = 'not-a-token';
      const fetchImpl = emulatorFetch();
      const provider = new UploadcareDerivativeApi({
        publicKey: PUBLIC_KEY,
        baseUrl: uploadOrigin,
        authToken: () => token,
        fetch: fetchImpl,
        ...NO_DELAY,
      });

      token = await mintAuthToken({ tokenId: 'second' });

      await provider.generate({ prompt: 'x', mode: 'generate' });
      expect(fetchImpl.requests[0].headers.get('Authorization')).toBe(`Bearer ${token}`);
      await expect(provider.getFileInfo(SEEDED_IMAGE_UUID)).resolves.toMatchObject({ uuid: SEEDED_IMAGE_UUID });
    });
  });
});
