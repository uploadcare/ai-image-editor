# Agent notes

Monorepo for the Uploadcare AI Enhancer.

- `packages/ai-enhancer` — the core `<uc-ai-enhancer>` web component + the File
  Uploader plugin (`@uploadcare/ai-enhancer`).
- `packages/react-ai-enhancer` — the React wrapper (`@uploadcare/react-ai-enhancer`).

## Maintaining these notes

**Keep this file accurate as you work.** Whenever you change something
cross-cutting — the element tag/name, a public API surface, an entry point, a
cross-package contract, build/test commands, or add/remove a package — update
AGENTS.md in the same change so future agents don't act on stale assumptions.
When you hit an inconsistency that wasn't written down, add a note here once
you've resolved it. Treat it as living documentation, not a one-time snapshot.

## Keep the React wrapper in sync

The React wrapper (`packages/react-ai-enhancer/src/AiEnhancer.tsx`) re-exposes the
`<uc-ai-enhancer>` public API. **Whenever you change the element's public properties
or events** (add/remove/rename a `@property`, change an event), update
`AiEnhancerProps` and the event handlers to match, then `tsc` the wrapper.

`AiEnhancerProps` types its props via indexed access (`UcAiEnhancer['propName']`),
so property *types* track the element automatically — but you must still add or
remove the prop *entries* by hand when properties are added or removed. Don't
expose `@internal` properties (e.g. `provider`, `shimmerConfig`).

Note: the wrapper type-checks against the built `dist/` types of
`@uploadcare/ai-enhancer`, so run its `build` after editing the element before
type-checking the wrapper.

## Keep the fern-docs mirror in sync

The guides in `packages/ai-enhancer/docs/` are mirrored to
[`uploadcare/fern-docs`](https://github.com/uploadcare/fern-docs), which
publishes them at `uploadcare.com/docs` — the **first-level** docs. **Whenever
you change a guide here, port the change to fern-docs** (and vice versa; its
AGENTS.md carries the same rule plus the page mapping and the VitePress→Fern
conversion notes).

- Guide pages map to `fern/pages/ai-enhancer/*.mdx` (`getting-started` →
  `quickstart`); `guide/plugin.md` maps to
  `fern/pages/file-uploader/ai-enhancer.mdx`; the props table of the
  *generated* `docs/api/components.md` (gitignored; produced from the
  `@property` JSDoc by `npm run docs:api`) feeds
  `fern/pages/ai-enhancer/options.mdx` (one heading per option, config
  options only — so new/changed `@property` docs must be ported there too).
- This site (GitHub Pages) remains the home of the API reference
  (typedoc + the components page's events/CSS custom properties) and the live
  demo; fern-docs links to them with
  `?utm_source=uploadcare-docs&utm_medium=docs&utm_campaign=ai-enhancer`.
- **CDN examples use the `%AI_ENHANCER_VERSION%` placeholder**, substituted
  with the current `package.json` version at docs build time (see the
  `ai-enhancer-version` Vite plugin in `docs/.vitepress/config.mts`). Never
  hardcode a version in the guides — it goes stale. When porting to
  fern-docs (which has no such substitution), map the placeholder to
  `@latest` and keep the pin-in-production warning.
