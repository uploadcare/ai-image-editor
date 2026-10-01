---
title: Error handling
---

# Error handling

Two things happen when a generation or edit fails. The editor handles the user:
it shows a [localized message](/guide/localization#error-messages) in place and
stays usable, with no wiring needed on your side. Your app gets the `uc:error`
event for everything the built-in UI can't know about: logging, metrics, or
reacting to specific failures.

```js
const editor = document.querySelector('uc-ai-image-editor');

editor.addEventListener('uc:error', (e) => {
  const error = e.detail.error; // always an AiImageEditorError
  console.warn(`generation failed: ${error.code}`, error);
});
```

The event bubbles and crosses shadow DOM boundaries (`composed`), so a
listener on a container, or on `document`, works too.

## The error object

`detail.error` is always an **`AiImageEditorError`**. Whatever actually went
wrong (a platform rejection, a network failure, even a custom provider throwing
a string) is normalized into it:

| Field | Type | What it tells you |
|---|---|---|
| `code` | `AiImageEditorErrorCode` | What failed: one of the [known codes](#error-codes), or any other string (backend-minted, or frontend-originated like the React wrapper's `engine_load_failed`). `'unknown'` when the failure carried no code (e.g. a network error). |
| `message` | `string` | The raw, untranslated failure text, for logs rather than for users (show [localized messages](/guide/localization#error-messages) instead). |
| `source` | `string \| undefined` | Which stage of a job reported the failure, when the backend says (e.g. `'ai_gateway'`). Values are backend-defined, so treat them as log enrichment rather than something to branch on. |
| `cause` | `unknown` | The original thrown value, untouched: the underlying `Error`, or whatever a custom provider threw. |

## Error codes

`code` is the field to branch on:

```ts
import type { AiImageEditorError } from '@uploadcare/ai-image-editor';

function report(error: AiImageEditorError) {
  switch (error.code) {
    case 'content_moderated':
      // the prompt was blocked — nothing to retry
      break;
    case 'provider_unavailable':
    case 'generation_timeout':
      // transient — worth offering a retry
      break;
    default:
      console.error('ai-image-editor failed:', error.code, error.message);
  }
}
```

Every failure is also logged to the console (`[uc-ai-image-editor]`, with the
code, the raw message and the error object), so a code you haven't wired up
still shows up while debugging.

The known codes come in four families:

| Family | Example codes | What went wrong |
|---|---|---|
| Platform validation | `invalid_source`, `canvas_too_large`, `derivative_disabled` | Bad input or project setup |
| AI gateway | `content_moderated`, `provider_unavailable`, `generation_timeout` | The generation itself |
| Auth token | `AccessTokenExpiredError`, `ScopeForbiddenError`, `OperationsLimitExceededError`, `AccessTokenInvalidError`, `SignatureRequiredError`, `auth_token_failed` | [Signed AI image generation](/guide/integrating#signed-ai-generation) or signed uploads refused the token, or your `authToken` function threw (`auth_token_failed`) |
| Upload pipeline | `DownloadFileHTTPClientError` and friends | Saving the result |

PascalCase codes come from Upload API; snake_case codes come from the editor.

Your handler gets every code. The on-screen message is less specific: codes the
user can act on get their own wording, and the rest, including every token
failure, share a generic one. The [localization guide](/guide/localization#error-messages) lists each
message.

`AiImageEditorErrorCode` is deliberately open: the known codes are typed as
literals (you get autocomplete for them), but the backend can introduce new
ones at any time, so any other string flows through rather than breaking.
Don't treat the union as closed; keep a `default` branch.

### When your auth token function fails {#auth-token-errors}

A throw from an [`authToken`](/guide/integrating#signed-ai-generation) function never
reaches the backend, so there is no server code to report. It arrives as
`code: 'auth_token_failed'`, with the `AuthTokenResolverError` from
`@uploadcare/signed-uploads` on `cause` and whatever your function threw on
`cause.cause`:

```js
editor.addEventListener('uc:error', (e) => {
  if (e.detail.error.code === 'auth_token_failed') {
    // Your endpoint, not ours. The original failure is on the cause chain.
    signInAgain();
  }
});
```

Branch on it when a failed token means the session is gone and the user should
go back through your login rather than retry.

Inside File Uploader you don't set the token: the editor uses the uploader's
token function and its cache. You can still get this error there. If that
function throws while a generation is running, it surfaces as
`auth_token_failed` on the editor's `uc:error`, so listen for it either way.

### Enabling AI Image Editor {#derivative-disabled}

`derivative_disabled` means AI generation isn't enabled for your project. The
editor won't say so on screen, since a visitor can't act on it: they see
"Image generation isn't available right now. Please try again later." Watch for
the code on `uc:error` or in the console instead.
During the **public beta**, AI Image Editor is available on all **paid**
Uploadcare plans. [Upgrade your plan](https://uploadcare.com/pricing/) if
you're on a free one, or contact support if you hit this code on a paid
account.

## React

The [React wrapper](/guide/react) delivers the same object to `onError`:

```tsx
<AiImageEditor
  pubkey="YOUR_PUBLIC_KEY"
  onError={(error) => console.warn(error.code, error.cause)}
/>
```

One React-specific case: if the lazily-loaded editor engine itself fails to
load (e.g. a chunk request dies on a flaky connection), `onError` receives an
`AiImageEditorError` with `code: 'engine_load_failed'` and the `fallback` stays
rendered. That code is frontend-originated, so it never appears in the backend
families above.

## Customizing the in-editor messages

The message the *editor* shows for a code is a locale string, overridable
per-code without touching your event handling:

```js
editor.localeDefinitionOverride = {
  en: { 'ai-image-editor-error-content_moderated': 'That prompt isn’t allowed here.' },
};
```

Each code has its own key, so overriding one changes that code alone — several
share the same default text, and changing one of those leaves the others as
they were. A code with no key (one this version has never heard of) falls back
to the generic `ai-image-editor-error`. See
[Localization](/guide/localization#error-messages) for the mechanics and the
full key list.

## Server-side code

`instanceof AiImageEditorError` works in server code too. Import the class from
the side-effect-free `errors` entry, which is safe where the main entry is not
(the main entry registers custom elements):

```ts
import { AiImageEditorError } from '@uploadcare/ai-image-editor/errors';

if (err instanceof AiImageEditorError && err.code === 'derivative_disabled') {
  // e.g. surface a setup hint in your server logs
}
```

## What doesn't fire `uc:error`

- **Cancellations.** Closing the editor fires `uc:cancel`; superseding or
  aborting an in-flight generation (Start over, unmount) is swallowed
  silently, since an abort is a user action rather than a failure.
- **Image display failures.** If a result generated fine but its image fails
  to *load* into the canvas, that surfaces as a separate `uc:image-error`
  event (`detail.url` names the failing URL). The generation itself didn't
  fail.
