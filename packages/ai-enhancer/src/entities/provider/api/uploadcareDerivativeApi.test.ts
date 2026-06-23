import { getPrefixedCdnBaseAsync } from '@uploadcare/cname-prefix/async';
import { info } from '@uploadcare/upload-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploadcareDerivativeApi } from './uploadcareDerivativeApi';

// Keep the real UploadcareFile (used to wrap the result) but stub the `info`
// network call so getFileInfo is exercised without hitting the Upload API.
vi.mock('@uploadcare/upload-client', async (importActual) => {
  const actual = await importActual<typeof import('@uploadcare/upload-client')>();
  return { ...actual, info: vi.fn() };
});
const mockInfo = vi.mocked(info);

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function readSentBody(init: RequestInit | undefined): Record<string, unknown> {
  return JSON.parse(init?.body as string) as Record<string, unknown>;
}

/**
 * Builds a fetch mock that answers the generate POST with `jobResponse` and
 * then walks through `statuses` on each successive status GET.
 */
function routedFetch(jobResponse: unknown, statuses: unknown[]): ReturnType<typeof vi.fn<typeof fetch>> {
  let statusIndex = 0;
  return vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method === 'POST') return jsonResponse(jobResponse);
    const body = statuses[Math.min(statusIndex, statuses.length - 1)];
    statusIndex += 1;
    void url;
    return jsonResponse(body);
  });
}

const NO_DELAY = { pollIntervalMs: 0 } as const;

