/** Core UI strings — every locale must provide all of these. */
const coreLocale = {
  'ai-enhancer-source-label': 'Generate image',
  'ai-enhancer-file-action-label': 'AI Edit',
  'ai-enhancer-generate-title': 'Generate image',
  'ai-enhancer-edit-title': 'Edit image',
  'ai-enhancer-generate-placeholder': 'Create image...',
  'ai-enhancer-edit-placeholder': 'Edit image...',
  'ai-enhancer-cancel': 'Cancel',
  'ai-enhancer-generate-btn': 'Generate',
  'ai-enhancer-done-btn': 'Done',
  'ai-enhancer-start-over': 'Start over',
  'ai-enhancer-history-title': 'Recent prompts',
  'ai-enhancer-busy': 'Generating…',
  'ai-enhancer-error': 'Something went wrong. Try again.',
  'ai-enhancer-fullscreen': 'View fullscreen',
  'ai-enhancer-exit-fullscreen': 'Exit fullscreen',
  'ai-enhancer-aspect-ratio-aria': 'Pick aspect ratio',
  'ai-enhancer-aspect-original': 'Original',
  'ai-enhancer-aspect-square': 'Square',
  'ai-enhancer-aspect-tall': 'Tall',
  'ai-enhancer-aspect-wide': 'Wide',
  'ai-enhancer-aspect-portrait': 'Portrait',
  'ai-enhancer-aspect-landscape': 'Landscape',
  'ai-enhancer-aspect-vertical': 'Vertical',
  'ai-enhancer-aspect-widescreen': 'Widescreen',
};

/**
 * Friendly messages for known platform/job `error_code`s, keyed
 * `ai-enhancer-error-<code>`. The editor looks these up by code and falls back
 * to the generic `ai-enhancer-error`. They're optional per locale (English here
 * is the default) and overridable via the `l10n` property like any other string.
 */
const errorLocale = {
  // Platform validation (POST generate/edit/outpaint, GET status)
  'ai-enhancer-error-invalid_request': 'Something went wrong with the request. Please try again.',
  'ai-enhancer-error-invalid_source': "The source image couldn't be read. Please try a different image.",
  'ai-enhancer-error-source_not_found': "The source image couldn't be found.",
  'ai-enhancer-error-source_not_image': 'The source file must be an image.',
  'ai-enhancer-error-source_url_unavailable': "The source image couldn't be downloaded. Please try again.",
  'ai-enhancer-error-invalid_aspect_ratio': "That aspect ratio isn't supported.",
  'ai-enhancer-error-canvas_too_large': 'The image is too large (max 4 megapixels). Try a smaller size.',
  'ai-enhancer-error-canvas_dimension_too_small': 'The image is too small — each side must be at least 256px.',
  'ai-enhancer-error-source_extends_beyond_canvas': "The source image doesn't fit the canvas. Try a larger canvas.",
  'ai-enhancer-error-derivative_disabled': "AI image generation isn't enabled for this account.",
  'ai-enhancer-error-job_id_required': 'Something went wrong. Please try again.',
  'ai-enhancer-error-job_not_found': 'This generation has expired. Please try again.',
  // AI gateway (job status)
  'ai-enhancer-error-content_moderated': 'This request was blocked by content moderation. Try a different prompt.',
  'ai-enhancer-error-provider_unavailable': 'The image service is busy right now. Please try again in a moment.',
  'ai-enhancer-error-generation_timeout': 'Generation took too long and timed out. Please try again.',
  'ai-enhancer-error-invalid_input': 'Some settings are invalid. Please adjust them and try again.',
  // Upload pipeline (job status)
  'ai-enhancer-error-DownloadFileHTTPClientError': "Couldn't retrieve the generated image. Please try again.",
  'ai-enhancer-error-DownloadFileNotFoundError': "The generated image couldn't be found. Please try again.",
  'ai-enhancer-error-DownloadFileTaskFailedError': "Couldn't save the generated image. Please try again.",
};

export const enLocale = { ...coreLocale, ...errorLocale };

export type AiEnhancerLocaleKey = keyof typeof enLocale;

/**
 * A locale's strings. Core keys are required; the per-error-code messages are
 * optional (they fall back to English / the generic message), so translations
 * can adopt them incrementally without every locale listing every code.
 */
export type AiEnhancerLocale = Record<keyof typeof coreLocale, string> &
  Partial<Record<keyof typeof errorLocale, string>>;
