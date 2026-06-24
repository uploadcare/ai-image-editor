// Public API of `@uploadcare/ai-enhancer`. Keep this surface minimal — it's the
// only entry point TypeDoc documents. Implementation details live in
// `./internal` and are intentionally not re-exported here.

// The editor element, plus the types for its events and configurable properties.
export {
  type CanvasFit,
  type ComposerPlacement,
  type DoneDetail,
  type HistoryPlacement,
  type MetadataCallback,
  type OutputFilenameResolver,
  type ToolbarPlacement,
  UcAiEnhancer,
} from './widgets/ai-editor';
// Aspect ratios offered by the `aspectRatios` property.
export { type AspectRatio } from './entities/aspect-ratio';
// Modes and quick-prompt presets (`presets` property).
export { type AiEditorMode, type AiPreset, type AiPresets } from './entities/mode';
// Secure (signed) CDN delivery (`secureDeliveryProxyUrlResolver` property).
export { type SecureDeliveryProxyUrlResolver, type SecureDeliveryUrlParts } from './shared/lib/secureDelivery';
// Localization helpers.
export { type AiEnhancerLocale, enLocale } from './shared/i18n';
