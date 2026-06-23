---
title: API reference
---

# API reference

Two complementary references, both generated from the source:

- **[Components](/api/components)** — the web-component API for `<uc-ai-editor>`:
  attributes, properties, events, slots, and CSS custom properties.
- **[TypeScript API](/api/typescript/)** — every exported symbol: the provider,
  the request/result types, the resolver types, and the localization helpers.

## Entry points

| Import | Exports |
|---|---|
| `@uploadcare/ai-enhancer` | `<uc-ai-editor>` registration, `UploadcareDerivativeApi`, all editor/provider types, and the localization helpers. |
| `@uploadcare/ai-enhancer/plugin` | `AiEnhancerPlugin`, `AiEditorActivityParams`, `aspectRatiosFromCropPreset`. |
