---
title: File Uploader plugin
---

# File Uploader plugin

Register the plugin on `<uc-config>` and add `ai-enhancer` to the source list.
The plugin reads its settings (public key, CDN config, locale, …) straight from
the uploader config — there's nothing extra to wire up.

```ts
import * as UC from '@uploadcare/file-uploader'
import { AiEnhancerPlugin } from '@uploadcare/ai-enhancer/plugin'

UC.defineComponents(UC)

const config = document.querySelector('uc-config')
config.plugins = [AiEnhancerPlugin]
```

```html
<uc-file-uploader-regular ctx-name="my-uploader"></uc-file-uploader-regular>
<uc-config
  ctx-name="my-uploader"
  pubkey="YOUR_PUBLIC_KEY"
  source-list="local, url, camera, ai-enhancer"
></uc-config>
<uc-upload-ctx-provider ctx-name="my-uploader"></uc-upload-ctx-provider>
```

The plugin contributes two affordances:

- **Generate image** — an upload source (shown because `ai-enhancer` is in
  `source-list`). Opens the editor in generate mode; the committed result is
  **added** as a new file (sourced to `ai-enhancer`).
- **AI Edit** — a file action on already-uploaded images. Opens the editor in
  edit mode on that image; the committed result **replaces the original entry in
  place** (same list position; the entry gets a new `internalId`) and keeps the
  original file's name.

## Configuration

The plugin consumes these `<uc-config>` keys (all standard uploader config — set
them as attributes or properties):

| Key | Required | Purpose |
|---|---|---|
| `pubkey` | ✅ | Uploadcare public key. Without it the editor is disabled. |
| `baseUrl` | | Upload API base URL (defaults to the SDK default). |
| `cdnCname` | | CDN cname for resolving results. |
| `cdnCnamePrefixed` | | Base domain for public-key-prefixed CDN URLs. |
| `cropPreset` | | Reused to derive the editor's offered aspect ratios. |
| `metadata` | | Key/value metadata attached to the AI result. A `MetadataCallback` is resolved against the source entry in edit mode; when generating from scratch there's no source to pass it, so the callback is skipped — use the static object form for generate-mode metadata. |
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

The **AI Edit** action hides itself for images that already carry CDN modifiers —
for example, ones edited with the
[Cloud Image Editor](https://uploadcare.com/docs/intelligence/image-editing/). AI
Edit operates on the original file and can't carry those modifiers over, so
offering it would silently drop the prior edits. The **Generate image** source is
unaffected.

## Typed config

Importing the plugin augments the uploader's config type, so `useAiEditor`
(and the editor's locale keys) are type-checked on `<uc-config>` — no casts. If
your project doesn't pick the augmentation up automatically, reference the
plugin's types once:

```ts
/// <reference types="@uploadcare/ai-enhancer/plugin" />
```
