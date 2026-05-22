import { describe, expect, it, vi } from 'vitest';
import { createUploadcareGenerateProvider } from './uploadcareGenerate';

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

describe('createUploadcareGenerateProvider', () => {
  it('throws when publicKey is missing', () => {
    expect(() => createUploadcareGenerateProvider({ publicKey: '' })).toThrow(/publicKey/);
  });

  it('POSTs the prompt + aspect ratio + pub_key to the derivative endpoint', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ uuid: 'abc-123' }));
    const provider = createUploadcareGenerateProvider({ publicKey: 'pk_test', fetch: fetchImpl });
    await provider.generate({ prompt: 'a hat', capability: 'generate', aspectRatio: [16, 9] });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = fetchImpl.mock.calls[0]!;
    const [url, init] = call as [string, RequestInit];
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
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ uuid: 'abc-123' }));
    const provider = createUploadcareGenerateProvider({ publicKey: 'pk', fetch: fetchImpl });
    await provider.generate({ prompt: 'x', capability: 'generate' });
    const [, init] = fetchImpl.mock.calls[0]! as [string, RequestInit];
    expect(readSentBody(init).aspect_ratio).toEqual([1, 1]);
  });

  it('honours baseUrl + cdnBaseUrl overrides', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ uuid: 'xyz' }));
    const provider = createUploadcareGenerateProvider({
      publicKey: 'pk',
      baseUrl: 'https://upload.example.com',
      cdnBaseUrl: 'https://cdn.example.com',
      fetch: fetchImpl,
    });
    const result = await provider.generate({ prompt: 'x', capability: 'generate' });
    const [url] = fetchImpl.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe('https://upload.example.com/derivative/image/generate/');
    expect(result.url).toBe('https://cdn.example.com/xyz/');
  });

  it('prefers cdn_url from the response when present', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ uuid: 'fallback', cdn_url: 'https://cdn.example.com/explicit/foo.png' }));
    const provider = createUploadcareGenerateProvider({ publicKey: 'pk', fetch: fetchImpl });
    const result = await provider.generate({ prompt: 'x', capability: 'generate' });
    expect(result.url).toBe('https://cdn.example.com/explicit/foo.png');
  });

  it('throws when the response has no usable URL or uuid', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}));
    const provider = createUploadcareGenerateProvider({ publicKey: 'pk', fetch: fetchImpl });
    await expect(provider.generate({ prompt: 'x', capability: 'generate' })).rejects.toThrow(/usable URL/);
  });

  it('surfaces non-2xx responses with status text', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('bad ratio', {
        status: 400,
        statusText: 'Bad Request',
        headers: { 'Content-Type': 'text/plain' },
      }),
    );
    const provider = createUploadcareGenerateProvider({ publicKey: 'pk', fetch: fetchImpl });
    await expect(provider.generate({ prompt: 'x', capability: 'generate' })).rejects.toThrow(/400/);
  });

  it('passes the abort signal to fetch', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return jsonResponse({ uuid: 'a' });
    });
    const provider = createUploadcareGenerateProvider({ publicKey: 'pk', fetch: fetchImpl });
    const controller = new AbortController();
    await provider.generate({ prompt: 'x', capability: 'generate', signal: controller.signal });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
