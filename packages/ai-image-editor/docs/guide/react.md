---
title: React
---

# React

**`@uploadcare/react-ai-image-editor`** wraps `<uc-ai-image-editor>` in a typed React
component — props instead of attributes, callbacks instead of event listeners,
and SSR support out of the box.

```sh
npm install @uploadcare/react-ai-image-editor
```

```tsx
import { AiImageEditor } from '@uploadcare/react-ai-image-editor'
import type { DoneDetail } from '@uploadcare/react-ai-image-editor'

export function Editor() {
  return (
    <AiImageEditor
      pubkey="YOUR_PUBLIC_KEY"
      onDone={(detail: DoneDetail) => console.log(detail.url)}
      onCancel={() => console.log('closed without committing')}
      onError={(error) => console.warn(error)}
    />
  )
}
```

Works with React **17, 18, and 19** (CI runs the test suite against 18 and 19).
Element types are re-exported, so `import type { DoneDetail }` works without
depending on the core package directly.

## Props

Props mirror the element's public API — `sourceUuid`, `sourceFileInfo`,
`aspectRatios`, `presets`, `metadata`, the [layout options](/guide/layout), and
so on; see the [components reference](/api/components) for the full list. On
top of those, a few React-specific ones:

- **`className`** — applied to the `<uc-ai-image-editor>` element.
- **`fallback`** — rendered during SSR and while the editor engine loads on the
  client (default: nothing). Size it to the editor's final dimensions to avoid
  layout shift.
- **`apiRef`** — a ref to the underlying `<uc-ai-image-editor>` element for
  imperative access:

```tsx
import { useRef } from 'react'
import type { UcAiImageEditor } from '@uploadcare/react-ai-image-editor'

const api = useRef<UcAiImageEditor>(null)
// …
<AiImageEditor pubkey="YOUR_PUBLIC_KEY" apiRef={api} />
```

`apiRef.current` is `null` until the lazily-loaded engine finishes loading and
the element is in the DOM — not just until the React component mounts (see
[Preloading](#preloading)).

## Events

The element's `uc:*` events map to callbacks, and handlers receive the event's
`detail` directly:

- **`onDone(detail: DoneDetail)`** — the user committed a result. The detail
  carries `url`, `uuid`, `prompt`, `mode`, the chosen `aspectRatio`, and the
  committed `file` (an `UploadcareFile`).
- **`onCancel()`** — the editor was closed without committing.
- **`onChange(result: DoneDetail | null)`** — the current result changed: a
  finished generation, a history selection, or a reset (`null`). Use it to
  drive your own chrome with
  [`toolbarPlacement="none"`](/guide/layout#bring-your-own-toolbar).
- **`onError(error: AiImageEditorError)`** — a generation/editor error. Always an
  `AiImageEditorError`: `code` identifies the failure (`'content_moderated'`,
  `'provider_unavailable'`, …) and `cause` holds the original thrown value.
  Also called if the editor engine itself fails to load (e.g. a chunk fails on
  a flaky connection) with `code: 'engine_load_failed'`; the `fallback` stays
  rendered in that case. See [Error handling](/guide/errors) for the code
  families and patterns.

## SSR & Next.js

The component is SSR-safe out of the box: on the server — `renderToString`,
Remix, Next.js — it renders the `fallback` prop and nothing else. The editor
engine (which registers custom elements and touches DOM globals) is only
imported in the browser, after mount, so hydration is mismatch-free by
construction.

In the Next.js App Router it can be used directly from Server Components — the
package ships the `'use client'` directive, so no `next/dynamic` and no wrapper
file are needed:

```tsx
// app/page.tsx — a Server Component
import { AiImageEditor } from '@uploadcare/react-ai-image-editor'

export default function Page() {
  return (
    <AiImageEditor
      pubkey="YOUR_PUBLIC_KEY"
      fallback={<div style={{ minHeight: 480 }}>Loading editor…</div>}
    />
  )
}
```

Function props (`onDone`, …) aren't serializable, so pass those from a Client
Component — the usual React Server Components rule, nothing specific to this
package.

## Preloading

The lazy engine load means the `fallback` is briefly visible on first mount.
To eliminate that window, warm the engine cache ahead of time — on hover, idle,
or route prefetch:

```ts
import { preloadAiImageEditor } from '@uploadcare/react-ai-image-editor'

// e.g. when the user hovers the "Edit image" button:
preloadAiImageEditor()
```

The engine is loaded once per page and shared by every `<AiImageEditor>` instance.
`preloadAiImageEditor()` is fire-and-forget (returns nothing; load errors surface
via `onError` when the component mounts), and calling it on the server is a
safe no-op.
