---
title: Integrating into your app
---

# Integrating into your app

`<uc-ai-image-editor>` is a standard custom element, so it drops into any framework or
no framework at all. Two rules apply everywhere.

Object and function values (`metadata`, `presets`, `sourceFileInfo`,
`outputFilename`, `localeDefinitionOverride`, `aspectRatios`, and an `authToken` function) must be set as
**DOM properties**, not string attributes.

The `uc:*` events (`uc:done`, `uc:cancel`, `uc:change`, `uc:error`) are plain
DOM `CustomEvent`s, and `detail` carries the payload. For `uc:error` the detail
is always `{ error: AiImageEditorError }`; see [Error handling](/guide/errors).

Importing the package registers the element as a side effect:

```ts
import '@uploadcare/ai-image-editor'
```

## Without a build step (CDN)

With no npm and no bundler, load the element straight from a CDN as an ES
module. [esm.run](https://esm.run) (jsDelivr's ESM CDN) bundles the
dependencies (Lit) for you, so a single import registers `<uc-ai-image-editor>`:

```html
<script type="module">
  import 'https://esm.run/@uploadcare/ai-image-editor@%AI_IMAGE_EDITOR_VERSION%'
</script>

<uc-ai-image-editor pubkey="YOUR_PUBLIC_KEY"></uc-ai-image-editor>
```

Set object/function properties and listen for events from a module script:

```html
<script type="module">
  import 'https://esm.run/@uploadcare/ai-image-editor@%AI_IMAGE_EDITOR_VERSION%'

  const editor = document.querySelector('uc-ai-image-editor')
  editor.aspectRatios = [[1, 1], [16, 9]]
  editor.addEventListener('uc:done', (e) => console.log(e.detail.url))
</script>
```

### Dynamic locales over the CDN

Languages other than English [load on demand](/guide/localization) via dynamic
import, and that works over a CDN with no extra setup. The locale modules are
resolved relative to the entry you imported, so when you set the language the
browser fetches the matching one (`de`, `ja`, and so on) from the same CDN:

```html
<uc-ai-image-editor pubkey="YOUR_PUBLIC_KEY" locale-name="de"></uc-ai-image-editor>
```

The examples above pin `@%AI_IMAGE_EDITOR_VERSION%`, the version this
documentation was built for. **Keep an exact version pin** in production: the
lazy locale modules must come from the same build as the entry, and an
unpinned URL (`@latest`) can otherwise resolve them to a different version.

## React

Use the **`@uploadcare/react-ai-image-editor`** wrapper. It gives you typed props
plus `onDone` / `onCancel` / `onError` callbacks, SSR support out of the box,
and direct usage from Next.js Server Components. See the dedicated
[React guide](/guide/react):

```tsx
import { AiImageEditor } from '@uploadcare/react-ai-image-editor'

<AiImageEditor pubkey="YOUR_PUBLIC_KEY" onDone={({ url }) => console.log(url)} />
```

## Vue 3

Tell the compiler that `uc-` tags are custom elements, then bind properties with
the `.prop` modifier and events with `@`:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue({ template: { compilerOptions: { isCustomElement: (t) => t.startsWith('uc-') } } })],
})
```

```vue
<uc-ai-image-editor :pubkey="key" .metadata="meta" @uc:done="onDone" />
```

## Angular

Add `CUSTOM_ELEMENTS_SCHEMA` to the module/component, then bind properties with
`[prop]` and events with `(uc:done)`:

```html
<uc-ai-image-editor [pubkey]="key" (uc:done)="onDone($event)"></uc-ai-image-editor>
```

## Svelte

Works natively: attributes and properties bind directly, and custom events use
`on:`.

```svelte
<uc-ai-image-editor {pubkey} on:uc:done={onDone} />
```

## Signed AI image generation {#signed-ai-generation}

Inside the [File Uploader plugin](/guide/plugin) the editor uses the uploader's
token, so you set nothing here.

With **Signed AI image generation** turned on in your project's
[uploading settings](https://app.uploadcare.com/projects/-/settings/#uploading-signed-ai-generation),
Uploadcare rejects editor requests that carry no
[auth token](https://uploadcare.com/docs/security/secure-uploads/#credentials). Your backend
[issues the token](https://uploadcare.com/docs/security/secure-uploads/#issue). Set
`authToken` to the token, or to a function that fetches one:

```js
const editor = document.querySelector('uc-ai-image-editor')

