# @uploadcare/ai-enhancer

AI image generation and editing for [Uploadcare](https://uploadcare.com/) — a
framework-agnostic `<uc-ai-editor>` web component, plus an optional plugin that
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
| `@uploadcare/ai-enhancer` | Registers the `<uc-ai-editor>` element and exports its public types, the provider, and the localization helpers. |
| `@uploadcare/ai-enhancer/plugin` | Just the `AiEnhancerPlugin` for the File Uploader — no eager component registration. |

> The plugin entry needs `@uploadcare/file-uploader` **≥ 1.32.0-alpha.0** as a
> peer dependency (it relies on `pluginApi.files.replace`). The standalone editor
> has no peer dependency.

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
| `localeName` | | Drives the editor language (lazy-loaded; see [Localization](#localization)). |
| `localeDefinitionOverride` | | Per-locale string overrides, layered onto the editor's built-ins. |
| `secureDeliveryProxyUrlResolver` | | Signs/proxies the CDN URLs the editor renders (secure delivery). |

## Use the standalone editor

`<uc-ai-editor>` works without the uploader. Importing the package registers the
element; configure it via attributes/properties and listen for `uc:*` events.

```ts
import '@uploadcare/ai-enhancer'
```

```html
<uc-ai-editor pubkey="YOUR_PUBLIC_KEY"></uc-ai-editor>
```

```ts
const editor = document.querySelector('uc-ai-editor')

editor.addEventListener('uc:done', (e) => {
  const { uuid, cdnUrl, file } = e.detail // file: UploadcareFile
  // persist / display the committed result…
})
editor.addEventListener('uc:cancel', () => {/* closed without committing */})
editor.addEventListener('uc:error', (e) => console.warn(e.detail.error))

// Edit an existing image instead of generating from scratch:
editor.source = 'c2499162-eb07-4b93-b31e-94a89a47e858'
editor.sourceFilename = 'photo.jpg' // result keeps this name
```

### `<uc-ai-editor>` properties

| Property | Attribute | Type | Description |
|---|---|---|---|
| `pubkey` | `pubkey` | `string` | Uploadcare public key. Required to enable generate/edit. |
| `source` | `source` | `string \| null` | UUID of an image to edit. Absent → generate mode. |
| `sourceFilename` | `source-filename` | `string \| null` | Name to give the edited result (edit mode). |
| `baseUrl` | `base-url` | `string` | Upload API base URL. |
| `cdnCname` | `cdn-cname` | `string` | CDN cname for resolving results. |
| `cdnCnamePrefixed` | `cdn-cname-prefixed` | `string` | Base domain for prefixed CDN URLs. |
| `aspectRatios` | `aspect-ratios` | `AspectRatio[] \| null` | Ratios offered in generate mode, e.g. `aspect-ratios="16:9 5:4 1:1"`. Empty → popular set. |
| `presetsOnly` | `presets-only` | `boolean` | Hide the free-text prompt; preset chips only, and picking one generates immediately. |
| `presets` | — | `AiPresets` | Property only. Quick-prompt chips keyed by mode, e.g. `{ generate: [{ label, prompt }], edit: [...] }`. Clicking a chip fills the prompt. Modes left out use the built-in set; an empty array (`{ generate: [] }`) hides that mode's chips. Keyed by mode, so future modes extend it without breaking existing configs. |
| `composerPlacement` | `composer-placement` | `ComposerPlacement` | Which edge the composer sits on: `bottom` (default) or `top`. |
| `canvasFit` | `canvas-fit` | `CanvasFit` | How the canvas sizes relative to the composer: `available` (default) shrinks the canvas to the space left by the composer (docked outside the image; history chips still overlay it); `full` lets the canvas fill the area with the composer floating over it. |
| `historyPlacement` | `history-placement` | `HistoryPlacement` | Where the history strip sits: `composer-above` (default) / `composer-below` (relative to the composer) or `canvas-top` / `canvas-bottom` (pinned to the canvas edge). |
| `composerAutoHide` | `composer-auto-hide` | `boolean` | Once an image exists, dock the composer down to a small peek; it raises when the pointer nears its edge or it gains focus. Always floats the composer, so it implies `canvas-fit="full"`. Off by default. |
| `toolbarPlacement` | `toolbar-placement` | `ToolbarPlacement` | Where the Cancel / Done toolbar sits: `bottom` (default) or `top`. |
| `localeName` | `locale-name` | `string` | Active locale (default `en`); the editor lazy-loads that locale's built-in strings. |
| `localeDefinitionOverride` | — | `Record<string, Partial<AiEnhancerLocale>>` | Per-locale string overrides, keyed by locale name (see [Localization](#localization)). |
| `secureDeliveryProxyUrlResolver` | — | `SecureDeliveryProxyUrlResolver` | Property only. Signs/proxies rendered CDN URLs. |

### `<uc-ai-editor>` events

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
there's a current image — an input `source` or a generation result — and
`generate` otherwise. So the first successful generation flips the editor into
edit mode for free, and a "Start over" affordance appears (only for generate
sessions — editing an existing `source` has nothing to start over to).

## Theming

The editor is styled entirely through CSS custom properties on the element. When
used as a plugin, most tokens inherit from the uploader's `--uc-*` theme
automatically. Set any of these to customize:

```css
uc-ai-editor {
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
message. `translate(key, overrides?)` and `enLocale` are exported for looking up
strings outside the element.

## API reference

Everything below is exported from `@uploadcare/ai-enhancer` (the plugin and its
types come from `@uploadcare/ai-enhancer/plugin`).

### Plugin — `@uploadcare/ai-enhancer/plugin`

- **`AiEnhancerPlugin`** — `UploaderPlugin`. Add to `config.plugins`.
- **`AiEditorActivityParams`** — `{ sourceInternalId?: string }`. Activity params;
  presence of `sourceInternalId` means edit mode (the source uuid + name are read
  from that entry, and `uc:done` replaces it in place).
- **`aspectRatiosFromCropPreset(cropPreset: string): AspectRatio[] | null`** —
  translate the uploader's `cropPreset` into the editor's offered ratios.

### Editor

- **`UcAiEditor`** (`<uc-ai-editor>`) — the editor element (see properties /
  events above).
- Types: **`DoneDetail`**, **`ComposerPlacement`**, **`CanvasFit`**, **`HistoryPlacement`**,
  **`ToolbarPlacement`**, **`AspectRatio`**, **`AiPreset`** (`{ label, prompt }`),
  **`AiPresets`** (`Partial<Record<AiEditorMode, AiPreset[]>>`),
  **`AiEditorMode`** (`'generate' | 'edit'`).

### Provider

For generating programmatically, or supplying your own backend.

- **`UploadcareDerivativeApi`** — the built-in `AiProvider` backed by Uploadcare's
  `derivative/*` API; dispatches on `request.mode` (`generate` | `edit`), polls
  the async job to completion, and resolves the result to a CDN URL.
- **`UploadcareDerivativeApiOptions`** — `{ publicKey (required), baseUrl?,
  filename?, store?, cdnBaseUrl?, cdnCnamePrefixed?, pollIntervalMs?, pollTimeoutMs? }`.
- **`AiProvider`**, **`AiProviderRequest`**, **`AiProviderResult`** — the provider
  contract, so you can plug in a custom backend.

```ts
import { UploadcareDerivativeApi } from '@uploadcare/ai-enhancer'

const provider = new UploadcareDerivativeApi({ publicKey: 'YOUR_PUBLIC_KEY' })
const result = await provider.generate({ prompt: 'a tiger', mode: 'generate' })
// { url, uuid, prompt, mode, file }
```

### Localization & secure delivery

- **`translate(key, overrides?)`**, **`enLocale`**, **`AiEnhancerLocale`** — look
  up / type editor strings.
- **`SecureDeliveryProxyUrlResolver`**, **`resolveSecureDeliveryUrl`**,
  **`SecureDeliveryUrlParts`** — sign / proxy the CDN URLs the editor renders.

## Useful links

- [Uploadcare File Uploader](https://uploadcare.com/docs/file-uploader/)
- [Uploadcare CDN & transformations](https://uploadcare.com/docs/transformations/image/)
- [Secure delivery](https://uploadcare.com/docs/security/secure-delivery/)

## License

MIT
