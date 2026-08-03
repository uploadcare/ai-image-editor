import type { KnownErrorCode } from '../lib/errorCodes';

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
 * Friendly messages for known platform/job `error_code`s, keyed
 * `ai-image-editor-error-<code>`. The editor looks these up by code and falls back
 * to the generic `ai-image-editor-error`. They're optional per locale (English here
 * is the default) and overridable via the `l10n` property like any other string.
 */
const errorLocale: Record<`ai-image-editor-error-${KnownErrorCode}`, string> = {
  // Platform validation (POST generate/edit/outpaint, GET status)
  'ai-image-editor-error-invalid_request': 'Something went wrong with the request. Please try again.',
  'ai-image-editor-error-invalid_source': "The source image couldn't be read. Please try a different image.",
  'ai-image-editor-error-source_not_found': "The source image couldn't be found.",
  'ai-image-editor-error-source_not_image': 'The source file must be an image.',
  'ai-image-editor-error-source_url_unavailable': "The source image couldn't be downloaded. Please try again.",
  'ai-image-editor-error-invalid_aspect_ratio': "That aspect ratio isn't supported.",
  'ai-image-editor-error-canvas_too_large': 'The image is too large (max 4 megapixels). Try a smaller size.',
  'ai-image-editor-error-canvas_dimension_too_small': 'The image is too small — each side must be at least 256px.',
  'ai-image-editor-error-source_extends_beyond_canvas': "The source image doesn't fit the canvas. Try a larger canvas.",
  'ai-image-editor-error-derivative_disabled': "AI image generation isn't enabled for this account.",
  'ai-image-editor-error-job_id_required': 'Something went wrong. Please try again.',
  'ai-image-editor-error-job_not_found': 'This generation has expired. Please try again.',
  // Project / key
  'ai-image-editor-error-ProjectPublicKeyInvalidError':
    "That public key isn't valid. Check the key for this project and try again.",
  // AI gateway (job status)
  'ai-image-editor-error-content_moderated': 'This request was blocked by content moderation. Try a different prompt.',
  'ai-image-editor-error-provider_unavailable': 'The image service is busy right now. Please try again in a moment.',
  'ai-image-editor-error-generation_timeout': 'Generation took too long and timed out. Please try again.',
  'ai-image-editor-error-invalid_input': 'Some settings are invalid. Please adjust them and try again.',
  'ai-image-editor-error-RequestThrottledError': 'Too many requests right now. Please wait a moment and try again.',
  // Upload pipeline (job status)
  'ai-image-editor-error-DownloadFileHTTPClientError': "Couldn't retrieve the generated image. Please try again.",
  'ai-image-editor-error-DownloadFileNotFoundError': "The generated image couldn't be found. Please try again.",
  'ai-image-editor-error-DownloadFileTaskFailedError': "Couldn't save the generated image. Please try again.",
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
