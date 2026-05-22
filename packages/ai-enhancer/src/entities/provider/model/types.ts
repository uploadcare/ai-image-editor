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
  prompt: string;
  capability: AiCapability;
};

export type AiProvider = {
  id: string;
  generate(request: AiProviderRequest): Promise<AiProviderResult>;
};
