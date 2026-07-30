---
title: Localization
---

# Localization

The editor ships English eagerly and lazy-loads 34 other locales. Set the active
language with `localeName`; the editor loads that locale's built-in strings on
demand. Customize individual strings with `localeDefinitionOverride` — **keyed by
locale name**, the same shape as the file uploader's config. As a plugin, both
follow the uploader's `localeName` / `localeDefinitionOverride` automatically.

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
on GitHub — the base [`en.ts`](https://github.com/uploadcare/ai-image-editor/blob/HEAD/packages/ai-image-editor/src/shared/i18n/en.ts)
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

When a generation or edit fails, the editor maps the backend `error_code` to an
`ai-image-editor-error-<code>` key and shows that message. If no key matches the code
(or you haven't translated it), it falls back to the generic `ai-image-editor-error`.
These per-code keys are **optional in every locale** — translate only the ones you
care about and the rest fall back gracefully:

```ts
editor.localeDefinitionOverride = {
  de: {
    'ai-image-editor-error': 'Etwas ist schiefgelaufen. Bitte erneut versuchen.',
    'ai-image-editor-error-content_moderated': 'Diese Anfrage wurde blockiert.',
  },
}
```

**Platform validation** — the request was rejected before generation started:

| Key | When it fires |
|---|---|
| `ai-image-editor-error-invalid_request` | The request was malformed or rejected. |
| `ai-image-editor-error-invalid_source` | The source image couldn't be read or decoded. |
| `ai-image-editor-error-source_not_found` | The source image (by uuid) doesn't exist. |
| `ai-image-editor-error-source_not_image` | The source file isn't an image. |
| `ai-image-editor-error-source_url_unavailable` | The source image couldn't be downloaded. |
| `ai-image-editor-error-invalid_aspect_ratio` | The requested aspect ratio isn't supported. |
| `ai-image-editor-error-canvas_too_large` | The result exceeds the 4-megapixel limit. |
| `ai-image-editor-error-canvas_dimension_too_small` | A side is under the 256px minimum. |
| `ai-image-editor-error-source_extends_beyond_canvas` | The source doesn't fit the target canvas. |
| `ai-image-editor-error-derivative_disabled` | AI generation isn't enabled for the account. |
| `ai-image-editor-error-job_id_required` | A job id was missing (internal). |
| `ai-image-editor-error-job_not_found` | The generation job expired or doesn't exist. |

**AI gateway** — the job failed while the model ran:

| Key | When it fires |
|---|---|
| `ai-image-editor-error-content_moderated` | Blocked by content moderation. |
| `ai-image-editor-error-provider_unavailable` | The upstream image service is overloaded. |
| `ai-image-editor-error-generation_timeout` | The job took too long and timed out. |
| `ai-image-editor-error-invalid_input` | The model rejected the inputs or settings. |
| `ai-image-editor-error-RequestThrottledError` | Too many requests — rate limited. |

**Upload pipeline** — the result couldn't be saved:

| Key | When it fires |
|---|---|
| `ai-image-editor-error-DownloadFileHTTPClientError` | Couldn't retrieve the generated image. |
| `ai-image-editor-error-DownloadFileNotFoundError` | The generated image wasn't found. |
| `ai-image-editor-error-DownloadFileTaskFailedError` | Couldn't save the generated image. |
