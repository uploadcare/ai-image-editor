import { getPrefixedCdnBaseAsync } from '@uploadcare/cname-prefix/async';
import { describe, expect, it, vi } from 'vitest';
import { UploadcareDerivativeApi } from './uploadcareDerivativeApi';

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
    await provider.generate({ prompt: 'a hat', capability: 'generate', aspectRatio: [16, 9] });

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

  it('uses 1:1 when aspectRatio is missing or invalid', async () => {
    const fetchImpl = routedFetch({ type: 'job', job_id: 'job-1' }, [{ status: 'success', uuid: 'abc-123' }]);
    const provider = new UploadcareDerivativeApi({ publicKey: 'pk', fetch: fetchImpl, ...NO_DELAY });
    await provider.generate({ prompt: 'x', capability: 'generate' });
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

    const result = await provider.generate({ prompt: 'x', capability: 'generate' });

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
    await expect(provider.generate({ prompt: 'x', capability: 'generate' })).rejects.toThrow(/content_policy|blocked/);
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
    const result = await provider.generate({ prompt: 'x', capability: 'generate' });
    const [genUrl] = fetchImpl.mock.calls[0]! as [string, RequestInit];
    const [statusUrl] = fetchImpl.mock.calls[1]! as [string, RequestInit];
    expect(genUrl).toBe('https://upload.example.com/derivative/image/generate/');
    expect(statusUrl).toBe('https://upload.example.com/derivative/status/?pub_key=pk&job_id=job-1');
    expect(result.url).toBe('https://cdn.example.com/xyz/');
  });

  it('derives the CDN base from the public key when cdnBaseUrl is left at the default', async () => {
    const fetchImpl = routedFetch({ type: 'job', job_id: 'job-1' }, [{ status: 'success', uuid: 'final-uuid' }]);
    const provider = new UploadcareDerivativeApi({ publicKey: 'pk', fetch: fetchImpl, ...NO_DELAY });
    const result = await provider.generate({ prompt: 'x', capability: 'generate' });
    const base = await getPrefixedCdnBaseAsync('pk', 'https://ucarecd.net');
    expect(result.url).toBe(`${base}/final-uuid/`);
  });

  it('throws when the success status has no usable URL or uuid', async () => {
    const fetchImpl = routedFetch({ type: 'job', job_id: 'job-1' }, [{ status: 'success' }]);
    const provider = new UploadcareDerivativeApi({ publicKey: 'pk', fetch: fetchImpl, ...NO_DELAY });
    await expect(provider.generate({ prompt: 'x', capability: 'generate' })).rejects.toThrow(/usable URL/);
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
    await expect(provider.generate({ prompt: 'x', capability: 'generate' })).rejects.toThrow(/400/);
  });

  it('times out when the job never reaches a terminal state', async () => {
    const fetchImpl = routedFetch({ type: 'job', job_id: 'job-1' }, [{ type: 'job', status: 'processing' }]);
    const provider = new UploadcareDerivativeApi({
      publicKey: 'pk',
      fetch: fetchImpl,
      pollIntervalMs: 0,
      pollTimeoutMs: 5,
    });
    await expect(provider.generate({ prompt: 'x', capability: 'generate' })).rejects.toThrow(/time/i);
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
    await provider.generate({ prompt: 'x', capability: 'generate', signal: controller.signal });
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

    await expect(provider.generate({ prompt: 'x', capability: 'generate', signal: controller.signal })).rejects.toThrow(
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
      provider.generate({ prompt: 'x', capability: 'generate', signal: controller.signal }),
    ).rejects.toThrow();
  });

  describe('edit mode', () => {
    it('routes edit-mode capabilities to the edit endpoint with the source image', async () => {
      const fetchImpl = routedFetch({ type: 'job', job_id: 'edit-1' }, [{ status: 'success', uuid: 'edited' }]);
      const provider = new UploadcareDerivativeApi({
        publicKey: 'pk',
        cdnBaseUrl: 'https://cdn.example.com',
        fetch: fetchImpl,
        ...NO_DELAY,
      });

      const result = await provider.generate({
        prompt: 'remove the cat',
        capability: 'object-remove',
        sourceUrl: 'https://ucarecdn.com/src/',
      });

      expect(result.url).toBe('https://cdn.example.com/edited/');
      const [url, init] = fetchImpl.mock.calls[0]! as [string, RequestInit];
      expect(url).toBe('https://upload.uploadcare.com/derivative/image/edit/');
      expect(readSentBody(init)).toMatchObject({
        pub_key: 'pk',
        prompt: 'remove the cat',
        image_url: 'https://ucarecdn.com/src/',
      });
    });

    it('throws when an edit request has no source image', async () => {
      const fetchImpl = routedFetch({ type: 'job', job_id: 'j' }, [{ status: 'success', uuid: 'x' }]);
      const provider = new UploadcareDerivativeApi({ publicKey: 'pk', fetch: fetchImpl, ...NO_DELAY });
      await expect(provider.generate({ prompt: 'x', capability: 'bg-replace' })).rejects.toThrow(/source image/i);
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  });
});
