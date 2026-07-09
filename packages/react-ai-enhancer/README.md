# @uploadcare/react-ai-enhancer

React wrapper for the [`<uc-ai-enhancer>`](../ai-enhancer) web component.

```tsx
import { AiEnhancer } from '@uploadcare/react-ai-enhancer';

<AiEnhancer
  pubkey="YOUR_PUBLIC_KEY"
  onDone={({ cdnUrl }) => console.log(cdnUrl)}
  onCancel={() => {}}
  onError={(error) => console.error(error)}
/>;
```

## SSR / Next.js

The component is SSR-safe out of the box: the editor engine (which registers
custom elements and touches DOM globals) is loaded lazily on the client after
mount. On the server — `renderToString`, Remix, Next.js App Router — it renders
the `fallback` prop (default: nothing), with no hydration mismatches.

In Next.js App Router it can be used directly from Server Components; the
package ships the `'use client'` directive, so no `next/dynamic` or wrapper
file is needed:

```tsx
// app/page.tsx — a Server Component
import { AiEnhancer } from '@uploadcare/react-ai-enhancer';

export default function Page() {
  return <AiEnhancer pubkey="YOUR_PUBLIC_KEY" fallback={<EditorSkeleton />} />;
}
```

To avoid the brief fallback flash on the client, warm the engine cache ahead
of time (e.g. on hover, idle, or route prefetch):

```ts
import { preloadAiEnhancer } from '@uploadcare/react-ai-enhancer';

preloadAiEnhancer();
```

## Testing

- `npm test` — vitest projects: `ssr` (bare Node, `renderToString`),
  `hydration` (happy-dom, hydration parity), `e2e` (real Chromium via
  Playwright with the real web component).
- `npm run test:next` — builds `tests/next-fixture`, a minimal Next.js App
  Router app, and asserts the prerendered HTML contains the SSR fallback.
  Requires `npm run build` first.

React 18 and 19 are both supported (`peerDependencies: react >= 17`); CI runs
the suite against both.
