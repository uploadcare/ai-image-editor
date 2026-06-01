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

/**
 * Parameters for an image→image edit request.
 *
 * NOTE: the edit endpoint contract is provisional — the platform side does not
 * exist yet (PR #1497 is generate-only). The endpoint path and `image_url`
 * field are best-guess and must be reconciled once the backend lands.
 */
export type EditRequestParams = {
  prompt: string;
  /** CDN URL of the source image to edit. */
  imageUrl: string;
  /** Target aspect ratio (used by outpaint to size the extended canvas). */
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

/** The job finished; the payload carries the uploaded file's identifiers. */
export type UploadcareJobSuccessStatus = {
  status: 'success';
  uuid?: string;
  file?: string;
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

async function throwHttpError(response: Response, action: string): Promise<never> {
  const text = await response.text().catch(() => '');
  throw new Error(`Uploadcare ${action} failed (${response.status} ${response.statusText})${text ? `: ${text}` : ''}`);
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
      image_url: params.imageUrl,
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

    const response = await this.doFetch(url.href, { method: 'GET', signal });
    if (!response.ok) await throwHttpError(response, 'generate status');

    const data = (await response.json()) as UploadcareJobStatus;
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) await throwHttpError(response, action);

    const data = (await response.json()) as UploadcareJobResponse;
    await devValidate('job', data);
    return data;
  }
}
