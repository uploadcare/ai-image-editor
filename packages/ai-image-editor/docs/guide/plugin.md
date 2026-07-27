---
title: File Uploader plugin
---

# File Uploader plugin

Register the plugin on `<uc-config>` and add `ai-image-editor` to the source list.
The plugin reads its settings (public key, CDN config, locale, and so on)
straight from the uploader config, so there's nothing extra to wire up.

::: info Public beta
AI Image Editor is in **public beta** and available on all **paid** Uploadcare
plans. On a free project its requests fail with the
[`derivative_disabled` error](/guide/errors#derivative-disabled).
:::

```ts
import * as UC from '@uploadcare/file-uploader'
import { AiImageEditorPlugin } from '@uploadcare/ai-image-editor/plugin'

UC.defineComponents(UC)

const config = document.querySelector('uc-config')
config.plugins = [AiImageEditorPlugin]
```

```html
<uc-config
  ctx-name="my-uploader"
  pubkey="YOUR_PUBLIC_KEY"
  source-list="local, url, camera, ai-image-editor"
></uc-config>
<uc-file-uploader-regular ctx-name="my-uploader"></uc-file-uploader-regular>
<uc-upload-ctx-provider ctx-name="my-uploader"></uc-upload-ctx-provider>
```

The plugin adds two things:

- **Generate image** is an upload source, shown because `ai-image-editor` is in
  `source-list`. It opens the editor in generate mode, and the committed result
  is **added** as a new file (sourced to `ai-image-editor`).
- **AI Edit** is a file action on already-uploaded images. It opens the editor in
  edit mode on that image, and the committed result **replaces the original
  entry in place** (same list position; the entry gets a new `internalId`) and
  keeps the original file's name.

## Configuration

The plugin consumes these `<uc-config>` keys (all standard uploader config, set
as attributes or properties). Keys are listed in their camelCase property
form; as HTML attributes they're kebab-case (`base-url`, `cdn-cname`,
`locale-name`, …):

| Key | Required | Purpose |
|---|---|---|
| `pubkey` | ✅ | Uploadcare public key. Without it the editor is disabled. |
| `baseUrl` | | Upload API base URL (defaults to the SDK default). |
| `cdnCname` | | CDN cname for resolving results. |
| `cdnCnamePrefixed` | | Base domain for public-key-prefixed CDN URLs. |
| `cropPreset` | | Reused to derive the editor's offered aspect ratios. |
| `metadata` | | Key/value metadata attached to the AI result. A `MetadataCallback` is resolved against the source entry in edit mode; when generating from scratch there's no source to pass it, so the callback is skipped; use the static object form for generate-mode metadata. |
| `localeName` | | Drives the editor language (lazy-loaded; see [Localization](/guide/localization)). |
| `localeDefinitionOverride` | | Per-locale string overrides, layered onto the editor's built-ins. |
| `secureDeliveryProxyUrlResolver` | | Signs/proxies the CDN URLs the editor renders ([secure delivery](https://uploadcare.com/docs/security/secure-delivery/)). |

The plugin also adds one config option of its own:

| Key | Default | Purpose |
|---|---|---|
| `useAiEditor` | `true` | Show the **AI Edit** file action on uploaded images. Set `false` (attribute `use-ai-editor="false"`) to hide it. Mirrors `useCloudImageEditor`. |

`aspectRatiosFromCropPreset(cropPreset)` is exported from the plugin entry if you
want to derive the same ratios yourself.

## Already-edited images

The **AI Edit** action hides itself for images that already carry CDN modifiers,
for example ones edited with the
[Cloud Image Editor](https://uploadcare.com/docs/intelligence/image-editing/). AI
Edit operates on the original file and can't carry those modifiers over, so
offering it would silently drop the prior edits. The **Generate image** source is
unaffected.

## Typed config

Importing the plugin augments the uploader's config type, so `useAiEditor`
(and the editor's locale keys) are type-checked on `<uc-config>`, with no casts
needed. If your project doesn't pick the augmentation up automatically,
reference the plugin's types once:

```ts
/// <reference types="@uploadcare/ai-image-editor/plugin" />
```
