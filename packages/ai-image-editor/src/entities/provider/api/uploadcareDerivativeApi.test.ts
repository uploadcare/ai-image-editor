import { DEMO_IMAGE_UUID, mintAuthToken } from '@uploadcare/api-emulator';
import { getPrefixedCdnBaseAsync } from '@uploadcare/cname-prefix/async';
import type { UploadcareFile } from '@uploadcare/upload-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { session } from '../../../../tests/specs/setup';
import { AiProviderError } from '../model/types';
import { UploadcareDerivativeApi } from './uploadcareDerivativeApi';

const PUBLIC_KEY = 'demopublickey';
const CDN = 'https://cdn.example.com';
const NO_DELAY = { pollIntervalMs: 0 } as const;
const STATUS_PATH = '/derivative/status/';
const STATUS = `GET ${STATUS_PATH}`;

/** A result's width over its height. */
const ratioOf = (file: UploadcareFile) =>
  (file.imageInfo?.width ?? Number.NaN) / (file.imageInfo?.height ?? Number.NaN);

/** Answers nothing, ever: a request to `route` stays in flight until its caller aborts it. */
const hang = (route: string) => session.on(route, () => new Promise<never>(() => {}));

/** A job that never finishes: every status poll answers `processing`. */
const neverFinish = () => session.on(STATUS, () => Response.json({ type: 'job', status: 'processing' }));

