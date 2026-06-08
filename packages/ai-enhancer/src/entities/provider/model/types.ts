import type { UploadcareFile } from '@uploadcare/upload-client';
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
  /** UUIDs of reference images guiding the edit (edit only, max 7). */
  references?: string[];
  signal?: AbortSignal;
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