describe('UploadcareDerivativeApi', () => {
  it('throws when publicKey is missing', () => {
    expect(() => new UploadcareDerivativeApi({ publicKey: '' })).toThrow(/publicKey/);
  });

  it('POSTs the prompt + aspect ratio + pub_key to the derivative endpoint', async () => {
    const fetchImpl = routedFetch({ type: 'job', job_id: 'job-1' }, [{ status: 'success', uuid: 'abc-123' }]);
    const provider = new UploadcareDerivativeApi({ publicKey: 'pk_test', fetch: fetchImpl, ...NO_DELAY });
    await provider.generate({ prompt: 'a hat', mode: 'generate', aspectRatio: [16, 9] });

    const [url, init] = fetchImpl.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe('https://upload.uploadcare.com/derivative/image/generate/');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(readSentBody(init)).toMatchObject({
      pub_key: 'pk_test',
      prompt: 'a hat',
      aspect_ratio: [16, 9],
      filename: 'generated.png',
    });
  });

  it('forwards request metadata to the generate endpoint', async () => {
    const fetchImpl = routedFetch({ type: 'job', job_id: 'job-1' }, [{ status: 'success', uuid: 'abc-123' }]);
    const provider = new UploadcareDerivativeApi({ publicKey: 'pk', fetch: fetchImpl, ...NO_DELAY });
    await provider.generate({ prompt: 'x', mode: 'generate', metadata: { source: 'ai-enhancer' } });
    const [, init] = fetchImpl.mock.calls[0]! as [string, RequestInit];
    expect(readSentBody(init).metadata).toEqual({ source: 'ai-enhancer' });
  });

  it('forwards request metadata to the edit endpoint', async () => {
    const fetchImpl = routedFetch({ type: 'job', job_id: 'job-e' }, [{ status: 'success', uuid: 'edited' }]);
    const provider = new UploadcareDerivativeApi({ publicKey: 'pk', fetch: fetchImpl, ...NO_DELAY });
    await provider.generate({ prompt: 'x', mode: 'edit', source: 'src', metadata: { source: 'ai-enhancer' } });
    const [url, init] = fetchImpl.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe('https://upload.uploadcare.com/derivative/image/edit/');
    expect(readSentBody(init).metadata).toEqual({ source: 'ai-enhancer' });
  });

  it('uses 1:1 when aspectRatio is missing or invalid', async () => {
    const fetchImpl = routedFetch({ type: 'job', job_id: 'job-1' }, [{ status: 'success', uuid: 'abc-123' }]);
    const provider = new UploadcareDerivativeApi({ publicKey: 'pk', fetch: fetchImpl, ...NO_DELAY });
    await provider.generate({ prompt: 'x', mode: 'generate' });
    const [, init] = fetchImpl.mock.calls[0]! as [string, RequestInit];
    expect(readSentBody(init).aspect_ratio).toEqual([1, 1]);
  });

  it('polls the status endpoint with pub_key + job_id until the job succeeds', async () => {
    const fetchImpl = routedFetch({ type: 'job', job_id: 'job-42' }, [
      { type: 'job', status: 'processing' },
      { type: 'job', status: 'uploading' },
      { status: 'success', uuid: 'final-uuid' },
    ]);
    const provider = new UploadcareDerivativeApi({
      publicKey: 'pk',
      cdnBaseUrl: 'https://cdn.example.com',
      fetch: fetchImpl,
      ...NO_DELAY,
    });

    const result = await provider.generate({ prompt: 'x', mode: 'generate' });

    expect(result.url).toBe('https://cdn.example.com/final-uuid/');
    // 1 POST + 3 status polls
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    const [statusUrl, statusInit] = fetchImpl.mock.calls[1]! as [string, RequestInit];
    expect(statusUrl).toBe('https://upload.uploadcare.com/derivative/status/?pub_key=pk&job_id=job-42');
    expect((statusInit?.method ?? 'GET').toUpperCase()).toBe('GET');
  });

  it('throws when the job ends in an error status', async () => {
    const fetchImpl = routedFetch({ type: 'job', job_id: 'job-err' }, [
      { type: 'job', status: 'processing' },
      { type: 'job', status: 'error', error_source: 'ai_gateway', error_code: 'content_policy', error: 'blocked' },
    ]);
    const provider = new UploadcareDerivativeApi({ publicKey: 'pk', fetch: fetchImpl, ...NO_DELAY });
    await expect(provider.generate({ prompt: 'x', mode: 'generate' })).rejects.toThrow(/content_policy|blocked/);
  });

  it('honours baseUrl + cdnBaseUrl overrides for both generate and status', async () => {
    const fetchImpl = routedFetch({ type: 'job', job_id: 'job-1' }, [{ status: 'success', uuid: 'xyz' }]);
    const provider = new UploadcareDerivativeApi({
      publicKey: 'pk',
      baseUrl: 'https://upload.example.com',
      cdnBaseUrl: 'https://cdn.example.com',
      fetch: fetchImpl,
      ...NO_DELAY,
    });
    const result = await provider.generate({ prompt: 'x', mode: 'generate' });
    const [genUrl] = fetchImpl.mock.calls[0]! as [string, RequestInit];
    const [statusUrl] = fetchImpl.mock.calls[1]! as [string, RequestInit];
    expect(genUrl).toBe('https://upload.example.com/derivative/image/generate/');
    expect(statusUrl).toBe('https://upload.example.com/derivative/status/?pub_key=pk&job_id=job-1');
    expect(result.url).toBe('https://cdn.example.com/xyz/');
  });

  it('returns an UploadcareFile on the result (with camelized fields)', async () => {
    const fetchImpl = routedFetch({ type: 'job', job_id: 'job-1' }, [
      { status: 'success', uuid: 'final-uuid', original_filename: 'f.png', is_image: true },
    ]);
    const provider = new UploadcareDerivativeApi({
      publicKey: 'pk',
      cdnBaseUrl: 'https://cdn.example.com',
      fetch: fetchImpl,
      ...NO_DELAY,
    });
    const result = await provider.generate({ prompt: 'x', mode: 'generate' });
    expect(result.file.uuid).toBe('final-uuid');
    expect(result.file.cdnUrl).toBe('https://cdn.example.com/final-uuid/');
    expect(result.file.originalFilename).toBe('f.png');
    expect(result.file.isImage).toBe(true);
    expect(result.url).toBe('https://cdn.example.com/final-uuid/');
  });

  it('derives the CDN base from the public key when cdnBaseUrl is left at the default', async () => {
    const fetchImpl = routedFetch({ type: 'job', job_id: 'job-1' }, [{ status: 'success', uuid: 'final-uuid' }]);
    const provider = new UploadcareDerivativeApi({ publicKey: 'pk', fetch: fetchImpl, ...NO_DELAY });
    const result = await provider.generate({ prompt: 'x', mode: 'generate' });
    const base = await getPrefixedCdnBaseAsync('pk', 'https://ucarecd.net');
    expect(result.url).toBe(`${base}/final-uuid/`);
  });

  it('throws when the success status has no uuid', async () => {
    const fetchImpl = routedFetch({ type: 'job', job_id: 'job-1' }, [{ status: 'success' }]);
    const provider = new UploadcareDerivativeApi({ publicKey: 'pk', fetch: fetchImpl, ...NO_DELAY });
    await expect(provider.generate({ prompt: 'x', mode: 'generate' })).rejects.toThrow(/uuid/);
  });

  it('surfaces non-2xx generate responses with status text', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('bad ratio', {
        status: 400,
        statusText: 'Bad Request',
        headers: { 'Content-Type': 'text/plain' },
      }),
    );
    const provider = new UploadcareDerivativeApi({ publicKey: 'pk', fetch: fetchImpl, ...NO_DELAY });
    await expect(provider.generate({ prompt: 'x', mode: 'generate' })).rejects.toThrow(/400/);
  });

  it('times out when the job never reaches a terminal state', async () => {
    const fetchImpl = routedFetch({ type: 'job', job_id: 'job-1' }, [{ type: 'job', status: 'processing' }]);
    const provider = new UploadcareDerivativeApi({
      publicKey: 'pk',
      fetch: fetchImpl,
      pollIntervalMs: 0,
      pollTimeoutMs: 5,
    });
    await expect(provider.generate({ prompt: 'x', mode: 'generate' })).rejects.toThrow(/time/i);
  });

  it('passes the abort signal to generate and status fetches', async () => {
    const seen: (AbortSignal | undefined)[] = [];
    const base = routedFetch({ type: 'job', job_id: 'job-1' }, [{ status: 'success', uuid: 'a' }]);
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((url, init) => {
      seen.push(init?.signal ?? undefined);
      return base(url, init);
    });
    const provider = new UploadcareDerivativeApi({ publicKey: 'pk', fetch: fetchImpl, ...NO_DELAY });
    const controller = new AbortController();
    await provider.generate({ prompt: 'x', mode: 'generate', signal: controller.signal });
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen.every((s) => s === controller.signal)).toBe(true);
  });

  it('stops polling when the signal is aborted mid-flight', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'POST') return jsonResponse({ type: 'job', job_id: 'job-1' });
      // Abort while "processing": the next poll must never happen.
      controller.abort();
      return jsonResponse({ type: 'job', status: 'processing' });
    });
    const provider = new UploadcareDerivativeApi({ publicKey: 'pk', fetch: fetchImpl, ...NO_DELAY });

    await expect(provider.generate({ prompt: 'x', mode: 'generate', signal: controller.signal })).rejects.toThrow(
      /abort/i,
    );
    // 1 POST + exactly 1 status poll, then it bails — no further polling.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not start polling when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    const provider = new UploadcareDerivativeApi({ publicKey: 'pk', fetch: fetchImpl, ...NO_DELAY });
    await expect(
      provider.generate({ prompt: 'x', mode: 'generate', signal: controller.signal }),
    ).rejects.toThrow();
  });

  describe('edit mode', () => {
    it('POSTs prompt + source uuid to the edit endpoint and resolves the result', async () => {
      const fetchImpl = routedFetch({ type: 'job', job_id: 'job-e' }, [{ status: 'success', uuid: 'edited-uuid' }]);
      const provider = new UploadcareDerivativeApi({
        publicKey: 'pk',
        cdnBaseUrl: 'https://cdn.example.com',
        fetch: fetchImpl,
        ...NO_DELAY,
      });

      const result = await provider.generate({
        prompt: 'remove the cat',
        mode: 'edit',
        source: 'src-uuid',
        aspectRatio: [16, 9],
      });

      const [url, init] = fetchImpl.mock.calls[0]! as [string, RequestInit];
      expect(url).toBe('https://upload.uploadcare.com/derivative/image/edit/');
      expect(readSentBody(init)).toMatchObject({
        pub_key: 'pk',
        prompt: 'remove the cat',
        source: 'src-uuid',
        aspect_ratio: [16, 9],
      });
      expect(result.url).toBe('https://cdn.example.com/edited-uuid/');
      expect(result.mode).toBe('edit');
    });

    it('omits aspect_ratio when none is provided', async () => {
      const fetchImpl = routedFetch({ type: 'job', job_id: 'job-e' }, [{ status: 'success', uuid: 'u' }]);
      const provider = new UploadcareDerivativeApi({ publicKey: 'pk', fetch: fetchImpl, ...NO_DELAY });
      await provider.generate({ prompt: 'x', mode: 'edit', source: 'src-uuid' });
      expect(readSentBody(fetchImpl.mock.calls[0]![1] as RequestInit).aspect_ratio).toBeUndefined();
    });

    it('throws (without any request) when an edit has no source uuid', async () => {
      const fetchImpl = routedFetch({ type: 'job', job_id: 'j' }, [{ status: 'success', uuid: 'x' }]);
      const provider = new UploadcareDerivativeApi({ publicKey: 'pk', fetch: fetchImpl, ...NO_DELAY });
      await expect(provider.generate({ prompt: 'x', mode: 'edit' })).rejects.toThrow(/source/i);
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('resolveCdnUrl maps a uuid to its CDN URL', async () => {
      const provider = new UploadcareDerivativeApi({
        publicKey: 'pk',
        cdnBaseUrl: 'https://cdn.example.com',
        fetch: vi.fn<typeof fetch>(),
        ...NO_DELAY,
      });
      expect(await provider.resolveCdnUrl('some-uuid')).toBe('https://cdn.example.com/some-uuid/');
    });
  });

  describe('getFileInfo', () => {
    afterEach(() => mockInfo.mockReset());

    const fileInfoFixture = {
      uuid: 'file-uuid',
      originalFilename: 'portrait.png',
      isImage: true,
      mimeType: 'image/png',
      imageInfo: { width: 800, height: 1200, format: 'PNG' },
    } as unknown as Awaited<ReturnType<typeof info>>;

    it('calls upload-client info() and wraps it as an UploadcareFile on the CDN base', async () => {
      mockInfo.mockResolvedValue(fileInfoFixture);
      const provider = new UploadcareDerivativeApi({
        publicKey: 'pk',
        cdnBaseUrl: 'https://cdn.example.com',
        fetch: vi.fn<typeof fetch>(),
        ...NO_DELAY,
      });

      const file = await provider.getFileInfo('file-uuid');

      expect(mockInfo).toHaveBeenCalledWith('file-uuid', expect.objectContaining({ publicKey: 'pk' }));
      expect(file.uuid).toBe('file-uuid');
      expect(file.originalFilename).toBe('portrait.png');
      expect(file.cdnUrl).toBe('https://cdn.example.com/file-uuid/');
      expect(file.imageInfo).toMatchObject({ width: 800, height: 1200 });
    });

    it('forwards baseUrl + abort signal to info()', async () => {
      mockInfo.mockResolvedValue(fileInfoFixture);
      const provider = new UploadcareDerivativeApi({
        publicKey: 'pk',
        baseUrl: 'https://upload.example.com',
        fetch: vi.fn<typeof fetch>(),
        ...NO_DELAY,
      });
      const controller = new AbortController();
      await provider.getFileInfo('file-uuid', controller.signal);
      expect(mockInfo).toHaveBeenCalledWith(
        'file-uuid',
        expect.objectContaining({ baseURL: 'https://upload.example.com', signal: controller.signal }),
      );
    });

    it('propagates info() failures', async () => {
      mockInfo.mockRejectedValue(new Error('FileNotFound'));
      const provider = new UploadcareDerivativeApi({ publicKey: 'pk', fetch: vi.fn<typeof fetch>(), ...NO_DELAY });
      await expect(provider.getFileInfo('missing')).rejects.toThrow(/FileNotFound/);
    });
  });
});
