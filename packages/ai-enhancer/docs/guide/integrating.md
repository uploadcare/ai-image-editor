---
title: Integrating into your app
---

# Integrating into your app

`<uc-ai-enhancer>` is a standard custom element, so it drops into any framework or
no framework at all. Two rules apply everywhere:

- **Object/function values** — `metadata`, `presets`, `sourceFileInfo`,
  `outputFilename`, `localeDefinitionOverride`, `aspectRatios` — must be set as
  **DOM properties**, not string attributes.
- **`uc:*` events** (`uc:done`, `uc:cancel`, `uc:error`) are plain DOM
  `CustomEvent`s; `detail` carries the payload. `uc:error`'s detail is always
  `{ error: AiEnhancerError }` — check `error.code` and find the original
  thrown value on `error.cause`.

Importing the package registers the element as a side effect:

```ts
import '@uploadcare/ai-enhancer'
```

## Without a build step (CDN)

No npm, no bundler? Load the element straight from a CDN as an ES module.
[esm.run](https://esm.run) (jsDelivr's ESM CDN) bundles the dependencies (Lit)
for you, so a single import registers `<uc-ai-enhancer>`:

```html
<script type="module">
  import 'https://esm.run/@uploadcare/ai-enhancer@0.1.0'
</script>

<uc-ai-enhancer pubkey="YOUR_PUBLIC_KEY"></uc-ai-enhancer>
```

Set object/function properties and listen for events from a module script:

```html
<script type="module">
  import 'https://esm.run/@uploadcare/ai-enhancer@0.1.0'

  const editor = document.querySelector('uc-ai-enhancer')
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
<uc-ai-enhancer pubkey="YOUR_PUBLIC_KEY" locale-name="de"></uc-ai-enhancer>
```

**Pin a version** (e.g. `@0.1.0`) in production. The lazy locale modules must come
from the same build as the entry; an unpinned URL can otherwise resolve them to a
different version.

## React

Use the **`@uploadcare/react-ai-enhancer`** wrapper — typed props plus `onDone` /
`onCancel` / `onError` callbacks, SSR support out of the box, and direct usage
from Next.js Server Components. See the dedicated [React guide](/guide/react):

```tsx
import { AiEnhancer } from '@uploadcare/react-ai-enhancer'

<AiEnhancer pubkey="YOUR_PUBLIC_KEY" onDone={({ url }) => console.log(url)} />
```

## Vue 3

Tell the compiler that `uc-` tags are custom elements, then bind properties with
the `.prop` modifier and events with `@`:

```ts
// vite.config.ts
export default defineConfig({
  plugins: [vue({ template: { compilerOptions: { isCustomElement: (t) => t.startsWith('uc-') } } })],
})
```

```vue
<uc-ai-enhancer :pubkey="key" .metadata="meta" @uc:done="onDone" />
```

## Angular

Add `CUSTOM_ELEMENTS_SCHEMA` to the module/component, then bind properties with
`[prop]` and events with `(uc:done)`:

```html
<uc-ai-enhancer [pubkey]="key" (uc:done)="onDone($event)"></uc-ai-enhancer>
```

## Svelte

Works natively — attributes/properties bind directly and custom events use
`on:`:

```svelte
<uc-ai-enhancer {pubkey} on:uc:done={onDone} />
```

## Bundlers & SSR

- **Two entry points**, imported independently so you only ship what you use:
  `@uploadcare/ai-enhancer` (the element) and `@uploadcare/ai-enhancer/plugin`
  (the [File Uploader plugin](/guide/plugin)). The editor's styles live in its
  shadow DOM — there's no separate CSS import.
- **SSR (Next.js, Nuxt, …):** the editor is a browser web component. When using
  the raw element (vanilla, Vue, Angular, Svelte), register it **client-side
  only** — a dynamic `import('@uploadcare/ai-enhancer')` inside an effect or a
  client-only boundary — never during the server render. The
  [React wrapper](/guide/react) handles this internally and is SSR-safe out of
  the box.

## TypeScript

- **Event details** are typed: import `DoneDetail` and cast
  `(e as CustomEvent<DoneDetail>).detail`, or augment your framework's event map.
- **Uploader config types** — importing `@uploadcare/ai-enhancer/plugin` augments
  the uploader config with `useAiEditor` and the editor's locale keys. If your
  project doesn't pick the augmentation up automatically, reference it once:
  ```ts
  /// <reference types="@uploadcare/ai-enhancer/plugin" />
  ```

See the [Components API](/api/components) for every property, event, and CSS
custom property.
