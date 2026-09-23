import type { CodeWithOwnMessage, ErrorMessageGroup } from '../lib/errorCodes';

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
 * Messages for the failures the editor can explain, keyed
 * `ai-image-editor-error-<group|code>` (see {@link ERROR_MESSAGE_GROUPS}).
 *
 * Written for the person using our customer's site, who knows nothing about
 * projects, keys, tokens or jobs and can't fix any of them. A code only gets a
 * line here when that line changes what they do next; everything else falls
 * back to the generic `ai-image-editor-error`, since "try again" is all there
 * is to say. They're optional per locale (English here is the default) and
 * overridable via the `l10n` property like any other string.
 */
const errorLocale: Record<`ai-image-editor-error-${ErrorMessageGroup | CodeWithOwnMessage}`, string> = {
  // Nothing they do will turn this on, so don't send them looking.
  'ai-image-editor-error-setup': "Image generation isn't available right now. Please try again later.",
  // Reloading is the one thing that might help: it usually mints a new token.
  'ai-image-editor-error-auth': 'Something went wrong. Please reload the page and try again.',
  'ai-image-editor-error-source': "This image can't be used. Please try a different one.",
  // Transient: the image itself is fine, fetching it wasn't. Retrying is the
  // advice, which is the opposite of what the shared `source` line says.
  'ai-image-editor-error-source_url_unavailable': "That image couldn't be loaded. Please try again.",
  'ai-image-editor-error-source_not_image': "That file isn't an image. Please choose an image.",
  'ai-image-editor-error-invalid_aspect_ratio': "That aspect ratio isn't supported. Please pick another one.",
  'ai-image-editor-error-source_extends_beyond_canvas':
    "This image doesn't fit that aspect ratio. Try one closer to the image's own shape.",
  'ai-image-editor-error-busy': 'The image service is busy right now. Please try again in a moment.',
  'ai-image-editor-error-canvas_too_large': 'This image is too large (over 4 megapixels). Try a smaller one.',
  'ai-image-editor-error-canvas_dimension_too_small': 'This image is too small. Each side must be at least 256 pixels.',
  'ai-image-editor-error-content_moderated': "That prompt isn't allowed. Try describing it differently.",
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
