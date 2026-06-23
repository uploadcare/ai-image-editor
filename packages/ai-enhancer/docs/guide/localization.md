---
title: Localization
---

# Localization

The editor ships English eagerly and lazy-loads 34 other locales. Set the active
language with `localeName`; the editor loads that locale's built-in strings on
demand. Customize individual strings with `localeDefinitionOverride` — **keyed by
locale name**, the same shape as the file uploader's config. As a plugin, both
follow the uploader's `localeName` / `localeDefinitionOverride` automatically.

```ts
// Standalone: pick the language and override specific strings per locale.
editor.localeName = 'de'
editor.localeDefinitionOverride = {
  en: { 'ai-enhancer-cancel': 'Dismiss' },
  de: { 'ai-enhancer-generate-btn': 'Los!' },
}
```

Supported locales: `en ar az ca cs da de el es et fi fr he hy is it ja ka kk ko
lv nb nl pl pt ro ru sk sr sv tr uk vi zh` (and `zh-TW`).

Error-code messages (`ai-enhancer-error-<code>`) are optional per locale and fall
back to the generic message. `translate(key, overrides?)` and `enLocale` are
exported for looking up strings outside the element.
