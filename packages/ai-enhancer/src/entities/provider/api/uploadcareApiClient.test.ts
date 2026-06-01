import { describe, expect, it, vi } from 'vitest';
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
  });

  describe('edit', () => {
    it('POSTs pub_key + prompt + image_url to the edit endpoint and returns the job', async () => {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ type: 'job', job_id: 'edit-1' }));
      const client = new UploadcareApiClient({ publicKey: 'pk', fetch: fetchImpl });

      const job = await client.edit({
        prompt: 'remove the cat',
        imageUrl: 'https://ucarecdn.com/abc/',
        filename: 'edited.png',
      });

      expect(job).toEqual({ type: 'job', job_id: 'edit-1' });
      const [url, init] = fetchImpl.mock.calls[0]! as [string, RequestInit];
      expect(url).toBe('https://upload.uploadcare.com/derivative/image/edit/');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toMatchObject({
        pub_key: 'pk',
        prompt: 'remove the cat',
        image_url: 'https://ucarecdn.com/abc/',
        filename: 'edited.png',
      });
    });

    it('includes aspect_ratio only when provided (e.g. outpaint)', async () => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockImplementation(async () => jsonResponse({ type: 'job', job_id: 'j' }));
      const client = new UploadcareApiClient({ publicKey: 'pk', fetch: fetchImpl });

      await client.edit({ prompt: 'extend', imageUrl: 'https://ucarecdn.com/abc/', filename: 'f.png' });
      expect(JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string).aspect_ratio).toBeUndefined();

      await client.edit({
        prompt: 'extend',
        imageUrl: 'https://ucarecdn.com/abc/',
        filename: 'f.png',
        aspectRatio: [16, 9],
      });
      expect(JSON.parse((fetchImpl.mock.calls[1]![1] as RequestInit).body as string).aspect_ratio).toEqual([16, 9]);
    });

    it('throws with status text on non-2xx', async () => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('nope', { status: 422, statusText: 'Unprocessable' }));
      const client = new UploadcareApiClient({ publicKey: 'pk', fetch: fetchImpl });
      await expect(
        client.edit({ prompt: 'x', imageUrl: 'https://ucarecdn.com/abc/', filename: 'f.png' }),
      ).rejects.toThrow(/422/);
    });

    it('forwards the abort signal', async () => {
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        return jsonResponse({ type: 'job', job_id: 'j' });
      });
      const client = new UploadcareApiClient({ publicKey: 'pk', fetch: fetchImpl });
      const controller = new AbortController();
      await client.edit({
        prompt: 'x',
        imageUrl: 'https://ucarecdn.com/abc/',
        filename: 'f.png',
        signal: controller.signal,
      });
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
