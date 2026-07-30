---
title: API reference
---

# API reference

Two complementary references, both generated from the source:

- **[Components](/api/components)** — the web-component API for `<uc-ai-image-editor>`:
  attributes, properties, events, slots, and CSS custom properties.
- **[TypeScript API](/api/typescript/)** — every exported symbol: the editor
  element, its event/resolver types, the aspect-ratio helpers, and the
  localization helpers.

## Entry points

| Import | Exports |
|---|---|
| `@uploadcare/ai-image-editor` | `<uc-ai-image-editor>` registration, the editor types, the aspect-ratio helpers, and the localization helpers. |
| `@uploadcare/ai-image-editor/plugin` | `AiImageEditorPlugin`, `AiEditorActivityParams`, `aspectRatiosFromCropPreset`. |
| `@uploadcare/ai-image-editor/errors` | `AiImageEditorError`, `AiImageEditorErrorCode`, `AiImageEditorErrorOptions` — side-effect-free (safe in server code). |
