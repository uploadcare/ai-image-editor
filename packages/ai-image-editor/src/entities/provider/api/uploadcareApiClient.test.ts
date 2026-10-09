import { DEMO_IMAGE_UUID, mintAuthToken } from '@uploadcare/api-emulator';
import { describe, expect, it, vi } from 'vitest';
import { session } from '../../../../tests/specs/setup';
import { AiProviderError } from '../model/types';
import { UploadcareApiClient } from './uploadcareApiClient';

const PUBLIC_KEY = 'demopublickey';

/** Answers nothing, ever: a request to `route` stays in flight until its caller aborts it. */
const hang = (route: string) => session.on(route, () => new Promise<never>(() => {}));

describe('UploadcareApiClient', () => {
  it('throws when publicKey is missing', () => {
    expect(() => new UploadcareApiClient({ publicKey: '' })).toThrow(/publicKey/);
  });

  describe('authToken', () => {
    it('sends no Authorization header when unset', async () => {
      const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY });

      await client.generate({ prompt: 'x', aspectRatio: [1, 1], filename: 'f.png' });

      expect(session.requests[0].headers.get('Authorization')).toBeNull();
    });

    it('sends a plain token as a bearer header', async () => {
      const token = await mintAuthToken();
      const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY, authToken: token });

      await client.generate({ prompt: 'x', aspectRatio: [1, 1], filename: 'f.png' });

      expect(session.requests[0].headers.get('Authorization')).toBe(`Bearer ${token}`);
    });

    it('re-resolves a resolver per request, so a job can rotate tokens mid-flight', async () => {
      const [first, second] = [await mintAuthToken({ tokenId: 'first' }), await mintAuthToken({ tokenId: 'second' })];
      const authToken = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
      const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY, authToken });

      const { job_id } = await client.generate({ prompt: 'x', aspectRatio: [1, 1], filename: 'f.png' });
      await client.getJobStatus(job_id!);

      expect(session.requests[0].headers.get('Authorization')).toBe(`Bearer ${first}`);
      expect(session.requests[1].headers.get('Authorization')).toBe(`Bearer ${second}`);
    });
  });

  describe('generate', () => {
    it('POSTs pub_key + prompt + aspect_ratio + filename and returns the job', async () => {
      const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY });

      const job = await client.generate({ prompt: 'a hat', aspectRatio: [16, 9], filename: 'generated.png' });

      expect(job).toEqual({ type: 'job', job_id: expect.any(String) });
      expect(session.requests[0].url).toBe('https://upload.uploadcare.com/derivative/image/generate/');
      expect(session.requests[0].method).toBe('POST');
      expect(await session.requests[0].json()).toMatchObject({
        pub_key: PUBLIC_KEY,
        prompt: 'a hat',
        aspect_ratio: [16, 9],
        filename: 'generated.png',
      });
    });

    it('includes store only when provided', async () => {
      const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY });

      await client.generate({ prompt: 'x', aspectRatio: [1, 1], filename: 'f.png' });
      await client.generate({ prompt: 'x', aspectRatio: [1, 1], filename: 'f.png', store: true });

      expect((await session.requests[0].json()).store).toBeUndefined();
      expect((await session.requests[1].json()).store).toBe(true);
    });

    it('includes metadata only when provided', async () => {
      const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY });

      await client.generate({ prompt: 'x', aspectRatio: [1, 1], filename: 'f.png' });
      await client.generate({
        prompt: 'x',
        aspectRatio: [1, 1],
        filename: 'f.png',
        metadata: { source: 'ai-image-editor' },
      });

      expect((await session.requests[0].json()).metadata).toBeUndefined();
      expect((await session.requests[1].json()).metadata).toEqual({ source: 'ai-image-editor' });
    });

    it('honours baseUrl override', async () => {
      const client = new UploadcareApiClient({
        publicKey: PUBLIC_KEY,
        baseUrl: 'https://upload.example.com/',
      });
      await client.generate({ prompt: 'x', aspectRatio: [1, 1], filename: 'f.png' });
      expect(session.requests[0].url).toBe('https://upload.example.com/derivative/image/generate/');
    });

    it('throws with status text on a non-2xx response that is not the error envelope', async () => {
      session.on(
        'POST /derivative/image/generate/',
        () => new Response('upstream failure', { status: 400, statusText: 'Bad Request' }),
      );
      const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY });
      await expect(client.generate({ prompt: 'x', aspectRatio: [1, 1], filename: 'f.png' })).rejects.toThrow(/400/);
    });

    it('gives up on a hanging request when the caller aborts', async () => {
      hang('POST /derivative/image/generate/');
      const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY });
      const controller = new AbortController();

      const pending = client.generate({
        prompt: 'x',
        aspectRatio: [1, 1],
        filename: 'f.png',
        signal: controller.signal,
      });
      await vi.waitFor(() => expect(session.requests).toHaveLength(1));
      controller.abort();

      await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('sends Accept: application/json', async () => {
      const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY });
      await client.generate({ prompt: 'x', aspectRatio: [1, 1], filename: 'f.png' });
      expect(session.requests[0].headers.get('Accept')).toBe('application/json');
    });

    it('surfaces a platform error envelope as an AiProviderError with its code', async () => {
      session.use('derivativesDisabled');
      const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY });
      await expect(client.generate({ prompt: 'x', aspectRatio: [1, 1], filename: 'f.png' })).rejects.toMatchObject({
        name: 'AiProviderError',
        errorCode: 'derivative_disabled',
        message: 'Derivatives are not enabled for this project.',
      });
    });
  });

  describe('edit', () => {
    it('POSTs pub_key + prompt + source uuid + filename to the edit endpoint', async () => {
      const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY });

      const job = await client.edit({ prompt: 'remove the cat', source: DEMO_IMAGE_UUID, filename: 'edited.png' });

      expect(job).toEqual({ type: 'job', job_id: expect.any(String) });
      expect(session.requests[0].url).toBe('https://upload.uploadcare.com/derivative/image/edit/');
      expect(session.requests[0].method).toBe('POST');
      expect(await session.requests[0].json()).toMatchObject({
        pub_key: PUBLIC_KEY,
        prompt: 'remove the cat',
        source: DEMO_IMAGE_UUID,
        filename: 'edited.png',
      });
    });

    it('includes aspect_ratio only when provided', async () => {
      const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY });

      await client.edit({ prompt: 'x', source: DEMO_IMAGE_UUID, filename: 'f.png' });
      await client.edit({ prompt: 'x', source: DEMO_IMAGE_UUID, filename: 'f.png', aspectRatio: [16, 9] });

      expect((await session.requests[0].json()).aspect_ratio).toBeUndefined();
      expect((await session.requests[1].json()).aspect_ratio).toEqual([16, 9]);
    });

    it('includes metadata only when provided', async () => {
      const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY });

      await client.edit({ prompt: 'x', source: DEMO_IMAGE_UUID, filename: 'f.png' });
      await client.edit({
        prompt: 'x',
        source: DEMO_IMAGE_UUID,
        filename: 'f.png',
        metadata: { source: 'ai-image-editor' },
      });

      expect((await session.requests[0].json()).metadata).toBeUndefined();
      expect((await session.requests[1].json()).metadata).toEqual({ source: 'ai-image-editor' });
    });

    it('surfaces a source the project does not have as an AiProviderError', async () => {
      const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY });
      await expect(client.edit({ prompt: 'x', source: 'missing', filename: 'f.png' })).rejects.toMatchObject({
        name: 'AiProviderError',
        errorCode: 'source_not_found',
      });
    });

    it('throws with status text on a non-2xx response that is not the error envelope', async () => {
      session.on(
        'POST /derivative/image/edit/',
        () => new Response('upstream failure', { status: 400, statusText: 'Bad Request' }),
      );
      const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY });
      await expect(client.edit({ prompt: 'x', source: 'u', filename: 'f.png' })).rejects.toThrow(/400/);
    });

    it('gives up on a hanging request when the caller aborts', async () => {
      hang('POST /derivative/image/edit/');
      const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY });
      const controller = new AbortController();

      const pending = client.edit({
        prompt: 'x',
        source: DEMO_IMAGE_UUID,
        filename: 'f.png',
        signal: controller.signal,
      });
      await vi.waitFor(() => expect(session.requests).toHaveLength(1));
      controller.abort();

      await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    });
  });

  describe('getJobStatus', () => {
    const startJob = async (client: UploadcareApiClient) =>
      (await client.generate({ prompt: 'x', aspectRatio: [1, 1], filename: 'f.png' })).job_id!;

    it('GETs the status endpoint with pub_key + job_id and returns the parsed status', async () => {
      const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY });
      const jobId = await startJob(client);

      const status = await client.getJobStatus(jobId);

      expect(status).toEqual({ type: 'job', status: 'processing' });
      expect(session.requests[1].url).toBe(
        `https://upload.uploadcare.com/derivative/status/?pub_key=${PUBLIC_KEY}&job_id=${jobId}`,
      );
      expect(session.requests[1].method).toBe('GET');
    });

    it('throws with status text on a non-2xx response that is not the error envelope', async () => {
      session.on(
        'GET /derivative/status/',
        () => new Response('upstream failure', { status: 404, statusText: 'Not Found' }),
      );
      const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY });
      await expect(client.getJobStatus('job-1')).rejects.toThrow(/404/);
    });

    it('surfaces a platform error envelope (e.g. job_not_found) as an AiProviderError', async () => {
      const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY });
      const err = await client.getJobStatus('job-1').catch((e) => e);
      expect(err).toBeInstanceOf(AiProviderError);
      expect(err.errorCode).toBe('job_not_found');
    });

    it('gives up on a hanging request when the caller aborts', async () => {
      hang('GET /derivative/status/');
      const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY });
      const jobId = await startJob(client);
      const controller = new AbortController();

      const pending = client.getJobStatus(jobId, controller.signal);
      await vi.waitFor(() => expect(session.requests).toHaveLength(2));
      controller.abort();

      await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    });
  });
});
