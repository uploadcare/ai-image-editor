import { getPrefixedCdnBaseAsync, isPrefixedCdnBase } from '@uploadcare/cname-prefix/async';
import { type AspectRatio, isValidAspectRatio } from '../../aspect-ratio';
import { CAPABILITIES } from '../../capability';
import type { AiProvider, AiProviderRequest, AiProviderResult } from '../model/types';
import {
  UploadcareApiClient,
  type UploadcareJobResponse,
  type UploadcareJobSuccessStatus,
} from './uploadcareApiClient';

const DEFAULT_RATIO: AspectRatio = [1, 1];
const DEFAULT_CDN_CNAME = 'https://ucarecdn.com';
const DEFAULT_POLL_INTERVAL_MS = 1500;
const DEFAULT_POLL_TIMEOUT_MS = 1000_000;

export type UploadcareDerivativeApiOptions = {
  publicKey: string;
  /** Base URL for the upload API. Defaults to https://upload.uploadcare.com. */
  baseUrl?: string;
  /** Filename to send in the request. Defaults to "generated.png". */
  filename?: string;
  /** Whether to store the generated image. Defaults to "auto" (per server default). */
  store?: 'auto' | boolean;
  /** Override the global fetch — useful for tests. */
  fetch?: typeof fetch;
  /**
   * CDN cname for resolving `{uuid}` responses. When left at the default
   * `https://ucarecdn.com` (or already a prefixed base), the actual base is
   * derived from the public key — exactly like the file uploader's `cdnCname`.
   */
  cdnBaseUrl?: string;
  /** Base domain for public-key-prefixed CDN URLs. Defaults to https://ucarecd.net. */
  cdnCnamePrefixed?: string;
  /** Delay between status polls in ms. Defaults to 1500. */
  pollIntervalMs?: number;
  /** Give up polling after this many ms. Defaults to 1000000 (approximately 16.7 minutes). */
  pollTimeoutMs?: number;
};

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Monotonic-ish clock that works in browsers, workers, and Node. */
function performanceNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

/**
 * AI provider backed by Uploadcare's `derivative/*` API. A single instance
 * serves both editor modes: `generate` (text→image) and `edit` (image→image,
 * for the `object-remove` / `bg-replace` / `outpaint` capabilities), dispatching
 * on the requested capability's mode.
 *
 * Transport is delegated to {@link UploadcareApiClient}; this class owns the
 * domain orchestration: aspect-ratio defaulting, polling the asynchronous job to
 * a terminal `success`/`error` state, and resolving the result to a CDN URL.
 */
export class UploadcareDerivativeApi implements AiProvider {
  public readonly id = 'uploadcare-derivative';

  private readonly api: UploadcareApiClient;
  private readonly publicKey: string;
  private readonly filename: string;
  private readonly store?: 'auto' | boolean;
  private readonly cname: string;
  private readonly cnamePrefixed: string;
  private readonly pollIntervalMs: number;
  private readonly pollTimeoutMs: number;
  private cdnBasePromise?: Promise<string>;

  constructor(options: UploadcareDerivativeApiOptions) {
    if (!options.publicKey) {
      throw new Error('UploadcareDerivativeApi: publicKey is required');
    }
    this.api = new UploadcareApiClient({
      publicKey: options.publicKey,
      baseUrl: options.baseUrl,
      fetch: options.fetch,
    });
    this.publicKey = options.publicKey;
    this.filename = options.filename ?? 'generated.png';
    this.store = options.store;
    this.cname = options.cdnBaseUrl ?? DEFAULT_CDN_CNAME;
    this.cnamePrefixed = options.cdnCnamePrefixed ?? 'https://ucarecd.net';
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.pollTimeoutMs = options.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  }

  async generate(request: AiProviderRequest): Promise<AiProviderResult> {
    const jobId = await this.startJob(request);
    return this.pollUntilDone(jobId, request);
  }

  private async startJob(request: AiProviderRequest): Promise<string> {
    const ratio: AspectRatio =
      request.aspectRatio && isValidAspectRatio(request.aspectRatio) ? request.aspectRatio : DEFAULT_RATIO;
    const aspectRatio: [number, number] = [ratio[0], ratio[1]];

    let job: UploadcareJobResponse;
    if (CAPABILITIES[request.capability].mode === 'edit') {
      if (!request.sourceUrl) {
        throw new Error(`Uploadcare edit (${request.capability}): a source image URL is required`);
      }
      job = await this.api.edit({
        prompt: request.prompt,
        imageUrl: request.sourceUrl,
        aspectRatio: request.aspectRatio ? aspectRatio : undefined,
        filename: this.filename,
        store: this.store,
        signal: request.signal,
      });
    } else {
      job = await this.api.generate({
        prompt: request.prompt,
        aspectRatio,
        filename: this.filename,
        store: this.store,
        signal: request.signal,
      });
    }

    if (!job.job_id) {
      throw new Error('Uploadcare derivative: response did not include a job_id');
    }
    return job.job_id;
  }

  private async pollUntilDone(jobId: string, request: AiProviderRequest): Promise<AiProviderResult> {
    const deadline = this.pollTimeoutMs + performanceNow();
    while (true) {
      const status = await this.api.getJobStatus(jobId, request.signal);

      if (status.status === 'success') {
        const url = await this.resolveSuccessUrl(status);
        if (!url) {
          throw new Error('Uploadcare derivative: response did not include a usable URL or uuid');
        }
        return { url, prompt: request.prompt, capability: request.capability };
      }

      if (status.status === 'error') {
        const detail = status.error_code ?? status.error ?? 'unknown error';
        const source = status.error_source ? ` [${status.error_source}]` : '';
        throw new Error(`Uploadcare derivative job failed${source}: ${detail}`);
      }

      if (performanceNow() >= deadline) {
        throw new Error(`Uploadcare derivative: timed out waiting for job ${jobId}`);
      }

      await delay(this.pollIntervalMs, request.signal);
    }
  }

  /**
   * Resolve the CDN base, deriving it from the public key when the cname is the
   * default (or already a prefixed base) — the same logic the file uploader
   * applies in its `cdnCname` computed config. Computed once and cached.
   */
  private getCdnBase(): Promise<string> {
    if (!this.cdnBasePromise) {
      this.cdnBasePromise =
        this.cname === DEFAULT_CDN_CNAME || isPrefixedCdnBase(this.cname, this.cnamePrefixed)
          ? getPrefixedCdnBaseAsync(this.publicKey, this.cnamePrefixed)
          : Promise.resolve(this.cname);
    }
    return this.cdnBasePromise;
  }

  private async resolveSuccessUrl(status: UploadcareJobSuccessStatus): Promise<string | null> {
    const id = status.uuid ?? status.file;
    if (!id) return null;
    return new URL(`/${id}/`, await this.getCdnBase()).href;
  }
}