editor.authToken = async () => {
  const response = await fetch('/uploadcare-token')
  // `fetch` does not throw on a 500, and a body without a token gives
  // `undefined`. Check both, so a failure says what actually went wrong.
  if (!response.ok) throw new Error(`token endpoint: ${response.status}`)
  const { token } = await response.json()
  if (!token) throw new Error('token endpoint returned no token')
  return token
}
```

The editor sends the token with every request. What a token function returns
is cached and refreshed 30 seconds before it expires, unless you set
`cacheAuthToken` to `false`, in which case your function is called for every
request and nothing is refreshed. A plain token is used as given and never
refreshed either, so it has to outlive the generation it starts. `authToken`
also takes a `{ getToken, invalidate }` object in place of the function, for
when you keep the cache yourself. An
[`AuthTokenCache`](https://github.com/uploadcare/uploadcare-js-api-clients/tree/master/packages/signed-uploads#caching-the-token-in-the-browser)
instance is already this shape, so you can pass one straight in. The editor
then adds none of its own, whatever `cacheAuthToken` says, and
`invalidateAuthToken()` forwards to your `invalidate()`. That is the shape the
File Uploader plugin passes through, which is why the editor inside the
uploader shares the uploader's cache, and why invalidating through either one
reaches the same token. See `authToken`,
`cacheAuthToken` and `invalidateAuthToken()` in the
[API reference](/api/components) for the details.

Nothing drops a token on its own when Uploadcare refuses it. The editor's
generation, edit and status requests are plain one-shot requests: they raise
the error and stop, so a token that expired or spent its last operation keeps
being sent until something replaces it. Call `editor.invalidateAuthToken()`
from your error handler to make the next request fetch a new one. (Uploads
through the File Uploader are a separate path and do retry once by
themselves.)

::: warning
Turn the setting on only after the editor sends a token. It applies
immediately, so an editor without one starts failing.
:::

Token failures arrive on [`uc:error`](/guide/errors): an Upload API code (`AccessTokenExpiredError`, `ScopeForbiddenError`,
`OperationsLimitExceededError`, `AccessTokenInvalidError`) when Uploadcare
refuses the token, or `auth_token_failed` when your function throws. Each
arrives on the first refusal, since the editor does not retry. See
[auth token errors](/guide/errors#auth-token-errors).

## Bundlers & SSR

There are three entry points, imported independently so you only ship what you
use: `@uploadcare/ai-image-editor` (the element),
`@uploadcare/ai-image-editor/plugin` (the
[File Uploader plugin](/guide/plugin)), and
`@uploadcare/ai-image-editor/errors` (the `AiImageEditorError` class, which is
side-effect-free and safe in server code). The editor's styles live in its
shadow DOM, so there's no separate CSS import.

Under SSR (Next.js, Nuxt, and the like) remember that the editor is a browser
web component. When using the raw element from vanilla JS, Vue, Angular, or
Svelte, register it **client-side only**: a dynamic
`import('@uploadcare/ai-image-editor')` inside an effect or a client-only boundary,
never during the server render. The [React wrapper](/guide/react) handles this
internally and is SSR-safe out of the box.

## TypeScript

Event details are typed. Import `DoneDetail` and cast
`(e as CustomEvent<DoneDetail>).detail`, or augment your framework's event map.

Importing `@uploadcare/ai-image-editor/plugin` augments the uploader config with
`useAiEditor` and the editor's locale keys. If your project doesn't pick the
augmentation up automatically, reference it once:

```ts
/// <reference types="@uploadcare/ai-image-editor/plugin" />
```

See the [Components API](/api/components) for every property, event, and CSS
custom property.
