import type { AuthErrorCode, ServerErrorCode } from '@uploadcare/upload-client';

/**
 * Codes the `derivative/*` API mints for itself. They are snake_case and live
 * only in this product, so there is nothing upstream to import them from.
 */
const DERIVATIVE_ERROR_CODES = [
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
  // AI gateway (job status)
  'content_moderated',
  'provider_unavailable',
  'generation_timeout',
  'invalid_input',
] as const;

/**
 * Codes that come from the Upload API, not from us. Typed against
 * upload-client's own `ServerErrorCode`, so a typo, or a code upstream renames,
 * fails the build here instead of quietly falling back to the generic message
 * at runtime.
 */
const UPLOAD_API_ERROR_CODES = [
  // Project / key (rejected before a job exists)
  'ProjectPublicKeyInvalidError',
  // Auth token. Raised by the upload and file-info requests the editor makes
  // through `@uploadcare/upload-client`; `derivative/*` does not check the
  // token today.
  'AccessTokenInvalidError',
  'AccessTokenExpiredError',
  'ScopeForbiddenError',
  'OperationsLimitExceededError',
  'SignatureRequiredError',
  'RequestThrottledError',
  // Upload pipeline (job status)
  'DownloadFileHTTPClientError',
  'DownloadFileNotFoundError',
  'DownloadFileTaskFailedError',
] as const satisfies readonly ServerErrorCode[];

/**
 * Single source of truth for the known `uc:error` codes — shared between
 * `AiImageEditorErrorCode` (entities/error) and the `ai-image-editor-error-<code>`
 * locale keys (shared/i18n). It is not a closed contract: unknown codes still
 * flow through as plain strings. Frontend-originated codes (e.g. the React
 * wrapper's `engine_load_failed`) deliberately stay out of this list.
 */
export const KNOWN_ERROR_CODES = [...DERIVATIVE_ERROR_CODES, ...UPLOAD_API_ERROR_CODES] as const;

export type KnownErrorCode = (typeof KNOWN_ERROR_CODES)[number];

/**
 * Codes the editor raises itself, for failures that never reach the API. Kept
 * apart from {@link KNOWN_ERROR_CODES}, which mirrors the server. Codes raised
 * by other frontend packages (the React wrapper's `engine_load_failed`) stay
 * out.
 */
export const CLIENT_ERROR_CODES = [
  /** The `authToken` function threw or rejected, so no token could be sent. */
  'auth_token_failed',
] as const;

export type ClientErrorCode = (typeof CLIENT_ERROR_CODES)[number];

/**
 * Every auth code upload-client knows about has to be listed above, or a token
 * failure it adds later would reach the screen as the generic "something went
 * wrong" with no mention of reloading. Type-level, so it fails the build rather
 * than waiting for someone to hit it.
 */
type UnlistedAuthCode = Exclude<AuthErrorCode, KnownErrorCode>;
export const EVERY_AUTH_CODE_IS_LISTED: [UnlistedAuthCode] extends [never] ? true : UnlistedAuthCode = true;
