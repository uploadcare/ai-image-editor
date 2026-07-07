# @uploadcare/ai-enhancer

AI image generation and editing for [Uploadcare](https://uploadcare.com/) — a
framework-agnostic `<uc-ai-enhancer>` web component, plus an optional plugin that
adds an **AI Edit** action and a **Generate image** source to the
[Uploadcare File Uploader](https://uploadcare.com/docs/file-uploader/). Generate
images from a text prompt, edit existing ones by uuid, pick aspect ratios, and
commit the result back as an already-uploaded Uploadcare file.

```sh
npm install @uploadcare/ai-enhancer
# or
pnpm add @uploadcare/ai-enhancer
yarn add @uploadcare/ai-enhancer
```

Two entry points, imported independently so you only pull in what you use:

| Import | What it gives you |
|---|---|
| `@uploadcare/ai-enhancer` | Registers the `<uc-ai-enhancer>` element and exports its public types, the provider, and the localization helpers. |
| `@uploadcare/ai-enhancer/plugin` | Just the `AiEnhancerPlugin` for the File Uploader — no eager component registration. |

> The plugin entry needs `@uploadcare/file-uploader` **≥ 1.31.2** as a
> peer dependency (it relies on `uploaderApi.replaceFile`). The standalone editor
> has no peer dependency.

You need an Uploadcare **public key** (from the
[dashboard](https://app.uploadcare.com/)) to generate or edit images.

## Use as a File Uploader plugin

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

### Configuration

The plugin consumes these `<uc-config>` keys (all standard uploader config — set
them as attributes or properties):

| Key | Required | Purpose |
|---|---|---|
| `pubkey` | ✅ | Uploadcare public key. Without it the editor is disabled. |
| `baseUrl` | | Upload API base URL (defaults to the SDK default). |
| `cdnCname` | | CDN cname for resolving results. |
| `cdnCnamePrefixed` | | Base domain for public-key-prefixed CDN URLs. |
| `cropPreset` | | Reused to derive the editor's offered aspect ratios. |
| `metadata` | | Key/value metadata attached to the AI result, like a regular upload. A `MetadataCallback` is resolved against the source entry in edit mode; in generate mode (no input file) only the static object form applies. |
| `localeName` | | Drives the editor language (lazy-loaded; see [Localization](#localization)). |
| `localeDefinitionOverride` | | Per-locale string overrides, layered onto the editor's built-ins. |
| `secureDeliveryProxyUrlResolver` | | Signs/proxies the CDN URLs the editor renders (secure delivery). |
| `useAiEditor` | | Plugin option (mirrors `useCloudImageEditor`). Show the **AI Edit** file action (default `true`). Set `false` / `use-ai-editor="false"` to hide it. |

Importing the plugin augments the uploader's config types, so `useAiEditor`
is type-checked on `<uc-config>` (reference `@uploadcare/ai-enhancer/plugin`
types if your project doesn't pick it up automatically).

> **Already-edited images:** the AI Edit action hides itself for images that
> already carry CDN modifiers (e.g. edited with the Cloud Image Editor) — AI Edit
> works on the original file and can't carry those modifiers over.

## Use the standalone editor

`<uc-ai-enhancer>` works without the uploader. Importing the package registers the
element; configure it via attributes/properties and listen for `uc:*` events.

```ts
import '@uploadcare/ai-enhancer'
```

```html
<uc-ai-enhancer pubkey="YOUR_PUBLIC_KEY"></uc-ai-enhancer>
```

```ts
const editor = document.querySelector('uc-ai-enhancer')

editor.addEventListener('uc:done', (e) => {
  const { uuid, cdnUrl, file } = e.detail // file: UploadcareFile
  // persist / display the committed result…
})
editor.addEventListener('uc:cancel', () => {/* closed without committing */})
editor.addEventListener('uc:error', (e) => console.warn(e.detail.error))

// Edit an existing image instead of generating from scratch:
editor.sourceUuid = 'c2499162-eb07-4b93-b31e-94a89a47e858'
```

**No bundler?** Load it from a CDN — [esm.run](https://esm.run) bundles the
dependencies, and lazy-loaded locales resolve from the same CDN automatically
(pin a version in production):

```html
<script type="module">
  import 'https://esm.run/@uploadcare/ai-enhancer@0.1.0'
</script>
<uc-ai-enhancer pubkey="YOUR_PUBLIC_KEY" locale-name="de"></uc-ai-enhancer>
```

### `<uc-ai-enhancer>` properties

| Property | Attribute | Type | Description |
|---|---|---|---|
| `pubkey` | `pubkey` | `string` | Uploadcare public key. Required to enable generate/edit. |
| `sourceUuid` | `source-uuid` | `string \| null` | UUID of an image to edit. Absent → generate mode. Use either this or `sourceFileInfo`, not both. |
| `sourceFileInfo` | — | `UploadcareFile` | Property only. The source image as an `UploadcareFile` (e.g. the object returned by `@uploadcare/upload-client`, or the `fileInfo` of a File Uploader output entry). An alternative to `sourceUuid` that hands the editor the file directly instead of having it look it up from the uuid. |
| `outputFilename` | — | `string \| (originalFilename, counter) => string` | Property only. Names the result. A string is used verbatim; a function receives the source's original filename (`undefined` when generating from scratch) and the 1-based history counter (first is `1`). Unset → keep the source's original name. |
| `baseUrl` | `base-url` | `string` | Upload API base URL. |
| `cdnCname` | `cdn-cname` | `string` | CDN cname for resolving results. |
| `cdnCnamePrefixed` | `cdn-cname-prefixed` | `string` | Base domain for prefixed CDN URLs. |
| `aspectRatios` | `aspect-ratios` | `AspectRatio[] \| null` | Ratios offered in generate mode, e.g. `aspect-ratios="16:9 5:4 1:1"`. Empty → popular set. |
| `presetsOnly` | `presets-only` | `boolean` | Hide the free-text prompt; preset chips only, and picking one generates immediately. |
| `presets` | — | `AiPresets` | Property only. Quick-prompt chips keyed by mode, e.g. `{ generate: [{ label, prompt }], edit: [...] }`. Clicking a chip fills the prompt. Modes left out use the built-in set; an empty array (`{ generate: [] }`) hides that mode's chips. Keyed by mode, so future modes extend it without breaking existing configs. |
| `metadata` | — | `Metadata \| MetadataCallback \| null` | Property only. Same shape as the file uploader's `metadata` config: a static key/value bag (`Record<string, string>`, e.g. `{ source: 'ai-enhancer' }`) or a `MetadataCallback` the editor calls at generation time with the source file (optionally async). The callback only runs when there's a source to pass it (editing an existing image); when generating from scratch it's skipped, so use the static object form there. |
| `composerPlacement` | `composer-placement` | `ComposerPlacement` | Which edge the composer sits on: `bottom` (default) or `top`. |
| `canvasFit` | `canvas-fit` | `CanvasFit` | How the canvas sizes relative to the composer: `available` (default) shrinks the canvas to the space left by the composer (docked outside the image; history chips still overlay it); `full` lets the canvas fill the area with the composer floating over it. |
| `historyPlacement` | `history-placement` | `HistoryPlacement` | Where the history strip sits: `composer-above` (default) / `composer-below` (relative to the composer) or `canvas-top` / `canvas-bottom` (pinned to the canvas edge). |
| `composerAutoHide` | `composer-auto-hide` | `boolean` | Once an image exists, dock the composer down to a small peek; it raises when the pointer nears its edge or it gains focus. Always floats the composer, so it implies `canvas-fit="full"`. Off by default. |
| `toolbarPlacement` | `toolbar-placement` | `ToolbarPlacement` | Where the Cancel / Done toolbar sits: `bottom` (default) or `top`. |
| `localeName` | `locale-name` | `string` | Active locale (default `en`); the editor lazy-loads that locale's built-in strings. |
| `localeDefinitionOverride` | — | `Record<string, Partial<AiEnhancerLocale>>` | Per-locale string overrides, keyed by locale name (see [Localization](#localization)). |
| `secureDeliveryProxyUrlResolver` | — | `SecureDeliveryProxyUrlResolver` | Property only. Signs/proxies rendered CDN URLs. |

### `<uc-ai-enhancer>` events

All events bubble and are `composed`.

| Event | `detail` | Fired when |
|---|---|---|
| `uc:done` | `DoneDetail` | The user commits a result. |
| `uc:cancel` | — | The user closes without committing. |
| `uc:error` | `{ error: unknown }` | A generation/edit fails. |

```ts
type DoneDetail = {
  url: string
  uuid: string // same as file.uuid
  prompt: string
  mode: 'generate' | 'edit'
  aspectRatio?: AspectRatio
  file: UploadcareFile // the committed result
}
```

### Edit vs. generate mode

Mode is **derived**, not set explicitly: the editor is in `edit` mode whenever
there's a current image — an input source (`sourceUuid` / `sourceFileInfo`) or a
generation result — and `generate` otherwise. So the first successful generation
flips the editor into edit mode for free, and a "Start over" affordance appears
(only for generate sessions — editing an existing source has nothing to start
over to).

## Framework usage

`<uc-ai-enhancer>` is a standard custom element, so it works in any framework. Two
things to wire up: object/function values (`metadata`, `presets`,
`sourceFileInfo`, `outputFilename`, …) must be set as **DOM properties**, not
string attributes, and `uc:*` events are plain DOM events.

For **React**, install the [`@uploadcare/react-ai-enhancer`](../react-ai-enhancer)
wrapper — typed props + `onDone` / `onCancel` / `onError` callbacks:

```bash
npm install @uploadcare/react-ai-enhancer
```

```tsx
import { AiEnhancer } from '@uploadcare/react-ai-enhancer'

<AiEnhancer pubkey="YOUR_PUBLIC_KEY" onDone={(d) => console.log(d.url)} />
```

```vue
<!-- Vue 3: mark `uc-` tags as custom elements (vite.config / compilerOptions),
     then bind properties with `.prop` and events with `@`. -->
<uc-ai-enhancer :pubkey="key" .metadata="meta" @uc:done="onDone" />
```

- **Angular** — add `CUSTOM_ELEMENTS_SCHEMA`; bind `[prop]` and `(uc:done)`.
- **Svelte** — works natively: attributes/properties and `on:uc:done`.

## Bundlers & SSR

The two entry points are imported independently, so you only ship what you use,
and the editor's styles live in its shadow DOM — there's no separate CSS import.

**SSR (Next.js, Nuxt, …):** the editor is a browser web component — register it
**client-side only** (e.g. a dynamic `import('@uploadcare/ai-enhancer')` inside an
effect, or a `'use client'` component), never during server render.

## TypeScript

- Event details are typed — cast `e.detail` to `DoneDetail` (exported), or augment
  your framework's event map.
- Importing `@uploadcare/ai-enhancer/plugin` augments the uploader's config types
  (`useAiEditor`, the editor's locale keys). If your project doesn't pick that up
  automatically, reference it once: `/// <reference types="@uploadcare/ai-enhancer/plugin" />`.

## Theming

The editor is styled entirely through CSS custom properties on the element. When
used as a plugin, most tokens inherit from the uploader's `--uc-*` theme
automatically. Set any of these to customize:

```css
uc-ai-enhancer {
  --uc-ai-primary: #6d28d9;
  --uc-ai-radius: 20px;
  --uc-ai-dot-grid-color: #2a2a2a;
}
```

| Token group | Tokens |
|---|---|
| Color | `--uc-ai-foreground`, `--uc-ai-background`, `--uc-ai-floating`, `--uc-ai-floating-border`, `--uc-ai-muted`, `--uc-ai-muted-foreground`, `--uc-ai-primary`, `--uc-ai-primary-hover`, `--uc-ai-primary-foreground`, `--uc-ai-primary-transparent`, `--uc-ai-secondary`, `--uc-ai-secondary-hover`, `--uc-ai-secondary-foreground`, `--uc-ai-border`, `--uc-ai-destructive`, `--uc-ai-destructive-foreground` |
| Shape | `--uc-ai-radius`, `--uc-ai-radius-button`, `--uc-ai-radius-card`, `--uc-ai-radius-frame`, `--uc-ai-radius-input` |
| Layout & type | `--uc-ai-padding`, `--uc-ai-button-size`, `--uc-ai-font-family`, `--uc-ai-font-size` |
| Canvas / motion | `--uc-ai-dot-grid-color`, `--uc-ai-shadow-color`, `--uc-ai-dialog-shadow`, `--uc-ai-transition`, `--uc-ai-ease-in-out`, `--uc-ai-ease-out` |
| Prompt | `--uc-ai-prompt-max-height`, `--uc-ai-prompt-max-lines` |

## Localization

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
lv nb nl pl pt ro ru sk sr sv tr uk vi zh` (and `zh-TW`). Error-code messages
(`ai-enhancer-error-<code>`) are optional per locale and fall back to the generic
message. `enLocale` is exported for looking up strings outside the element.

## API reference

Everything below is exported from `@uploadcare/ai-enhancer` (the plugin and its
types come from `@uploadcare/ai-enhancer/plugin`).

### Plugin — `@uploadcare/ai-enhancer/plugin`

- **`AiEnhancerPlugin`** — `UploaderPlugin`. Add to `config.plugins`.
- **`AiEditorActivityParams`** — `{ sourceInternalId?: string }`. Activity params;
  presence of `sourceInternalId` means edit mode (the source uuid + file info are
  read from that entry, and `uc:done` replaces it in place).
- **`aspectRatiosFromCropPreset(cropPreset: string): AspectRatio[] | null`** —
  translate the uploader's `cropPreset` into the editor's offered ratios.

### Editor

- **`UcAiEnhancer`** (`<uc-ai-enhancer>`) — the editor element (see properties /
  events above).
- Types: **`DoneDetail`**, **`OutputFilenameResolver`** (`(originalFilename, counter) => string`),
  **`MetadataCallback`** (`(fileInfo: UploadcareFile) => Metadata | Promise<Metadata>`),
  **`ComposerPlacement`**, **`CanvasFit`**, **`HistoryPlacement`**,
  **`ToolbarPlacement`**, **`AspectRatio`**, **`AiPreset`** (`{ label, prompt }`),
  **`AiPresets`** (`Partial<Record<AiEditorMode, AiPreset[]>>`),
  **`AiEditorMode`** (`'generate' | 'edit'`).

### Localization & secure delivery

- **`enLocale`**, **`AiEnhancerLocale`** — look up / type editor strings.
- **`SecureDeliveryProxyUrlResolver`**, **`SecureDeliveryUrlParts`** — sign /
  proxy the CDN URLs the editor renders.

## Useful links

- [Uploadcare File Uploader](https://uploadcare.com/docs/file-uploader/)
- [Uploadcare CDN & transformations](https://uploadcare.com/docs/transformations/image/)
- [Secure delivery](https://uploadcare.com/docs/security/secure-delivery/)

## License

MIT
