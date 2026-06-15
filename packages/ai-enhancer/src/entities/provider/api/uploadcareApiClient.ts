import type { FileInfo } from '@uploadcare/upload-client';
import type { SnakeCasedPropertiesDeep } from '../../../shared/lib/camelizeKeys';
import { AiProviderError } from '../model/types';

/**
 * Platform error envelope. With `Accept: application/json` the API returns the
 * validation error in the body (status code mirrored in `status_code`) rather
 * than as an HTTP error, so we detect it from the body on any response.
 */
type PlatformErrorEnvelope = {
  error: { status_code?: number; error_code: string; content?: string };
};

function isPlatformError(data: unknown): data is PlatformErrorEnvelope {
  const e = (data as PlatformErrorEnvelope | null)?.error;
  return !!e && typeof e === 'object' && typeof e.error_code === 'string';
}

export type UploadcareApiClientOptions = {
  publicKey: string;
  /** Base URL for the upload API. Defaults to https://upload.uploadcare.com. */
  baseUrl?: string;
  /** Override the global fetch — useful for tests. */
  fetch?: typeof fetch;
};

/** Parameters for a text→image generate request. */
export type GenerateRequestParams = {
  prompt: string;
  aspectRatio: [number, number];
  filename: string;
  store?: 'auto' | boolean;
  signal?: AbortSignal;
};

/** Parameters for an image→image edit request. */
export type EditRequestParams = {
  prompt: string;
  /** UUID of the source image to edit. */
  source: string;
  /** Target output aspect ratio. Optional; omitted to preserve the source. */
  aspectRatio?: [number, number];
  filename: string;
  store?: 'auto' | boolean;
  signal?: AbortSignal;
};

/** Job handle returned by the generate/edit endpoints. */
export type UploadcareJobResponse = {
  type?: 'job';
  job_id?: string;
};

/** Generation is still running. */
export type UploadcareJobProcessingStatus = { type?: 'job'; status: 'processing' };

/** The result is being imported into Uploadcare storage. */
export type UploadcareJobUploadingStatus = { type?: 'job'; status: 'uploading' };

/** The job failed during generation or upload. */
export type UploadcareJobErrorStatus = {
  type?: 'job';
  status: 'error';
  error_source?: string;
  error_code?: string;
  error?: string;
};

/**
 * The job finished. The payload is the upload-info bag: the raw (snake_case)
 * form of upload-client's `FileInfo`, which {@link camelizeKeys} turns into the
 * `FileInfo` that `UploadcareFile` consumes. Fields beyond `uuid` are treated as
 * best-effort (the frame may omit them), but `uuid` is always present.
 */
type RawSuccess = Partial<SnakeCasedPropertiesDeep<FileInfo>>;
type RawImageInfo = NonNullable<RawSuccess['image_info']>;
/** upload-client types `dpi` as a `{0,1}` object, but the live API sends a `[x, y]` tuple. */
type CorrectedImageInfo = Omit<RawImageInfo, 'dpi'> & { dpi: number[] | null };
type RawContentInfo = NonNullable<RawSuccess['content_info']>;
type CorrectedContentInfo = Omit<RawContentInfo, 'image'> & { image?: CorrectedImageInfo };

export type UploadcareJobSuccessStatus = Omit<RawSuccess, 'is_ready' | 'image_info' | 'content_info'> & {
  type?: 'job';
  status: 'success';
  /** Always present on success — the uploaded file's UUID (see platform PR #1497). */
  uuid: string;
  /** Live API sends a boolean; upload-client mistypes it as a string. */
  is_ready?: boolean;
  image_info?: CorrectedImageInfo | null;
  content_info?: CorrectedContentInfo | null;
};

/**
 * Status frames returned by `derivative/status/`, discriminated on `status`.
 * The server normalises waiting/progress frames into `uploading`, so these four
 * variants are exhaustive for this endpoint.
 */
export type UploadcareJobStatus =
  | UploadcareJobProcessingStatus
  | UploadcareJobUploadingStatus
  | UploadcareJobErrorStatus
  | UploadcareJobSuccessStatus;

