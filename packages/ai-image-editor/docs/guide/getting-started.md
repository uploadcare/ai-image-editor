---
title: Getting started
---

# Getting started

AI image generation and editing for [Uploadcare](https://uploadcare.com/) — a
framework-agnostic `<uc-ai-image-editor>` web component, plus an optional plugin that
adds an **AI Edit** action and a **Generate image** source to the
[File Uploader](https://uploadcare.com/docs/file-uploader/).

Want to see it first? Head to the [live demo](/demo).

## Install

::: code-group
```sh [npm]
npm install @uploadcare/ai-image-editor
```
```sh [pnpm]
pnpm add @uploadcare/ai-image-editor
```
```sh [yarn]
yarn add @uploadcare/ai-image-editor
```
```sh [bun]
bun add @uploadcare/ai-image-editor
```
:::

You'll also need an Uploadcare **public key** to enable generate/edit. Grab one
from the [Uploadcare dashboard](https://app.uploadcare.com/) — see
[API keys](https://uploadcare.com/docs/start/settings/#keys) in the docs.

::: info Public beta
AI Enhancer is in **public beta** and available on all **paid** Uploadcare
plans. On a free project, generation and edit requests fail with the
[`derivative_disabled` error](/guide/errors#derivative-disabled).
:::

Three entry points, imported independently so you only pull in what you use:

| Import | What it gives you |
|---|---|
| `@uploadcare/ai-image-editor` | Registers the `<uc-ai-image-editor>` element and exports its public types, the provider, and the localization helpers. |
| `@uploadcare/ai-image-editor/plugin` | Just the `AiImageEditorPlugin` for the File Uploader — no eager component registration. |
| `@uploadcare/ai-image-editor/errors` | Just `AiImageEditorError` and its types — side-effect-free, safe to import in server code (no element registration). |

::: tip Plugin peer dependency
The plugin entry needs `@uploadcare/file-uploader` **≥ 1.31.2** as a peer
dependency (it relies on `uploaderApi.replaceFile`). The standalone editor has no
peer dependency.
:::

## The standalone editor

Importing the package registers the element; configure it via
attributes/properties and listen for `uc:*` events.

```ts
import '@uploadcare/ai-image-editor'
```

```html
<uc-ai-image-editor pubkey="YOUR_PUBLIC_KEY"></uc-ai-image-editor>
```

```ts
const editor = document.querySelector('uc-ai-image-editor')

editor.addEventListener('uc:done', (e) => {
  const { url, uuid, file } = e.detail // file: UploadcareFile
  // persist / display the committed result…
})
editor.addEventListener('uc:cancel', () => {/* closed without committing */})
editor.addEventListener('uc:error', (e) => console.warn(e.detail.error.code, e.detail.error)) // see the error handling guide
```

See the [Components API](/api/components) for the full list of attributes,
properties, events, and CSS custom properties, and [Error handling](/guide/errors)
for what `uc:error` carries.

## Edit an existing image

Set `sourceUuid` to an Uploadcare uuid to open the editor in **edit** mode
instead of generating from scratch:

```ts
editor.sourceUuid = 'c2499162-eb07-4b93-b31e-94a89a47e858'
```

The editor resolves the image and frames the canvas to its real aspect ratio.
If you already hold the file as an `UploadcareFile` (returned by
[`@uploadcare/upload-client`](https://uploadcare.com/docs/uploads/), or the
`fileInfo` of a File Uploader output entry), pass it as `sourceFileInfo` instead
to skip the lookup — use **one or the other**, not both.
The first successful generation also flips a from-scratch session into edit mode,
so you can chain edits.

## Where to next

- [File Uploader plugin](/guide/plugin) — drop it into the uploader.
- [Theming](/guide/theming) · [Localization](/guide/localization)
- [Live demo](/demo) — try the editor and its layout options.
