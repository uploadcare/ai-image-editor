import { AiProviderError } from '../../provider';
import { AiEnhancerError } from './types';

/**
 * Normalizes any thrown value into the public {@link AiEnhancerError},
 * preserving the original on `.cause`. Idempotent; the sole entry point for
 * the `uc:error` dispatch, so `detail.error` is always the one public class
 * even when a custom provider throws arbitrary values.
 */
export function normalizeError(err: unknown): AiEnhancerError {
  if (err instanceof AiEnhancerError) return err;
  if (err instanceof AiProviderError) {
    return new AiEnhancerError(err.message, { code: err.errorCode, source: err.errorSource, cause: err });
  }
  if (err instanceof Error) {
    return new AiEnhancerError(err.message, { cause: err });
  }
  return new AiEnhancerError(typeof err === 'string' && err ? err : 'Generation failed', { cause: err });
}
