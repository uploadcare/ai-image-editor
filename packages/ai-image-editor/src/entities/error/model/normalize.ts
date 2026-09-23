import { AuthTokenResolverError } from '@uploadcare/signed-uploads/client';
import { UploadError } from '@uploadcare/upload-client';
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
  // The host's `authToken` function threw, so nothing was ever sent. Its own
  // message is the host's internal one, not something to show a user.
  if (err instanceof AuthTokenResolverError) {
    return new AiImageEditorError(err.message, { code: 'auth_token_failed', cause: err });
  }
  // Upload API failures (uploads, file info) carry the server's error code —
  // including the auth ones the editor has messages for.
  if (err instanceof UploadError) {
    return new AiImageEditorError(err.message, { code: err.code, cause: err });
  }
  if (err instanceof Error) {
    return new AiImageEditorError(err.message, { cause: err });
  }
  return new AiImageEditorError(typeof err === 'string' && err ? err : 'Generation failed', { cause: err });
}
