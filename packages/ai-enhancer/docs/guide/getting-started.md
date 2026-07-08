---
title: Getting started
---

# Getting started

AI image generation and editing for [Uploadcare](https://uploadcare.com/) — a
framework-agnostic `<uc-ai-enhancer>` web component, plus an optional plugin that
adds an **AI Edit** action and a **Generate image** source to the
[File Uploader](https://uploadcare.com/docs/file-uploader/).

Want to see it first? Head to the [live demo](/demo).

## Install

::: code-group
```sh [npm]
npm install @uploadcare/ai-enhancer
```
```sh [pnpm]
pnpm add @uploadcare/ai-enhancer
```
```sh [yarn]
yarn add @uploadcare/ai-enhancer
```
```sh [bun]
bun add @uploadcare/ai-enhancer
```
:::

You'll also need an Uploadcare **public key** to enable generate/edit. Grab one
from the [Uploadcare dashboard](https://app.uploadcare.com/) — see
[API keys](https://uploadcare.com/docs/start/settings/#api-keys) in the docs.

Two entry points, imported independently so you only pull in what you use:

| Import | What it gives you |
|---|---|
| `@uploadcare/ai-enhancer` | Registers the `<uc-ai-enhancer>` element and exports its public types, the provider, and the localization helpers. |
| `@uploadcare/ai-enhancer/plugin` | Just the `AiEnhancerPlugin` for the File Uploader — no eager component registration. |

::: tip Plugin peer dependency
The plugin entry needs `@uploadcare/file-uploader` **≥ 1.31.2** as a peer
dependency (it relies on `uploaderApi.replaceFile`). The standalone editor has no
peer dependency.
:::

## The standalone editor

Importing the package registers the element; configure it via
attributes/properties and listen for `uc:*` events.

```ts
import '@uploadcare/ai-enhancer'
```

```html
<uc-ai-enhancer pubkey="YOUR_PUBLIC_KEY"></uc-ai-enhancer>
```

```ts
const editor = document.querySelector('uc-ai-enhancer')

editor.addEventListener('uc:done', (e) => {
  const { url, uuid, file } = e.detail // file: UploadcareFile
  // persist / display the committed result…
})
editor.addEventListener('uc:cancel', () => {/* closed without committing */})
editor.addEventListener('uc:error', (e) => console.warn(e.detail.error))
```

See the [Components API](/api/components) for the full list of attributes,
properties, events, and CSS custom properties.

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
