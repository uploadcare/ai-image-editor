/**
 * Single source of truth for the known `uc:error` codes — shared between
 * `AiImageEditorErrorCode` (entities/error) and the `ai-image-editor-error-<code>`
 * locale keys (shared/i18n). The list mirrors what the platform/job APIs are
 * known to send; it is not a closed contract — unknown codes still flow
 * through as plain strings. Frontend-originated codes (e.g. the React
 * wrapper's `engine_load_failed`) deliberately stay out of this list.
 */
export const KNOWN_ERROR_CODES = [
  // Platform validation (POST generate/edit, GET status)
  'invalid_request',
  'invalid_source',
  'source_not_found',
  'source_not_image',
  'source_url_unavailable',
  'invalid_aspect_ratio',
  'canvas_too_large',
  'canvas_dimension_too_small',
  'source_extends_beyond_canvas',
  'derivative_disabled',
  'job_id_required',
  'job_not_found',
  // Project / key (Upload API rejects the request before a job exists)
  'ProjectPublicKeyInvalidError',
  // Auth token (Upload API rejects the Bearer token). Raised by the upload and
  // file-info requests the editor makes through `@uploadcare/upload-client`;
  // the `derivative/*` endpoints do not check the token today.
  'AccessTokenInvalidError',
  'AccessTokenExpiredError',
  'ScopeForbiddenError',
  'OperationsLimitExceededError',
  'SignatureRequiredError',
  // AI gateway (job status)
  'content_moderated',
  'provider_unavailable',
  'generation_timeout',
  'invalid_input',
  'RequestThrottledError',
  // Upload pipeline (job status)
  'DownloadFileHTTPClientError',
  'DownloadFileNotFoundError',
  'DownloadFileTaskFailedError',
] as const;

export type KnownErrorCode = (typeof KNOWN_ERROR_CODES)[number];

/**
 * Codes the editor raises itself, for failures that never reach the API. Kept
 * apart from {@link KNOWN_ERROR_CODES} (which mirrors the server) but they get
 * the same `ai-image-editor-error-<code>` locale treatment. Codes raised by
 * other frontend packages (the React wrapper's `engine_load_failed`) stay out.
 */
export const CLIENT_ERROR_CODES = [
  /** The `authToken` function threw or rejected, so no token could be sent. */
  'auth_token_failed',
] as const;

export type ClientErrorCode = (typeof CLIENT_ERROR_CODES)[number];

/**
 * The auth token failures, which share one user-facing message
 * (`ai-image-editor-error-auth`) instead of one per code: they differ only in
 * what the integrator has to fix, and the visitor sees the same dead end
 * either way.
 */
export const AUTH_ERROR_CODES = [
  'AccessTokenInvalidError',
  'AccessTokenExpiredError',
  'ScopeForbiddenError',
  'OperationsLimitExceededError',
  'SignatureRequiredError',
  'auth_token_failed',
] as const satisfies readonly (KnownErrorCode | ClientErrorCode)[];

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export const isAuthErrorCode = (code: string): code is AuthErrorCode =>
  (AUTH_ERROR_CODES as readonly string[]).includes(code);
