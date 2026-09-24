import type { ClientErrorCode, KnownErrorCode } from '../lib/errorCodes';

/** Core UI strings — every locale must provide all of these. */
const coreLocale = {
  'ai-image-editor-source-label': 'Generate image',
  'ai-image-editor-file-action-label': 'AI Edit',
  'ai-image-editor-generate-title': 'Generate image',
  'ai-image-editor-edit-title': 'Edit image',
  'ai-image-editor-generate-placeholder': 'Create image...',
  'ai-image-editor-edit-placeholder': 'Edit image...',
  'ai-image-editor-cancel': 'Cancel',
  'ai-image-editor-generate-btn': 'Generate',
  'ai-image-editor-done-btn': 'Done',
  'ai-image-editor-start-over': 'Start over',
  'ai-image-editor-history-title': 'Recent prompts',
  'ai-image-editor-busy': 'Generating…',
  'ai-image-editor-error': 'Something went wrong. Try again.',
  'ai-image-editor-fullscreen': 'View fullscreen',
  'ai-image-editor-exit-fullscreen': 'Exit fullscreen',
  'ai-image-editor-aspect-ratio-aria': 'Pick aspect ratio',
  'ai-image-editor-aspect-auto': 'Auto',
  'ai-image-editor-aspect-square': 'Square',
  'ai-image-editor-aspect-tall': 'Tall',
  'ai-image-editor-aspect-wide': 'Wide',
  'ai-image-editor-aspect-portrait': 'Portrait',
  'ai-image-editor-aspect-landscape': 'Landscape',
  'ai-image-editor-aspect-vertical': 'Vertical',
  'ai-image-editor-aspect-widescreen': 'Widescreen',
};

/**
 * A message per known `error_code`, keyed `ai-image-editor-error-<code>`. The
 * editor looks one up by code and falls back to the generic
 * `ai-image-editor-error` for a code it has never heard of. They're optional
 * per locale (English here is the default) and overridable via the `l10n`
 * property like any other string.
 *
 * Written for the person using our customer's site, who knows nothing about
 * projects, keys, tokens or jobs and can't fix any of them. Several codes
 * therefore read the same: an expired token and a forbidden scope are one dead
 * end from the outside, and a code with no advice beyond "try again" says just
 * that. The text is repeated per code rather than shared behind a lookup, so
 * this table is the whole story.
 */
const errorLocale: Record<`ai-image-editor-error-${KnownErrorCode | ClientErrorCode}`, string> = {
  // Platform validation (POST generate/edit, GET status)
  'ai-image-editor-error-invalid_request': 'Something went wrong. Try again.',
  'ai-image-editor-error-invalid_source': "This image can't be used. Please try a different one.",
  'ai-image-editor-error-source_not_found': "This image can't be used. Please try a different one.",
  'ai-image-editor-error-source_not_image': "That file isn't an image. Please choose an image.",
  // Transient: the image itself is fine, fetching it wasn't, so this one asks
  // for a retry where its neighbours ask for a different image.
  'ai-image-editor-error-source_url_unavailable': "That image couldn't be loaded. Please try again.",
  'ai-image-editor-error-invalid_aspect_ratio': "That aspect ratio isn't supported. Please pick another one.",
  'ai-image-editor-error-canvas_too_large': 'This image is too large (over 4 megapixels). Try a smaller one.',
  'ai-image-editor-error-canvas_dimension_too_small': 'This image is too small. Each side must be at least 256 pixels.',
  'ai-image-editor-error-source_extends_beyond_canvas':
    "This image doesn't fit that aspect ratio. Try one closer to the image's own shape.",
  // Nothing the visitor does will turn this on, so don't send them looking.
  'ai-image-editor-error-derivative_disabled': "Image generation isn't available right now. Please try again later.",
  'ai-image-editor-error-job_id_required': 'Something went wrong. Try again.',
  'ai-image-editor-error-job_not_found': 'Something went wrong. Try again.',
  // Project / key: a setup problem, and it reads like the one above because it
  // is the same dead end for everyone but the integrator.
  'ai-image-editor-error-ProjectPublicKeyInvalidError':
    "Image generation isn't available right now. Please try again later.",
  // Auth token. All six read the same: reloading is the only thing that might
  // help (it usually mints a new token), and the specific code is on
  // `uc:error` and in the console for whoever can act on it.
  'ai-image-editor-error-AccessTokenInvalidError': 'Something went wrong. Please reload the page and try again.',
  'ai-image-editor-error-AccessTokenExpiredError': 'Something went wrong. Please reload the page and try again.',
  'ai-image-editor-error-ScopeForbiddenError': 'Something went wrong. Please reload the page and try again.',
  'ai-image-editor-error-OperationsLimitExceededError': 'Something went wrong. Please reload the page and try again.',
  'ai-image-editor-error-SignatureRequiredError': 'Something went wrong. Please reload the page and try again.',
  'ai-image-editor-error-auth_token_failed': 'Something went wrong. Please reload the page and try again.',
  // AI gateway (job status)
  'ai-image-editor-error-content_moderated': "That prompt isn't allowed. Try describing it differently.",
  'ai-image-editor-error-provider_unavailable': 'The image service is busy right now. Please try again in a moment.',
  'ai-image-editor-error-generation_timeout': 'The image service is busy right now. Please try again in a moment.',
  'ai-image-editor-error-RequestThrottledError': 'The image service is busy right now. Please try again in a moment.',
  'ai-image-editor-error-invalid_input': 'Something went wrong. Try again.',
  // Upload pipeline (job status)
  'ai-image-editor-error-DownloadFileHTTPClientError': 'Something went wrong. Try again.',
  'ai-image-editor-error-DownloadFileNotFoundError': 'Something went wrong. Try again.',
  'ai-image-editor-error-DownloadFileTaskFailedError': 'Something went wrong. Try again.',
};

/**
 * History paging arrow aria-labels. Optional per locale (they fall back to
 * English), so translations can adopt them incrementally like the error codes.
 */
const navLocale = {
  'ai-image-editor-history-prev': 'Older results',
  'ai-image-editor-history-next': 'Newer results',
};

export const enLocale = { ...coreLocale, ...navLocale, ...errorLocale };

export type AiImageEditorLocaleKey = keyof typeof enLocale;

/**
 * A locale's strings. Core keys are required; the paging labels and per-error-
 * code messages are optional (they fall back to English / the generic message),
 * so translations can adopt them incrementally without every locale listing all.
 */
export type AiImageEditorLocale = Record<keyof typeof coreLocale, string> &
  Partial<Record<keyof typeof navLocale, string>> &
  Partial<Record<keyof typeof errorLocale, string>>;
