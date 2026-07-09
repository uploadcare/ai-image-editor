<p align="center">
  <a href="https://uploadcare.com/?ref=react-ai-enhancer">
    <picture>
      <source media="(prefers-color-scheme: light)" srcset="https://ucarecdn.com/1b4714cd-53be-447b-bbde-e061f1e5a22f/logosafespacetransparent.svg">
      <source media="(prefers-color-scheme: dark)" srcset="https://ucarecdn.com/3b610a0a-780c-4750-a8b4-3bf4a8c90389/logotransparentinverted.svg">
      <img width=250 alt="Uploadcare logo" src="https://ucarecdn.com/1b4714cd-53be-447b-bbde-e061f1e5a22f/logosafespacetransparent.svg">
    </picture>
  </a>
</p>
<p align="center">
  <a href="https://uploadcare.com/?ref=react-ai-enhancer">Website</a> •
  <a href="https://uploadcare.github.io/ai-enhancer/">Docs</a> •
  <a href="https://uploadcare.com/blog?ref=react-ai-enhancer">Blog</a> •
  <a href="https://twitter.com/Uploadcare?ref=react-ai-enhancer">Twitter</a>
</p>

# Uploadcare React AI Enhancer

[![NPM version][npm-img]][npm-url]
[![Build Status][badge-build]][build-url]
[![GitHub release][badge-release-img]][badge-release-url]

React wrapper for the [Uploadcare AI Enhancer][docs] — an AI image editor:
generate images from a prompt or edit existing ones, with the result stored
on Uploadcare. Typed props, callback events, and SSR support out of the box.

## Quick start

1. Install the package:

```bash
npm install @uploadcare/react-ai-enhancer
```

2. Render the component:

```jsx
import { AiEnhancer } from '@uploadcare/react-ai-enhancer';

<AiEnhancer
  pubkey="YOUR_PUBLIC_KEY"
  onDone={({ url }) => console.log(url)}
/>;
```

Works with React 17, 18, and 19. Props, events, and the underlying element API
(`apiRef`) are covered in the [React guide][docs-react].

## SSR & Next.js

The component is SSR-safe out of the box and can be used directly from Next.js
App Router Server Components — no `next/dynamic` and no wrapper file needed:

```jsx
// app/page.tsx — a Server Component
import { AiEnhancer } from '@uploadcare/react-ai-enhancer';

export default function Page() {
  return <AiEnhancer pubkey="YOUR_PUBLIC_KEY" fallback={<div>Loading…</div>} />;
}
```

The server renders the `fallback` prop; the editor engine loads in the browser
after mount. Call `preloadAiEnhancer()` ahead of time to skip the loading
window. Details in the [SSR & Next.js docs][docs-react-ssr].

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
[docs-react]: https://uploadcare.github.io/ai-enhancer/guide/react
[docs-react-ssr]: https://uploadcare.github.io/ai-enhancer/guide/react#ssr-next-js
[uc-email-bounty]: mailto:bugbounty@uploadcare.com
[uc-email-hello]: mailto:hello@uploadcare.com
[npm-img]: https://img.shields.io/npm/v/@uploadcare/react-ai-enhancer.svg
[npm-url]: https://www.npmjs.com/package/@uploadcare/react-ai-enhancer
[badge-build]: https://github.com/uploadcare/ai-enhancer/actions/workflows/checks.yml/badge.svg
[build-url]: https://github.com/uploadcare/ai-enhancer/actions/workflows/checks.yml
[badge-release-img]: https://img.shields.io/github/release/uploadcare/ai-enhancer.svg
[badge-release-url]: https://github.com/uploadcare/ai-enhancer/releases
