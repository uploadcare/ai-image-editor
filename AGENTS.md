# Agent notes

Monorepo for the Uploadcare AI Image Editor.

- `packages/ai-image-editor` — the core `<uc-ai-image-editor>` web component + the File
  Uploader plugin (`@uploadcare/ai-image-editor`).
- `packages/react-ai-image-editor` — the React wrapper (`@uploadcare/react-ai-image-editor`).

## Maintaining these notes

**Keep this file accurate as you work.** Whenever you change something
cross-cutting — the element tag/name, a public API surface, an entry point, a
cross-package contract, build/test commands, or add/remove a package — update
AGENTS.md in the same change so future agents don't act on stale assumptions.
When you hit an inconsistency that wasn't written down, add a note here once
you've resolved it. Treat it as living documentation, not a one-time snapshot.

## Keep the React wrapper in sync

The React wrapper (`packages/react-ai-image-editor/src/AiImageEditor.tsx`) re-exposes the
`<uc-ai-image-editor>` public API. **Whenever you change the element's public properties
or events** (add/remove/rename a `@property`, change an event), update
`AiImageEditorProps` and the event handlers to match, then `tsc` the wrapper.

`AiImageEditorProps` types its props via indexed access (`UcAiImageEditor['propName']`),
so property *types* track the element automatically — but you must still add or
remove the prop *entries* by hand when properties are added or removed. Don't
expose `@internal` properties (e.g. `provider`, `shimmerConfig`).

Note: the wrapper type-checks against the built `dist/` types of
`@uploadcare/ai-image-editor`, so run its `build` after editing the element before
type-checking the wrapper.

## The `authToken` contract

`authToken` accepts three things, and each means something different:

- a **token string**, used as given and never refreshed, so it has to outlive
  the job it starts;
- a **function**, called when a token is needed and cached by
  `AuthTokenController` unless `cacheAuthToken` is `false`;
- a **provider** (`{ getToken, invalidate? }`), which owns its own caching and
  is passed through untouched. This is what the File Uploader plugin hands
  over, and what the editor gives `UploadcareDerivativeApi` so upload-client
  can drop a refused token and retry once.

Two invariants that are easy to break:

- **Unset is not the same as empty.** No `authToken` means requests go
  unsigned; a function that returns `null`, `undefined` or `''` is a failure
  (`auth_token_failed`), not a request without a header. Leave the option
  unset for unsigned requests.
- **The provider handed to the API client is built once** and reads `authToken`
  when it is called. Passing the current value instead would rebuild the client
  on every token change, and `willUpdate` only rebuilds when a token appears or
  disappears.

## Never hardcode a version in the guides

**CDN examples use the `%AI_IMAGE_EDITOR_VERSION%` placeholder**, substituted
with the current `package.json` version at docs build time (see the
`ai-image-editor-version` Vite plugin in `docs/.vitepress/config.mts`). A
hardcoded version goes stale silently; the placeholder can't. Keep the
pin-in-production warning alongside the examples.

If you rename the placeholder, rename it on **both** sides — the plugin and
every guide that uses it. A mismatch doesn't fail the build: substitution
simply no-ops and the literal `%…%` ships to readers.

## Shared runtime dependencies are not bundled

`lit`, `@uploadcare/file-uploader`, `@uploadcare/signed-uploads` and
`@uploadcare/upload-client` are `external` in `packages/ai-image-editor/vite.config.ts`,
so the editor and File Uploader resolve one shared copy. Bundling the auth
packages again would give the plugin two `AuthTokenResolverError` classes:
`instanceof` fails across them and the editor wraps the uploader's error a
second time, pushing the original one level deeper on `cause`.

## Tests talk to the Uploadcare API emulator

`@uploadcare/api-emulator` (a devDependency of `packages/ai-image-editor`)
stands in for the Upload API and CDN; tests should not hand-write Uploadcare
responses.

- **Specs** (happy-dom) inject `emulatorFetch()` from
  `src/entities/provider/api/emulator.testing.ts` as the client's `fetch`, and
  call `resetSession()` before each test. `getFileInfo` goes through
  upload-client's own transport, so those specs start a real emulator server
  (`@uploadcare/api-emulator/listen`) and pass its origin as `baseUrl`.
- **Browser e2e** run the emulator in the page with
  `setupEmulator()` from `@uploadcare/api-emulator/browser` (MSW and
  `@mswjs/interceptors` underneath, both devDependencies here):
  `tests/setup.ts` emulates Uploadcare's hosts and `cdn.example.com` (the
  tests' CDN cname), fails any other Uploadcare host, passes every
  non-Uploadcare origin through, and resets the session before every test. Signing stays
  Node-side in `tests/commands.ts` (`commands.mintAuthToken()`). The editor
  tests use `DERIVATIVE_INSTANT_PUBLIC_KEY` so a
  generation finishes on its first poll instead of after the editor's 1.5s
  interval several times over.
- Bearer tokens must be real: mint them with `mintAuthToken()` (specs) or
  `commands.mintAuthToken()` (e2e).
- A hand-written stub is still right for what the emulator can't do (a bare
  non-JSON failure, a poll that hangs or never finishes); say why next to it.

The dependency is a TEMPORARY `file:` link to an unreleased checkout until the
package ships; swap it for a version range then and drop the TEMPORARY comments.

## Docs layout

`docs/` is a VitePress site published to GitHub Pages: hand-written guides in
`docs/guide/`, plus an API reference generated by `npm run docs:api` (typedoc
for the TypeScript surface, and `docs/api/components.md` built from the
`@property` JSDoc — both gitignored, so edit the source, not the output).

**The guides are mirrored in `uploadcare/fern-docs`.** Every file in
`docs/guide/` has a counterpart under `fern/pages/ai-image-editor/` (and
`guide/plugin.md` under `fern/pages/file-uploader/ai-image-editor.mdx`); that
repo's `AGENTS.md` holds the page mapping and the VitePress-to-Fern conversion
rules. Fern is the first-level documentation, this site keeps the API reference
and the live demo. Change one side and port the change to the other in the same
piece of work: they have drifted before, and a reader hitting the stale copy
has no way to tell which one is right.
