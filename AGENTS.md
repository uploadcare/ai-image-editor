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

## The plugin's `aiEditor*` config keys

The File Uploader plugin forwards the editor's own options as `aiEditor*`
`<uc-config>` keys (`AiImageEditorPluginConfig` in
`packages/ai-image-editor/src/widgets/ai-image-editor-plugin/ui/AiImageEditorPlugin.ts`).
When you expose another one, register it in `setup`, subscribe it in the
activity, add a case to the forwarding table in
`packages/ai-image-editor/tests/plugin.e2e.test.ts` (it won't compile without
one), and a row to the plugin page in `uploadcare/fern-docs`
(`fern/pages/file-uploader/ai-image-editor.mdx`). Two uploader
behaviours shape the registrations:

- It reflects a config value back onto its attribute with `toString()`, and
  never calls `toAttribute`. Objects and functions need `attribute: false`.
- Removing an attribute hands `fromAttribute` the key's `defaultValue`, or `''`
  when that's `null`. So `''` means unset, and a boolean key defaults to
  `false` (a `null` default would arrive as `''`, i.e. present).

The config type is exported from the plugin entry because the bundled
`plugin.d.ts` drops a type that only the `declare module` augmentation refers
to.

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

- **Specs** (happy-dom) run against `setupEmulator()` from
  `@uploadcare/api-emulator/node`, started once in `tests/specs/setup.ts`
  (the `specs` project's setup file). It answers the global `fetch` and
  `node:http(s)` (upload-client's transport, so `getFileInfo` too), refuses
  every other origin, and resets the session before every test: import
  `session` from there to register a scenario or read what was sent from its
  `requests`. The clients call the global `fetch`; a spec that checks what
  they pass it uses `vi.spyOn(globalThis, 'fetch')` and restores it after the
  test.
- **Browser e2e** run the emulator in the page with
  `setupEmulator()` from `@uploadcare/api-emulator/browser` (MSW and
  `@mswjs/interceptors` underneath, both devDependencies of the root
  `package.json`):
  `tests/emulator.ts` emulates Uploadcare's hosts and `cdn.example.com` (the
  tests' CDN cname), fails any other Uploadcare host, passes every
  non-Uploadcare origin through, and resets the session before every test;
  import `session` from there to register a scenario or preset, or to read
  what the editor sent (`requests`) and what a run produced (`files`; the
  harness's `resultUuid()` answers the one that isn't a `DEMO_FILES` image).
  A test that checks what the editor passed `fetch` itself uses
  `vi.spyOn(globalThis, 'fetch')` and restores it after the test. The editor
  tests apply the `derivativesInstant` preset (`tests/editor/harness.ts`) so
  a generation finishes on its first poll instead of after the editor's 1.5s
  interval several times over.
- **Contract** tests (`tests/contract/`, the `contract` project) hold the
  derivative API to one set of assertions on two targets: the emulator in
  every `npm test`, and the real `upload.uploadcare.com` with
  `npm run test:contract:live -w @uploadcare/ai-image-editor`
  (`UC_CONTRACT_PUBLIC_KEY` required; the run fails without it). CI runs the
  live target only by hand (the `contract` workflow).
- In specs, e2e and contract tests, a request or response that fails the
  client's dev schemas (`uploadcareApiClient.schemas.dev.ts`) fails the test
  (`tests/schema-drift.ts`).
- Steer the emulator per test with `session.on()` and `session.use(preset)`
  (`session` from the project's setup file); there are no magic keys,
  prompts or uuids.
- Bearer tokens must be real: mint them with the emulator's `mintAuthToken()`
  (WebCrypto, so it works in the page too). The images every fresh session
  holds are its `DEMO_FILES`.
- A `session.on()` handler runs before the emulator's routes and can answer
  any `Response` or a promise that never settles, so a bare non-JSON failure,
  a job stuck in `processing` or a poll that hangs is a scenario, not a stub.
  Stub `fetch` only where it is simpler, and say why next to it.

The React wrapper's e2e project runs against the same in-page emulator
(`packages/react-ai-image-editor/tests/e2e/setup.ts`), so a request the
element starts making there fails loudly instead of reaching the network.

In both packages the dependency is a TEMPORARY `file:` link to an unreleased
checkout, so `npm ci` only resolves it on that machine; swap it for a version
once the package ships.

## Docs layout

**The guides live only in `uploadcare/fern-docs`** (`fern/pages/ai-image-editor/`,
plus `fern/pages/file-uploader/ai-image-editor.mdx` for the plugin), published
at `https://uploadcare.com/docs/ai-image-editor/`. There is no local copy to
keep in sync: a guide change is a fern-docs change.

`docs/` here is a VitePress site on GitHub Pages that keeps only what's
generated from this repo: the API reference (`npm run docs:api`: typedoc for
the TypeScript surface, and `docs/api/components.md` built from the
`@property` JSDoc by `scripts/build-cem-docs.mjs`; both gitignored, so edit the
source, not the output) and the demo/playground. Its links to guides point at
the Fern pages. The old `/guide/*` URLs are redirect stubs written at build
time (`MOVED_GUIDES` in `docs/.vitepress/config.mts`) that forward to the
Fern page and keep the `#anchor`, because published READMEs still link them. Every property row in `components.md` links to its section on
the Fern Options page via `OPTION_SECTIONS` in `build-cem-docs.mjs`; when you
add an option, add its Fern section and its name there. Fern links back to this
site only for the API reference and the demo/playground.

`npm run docs:check-links -w @uploadcare/ai-image-editor` (after `docs:build`)
fetches every `uploadcare.com/docs` link in the built site, the READMEs and the
package homepages, and fails on a missing page or `#anchor`. The `docs links`
workflow runs it every Monday and on demand.
