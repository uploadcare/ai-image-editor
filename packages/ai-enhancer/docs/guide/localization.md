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
  en: { 'ai-enhancer-cancel': 'Dismiss' },
  de: { 'ai-enhancer-generate-btn': 'Los!' },
}
```

Supported locales: `en ar az ca cs da de el es et fi fr he hy is it ja ka kk ko
lv nb nl pl pt ro ru sk sr sv tr uk vi zh` (and `zh-TW`). Browse the translations
on GitHub — the base [`en.ts`](https://github.com/uploadcare/ai-enhancer/blob/HEAD/packages/ai-enhancer/src/shared/i18n/en.ts)
and the [other locales](https://github.com/uploadcare/ai-enhancer/tree/HEAD/packages/ai-enhancer/src/shared/i18n/locales).

## Available strings

These are the keys you can override, shown with their English defaults (the base
locale, [`enLocale`](https://github.com/uploadcare/ai-enhancer/blob/HEAD/packages/ai-enhancer/src/shared/i18n/en.ts)).
Every locale provides this core set:

```ts
{
  'ai-enhancer-source-label': 'Generate image',       // uploader source button
  'ai-enhancer-file-action-label': 'AI Edit',         // uploader file action
  'ai-enhancer-generate-title': 'Generate image',     // header, generate mode
  'ai-enhancer-edit-title': 'Edit image',             // header, edit mode
  'ai-enhancer-generate-placeholder': 'Create image...',
  'ai-enhancer-edit-placeholder': 'Edit image...',
  'ai-enhancer-cancel': 'Cancel',
  'ai-enhancer-generate-btn': 'Generate',
  'ai-enhancer-done-btn': 'Done',
  'ai-enhancer-start-over': 'Start over',
  'ai-enhancer-history-title': 'Recent prompts',
  'ai-enhancer-busy': 'Generating…',                  // progress label
  'ai-enhancer-error': 'Something went wrong. Try again.', // generic error
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
}
```

`enLocale` is exported if you need to look strings up outside the element:

```ts
import { enLocale } from '@uploadcare/ai-enhancer'

enLocale['ai-enhancer-generate-btn'] // 'Generate'
```

## Error messages

When a generation or edit fails, the editor maps the backend `error_code` to an
`ai-enhancer-error-<code>` key and shows that message. If no key matches the code
(or you haven't translated it), it falls back to the generic `ai-enhancer-error`.
These per-code keys are **optional in every locale** — translate only the ones you
care about and the rest fall back gracefully:

```ts
editor.localeDefinitionOverride = {
  de: {
    'ai-enhancer-error': 'Etwas ist schiefgelaufen. Bitte erneut versuchen.',
    'ai-enhancer-error-content_moderated': 'Diese Anfrage wurde blockiert.',
  },
}
```

**Platform validation** — the request was rejected before generation started:

| Key | When it fires |
|---|---|
| `ai-enhancer-error-invalid_request` | The request was malformed or rejected. |
| `ai-enhancer-error-invalid_source` | The source image couldn't be read or decoded. |
| `ai-enhancer-error-source_not_found` | The source image (by uuid) doesn't exist. |
| `ai-enhancer-error-source_not_image` | The source file isn't an image. |
| `ai-enhancer-error-source_url_unavailable` | The source image couldn't be downloaded. |
| `ai-enhancer-error-invalid_aspect_ratio` | The requested aspect ratio isn't supported. |
| `ai-enhancer-error-canvas_too_large` | The result exceeds the 4-megapixel limit. |
| `ai-enhancer-error-canvas_dimension_too_small` | A side is under the 256px minimum. |
| `ai-enhancer-error-source_extends_beyond_canvas` | The source doesn't fit the target canvas. |
| `ai-enhancer-error-derivative_disabled` | AI generation isn't enabled for the account. |
| `ai-enhancer-error-job_id_required` | A job id was missing (internal). |
| `ai-enhancer-error-job_not_found` | The generation job expired or doesn't exist. |

**AI gateway** — the job failed while the model ran:

| Key | When it fires |
|---|---|
| `ai-enhancer-error-content_moderated` | Blocked by content moderation. |
| `ai-enhancer-error-provider_unavailable` | The upstream image service is overloaded. |
| `ai-enhancer-error-generation_timeout` | The job took too long and timed out. |
| `ai-enhancer-error-invalid_input` | The model rejected the inputs or settings. |
| `ai-enhancer-error-RequestThrottledError` | Too many requests — rate limited. |

**Upload pipeline** — the result couldn't be saved:

| Key | When it fires |
|---|---|
| `ai-enhancer-error-DownloadFileHTTPClientError` | Couldn't retrieve the generated image. |
| `ai-enhancer-error-DownloadFileNotFoundError` | The generated image wasn't found. |
| `ai-enhancer-error-DownloadFileTaskFailedError` | Couldn't save the generated image. |
