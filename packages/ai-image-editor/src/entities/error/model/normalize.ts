import { AiProviderError } from '../../provider';
import { AiImageEditorError } from './types';

/**
 * Normalizes any thrown value into the public {@link AiImageEditorError},
 * preserving the original on `.cause`. Idempotent; the sole entry point for
 * the `uc:error` dispatch, so `detail.error` is always the one public class
 * even when a custom provider throws arbitrary values.
 */
export function normalizeError(err: unknown): AiImageEditorError {
  if (err instanceof AiImageEditorError) return err;
  if (err instanceof AiProviderError) {
    return new AiImageEditorError(err.message, { code: err.errorCode, source: err.errorSource, cause: err });
  }
  if (err instanceof Error) {
    return new AiImageEditorError(err.message, { cause: err });
  }
  return new AiImageEditorError(typeof err === 'string' && err ? err : 'Generation failed', { cause: err });
}
