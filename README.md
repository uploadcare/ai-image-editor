<p align="center">
  <a href="https://uploadcare.com/?ref=ai-image-editor">
    <picture>
      <source media="(prefers-color-scheme: light)" srcset="https://ucarecdn.com/1b4714cd-53be-447b-bbde-e061f1e5a22f/logosafespacetransparent.svg">
      <source media="(prefers-color-scheme: dark)" srcset="https://ucarecdn.com/3b610a0a-780c-4750-a8b4-3bf4a8c90389/logotransparentinverted.svg">
      <img width=250 alt="Uploadcare logo" src="https://ucarecdn.com/1b4714cd-53be-447b-bbde-e061f1e5a22f/logosafespacetransparent.svg">
    </picture>
  </a>
</p>
<p align="center">
  <a href="https://uploadcare.com/?ref=ai-image-editor">Website</a> •
  <a href="https://uploadcare.github.io/ai-image-editor/">Docs</a> •
  <a href="https://uploadcare.com/blog?ref=ai-image-editor">Blog</a> •
  <a href="https://twitter.com/Uploadcare?ref=ai-image-editor">Twitter</a>
</p>

# Uploadcare AI Image Editor

[![Build Status][badge-build]][build-url]
[![GitHub release][badge-release-img]][badge-release-url]

AI image generation and editing for Uploadcare: a framework-agnostic web
component (with a File Uploader plugin sub-export) and a React wrapper. Full
documentation: **[uploadcare.github.io/ai-image-editor][docs]**.

## Packages

| Package | | Description |
|---|---|---|
| [`@uploadcare/ai-image-editor`](packages/ai-image-editor) | [![npm][npm-core-img]][npm-core-url] | The [`<uc-ai-image-editor>`][docs-getting-started] web component + [`/plugin`][docs-plugin] sub-export for the [File Uploader](https://uploadcare.com/docs/file-uploader/). |
| [`@uploadcare/react-ai-image-editor`](packages/react-ai-image-editor) | [![npm][npm-react-img]][npm-react-url] | [React wrapper][docs-react] — typed props, callbacks, [SSR & Next.js][docs-react-ssr] support. |

## Security issues

If you think you ran into something in Uploadcare libraries that might have
security implications, please hit us up at
[bugbounty@uploadcare.com][uc-email-bounty] or Hackerone.

We'll contact you personally in a short time to fix an issue through co-op and
prior to any public disclosure.

## Feedback

Issues and PRs are welcome. You can provide your feedback or drop us a support
request at [hello@uploadcare.com][uc-email-hello].

## License

MIT

[docs]: https://uploadcare.github.io/ai-image-editor/
[docs-getting-started]: https://uploadcare.github.io/ai-image-editor/guide/getting-started
[docs-plugin]: https://uploadcare.github.io/ai-image-editor/guide/plugin
[docs-react]: https://uploadcare.github.io/ai-image-editor/guide/react
[docs-react-ssr]: https://uploadcare.github.io/ai-image-editor/guide/react#ssr-next-js
[uc-email-bounty]: mailto:bugbounty@uploadcare.com
[uc-email-hello]: mailto:hello@uploadcare.com
[npm-core-img]: https://img.shields.io/npm/v/@uploadcare/ai-image-editor.svg
[npm-core-url]: https://www.npmjs.com/package/@uploadcare/ai-image-editor
[npm-react-img]: https://img.shields.io/npm/v/@uploadcare/react-ai-image-editor.svg
[npm-react-url]: https://www.npmjs.com/package/@uploadcare/react-ai-image-editor
[badge-build]: https://github.com/uploadcare/ai-image-editor/actions/workflows/checks.yml/badge.svg
[build-url]: https://github.com/uploadcare/ai-image-editor/actions/workflows/checks.yml
[badge-release-img]: https://img.shields.io/github/release/uploadcare/ai-image-editor.svg
[badge-release-url]: https://github.com/uploadcare/ai-image-editor/releases
