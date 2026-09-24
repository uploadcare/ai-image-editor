---
title: Localization
---

# Localization

The editor ships English eagerly and lazy-loads 34 other locales. Set the active
language with `localeName`; the editor loads that locale's built-in strings on
demand. Customize individual strings with `localeDefinitionOverride`, which is
**keyed by locale name** and takes the same shape as the file uploader's config.
As a plugin, both follow the uploader's `localeName` /
`localeDefinitionOverride` automatically.

```ts
// Standalone: pick the language and override specific strings per locale.
editor.localeName = 'de'
editor.localeDefinitionOverride = {
  en: { 'ai-image-editor-cancel': 'Dismiss' },
  de: { 'ai-image-editor-generate-btn': 'Los!' },
}
```

Supported locales: `en ar az ca cs da de el es et fi fr he hy is it ja ka kk ko
lv nb nl pl pt ro ru sk sr sv tr uk vi zh` (and `zh-TW`). Browse the translations
on GitHub: the base [`en.ts`](https://github.com/uploadcare/ai-image-editor/blob/HEAD/packages/ai-image-editor/src/shared/i18n/en.ts)
and the [other locales](https://github.com/uploadcare/ai-image-editor/tree/HEAD/packages/ai-image-editor/src/shared/i18n/locales).

## Available strings

These are the keys you can override, shown with their English defaults (the base
locale, [`enLocale`](https://github.com/uploadcare/ai-image-editor/blob/HEAD/packages/ai-image-editor/src/shared/i18n/en.ts)).
Every locale provides this core set:

```ts
{
  'ai-image-editor-source-label': 'Generate image',       // uploader source button
  'ai-image-editor-file-action-label': 'AI Edit',         // uploader file action
  'ai-image-editor-generate-title': 'Generate image',     // header, generate mode
  'ai-image-editor-edit-title': 'Edit image',             // header, edit mode
  'ai-image-editor-generate-placeholder': 'Create image...',
  'ai-image-editor-edit-placeholder': 'Edit image...',
  'ai-image-editor-cancel': 'Cancel',
  'ai-image-editor-generate-btn': 'Generate',
  'ai-image-editor-done-btn': 'Done',
  'ai-image-editor-start-over': 'Start over',
  'ai-image-editor-history-title': 'Recent prompts',
  'ai-image-editor-busy': 'Generating…',                  // progress label
  'ai-image-editor-error': 'Something went wrong. Try again.', // generic error
  'ai-image-editor-fullscreen': 'View fullscreen',
  'ai-image-editor-exit-fullscreen': 'Exit fullscreen',
  'ai-image-editor-aspect-ratio-aria': 'Pick aspect ratio',
  'ai-image-editor-aspect-original': 'Original',
  'ai-image-editor-aspect-square': 'Square',
  'ai-image-editor-aspect-tall': 'Tall',
  'ai-image-editor-aspect-wide': 'Wide',
  'ai-image-editor-aspect-portrait': 'Portrait',
  'ai-image-editor-aspect-landscape': 'Landscape',
  'ai-image-editor-aspect-vertical': 'Vertical',
  'ai-image-editor-aspect-widescreen': 'Widescreen',
}
```

`enLocale` is exported if you need to look strings up outside the element:

```ts
import { enLocale } from '@uploadcare/ai-image-editor'

enLocale['ai-image-editor-generate-btn'] // 'Generate'
```

## Error messages

When a generation or edit fails, the editor maps the `error_code` to an
`ai-image-editor-error-<code>` key and shows that message; a code it has never
heard of falls back to the generic `ai-image-editor-error`. Every key is
**optional in every locale**, so translate only the ones you care about and the
rest fall back to English:

```ts
editor.localeDefinitionOverride = {
  de: {
    'ai-image-editor-error': 'Etwas ist schiefgelaufen. Bitte erneut versuchen.',
    'ai-image-editor-error-content_moderated': 'Diese Anfrage wurde blockiert.',
  },
}
```

Several codes deliberately read the same. These messages are for the person
using your site, who knows nothing about your Uploadcare project and can't fix
it, so a failure they can't act on says only "Something went wrong. Try again."
and every token failure says the same line. The code itself is never lost: it's
on the `uc:error` event and in the console, where you can act on it.

| Key | Default message |
|---|---|
| `ai-image-editor-error` | Something went wrong. Try again. |
| `ai-image-editor-error-invalid_request` | Something went wrong. Try again. |
| `ai-image-editor-error-invalid_source` | This image can't be used. Please try a different one. |
| `ai-image-editor-error-source_not_found` | This image can't be used. Please try a different one. |
| `ai-image-editor-error-source_not_image` | That file isn't an image. Please choose an image. |
| `ai-image-editor-error-source_url_unavailable` | That image couldn't be loaded. Please try again. |
| `ai-image-editor-error-invalid_aspect_ratio` | That aspect ratio isn't supported. Please pick another one. |
| `ai-image-editor-error-canvas_too_large` | This image is too large (over 4 megapixels). Try a smaller one. |
| `ai-image-editor-error-canvas_dimension_too_small` | This image is too small. Each side must be at least 256 pixels. |
| `ai-image-editor-error-source_extends_beyond_canvas` | This image doesn't fit that aspect ratio. Try one closer to the image's own shape. |
| `ai-image-editor-error-derivative_disabled` | Image generation isn't available right now. Please try again later. |
| `ai-image-editor-error-job_id_required` | Something went wrong. Try again. |
| `ai-image-editor-error-job_not_found` | Something went wrong. Try again. |
| `ai-image-editor-error-ProjectPublicKeyInvalidError` | Image generation isn't available right now. Please try again later. |
| `ai-image-editor-error-AccessTokenInvalidError` | Something went wrong. Please reload the page and try again. |
| `ai-image-editor-error-AccessTokenExpiredError` | Something went wrong. Please reload the page and try again. |
| `ai-image-editor-error-ScopeForbiddenError` | Something went wrong. Please reload the page and try again. |
| `ai-image-editor-error-OperationsLimitExceededError` | Something went wrong. Please reload the page and try again. |
| `ai-image-editor-error-SignatureRequiredError` | Something went wrong. Please reload the page and try again. |
| `ai-image-editor-error-auth_token_failed` | Something went wrong. Please reload the page and try again. |
| `ai-image-editor-error-content_moderated` | That prompt isn't allowed. Try describing it differently. |
| `ai-image-editor-error-provider_unavailable` | The image service is busy right now. Please try again in a moment. |
| `ai-image-editor-error-generation_timeout` | The image service is busy right now. Please try again in a moment. |
| `ai-image-editor-error-RequestThrottledError` | The image service is busy right now. Please try again in a moment. |
| `ai-image-editor-error-invalid_input` | Something went wrong. Try again. |
| `ai-image-editor-error-DownloadFileHTTPClientError` | Something went wrong. Try again. |
| `ai-image-editor-error-DownloadFileNotFoundError` | Something went wrong. Try again. |
| `ai-image-editor-error-DownloadFileTaskFailedError` | Something went wrong. Try again. |


