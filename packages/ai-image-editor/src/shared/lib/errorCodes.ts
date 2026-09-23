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
 * `AiImageEditorErrorCode` (entities/error) and the `ai-image-editor-error-*`
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
 * Codes that share one user-facing message, keyed by the message's locale
 * suffix (`ai-image-editor-error-<group>`).
 *
 * A code earns a message only when that message changes what the person at the
 * screen does next. Codes that differ only in what the integrator has to fix
 * read the same from the outside, so they collapse into one line; codes in no
 * group and with no message of their own fall back to the generic
 * `ai-image-editor-error`, because "try again" is the whole of the advice.
 */
export const ERROR_MESSAGE_GROUPS = {
  /** The token was rejected, or the app couldn't produce one. */
  auth: [
    'AccessTokenInvalidError',
    'AccessTokenExpiredError',
    'ScopeForbiddenError',
    'OperationsLimitExceededError',
    'SignatureRequiredError',
    'auth_token_failed',
  ],
  /** The project isn't set up for this; waiting is all the visitor can do. */
  setup: ['ProjectPublicKeyInvalidError', 'derivative_disabled'],
  /**
   * The image they picked can't be used — a different one might be. Kept apart
   * from `source_url_unavailable` (retry, don't replace) and `source_not_image`
   * (the file isn't an image at all), which lead somewhere else.
   */
  source: ['invalid_source', 'source_not_found'],
  /** Nothing is broken, the service is loaded — worth retrying in a moment. */
  busy: ['provider_unavailable', 'generation_timeout', 'RequestThrottledError'],
} as const satisfies Record<string, readonly (KnownErrorCode | ClientErrorCode)[]>;

export type ErrorMessageGroup = keyof typeof ERROR_MESSAGE_GROUPS;

/**
 * Every auth code upload-client knows about has to be in the `auth` group, or a
 * token failure it adds later would reach the screen as "something went wrong"
 * with no mention of reloading. Type-level, so it fails the build rather than
 * waiting for someone to hit it.
 */
type UngroupedAuthCode = Exclude<AuthErrorCode, (typeof ERROR_MESSAGE_GROUPS)['auth'][number]>;
export type EveryAuthCodeIsGrouped = [UngroupedAuthCode] extends [never] ? true : UngroupedAuthCode;
const EVERY_AUTH_CODE_IS_GROUPED: EveryAuthCodeIsGrouped = true;

// Referenced so the assertion above can't be dropped as dead code.
export const AUTH_GROUP_IS_COMPLETE = EVERY_AUTH_CODE_IS_GROUPED;

/** The few codes specific enough to keep a message of their own. */
export const CODES_WITH_OWN_MESSAGE = [
  'canvas_too_large',
  'canvas_dimension_too_small',
  'content_moderated',
  'source_not_image',
  'source_url_unavailable',
  // Two different problems with the shape: one ratio the service won't take at
  // all, versus a ratio it would take but this image can't be cropped into.
  'invalid_aspect_ratio',
  'source_extends_beyond_canvas',
] as const satisfies readonly KnownErrorCode[];

export type CodeWithOwnMessage = (typeof CODES_WITH_OWN_MESSAGE)[number];

/** The group a code belongs to, or `undefined` when it has no shared message. */
export const errorMessageGroup = (code: string): ErrorMessageGroup | undefined =>
  (Object.keys(ERROR_MESSAGE_GROUPS) as ErrorMessageGroup[]).find((group) =>
    (ERROR_MESSAGE_GROUPS[group] as readonly string[]).includes(code),
  );
