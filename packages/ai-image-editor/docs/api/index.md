---
title: API reference
---

# API reference

Two complementary references, both generated from the source:

- **[Components](/api/components)** covers the web-component API for
  `<uc-ai-image-editor>`: attributes, properties, events, slots, and CSS custom
  properties.
- **[TypeScript API](/api/typescript/)** covers every exported symbol: the
  editor element, its event and resolver types, the aspect-ratio helpers, and
  the localization helpers.

The guides, and a section per configuration option, are in the
[Uploadcare docs](https://uploadcare.com/docs/ai-image-editor/):

- [Quickstart](https://uploadcare.com/docs/ai-image-editor/quickstart/) · [Options](https://uploadcare.com/docs/ai-image-editor/options/)
- [Integrating into your app](https://uploadcare.com/docs/ai-image-editor/integrating/) · [React](https://uploadcare.com/docs/ai-image-editor/react/) ·
  [File Uploader plugin](https://uploadcare.com/docs/file-uploader/ai-image-editor/)
- [UI & layout](https://uploadcare.com/docs/ai-image-editor/layout/) · [Theming](https://uploadcare.com/docs/ai-image-editor/theming/) ·
  [Localization](https://uploadcare.com/docs/ai-image-editor/localization/) · [Error handling](https://uploadcare.com/docs/ai-image-editor/errors/)

## Entry points

| Import | Exports |
|---|---|
| `@uploadcare/ai-image-editor` | `<uc-ai-image-editor>` registration, the editor types, the aspect-ratio helpers, and the localization helpers. |
| `@uploadcare/ai-image-editor/plugin` | `AiImageEditorPlugin`, `AiEditorActivityParams`, `aspectRatiosFromCropPreset`. |
| `@uploadcare/ai-image-editor/errors` | `AiImageEditorError`, `AiImageEditorErrorCode`, `AiImageEditorErrorOptions`. Side-effect-free, so it's safe in server code. |
