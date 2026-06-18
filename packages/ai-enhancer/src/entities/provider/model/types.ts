import type { Metadata, UploadcareFile } from '@uploadcare/upload-client';
import type { AspectRatio } from '../../aspect-ratio';
import type { AiEditorMode } from '../../mode';

export type AiProviderRequest = {
  prompt: string;
  mode: AiEditorMode;
  /**
   * Target aspect ratio. Required for `generate`; optional for `edit` (omitted
   * to preserve the source's ratio). Validated by the editor before the call.
   */
  aspectRatio?: AspectRatio;
  /** UUID of the source image to edit. Required when `mode` is `edit`. */
  source?: string;
  /** Desired output filename. Falls back to the provider's configured default. */
  filename?: string;
  signal?: AbortSignal;
  metadata?: Metadata;
};

export type AiProviderResult = {
  url: string;
  /** UUID of the resulting Uploadcare file (same as `file.uuid`). */
  uuid: string;
  prompt: string;
  mode: AiEditorMode;
  /** The resulting file as an Uploadcare file object. */
  file: UploadcareFile;
};

export type AiProvider = {
  id: string;
  generate(request: AiProviderRequest): Promise<AiProviderResult>;
};

/**
 * A failure that carries the platform/job `error_code` (and, for job failures,
 * the `error_source`). The UI maps the code to a localized, overridable message;
 * `message` keeps the server's raw text as a fallback / for logging.
 */
export class AiProviderError extends Error {
  public readonly errorCode: string;
  public readonly errorSource?: string;

  public constructor(errorCode: string, message: string, errorSource?: string) {
    super(message);
    this.name = 'AiProviderError';
    this.errorCode = errorCode;
    this.errorSource = errorSource;
  }
}
