# Changelog

## [0.2.4](https://github.com/uploadcare/ai-image-editor/compare/ai-image-editor-v0.2.3...ai-image-editor-v0.2.4) (2026-08-20)


### Features

* **demo:** persist the provider selector across reloads ([5e3adea](https://github.com/uploadcare/ai-image-editor/commit/5e3adea2dff5a94234d0bb9b9033a4d1f3e35ac3))
* **demo:** toggle between real Uploadcare and fake Unsplash provider ([ab16274](https://github.com/uploadcare/ai-image-editor/commit/ab16274b2056b0a82a90cd927f8b7e0f55f33627))


### Bug Fixes

* **ai-image-editor:** keep the history hover fan smooth through a result-landing slide ([b3b9758](https://github.com/uploadcare/ai-image-editor/commit/b3b9758115537741a6b68253986063e40a84106e))
* **ai-image-editor:** polish history strip hover, selection & focus ([1078a1d](https://github.com/uploadcare/ai-image-editor/commit/1078a1d5d133f0f742fc3fca037bacf5c223ea67))
* **ai-image-editor:** poll derivative status until is_ready before returning ([92a6dfd](https://github.com/uploadcare/ai-image-editor/commit/92a6dfd961e23ce103c4d3e857f6aaf0c582d834))
* **ai-image-editor:** poll derivative status until is_ready before returning ([60f82f2](https://github.com/uploadcare/ai-image-editor/commit/60f82f264c987137ebdc7fdb105ace909a7a73fc))
* **ai-image-editor:** poll source file info until ready; require is_ready ([6148960](https://github.com/uploadcare/ai-image-editor/commit/6148960847707d705b17930a55d28e46e22c3b50))
* **ai-image-editor:** stop the shimmer leaking a dot strip at the frame edge ([946c5b1](https://github.com/uploadcare/ai-image-editor/commit/946c5b1ea170eb804e72ec26a4e6f852024914e2))

## [0.2.3](https://github.com/uploadcare/ai-image-editor/compare/ai-image-editor-v0.2.2...ai-image-editor-v0.2.3) (2026-08-19)


### Bug Fixes

* **ai-image-editor:** wait for CDN readiness before returning a result ([#72](https://github.com/uploadcare/ai-image-editor/issues/72)) ([1fdc0cb](https://github.com/uploadcare/ai-image-editor/commit/1fdc0cb095811ea2001eef6ce453e6f6f2367d74))

## [0.2.2](https://github.com/uploadcare/ai-image-editor/compare/ai-image-editor-v0.2.1...ai-image-editor-v0.2.2) (2026-08-04)


### Bug Fixes

* **docs:** stop the Playground nav link 404ing on click ([#61](https://github.com/uploadcare/ai-image-editor/issues/61)) ([ade1b5d](https://github.com/uploadcare/ai-image-editor/commit/ade1b5d13993c2624d5393b1d04e0be9cd508acb))

## [0.2.1](https://github.com/uploadcare/ai-image-editor/compare/ai-image-editor-v0.2.0...ai-image-editor-v0.2.1) (2026-07-30)


### Features

* **demo:** redesign the playground index and make Shimmer Lab dev-only ([5b2f584](https://github.com/uploadcare/ai-image-editor/commit/5b2f584aed9cbfd31fe9e2a515a02d94632ba7ca))
* **i18n:** friendly message for ProjectPublicKeyInvalidError ([a6e4e13](https://github.com/uploadcare/ai-image-editor/commit/a6e4e13af47dc3122c336bf4b598b9de22317f65))


### Bug Fixes

* **demo:** stop linking to Shimmer Lab from the published playground ([4e615ca](https://github.com/uploadcare/ai-image-editor/commit/4e615ca6a5c460e5b8ecf0744947aa1546faef83))

## [0.2.0](https://github.com/uploadcare/ai-image-editor/compare/ai-enhancer-v0.1.6...ai-image-editor-v0.2.0) (2026-07-30)


### ⚠ BREAKING CHANGES

* rename AI Enhancer to AI Image Editor ([#56](https://github.com/uploadcare/ai-image-editor/issues/56))

### Features

* rename AI Enhancer to AI Image Editor ([#56](https://github.com/uploadcare/ai-image-editor/issues/56)) ([158b549](https://github.com/uploadcare/ai-image-editor/commit/158b5490e9d0551cb1e781ce3aa1cdfa09799d5f))

## [0.1.6](https://github.com/uploadcare/ai-image-editor/compare/ai-enhancer-v0.1.5...ai-enhancer-v0.1.6) (2026-07-24)


### Features

* **ai-enhancer:** add sizing mode for consumer-controlled container behavior ([#51](https://github.com/uploadcare/ai-image-editor/issues/51)) ([5ab0d7b](https://github.com/uploadcare/ai-image-editor/commit/5ab0d7b3a0c406bb49e101f7c5861a01d2167113))

## [0.1.5](https://github.com/uploadcare/ai-image-editor/compare/ai-enhancer-v0.1.4...ai-enhancer-v0.1.5) (2026-07-22)


### Features

* **ai-enhancer:** rename aspect-ratio "original" to "auto" ([cfb5b3e](https://github.com/uploadcare/ai-image-editor/commit/cfb5b3e77f65e40855cb2b803416373f41de4db3))

## [0.1.4](https://github.com/uploadcare/ai-image-editor/compare/ai-enhancer-v0.1.3...ai-enhancer-v0.1.4) (2026-07-10)


### Features

* **ai-enhancer:** toolbar-placement "none" + uc:change for host-driven chrome ([#38](https://github.com/uploadcare/ai-image-editor/issues/38)) ([bb0336e](https://github.com/uploadcare/ai-image-editor/commit/bb0336ef977f8cf312dc07f4cc402bab3e7e6711))

## [0.1.3](https://github.com/uploadcare/ai-image-editor/compare/ai-enhancer-v0.1.2...ai-enhancer-v0.1.3) (2026-07-09)


### Features

* typed uc:error event — normalized AiEnhancerError ([#33](https://github.com/uploadcare/ai-image-editor/issues/33)) ([e64034a](https://github.com/uploadcare/ai-image-editor/commit/e64034a9a74e031fe337d261214ae02067f3c89d))

## [0.1.2](https://github.com/uploadcare/ai-image-editor/compare/ai-enhancer-v0.1.1...ai-enhancer-v0.1.2) (2026-07-09)


### Features

* **react-ai-enhancer:** SSR support + runtime/SSR/Next.js test suites ([#26](https://github.com/uploadcare/ai-image-editor/issues/26)) ([c467407](https://github.com/uploadcare/ai-image-editor/commit/c467407da7f67e87eb7b3029da805d4a8f56f7de))

## [0.1.1](https://github.com/uploadcare/ai-image-editor/compare/ai-enhancer-v0.1.0...ai-enhancer-v0.1.1) (2026-07-09)
