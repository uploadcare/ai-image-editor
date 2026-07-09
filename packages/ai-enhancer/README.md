<p align="center">
  <a href="https://uploadcare.com/?ref=ai-enhancer">
    <picture>
      <source media="(prefers-color-scheme: light)" srcset="https://ucarecdn.com/1b4714cd-53be-447b-bbde-e061f1e5a22f/logosafespacetransparent.svg">
      <source media="(prefers-color-scheme: dark)" srcset="https://ucarecdn.com/3b610a0a-780c-4750-a8b4-3bf4a8c90389/logotransparentinverted.svg">
      <img width=250 alt="Uploadcare logo" src="https://ucarecdn.com/1b4714cd-53be-447b-bbde-e061f1e5a22f/logosafespacetransparent.svg">
    </picture>
  </a>
</p>
<p align="center">
  <a href="https://uploadcare.com/?ref=ai-enhancer">Website</a> •
  <a href="https://uploadcare.github.io/ai-enhancer/">Docs</a> •
  <a href="https://uploadcare.com/blog?ref=ai-enhancer">Blog</a> •
  <a href="https://twitter.com/Uploadcare?ref=ai-enhancer">Twitter</a>
</p>

# Uploadcare AI Enhancer

[![NPM version][npm-img]][npm-url]
[![Build Status][badge-build]][build-url]
[![GitHub release][badge-release-img]][badge-release-url]

AI image generation and editing for [Uploadcare](https://uploadcare.com/) — a
framework-agnostic `<uc-ai-enhancer>` web component, plus an optional plugin
that adds an **AI Edit** action and a **Generate image** source to the
[Uploadcare File Uploader](https://uploadcare.com/docs/file-uploader/). Generate
images from a text prompt, edit existing ones by uuid, and commit the result
back as an already-uploaded Uploadcare file.

## Quick start

1. Install the package:

```bash
npm install @uploadcare/ai-enhancer
```

2. Use the [standalone editor][docs-getting-started] — importing the package
registers the element; configure it via [properties][docs-api] and pick a
[layout][docs-layout], [theme][docs-theming], and [locale][docs-l10n]:

```js
import '@uploadcare/ai-enhancer';
```

```html
<uc-ai-enhancer pubkey="YOUR_PUBLIC_KEY"></uc-ai-enhancer>
```

```js
const editor = document.querySelector('uc-ai-enhancer');
editor.addEventListener('uc:done', (e) => console.log(e.detail.url));
```

All `uc:*` events and their payloads are listed in the [API reference][docs-api].

> **Client-only:** importing the package registers custom elements, so it must
> run in the browser — in SSR apps load it behind a client boundary (see
> [Bundlers & SSR][docs-ssr]), or use the SSR-safe
> [React wrapper][docs-react].

Or as a [File Uploader plugin][docs-plugin], assuming a working
[File Uploader](https://uploadcare.com/docs/file-uploader/) setup
(`@uploadcare/file-uploader` **≥ 1.31.2**) — the plugin reads its settings
from the uploader config:

```bash
npm install @uploadcare/ai-enhancer @uploadcare/file-uploader
```

```js
import * as UC from '@uploadcare/file-uploader';
import { AiEnhancerPlugin } from '@uploadcare/ai-enhancer/plugin';

UC.defineComponents(UC);
document.querySelector('uc-config').plugins = [AiEnhancerPlugin];
```

Add `ai-enhancer` to the config's `source-list` to expose the **Generate
image** source; the **AI Edit** action appears on uploaded images
automatically. Full setup in the [plugin guide][docs-plugin].

You need an Uploadcare **public key** from the
[dashboard](https://app.uploadcare.com/). Using React? See
[`@uploadcare/react-ai-enhancer`][docs-react].

## Documentation

Everything else lives in the [docs][docs]:

- [Getting started][docs-getting-started] — install, entry points, first render
- [Integrating into your app][docs-integrating] — Vue, Angular, Svelte, bundlers, SSR
- [File Uploader plugin][docs-plugin] — configuration and behavior
- [UI & layout][docs-layout], [Theming][docs-theming], [Localization][docs-l10n]
- [API reference][docs-api] — properties, events, exported types

## Security issues

If you think you ran into something in Uploadcare libraries that might have
security implications, please hit us up at
[bugbounty@uploadcare.com][uc-email-bounty] or Hackerone.

We'll contact you personally in a short time to fix an issue through co-op and
prior to any public disclosure.

## Feedback

Issues and PRs are welcome. You can provide your feedback or drop us a support
request at [hello@uploadcare.com][uc-email-hello].

[docs]: https://uploadcare.github.io/ai-enhancer/
[docs-getting-started]: https://uploadcare.github.io/ai-enhancer/guide/getting-started
[docs-integrating]: https://uploadcare.github.io/ai-enhancer/guide/integrating
[docs-react]: https://uploadcare.github.io/ai-enhancer/guide/react
[docs-plugin]: https://uploadcare.github.io/ai-enhancer/guide/plugin
[docs-ssr]: https://uploadcare.github.io/ai-enhancer/guide/integrating#bundlers-ssr
[docs-layout]: https://uploadcare.github.io/ai-enhancer/guide/layout
[docs-theming]: https://uploadcare.github.io/ai-enhancer/guide/theming
[docs-l10n]: https://uploadcare.github.io/ai-enhancer/guide/localization
[docs-api]: https://uploadcare.github.io/ai-enhancer/api/
[uc-email-bounty]: mailto:bugbounty@uploadcare.com
[uc-email-hello]: mailto:hello@uploadcare.com
[npm-img]: https://img.shields.io/npm/v/@uploadcare/ai-enhancer.svg
[npm-url]: https://www.npmjs.com/package/@uploadcare/ai-enhancer
[badge-build]: https://github.com/uploadcare/ai-enhancer/actions/workflows/checks.yml/badge.svg
[build-url]: https://github.com/uploadcare/ai-enhancer/actions/workflows/checks.yml
[badge-release-img]: https://img.shields.io/github/release/uploadcare/ai-enhancer.svg
[badge-release-url]: https://github.com/uploadcare/ai-enhancer/releases
