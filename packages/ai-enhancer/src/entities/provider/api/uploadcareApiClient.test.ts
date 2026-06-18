import { describe, expect, it, vi } from 'vitest';
import { AiProviderError } from '../model/types';
import { UploadcareApiClient } from './uploadcareApiClient';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('UploadcareApiClient', () => {
  it('throws when publicKey is missing', () => {
    expect(() => new UploadcareApiClient({ publicKey: '' })).toThrow(/publicKey/);
  });

  describe('generate', () => {
    it('POSTs pub_key + prompt + aspect_ratio + filename and returns the job', async () => {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ type: 'job', job_id: 'job-1' }));
      const client = new UploadcareApiClient({ publicKey: 'pk', fetch: fetchImpl });

      const job = await client.generate({ prompt: 'a hat', aspectRatio: [16, 9], filename: 'generated.png' });

      expect(job).toEqual({ type: 'job', job_id: 'job-1' });
      const [url, init] = fetchImpl.mock.calls[0]! as [string, RequestInit];
      expect(url).toBe('https://upload.uploadcare.com/derivative/image/generate/');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toMatchObject({
        pub_key: 'pk',
        prompt: 'a hat',
        aspect_ratio: [16, 9],
        filename: 'generated.png',
      });
    });

    it('includes store only when provided', async () => {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ type: 'job', job_id: 'j' }));
      const client = new UploadcareApiClient({ publicKey: 'pk', fetch: fetchImpl });
      await client.generate({ prompt: 'x', aspectRatio: [1, 1], filename: 'f.png', store: true });
      const [, init] = fetchImpl.mock.calls[0]! as [string, RequestInit];
      expect(JSON.parse(init.body as string).store).toBe(true);
    });

    it('includes metadata only when provided', async () => {
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse({ type: 'job', job_id: 'j' }));
      const client = new UploadcareApiClient({ publicKey: 'pk', fetch: fetchImpl });

      await client.generate({ prompt: 'x', aspectRatio: [1, 1], filename: 'f.png' });
      expect(JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string).metadata).toBeUndefined();

      await client.generate({ prompt: 'x', aspectRatio: [1, 1], filename: 'f.png', metadata: { source: 'ai-enhancer' } });
      expect(JSON.parse((fetchImpl.mock.calls[1]![1] as RequestInit).body as string).metadata).toEqual({
        source: 'ai-enhancer',
      });
    });

    it('honours baseUrl override', async () => {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ type: 'job', job_id: 'j' }));
      const client = new UploadcareApiClient({
        publicKey: 'pk',
        baseUrl: 'https://upload.example.com/',
        fetch: fetchImpl,
      });
      await client.generate({ prompt: 'x', aspectRatio: [1, 1], filename: 'f.png' });
      const [url] = fetchImpl.mock.calls[0]! as [string, RequestInit];
      expect(url).toBe('https://upload.example.com/derivative/image/generate/');
    });

    it('throws with status text on non-2xx', async () => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('bad ratio', { status: 400, statusText: 'Bad Request' }));
      const client = new UploadcareApiClient({ publicKey: 'pk', fetch: fetchImpl });
      await expect(client.generate({ prompt: 'x', aspectRatio: [1, 1], filename: 'f.png' })).rejects.toThrow(/400/);
    });

    it('forwards the abort signal', async () => {
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        return jsonResponse({ type: 'job', job_id: 'j' });
      });
      const client = new UploadcareApiClient({ publicKey: 'pk', fetch: fetchImpl });
      const controller = new AbortController();
      await client.generate({ prompt: 'x', aspectRatio: [1, 1], filename: 'f.png', signal: controller.signal });
    });

    it('sends Accept: application/json', async () => {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ type: 'job', job_id: 'j' }));
      const client = new UploadcareApiClient({ publicKey: 'pk', fetch: fetchImpl });
      await client.generate({ prompt: 'x', aspectRatio: [1, 1], filename: 'f.png' });
      const [, init] = fetchImpl.mock.calls[0]! as [string, RequestInit];
      expect((init.headers as Record<string, string>).Accept).toBe('application/json');
    });

    it('surfaces a platform error envelope as an AiProviderError with its code', async () => {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({ error: { status_code: 400, error_code: 'canvas_too_large', content: 'Canvas size exceeds the 4MP limit.' } }),
      );
      const client = new UploadcareApiClient({ publicKey: 'pk', fetch: fetchImpl });
      await expect(client.generate({ prompt: 'x', aspectRatio: [1, 1], filename: 'f.png' })).rejects.toMatchObject({
        name: 'AiProviderError',
        errorCode: 'canvas_too_large',
        message: 'Canvas size exceeds the 4MP limit.',
      });
    });
  });

  describe('edit', () => {
    it('POSTs pub_key + prompt + source uuid + filename to the edit endpoint', async () => {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ type: 'job', job_id: 'job-e' }));
      const client = new UploadcareApiClient({ publicKey: 'pk', fetch: fetchImpl });

      const job = await client.edit({ prompt: 'remove the cat', source: 'src-uuid', filename: 'edited.png' });

      expect(job).toEqual({ type: 'job', job_id: 'job-e' });
      const [url, init] = fetchImpl.mock.calls[0]! as [string, RequestInit];
      expect(url).toBe('https://upload.uploadcare.com/derivative/image/edit/');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toMatchObject({
        pub_key: 'pk',
        prompt: 'remove the cat',
        source: 'src-uuid',
        filename: 'edited.png',
      });
    });

    it('includes aspect_ratio only when provided', async () => {
      // Fresh Response per call — a single shared Response body can be read once.
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse({ type: 'job', job_id: 'j' }));
      const client = new UploadcareApiClient({ publicKey: 'pk', fetch: fetchImpl });

      await client.edit({ prompt: 'x', source: 'u', filename: 'f.png' });
      expect(JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string).aspect_ratio).toBeUndefined();

      await client.edit({ prompt: 'x', source: 'u', filename: 'f.png', aspectRatio: [16, 9] });
      expect(JSON.parse((fetchImpl.mock.calls[1]![1] as RequestInit).body as string).aspect_ratio).toEqual([16, 9]);
    });

    it('includes metadata only when provided', async () => {
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse({ type: 'job', job_id: 'j' }));
      const client = new UploadcareApiClient({ publicKey: 'pk', fetch: fetchImpl });

      await client.edit({ prompt: 'x', source: 'u', filename: 'f.png' });
      expect(JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string).metadata).toBeUndefined();

      await client.edit({ prompt: 'x', source: 'u', filename: 'f.png', metadata: { source: 'ai-enhancer' } });
      expect(JSON.parse((fetchImpl.mock.calls[1]![1] as RequestInit).body as string).metadata).toEqual({
        source: 'ai-enhancer',
      });
    });

    it('throws with status text on non-2xx', async () => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('bad source', { status: 400, statusText: 'Bad Request' }));
      const client = new UploadcareApiClient({ publicKey: 'pk', fetch: fetchImpl });
      await expect(client.edit({ prompt: 'x', source: 'u', filename: 'f.png' })).rejects.toThrow(/400/);
    });

    it('forwards the abort signal', async () => {
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        return jsonResponse({ type: 'job', job_id: 'j' });
      });
      const client = new UploadcareApiClient({ publicKey: 'pk', fetch: fetchImpl });
      const controller = new AbortController();
      await client.edit({ prompt: 'x', source: 'u', filename: 'f.png', signal: controller.signal });
    });
  });

  describe('getJobStatus', () => {
    it('GETs the status endpoint with pub_key + job_id and returns the parsed status', async () => {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ type: 'job', status: 'processing' }));
      const client = new UploadcareApiClient({ publicKey: 'pk', fetch: fetchImpl });

      const status = await client.getJobStatus('job-42');

      expect(status).toEqual({ type: 'job', status: 'processing' });
      const [url, init] = fetchImpl.mock.calls[0]! as [string, RequestInit];
      expect(url).toBe('https://upload.uploadcare.com/derivative/status/?pub_key=pk&job_id=job-42');
      expect((init?.method ?? 'GET').toUpperCase()).toBe('GET');
    });

    it('throws with status text on non-2xx', async () => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('nope', { status: 404, statusText: 'Not Found' }));
      const client = new UploadcareApiClient({ publicKey: 'pk', fetch: fetchImpl });
      await expect(client.getJobStatus('job-1')).rejects.toThrow(/404/);
    });

    it('surfaces a platform error envelope (e.g. job_not_found) as an AiProviderError', async () => {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({ error: { status_code: 404, error_code: 'job_not_found', content: 'Derivative job is not found.' } }),
      );
      const client = new UploadcareApiClient({ publicKey: 'pk', fetch: fetchImpl });
      const err = await client.getJobStatus('job-1').catch((e) => e);
      expect(err).toBeInstanceOf(AiProviderError);
      expect(err.errorCode).toBe('job_not_found');
    });

    it('forwards the abort signal', async () => {
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        return jsonResponse({ type: 'job', status: 'processing' });
      });
      const client = new UploadcareApiClient({ publicKey: 'pk', fetch: fetchImpl });
      const controller = new AbortController();
      await client.getJobStatus('job-1', controller.signal);
    });
  });
});
