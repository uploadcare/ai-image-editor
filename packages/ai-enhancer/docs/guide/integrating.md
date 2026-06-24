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
  `CustomEvent`s; `detail` carries the payload.

Importing the package registers the element as a side effect:

```ts
import '@uploadcare/ai-enhancer'
```

## React

Use the **`@uploadcare/react-ai-enhancer`** wrapper — typed props plus `onDone` /
`onCancel` / `onError` callbacks, so you don't manage refs or event listeners:

```sh
npm install @uploadcare/react-ai-enhancer
```

```tsx
import { AiEnhancer } from '@uploadcare/react-ai-enhancer'
import type { DoneDetail } from '@uploadcare/ai-enhancer'

export function Editor() {
  return (
    <AiEnhancer
      pubkey="YOUR_PUBLIC_KEY"
      onDone={(detail: DoneDetail) => console.log(detail.url)}
      onError={(error) => console.warn(error)}
    />
  )
}
```

Props mirror the element — `sourceUuid`, `sourceFileInfo`, `aspectRatios`,
`presets`, `metadata`, the [layout options](/guide/layout), and so on. `apiRef`
exposes the underlying `<uc-ai-enhancer>` for imperative access.

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
- **SSR (Next.js, Nuxt, …):** the editor is a browser web component. Register it
  **client-side only** — a dynamic `import('@uploadcare/ai-enhancer')` inside an
  effect, or behind a `'use client'` / client-only boundary — never during the
  server render.

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
