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
