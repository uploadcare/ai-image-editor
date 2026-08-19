import { serializeCdnUrl } from '@uploadcare/cdn-url';
import { getPrefixedCdnBaseAsync, isPrefixedCdnBase } from '@uploadcare/cname-prefix/async';
import {
  type CustomUserAgentFn,
  CancelError,
  camelizeKeys,
  type FileInfo,
  info,
  type Metadata,
  poll,
  UploadcareFile,
} from '@uploadcare/upload-client';
import { customUserAgent } from '../../../shared/lib/userAgent';
import { isValidAspectRatio } from '../../aspect-ratio';
import { type AiProvider, AiProviderError, type AiProviderRequest, type AiProviderResult } from '../model/types';
import {
  UploadcareApiClient,
  type UploadcareJobResponse,
  type UploadcareJobSuccessStatus,
} from './uploadcareApiClient';

const DEFAULT_RATIO: [number, number] = [1, 1];
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

/**
 * AI provider backed by Uploadcare's `derivative/*` API. A single instance
 * serves both editor modes, dispatching on `request.mode`: `generate`
 * (text→image) and `edit` (image→image, editing a source image by uuid).
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
  /** What every upload-client call needs: credentials, endpoint, and our identity. */
  private readonly uploadClientOptions: { publicKey: string; baseURL?: string; userAgent: CustomUserAgentFn };
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
    this.uploadClientOptions = {
      publicKey: options.publicKey,
      baseURL: options.baseUrl,
      userAgent: customUserAgent,
    };
  }

  async generate(request: AiProviderRequest): Promise<AiProviderResult> {
    const jobId = await this.startJob(request);
    return this.pollUntilDone(jobId, request);
  }

  /**
   * Resolve a stored file's UUID to its CDN URL, using the same key-derived CDN
   * base as generation results — so an input image displays identically to one
   * the editor produced.
   */
  async resolveCdnUrl(uuid: string): Promise<string> {
    return serializeCdnUrl({ origin: await this.getCdnBase(), uuid });
  }

  /**
   * Resolve a stored file's full info (image dimensions, original filename,
   * mime, …) from its uuid, as an {@link UploadcareFile} — the same shape
   * generation results carry. Lets the editor frame the canvas to the source's
   * true aspect ratio before the image decodes, and name outputs after it.
   */
  async getFileInfo(uuid: string, signal?: AbortSignal): Promise<UploadcareFile> {
    const fileInfo = await info(uuid, { ...this.uploadClientOptions, signal });
    return new UploadcareFile(fileInfo, { baseCDN: await this.getCdnBase() });
  }

  private async startJob(request: AiProviderRequest): Promise<string> {
    // A valid ratio when supplied; generate falls back to a default, edit omits.
    const ratio: [number, number] | undefined =
      request.aspectRatio && isValidAspectRatio(request.aspectRatio)
        ? [request.aspectRatio[0], request.aspectRatio[1]]
        : undefined;

    const filename = request.filename ?? this.filename;
    const job: UploadcareJobResponse =
      request.mode === 'edit'
        ? await this.startEditJob(request, ratio, filename, request.metadata)
        : await this.api.generate({
            prompt: request.prompt,
            aspectRatio: ratio ?? DEFAULT_RATIO,
            filename,
            store: this.store,
            signal: request.signal,
            metadata: request.metadata,
          });

    if (!job.job_id) {
      throw new Error('Uploadcare derivative: response did not include a job_id');
    }
    return job.job_id;
  }

  private startEditJob(
    request: AiProviderRequest,
    ratio: [number, number] | undefined,
    filename: string,
    metadata: Metadata | undefined,
  ): Promise<UploadcareJobResponse> {
    if (!request.source) {
      throw new Error('Uploadcare edit: a source image uuid is required');
    }
    return this.api.edit({
      prompt: request.prompt,
      source: request.source,
      aspectRatio: ratio,
      filename,
      store: this.store,
      signal: request.signal,
      metadata,
    });
  }

  private async pollUntilDone(jobId: string, request: AiProviderRequest): Promise<AiProviderResult> {
    const status = await this.pollJobStatus(jobId, request);
    // `pollJobStatus` only resolves once the success frame reports the file as
    // CDN-ready, so the frame is the final FileInfo — no extra readiness fetch.
    const file = new UploadcareFile(camelizeKeys<FileInfo>(status), { baseCDN: await this.getCdnBase() });
    return { url: file.cdnUrl, uuid: file.uuid, prompt: request.prompt, mode: request.mode, file };
  }

  /**
   * Poll the job until it succeeds *and* its file is CDN-ready. `poll` rejects
   * with a `CancelError` for two reasons — a caller-driven abort or its own
   * timeout. A caller abort re-throws untouched so the generation controller
   * still recognises the cancellation; the timeout (signal not aborted) becomes a
   * coded, localizable domain error that names the job. Job and transport
   * failures already carry their own shape (AiProviderError / Error) and
   * propagate unchanged.
   */
  private async pollJobStatus(jobId: string, request: AiProviderRequest): Promise<UploadcareJobSuccessStatus> {
    try {
      return await poll<UploadcareJobSuccessStatus>({
        check: async (signal) => {
          const status = await this.api.getJobStatus(jobId, signal);
          if (status.status === 'error') {
            const code = status.error_code ?? 'unknown';
            throw new AiProviderError(code, status.error ?? code, status.error_source);
          }
          // Not done yet — a falsy result keeps the poll going. `processing` /
          // `uploading` haven't finished; a `success` frame with `is_ready:
          // false` has finished generating but the CDN URL would still 404, so
          // wait for the ready frame (its `is_ready` flips true).
          return status.status === 'success' && status.is_ready !== false && status;
        },
        interval: this.pollIntervalMs,
        timeout: this.pollTimeoutMs,
        signal: request.signal,
      });
    } catch (err) {
      if (err instanceof CancelError && !request.signal?.aborted) {
        throw new AiProviderError('generation_timeout', `Uploadcare derivative: timed out waiting for job ${jobId}`);
      }
      throw err;
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
}
