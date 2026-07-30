<p align="center">
  <a href="https://uploadcare.com/?ref=react-ai-image-editor">
    <picture>
      <source media="(prefers-color-scheme: light)" srcset="https://ucarecdn.com/1b4714cd-53be-447b-bbde-e061f1e5a22f/logosafespacetransparent.svg">
      <source media="(prefers-color-scheme: dark)" srcset="https://ucarecdn.com/3b610a0a-780c-4750-a8b4-3bf4a8c90389/logotransparentinverted.svg">
      <img width=250 alt="Uploadcare logo" src="https://ucarecdn.com/1b4714cd-53be-447b-bbde-e061f1e5a22f/logosafespacetransparent.svg">
    </picture>
  </a>
</p>
<p align="center">
  <a href="https://uploadcare.com/?ref=react-ai-image-editor">Website</a> •
  <a href="https://uploadcare.github.io/ai-image-editor/">Docs</a> •
  <a href="https://uploadcare.com/blog?ref=react-ai-image-editor">Blog</a> •
  <a href="https://twitter.com/Uploadcare?ref=react-ai-image-editor">Twitter</a>
</p>

# Uploadcare React AI Image Editor

[![NPM version][npm-img]][npm-url]
[![Build Status][badge-build]][build-url]
[![GitHub release][badge-release-img]][badge-release-url]

React wrapper for the [Uploadcare AI Image Editor][docs] — an AI image editor:
generate images from a prompt or edit existing ones, with the result stored
on Uploadcare. Typed [props][docs-react-props], callback [events][docs-react-events],
and [SSR support][docs-react-ssr] out of the box.

## Quick start

1. Install the package:

```bash
npm install @uploadcare/react-ai-image-editor
```

2. Render the component:

```jsx
import { AiImageEditor } from '@uploadcare/react-ai-image-editor';

<AiImageEditor
  pubkey="YOUR_PUBLIC_KEY"
  onDone={({ url }) => console.log(url)}
/>;
```

Works with React 17, 18, and 19. [Props][docs-react-props] mirror the
[element API][docs-api] — including the [layout options][docs-layout] — and
[events][docs-react-events] arrive as typed callbacks; `apiRef` exposes the
underlying element. See the [React guide][docs-react].

## SSR & Next.js

The component is SSR-safe out of the box and can be used directly from Next.js
App Router Server Components — no `next/dynamic` and no wrapper file needed:

```jsx
// app/page.tsx — a Server Component
import { AiImageEditor } from '@uploadcare/react-ai-image-editor';

export default function Page() {
  return <AiImageEditor pubkey="YOUR_PUBLIC_KEY" fallback={<div>Loading…</div>} />;
}
```

The server renders the `fallback` prop; the editor engine loads in the browser
after mount. To skip the loading window, warm the engine cache ahead of time —
on hover, idle, or route prefetch ([details][docs-react-preloading]):

```js
import { preloadAiImageEditor } from '@uploadcare/react-ai-image-editor';

preloadAiImageEditor();
```

More in the [SSR & Next.js docs][docs-react-ssr].

## Security issues

If you think you ran into something in Uploadcare libraries that might have
security implications, please hit us up at
[bugbounty@uploadcare.com][uc-email-bounty] or Hackerone.

We'll contact you personally in a short time to fix an issue through co-op and
prior to any public disclosure.

## Feedback

Issues and PRs are welcome. You can provide your feedback or drop us a support
request at [hello@uploadcare.com][uc-email-hello].

[docs]: https://uploadcare.github.io/ai-image-editor/
[docs-react]: https://uploadcare.github.io/ai-image-editor/guide/react
[docs-react-props]: https://uploadcare.github.io/ai-image-editor/guide/react#props
[docs-react-events]: https://uploadcare.github.io/ai-image-editor/guide/react#events
[docs-react-ssr]: https://uploadcare.github.io/ai-image-editor/guide/react#ssr-next-js
[docs-react-preloading]: https://uploadcare.github.io/ai-image-editor/guide/react#preloading
[docs-api]: https://uploadcare.github.io/ai-image-editor/api/components
[docs-layout]: https://uploadcare.github.io/ai-image-editor/guide/layout
[uc-email-bounty]: mailto:bugbounty@uploadcare.com
[uc-email-hello]: mailto:hello@uploadcare.com
[npm-img]: https://img.shields.io/npm/v/@uploadcare/react-ai-image-editor.svg
[npm-url]: https://www.npmjs.com/package/@uploadcare/react-ai-image-editor
[badge-build]: https://github.com/uploadcare/ai-image-editor/actions/workflows/checks.yml/badge.svg
[build-url]: https://github.com/uploadcare/ai-image-editor/actions/workflows/checks.yml
[badge-release-img]: https://img.shields.io/github/release/uploadcare/ai-image-editor.svg
[badge-release-url]: https://github.com/uploadcare/ai-image-editor/releases