describe('UploadcareDerivativeApi', () => {
  it('throws when publicKey is missing', () => {
    expect(() => new UploadcareDerivativeApi({ publicKey: '' })).toThrow(/publicKey/);
  });

  it('generates an image at the requested aspect ratio', async () => {
    const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, ...NO_DELAY });
    const { file } = await provider.generate({ prompt: 'a hat', mode: 'generate', aspectRatio: [16, 9] });
    expect(ratioOf(file)).toBe(16 / 9);
  });

  it('names the result generated.png when no filename is given', async () => {
    const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, ...NO_DELAY });
    const { file } = await provider.generate({ prompt: 'x', mode: 'generate' });
    expect(file.originalFilename).toBe('generated.png');
  });

  it('forwards request metadata to the generate endpoint', async () => {
    const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, ...NO_DELAY });
    await provider.generate({ prompt: 'x', mode: 'generate', metadata: { source: 'ai-image-editor' } });
    expect((await session.requests[0].json()).metadata).toEqual({ source: 'ai-image-editor' });
  });

  it('forwards request metadata to the edit endpoint', async () => {
    const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, ...NO_DELAY });
    await provider.generate({
      prompt: 'x',
      mode: 'edit',
      source: DEMO_IMAGE_UUID,
      metadata: { source: 'ai-image-editor' },
    });
    expect(session.requests[0].url).toBe('https://upload.uploadcare.com/derivative/image/edit/');
    expect((await session.requests[0].json()).metadata).toEqual({ source: 'ai-image-editor' });
  });

  it.each([
    ['missing', undefined],
    ['not positive', [0, 1]],
    ['wider than 10:1', [20, 1]],
  ] as const)('generates a square image when aspectRatio is %s', async (_, aspectRatio) => {
    const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, ...NO_DELAY });
    const { file } = await provider.generate({
      prompt: 'x',
      mode: 'generate',
      aspectRatio: aspectRatio && [...aspectRatio],
    });
    expect(ratioOf(file)).toBe(1);
  });

  it('keeps polling through processing, uploading and an unready success until is_ready', async () => {
    // Oldest first: the emulator's own frames, walked straight to ready.
    session.use('derivativesInstant');
    session.on(STATUS, async ({ next }) => Response.json({ ...(await (await next())?.json()), is_ready: false }), {
      times: 1,
    });
    session.on(STATUS, () => Response.json({ type: 'job', status: 'uploading' }), { times: 1 });
    session.on(STATUS, () => Response.json({ type: 'job', status: 'processing' }), { times: 1 });
    const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, cdnBaseUrl: CDN, ...NO_DELAY });

    const result = await provider.generate({ prompt: 'x', mode: 'generate' });

    expect(result.url).toBe(`${CDN}/${result.uuid}/`);
    // processing, uploading, unready success, ready success: one poll each, none after.
    expect(session.requests.filter((request) => new URL(request.url).pathname === STATUS_PATH)).toHaveLength(4);
  });

  it('throws when the job ends in an error status', async () => {
    session.use('derivativeFailure', { code: 'content_moderated' });
    const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, ...NO_DELAY });
    await expect(provider.generate({ prompt: 'x', mode: 'generate' })).rejects.toMatchObject({
      name: 'AiProviderError',
      errorCode: 'content_moderated',
    });
  });

  it('wraps an internal poll timeout as a generation_timeout provider error', async () => {
    // A zero timeout: `poll` gives up on its own, without the caller's signal ever aborting.
    neverFinish();
    let jobId: string | undefined;
    session.on('POST /derivative/image/generate/', async ({ next }) => {
      const answer = await next();
      jobId = (await answer?.clone().json())?.job_id;
      return answer;
    });
    const provider = new UploadcareDerivativeApi({
      publicKey: PUBLIC_KEY,
      pollIntervalMs: 0,
      pollTimeoutMs: 0,
    });
    const pending = provider.generate({ prompt: 'x', mode: 'generate' });
    await expect(pending).rejects.toBeInstanceOf(AiProviderError);
    await expect(pending).rejects.toMatchObject({ errorCode: 'generation_timeout' });
    expect(jobId).toEqual(expect.any(String));
    await expect(pending).rejects.toThrow(jobId);
  });

  describe('when a status poll fails mid-job', () => {
    /** The job's status polls, in order. */
    const statusPolls = () => session.requests.filter((request) => new URL(request.url).pathname === STATUS_PATH);

    /** The job's first poll answers `processing`; the next one answers `failure`. */
    const failSecondPoll = (failure: () => Response) => {
      session.on(STATUS, failure, { times: 1 });
      session.on(STATUS, () => Response.json({ type: 'job', status: 'processing' }), { times: 1 });
    };

    it('rejects with the status of a 5xx, and polls no more', async () => {
      failSecondPoll(() => new Response('upstream down', { status: 503, statusText: 'Service Unavailable' }));
      const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, ...NO_DELAY });

      await expect(provider.generate({ prompt: 'x', mode: 'generate' })).rejects.toThrow(/503 Service Unavailable/);
      expect(statusPolls()).toHaveLength(2);
    });
  });

  describe('with the default poll options', () => {
    // The documented defaults: a poll every 1.5s, giving up after 1,000,000ms.
    const INTERVAL = 1500;
    const TIMEOUT = 1_000_000;

    // Only the clock is fake: the emulator's requests still need real I/O turns to complete.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      return () => vi.useRealTimers();
    });

    /** Starts a generation and tracks whether it has settled. */
    const start = () => {
      const run = { settled: false, pending: Promise.resolve() as Promise<unknown> };
      run.pending = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY })
        .generate({ prompt: 'x', mode: 'generate' })
        .finally(() => {
          run.settled = true;
        });
      run.pending.catch(() => {});
      return run;
    };

    /** Lets the in-flight request finish, without moving the clock, until the poll sleeps or `run` settles. */
    const untilIdle = async (run: { settled: boolean }) => {
      while (vi.getTimerCount() === 0 && !run.settled) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    };

    it('waits the default interval between status polls', async () => {
      const polledAt: number[] = [];
      session.on(STATUS, () => {
        polledAt.push(Date.now());
        return Response.json({ type: 'job', status: 'processing' });
      });
      const run = start();

      for (let sleeps = 0; sleeps < 3; sleeps++) {
        await untilIdle(run);
        await vi.advanceTimersToNextTimerAsync();
      }
      await untilIdle(run);

      expect(polledAt.slice(1).map((at, i) => at - polledAt[i])).toEqual([INTERVAL, INTERVAL, INTERVAL]);
    });

    it('gives up at the default timeout', async () => {
      neverFinish();
      const startedAt = Date.now();
      const run = start();

      for (;;) {
        await untilIdle(run);
        if (run.settled) break;
        await vi.advanceTimersToNextTimerAsync();
      }

      expect(Date.now() - startedAt).toBe(TIMEOUT);
      await expect(run.pending).rejects.toMatchObject({ name: 'AiProviderError', errorCode: 'generation_timeout' });
    });
  });

  it('honours baseUrl + cdnBaseUrl overrides for both generate and status', async () => {
    const provider = new UploadcareDerivativeApi({
      publicKey: PUBLIC_KEY,
      baseUrl: 'https://upload.example.com',
      cdnBaseUrl: CDN,
      ...NO_DELAY,
    });
    const result = await provider.generate({ prompt: 'x', mode: 'generate' });
    expect(session.requests[0].url).toBe('https://upload.example.com/derivative/image/generate/');
    expect(session.requests[1].url).toMatch(
      new RegExp(`^https://upload\\.example\\.com/derivative/status/\\?pub_key=${PUBLIC_KEY}&job_id=`),
    );
    expect(result.url).toBe(`${CDN}/${result.uuid}/`);
  });

  it('returns an UploadcareFile on the result (with camelized fields)', async () => {
    const provider = new UploadcareDerivativeApi({
      publicKey: PUBLIC_KEY,
      cdnBaseUrl: CDN,
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
    const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, ...NO_DELAY });
    const result = await provider.generate({ prompt: 'x', mode: 'generate' });
    const base = await getPrefixedCdnBaseAsync(PUBLIC_KEY, 'https://ucarecd.net');
    expect(result.url).toBe(`${base}/${result.uuid}/`);
  });

  it('surfaces non-2xx generate responses with status text', async () => {
    session.on(
      'POST /derivative/image/generate/',
      () => new Response('upstream failure', { status: 400, statusText: 'Bad Request' }),
    );
    const provider = new UploadcareDerivativeApi({
      publicKey: PUBLIC_KEY,
      ...NO_DELAY,
    });
    await expect(provider.generate({ prompt: 'x', mode: 'generate' })).rejects.toThrow(/400/);
  });

  it('cancels a job that is still starting when the caller aborts', async () => {
    hang('POST /derivative/image/generate/');
    const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, ...NO_DELAY });
    const controller = new AbortController();

    const pending = provider.generate({ prompt: 'x', mode: 'generate', signal: controller.signal });
    await vi.waitFor(() => expect(session.requests).toHaveLength(1));
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('cancels a status poll in flight when the caller aborts', async () => {
    hang(STATUS);
    const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, ...NO_DELAY });
    const controller = new AbortController();

    const pending = provider.generate({ prompt: 'x', mode: 'generate', signal: controller.signal });
    // The start, then the first status poll.
    await vi.waitFor(() => expect(session.requests).toHaveLength(2));
    controller.abort();

    await expect(pending).rejects.toThrow(/cancel/i);
  });

  it('sends nothing when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, ...NO_DELAY });
    await expect(provider.generate({ prompt: 'x', mode: 'generate', signal: controller.signal })).rejects.toMatchObject(
      { name: 'AbortError' },
    );
    expect(session.requests).toHaveLength(0);
  });

  describe('edit mode', () => {
    it('edits the source into a new file at the requested aspect ratio', async () => {
      const provider = new UploadcareDerivativeApi({
        publicKey: PUBLIC_KEY,
        cdnBaseUrl: CDN,
        ...NO_DELAY,
      });

      const result = await provider.generate({
        prompt: 'remove the cat',
        mode: 'edit',
        source: DEMO_IMAGE_UUID,
        aspectRatio: [16, 9],
      });

      expect(session.requests[0].url).toBe('https://upload.uploadcare.com/derivative/image/edit/');
      expect(result.uuid).not.toBe(DEMO_IMAGE_UUID);
      expect(ratioOf(result.file)).toBe(16 / 9);
      expect(result.url).toBe(`${CDN}/${result.uuid}/`);
      expect(result.mode).toBe('edit');
    });

    it("keeps the source's dimensions when no aspectRatio is given", async () => {
      const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, ...NO_DELAY });
      const source = await provider.getFileInfo(DEMO_IMAGE_UUID);
      const { file } = await provider.generate({ prompt: 'x', mode: 'edit', source: DEMO_IMAGE_UUID });
      expect(file.imageInfo).toMatchObject({ width: source.imageInfo?.width, height: source.imageInfo?.height });
      // The seeded demo image is not square, so a 1:1 default would show here.
      expect(ratioOf(file)).not.toBe(1);
    });

    it('throws (without any request) when an edit has no source uuid', async () => {
      const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, ...NO_DELAY });
      await expect(provider.generate({ prompt: 'x', mode: 'edit' })).rejects.toThrow(/source/i);
      expect(session.requests).toHaveLength(0);
    });

    it('resolveCdnUrl maps a uuid to its CDN URL', async () => {
      const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, cdnBaseUrl: CDN });
      expect(await provider.resolveCdnUrl('some-uuid')).toBe(`${CDN}/some-uuid/`);
    });
  });

  describe('getFileInfo', () => {
    it('waits for the file to be ready and wraps it as an UploadcareFile on the CDN base', async () => {
      const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY, cdnBaseUrl: CDN });

      const file = await provider.getFileInfo(DEMO_IMAGE_UUID);

      expect(file.uuid).toBe(DEMO_IMAGE_UUID);
      expect(file.cdnUrl).toBe(`${CDN}/${DEMO_IMAGE_UUID}/`);
      expect(file.imageInfo).toMatchObject({ width: expect.any(Number), height: expect.any(Number) });
    });

    it('honours the abort signal', async () => {
      const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY });
      const controller = new AbortController();
      controller.abort();
      await expect(provider.getFileInfo(DEMO_IMAGE_UUID, controller.signal)).rejects.toThrow(/cancel/i);
    });

    it('propagates a lookup failure', async () => {
      const provider = new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY });
      // A well-formed uuid the session does not hold: a malformed id would be
      // refused earlier, as invalid, and never reach the not-found lookup.
      await expect(provider.getFileInfo('00000000-0000-4000-8000-000000000000')).rejects.toThrow(/not found/i);
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
      const provider = new UploadcareDerivativeApi({
        publicKey: PUBLIC_KEY,
        authToken: token,
        ...NO_DELAY,
      });

      await provider.generate({ prompt: 'x', mode: 'generate' });
      expect(session.requests[0].headers.get('Authorization')).toBe(`Bearer ${token}`);

      await expect(provider.getFileInfo(DEMO_IMAGE_UUID)).resolves.toMatchObject({ uuid: DEMO_IMAGE_UUID });
    });

    it('is refused on both network paths without one', async () => {
      const provider = new UploadcareDerivativeApi({
        publicKey: PUBLIC_KEY,
        ...NO_DELAY,
      });
      await expect(provider.generate({ prompt: 'x', mode: 'generate' })).rejects.toThrow(/signature/i);
      await expect(provider.getFileInfo(DEMO_IMAGE_UUID)).rejects.toThrow(/signature/i);
    });

    it('follows a token that changes, on both network paths', async () => {
      // The provider holds one resolver for its lifetime; whoever owns the
      // token changes what that resolver returns, and nothing is pushed in.
      const [first, second] = [await mintAuthToken({ tokenId: 'first' }), await mintAuthToken({ tokenId: 'second' })];
      let token = first;
      const provider = new UploadcareDerivativeApi({
        publicKey: PUBLIC_KEY,
        authToken: () => token,
        ...NO_DELAY,
      });
      const tokensSent = (requests: Request[]) =>
        new Set(requests.map((request) => request.headers.get('Authorization')));

      await provider.generate({ prompt: 'x', mode: 'generate' });
      await expect(provider.getFileInfo(DEMO_IMAGE_UUID)).resolves.toMatchObject({ uuid: DEMO_IMAGE_UUID });
      const beforeRotation = session.requests.length;

      token = second;
      await provider.generate({ prompt: 'x', mode: 'generate' });
      await expect(provider.getFileInfo(DEMO_IMAGE_UUID)).resolves.toMatchObject({ uuid: DEMO_IMAGE_UUID });

      expect(tokensSent(session.requests.slice(0, beforeRotation))).toEqual(new Set([`Bearer ${first}`]));
      expect(tokensSent(session.requests.slice(beforeRotation))).toEqual(new Set([`Bearer ${second}`]));
    });
  });
});
