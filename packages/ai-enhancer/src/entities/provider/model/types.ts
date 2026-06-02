import type { UploadcareFile } from '@uploadcare/upload-client';
import type { AspectRatio } from '../../aspect-ratio';
import type { AiCapability } from '../../capability';

export type AiProviderRequest = {
  prompt: string;
  capability: AiCapability;
  /**
   * Target aspect ratio for `generate` (and outpaint). Validated by the editor
   * before the call; providers may pass it through unchanged.
   */
  aspectRatio?: AspectRatio;
  sourceUrl?: string;
  signal?: AbortSignal;
};

export type AiProviderResult = {
  url: string;
  /** UUID of the resulting Uploadcare file (same as `file.uuid`). */
  uuid: string;
  prompt: string;
  capability: AiCapability;
  /** The resulting file as an Uploadcare file object. */
  file: UploadcareFile;
};

export type AiProvider = {
  id: string;
  generate(request: AiProviderRequest): Promise<AiProviderResult>;
};
