---
title: Error handling
---

# Error handling

Two things happen when a generation or edit fails. The editor handles the user:
it shows a [localized message](/guide/localization#error-messages) in place and
stays usable — no wiring needed. Your app gets the `uc:error` event, for
everything the built-in UI can't know: logging, metrics, or reacting to
specific failures.

```js
const editor = document.querySelector('uc-ai-enhancer');

editor.addEventListener('uc:error', (e) => {
  const error = e.detail.error; // always an AiEnhancerError
  console.warn(`generation failed: ${error.code}`, error);
});
```

## The error object

`detail.error` is always an **`AiEnhancerError`** — whatever actually went
wrong (a platform rejection, a network failure, even a custom provider throwing
a string) is normalized into it:

| Field | Type | What it tells you |
|---|---|---|
| `code` | `AiEnhancerErrorCode` | What failed — one of the [known codes](#error-codes), or any string the backend sends. `'unknown'` when the failure carried no code (e.g. a network error). |
| `message` | `string` | The raw, untranslated failure text — for logs, not for users (show [localized messages](/guide/localization#error-messages) instead). |
| `source` | `string \| undefined` | Which stage of a job reported the failure, when the backend says. |
| `cause` | `unknown` | The original thrown value, untouched — the underlying `Error`, or whatever a custom provider threw. |

## Error codes

`code` is the field to branch on:

```ts
import type { AiEnhancerError } from '@uploadcare/ai-enhancer';

function report(error: AiEnhancerError) {
  switch (error.code) {
    case 'content_moderated':
      // the prompt was blocked — nothing to retry
      break;
    case 'provider_unavailable':
    case 'generation_timeout':
      // transient — worth offering a retry
      break;
    default:
      console.error('ai-enhancer failed:', error.code, error.message);
  }
}
```

The known codes come in three families — **platform validation** (bad input:
`invalid_source`, `canvas_too_large`, …), **AI gateway** (generation itself:
`content_moderated`, `provider_unavailable`, `generation_timeout`, …), and
**upload pipeline** (persisting the result: `DownloadFile*`). The full list
with their user-facing messages lives in the
[localization guide](/guide/localization#error-messages).

`AiEnhancerErrorCode` is deliberately open: the known codes are typed as
literals (you get autocomplete and exhaustive `switch` support), but the
backend can introduce new ones at any time, so any other string flows through
rather than breaking. Don't treat the union as closed — keep a `default`
branch.

## React

The [React wrapper](/guide/react) delivers the same object to `onError`:

```tsx
<AiEnhancer
  pubkey="YOUR_PUBLIC_KEY"
  onError={(error) => console.warn(error.code, error.cause)}
/>
```

One React-specific case: if the lazily-loaded editor engine itself fails to
load (e.g. a chunk request dies on a flaky connection), `onError` receives an
`AiEnhancerError` with `code: 'engine_load_failed'` and the `fallback` stays
rendered. That code is frontend-originated — it never appears in the backend
families above.

## Customizing the in-editor messages

The message the *editor* shows for a code is a locale string, overridable
per-code without touching your event handling:

```js
editor.localeDefinitionOverride = {
  en: { 'ai-enhancer-error-content_moderated': 'That prompt isn’t allowed here.' },
};
```

See [Localization](/guide/localization#error-messages) for the mechanics and
the full key list.

## Server-side code

`instanceof AiEnhancerError` works in server code too — import the class from
the side-effect-free `errors` entry, which is safe where the main entry (it
registers custom elements) is not:

```ts
import { AiEnhancerError } from '@uploadcare/ai-enhancer/errors';

if (err instanceof AiEnhancerError && err.code === 'derivative_disabled') {
  // e.g. surface a setup hint in your server logs
}
```

## What doesn't fire `uc:error`

- **Cancellations.** Closing the editor fires `uc:cancel`; superseding or
  aborting an in-flight generation (Start over, unmount) is swallowed
  silently — aborts are a user action, not a failure.
- **Image display failures.** If a result generated fine but its image fails
  to *load* into the canvas, that surfaces as a separate `uc:image-error`
  event (`detail.url` names the failing URL) — the generation itself didn't
  fail.
