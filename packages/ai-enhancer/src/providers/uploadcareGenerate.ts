import type { AspectRatio } from '../aspect-ratio';
import { isValidAspectRatio } from '../aspect-ratio';
import type { AiProvider, AiProviderRequest, AiProviderResult } from './types';

const DEFAULT_BASE_URL = 'https://upload.uploadcare.com';
const ENDPOINT = '/derivative/image/generate/';
const DEFAULT_RATIO: AspectRatio = [1, 1];
const DEFAULT_CDN_BASE = 'https://ucarecdn.com';

export type UploadcareGenerateOptions = {
  publicKey: string;
  /** Base URL for the upload API. Defaults to https://upload.uploadcare.com. */
  baseUrl?: string;
  /** Filename to send in the request. Defaults to "generated.png". */
  filename?: string;
  /** Whether to store the generated image. Defaults to "auto" (per server default). */
  store?: 'auto' | boolean;
  /** Override the global fetch — useful for tests. */
  fetch?: typeof fetch;
  /** CDN base URL for resolving `{uuid}` responses. Defaults to https://ucarecdn.com. */
  cdnBaseUrl?: string;
};

export type UploadcareGenerateResponse = {
  uuid?: string;
  file?: string;
  cdn_url?: string;
  url?: string;
};

function resolveUrl(response: UploadcareGenerateResponse, cdnBaseUrl: string): string | null {
  if (response.cdn_url) return response.cdn_url;
  if (response.url) return response.url;
  const id = response.uuid ?? response.file;
  if (!id) return null;
  const base = cdnBaseUrl.replace(/\/+$/, '');
  return `${base}/${id}/`;
}

/**
 * Provider for Uploadcare's `derivative/image/generate/` endpoint.
 * Sends pub_key + prompt + aspect_ratio and resolves to a CDN URL.
 */
export function createUploadcareGenerateProvider(options: UploadcareGenerateOptions): AiProvider {
  const {
    publicKey,
    baseUrl = DEFAULT_BASE_URL,
    filename = 'generated.png',
    store,
    fetch: fetchImpl,
    cdnBaseUrl = DEFAULT_CDN_BASE,
  } = options;

  if (!publicKey) {
    throw new Error('createUploadcareGenerateProvider: publicKey is required');
  }

  const endpoint = `${baseUrl.replace(/\/+$/, '')}${ENDPOINT}`;
  const doFetch = fetchImpl ?? globalThis.fetch.bind(globalThis);

  return {
    id: 'uploadcare-generate',
    async generate({ prompt, capability, aspectRatio, signal }: AiProviderRequest): Promise<AiProviderResult> {
      const ratio: AspectRatio =
        aspectRatio && isValidAspectRatio(aspectRatio) ? aspectRatio : DEFAULT_RATIO;
      const body: Record<string, unknown> = {
        pub_key: publicKey,
        prompt,
        aspect_ratio: [ratio[0], ratio[1]],
        filename,
      };
      if (store !== undefined) body.store = store;

      const response = await doFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(
          `Uploadcare generate failed (${response.status} ${response.statusText})${text ? `: ${text}` : ''}`,
        );
      }

      const data = (await response.json()) as UploadcareGenerateResponse;
      const url = resolveUrl(data, cdnBaseUrl);
      if (!url) {
        throw new Error('Uploadcare generate: response did not include a usable URL or uuid');
      }

      return { url, prompt, capability };
    },
  };
}
