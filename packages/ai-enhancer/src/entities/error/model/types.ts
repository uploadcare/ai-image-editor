import type { KnownErrorCode } from '../../../shared/lib/errorCodes';

/**
 * The known error codes (see {@link KNOWN_ERROR_CODES} in shared/lib), plus an
 * escape hatch: the backend can introduce codes the frontend hasn't heard of,
 * and frontend-originated failures use their own codes (e.g. the React
 * wrapper's `engine_load_failed`).
 */
export type AiEnhancerErrorCode = KnownErrorCode | (string & {});

export type AiEnhancerErrorOptions = {
  code?: AiEnhancerErrorCode;
  /** Job/platform `error_source`, when the failure reports one. */
  source?: string;
  /** The original thrown value. */
  cause?: unknown;
};

/**
 * The one error type carried by `uc:error`'s `detail.error`. Every value
 * thrown out of a generation/edit run is normalized into this class at the
 * dispatch site; the original thrown value is always preserved on `.cause`.
 * The UI maps `code` to a localized message (`ai-enhancer-error-<code>`).
 */
export class AiEnhancerError extends Error {
  public readonly code: AiEnhancerErrorCode;
  public readonly source?: string;
  // declared locally: `Error.cause` needs lib ES2022+, this package targets ES2020
  public readonly cause?: unknown;

  public constructor(message: string, options: AiEnhancerErrorOptions = {}) {
    super(message);
    this.name = 'AiEnhancerError';
    this.code = options.code ?? 'unknown';
    this.source = options.source;
    this.cause = options.cause;
  }
}
