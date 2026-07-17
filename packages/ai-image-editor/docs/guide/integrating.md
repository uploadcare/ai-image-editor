---
title: Integrating into your app
---

# Integrating into your app

`<uc-ai-image-editor>` is a standard custom element, so it drops into any framework or
no framework at all. Two rules apply everywhere:

- **Object/function values** — `metadata`, `presets`, `sourceFileInfo`,
  `outputFilename`, `localeDefinitionOverride`, `aspectRatios` — must be set as
  **DOM properties**, not string attributes.
- **`uc:*` events** (`uc:done`, `uc:cancel`, `uc:change`, `uc:error`) are plain DOM
  `CustomEvent`s; `detail` carries the payload. `uc:error`'s detail is always
  `{ error: AiImageEditorError }` — see [Error handling](/guide/errors).

Importing the package registers the element as a side effect:

```ts
import '@uploadcare/ai-image-editor'
```

## Without a build step (CDN)

No npm, no bundler? Load the element straight from a CDN as an ES module.
[esm.run](https://esm.run) (jsDelivr's ESM CDN) bundles the dependencies (Lit)
for you, so a single import registers `<uc-ai-image-editor>`:

```html
<script type="module">
  import 'https://esm.run/@uploadcare/ai-image-editor@latest'
</script>

<uc-ai-image-editor pubkey="YOUR_PUBLIC_KEY"></uc-ai-image-editor>
```

Set object/function properties and listen for events from a module script:

```html
<script type="module">
  import 'https://esm.run/@uploadcare/ai-image-editor@latest'

  const editor = document.querySelector('uc-ai-image-editor')
  editor.aspectRatios = [[1, 1], [16, 9]]
  editor.addEventListener('uc:done', (e) => console.log(e.detail.url))
</script>
```

### Dynamic locales over the CDN

Languages other than English [load on demand](/guide/localization) via dynamic
import — and this works over a CDN with no extra setup. The locale modules are
resolved relative to the entry you imported, so the browser fetches the matching
one (`de`, `ja`, …) from the same CDN when you set the language:

```html
<uc-ai-image-editor pubkey="YOUR_PUBLIC_KEY" locale-name="de"></uc-ai-image-editor>
```

The examples above use `@latest` for convenience. In production, **pin an
exact version** (e.g. `@0.1.4`) — the lazy locale modules must come from the
same build as the entry, and an unpinned URL can otherwise resolve them to a
different version.

## React

Use the **`@uploadcare/react-ai-image-editor`** wrapper — typed props plus `onDone` /
`onCancel` / `onError` callbacks, SSR support out of the box, and direct usage
from Next.js Server Components. See the dedicated [React guide](/guide/react):

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

Works natively — attributes/properties bind directly and custom events use
`on:`:

```svelte
<uc-ai-image-editor {pubkey} on:uc:done={onDone} />
```

## Bundlers & SSR

- **Three entry points**, imported independently so you only ship what you use:
  `@uploadcare/ai-image-editor` (the element), `@uploadcare/ai-image-editor/plugin`
  (the [File Uploader plugin](/guide/plugin)), and
  `@uploadcare/ai-image-editor/errors` (the `AiImageEditorError` class — side-effect-
  free, safe in server code). The editor's styles live in its shadow DOM —
  there's no separate CSS import.
- **SSR (Next.js, Nuxt, …):** the editor is a browser web component. When using
  the raw element (vanilla, Vue, Angular, Svelte), register it **client-side
  only** — a dynamic `import('@uploadcare/ai-image-editor')` inside an effect or a
  client-only boundary — never during the server render. The
  [React wrapper](/guide/react) handles this internally and is SSR-safe out of
  the box.

## TypeScript

- **Event details** are typed: import `DoneDetail` and cast
  `(e as CustomEvent<DoneDetail>).detail`, or augment your framework's event map.
- **Uploader config types** — importing `@uploadcare/ai-image-editor/plugin` augments
  the uploader config with `useAiEditor` and the editor's locale keys. If your
  project doesn't pick the augmentation up automatically, reference it once:
  ```ts
  /// <reference types="@uploadcare/ai-image-editor/plugin" />
  ```

See the [Components API](/api/components) for every property, event, and CSS
custom property.