/**
 * Validate a request/response against its Zod schema in dev only. The schema
 * module is the sole importer of zod and is loaded lazily behind this guard, so
 * a production build (`import.meta.env.DEV === false`) strips both the call and
 * zod from the bundle. See `uploadcareApiClient.schemas.dev.ts`.
 */
async function devValidate(kind: 'generate' | 'edit' | 'job' | 'status', data: unknown): Promise<void> {
  if (!import.meta.env.DEV) return;
  const { validate } = await import('./uploadcareApiClient.schemas.dev');
  validate(kind, data);
}

/**
 * Read a JSON response: surface a platform error envelope as an
 * {@link AiProviderError} (carrying its `error_code`), and fall back to a
 * generic transport error for non-JSON / non-2xx responses.
 */
async function readJson(response: Response, action: string): Promise<unknown> {
  const text = await response.text().catch(() => '');
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      /* non-JSON body — handled below */
    }
  }
  if (isPlatformError(data)) {
    const { error_code, content } = data.error;
    throw new AiProviderError(error_code, content ?? error_code);
  }
  if (!response.ok) {
    throw new Error(`Uploadcare ${action} failed (${response.status} ${response.statusText})${text ? `: ${text}` : ''}`);
  }
  return data;
}

/** HTTP transport for Uploadcare's `derivative/*` generation + edit endpoints. */
export class UploadcareApiClient {
  private readonly publicKey: string;
  private readonly baseUrl: string;
  private readonly doFetch: typeof fetch;

  constructor(options: UploadcareApiClientOptions) {
    if (!options.publicKey) {
      throw new Error('UploadcareApiClient: publicKey is required');
    }
    this.publicKey = options.publicKey;
    this.baseUrl = options.baseUrl ?? 'https://upload.uploadcare.com';
    this.doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /** Start a text→image generation job. Resolves to the job handle. */
  async generate(params: GenerateRequestParams): Promise<UploadcareJobResponse> {
    const body: Record<string, unknown> = {
      pub_key: this.publicKey,
      prompt: params.prompt,
      aspect_ratio: [params.aspectRatio[0], params.aspectRatio[1]],
      filename: params.filename,
    };
    if (params.store !== undefined) body.store = params.store;

    await devValidate('generate', body);
    return this.startJob(new URL('/derivative/image/generate/', this.baseUrl), body, 'generate', params.signal);
  }

  /** Start an image→image edit job. Resolves to the job handle. */
  async edit(params: EditRequestParams): Promise<UploadcareJobResponse> {
    const body: Record<string, unknown> = {
      pub_key: this.publicKey,
      prompt: params.prompt,
      source: params.source,
      filename: params.filename,
    };
    if (params.aspectRatio) body.aspect_ratio = [params.aspectRatio[0], params.aspectRatio[1]];
    if (params.store !== undefined) body.store = params.store;

    await devValidate('edit', body);
    return this.startJob(new URL('/derivative/image/edit/', this.baseUrl), body, 'edit', params.signal);
  }

  /** Fetch the current state of a generation/edit job. */
  async getJobStatus(jobId: string, signal?: AbortSignal): Promise<UploadcareJobStatus> {
    const url = new URL('/derivative/status/', this.baseUrl);
    url.searchParams.set('pub_key', this.publicKey);
    url.searchParams.set('job_id', jobId);

    const response = await this.doFetch(url.href, { method: 'GET', headers: { Accept: 'application/json' }, signal });

    const data = (await readJson(response, 'generate status')) as UploadcareJobStatus;
    await devValidate('status', data);
    return data;
  }

  private async startJob(
    endpoint: URL,
    body: Record<string, unknown>,
    action: string,
    signal?: AbortSignal,
  ): Promise<UploadcareJobResponse> {
    const response = await this.doFetch(endpoint.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    const data = (await readJson(response, action)) as UploadcareJobResponse;
    await devValidate('job', data);
    return data;
  }
}
