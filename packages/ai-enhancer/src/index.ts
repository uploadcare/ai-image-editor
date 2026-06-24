export {
  type AspectRatio,
  type AspectRatioLabelKey,
  type AspectRatioOption,
  aspectRatioEquals,
  aspectRatioKey,
  type AspectRatioValue,
  aspectRatioValueEquals,
  DEFAULT_GENERATE_RATIO,
  isConcreteRatio,
  isValidAspectRatio,
  labelKeyForRatio,
  ORIGINAL_RATIO,
  POPULAR_ASPECT_RATIOS,
  parseAspectRatioList,
  toAspectRatioOption,
} from './entities/aspect-ratio';
export { type AiEditorMode, type AiPreset, type AiPresets, MODES, type ModeMeta } from './entities/mode';
export {
  type AiProvider,
  type AiProviderRequest,
  type AiProviderResult,
  UploadcareDerivativeApi,
  type UploadcareDerivativeApiOptions,
  type UploadcareJobResponse,
  type UploadcareJobStatus,
} from './entities/provider';
export { enLocale, translate } from './shared/i18n';
export {
  resolveSecureDeliveryUrl,
  type SecureDeliveryProxyUrlResolver,
  type SecureDeliveryUrlParts,
} from './shared/lib/secureDelivery';
// Internal sub-component elements (uc-ai-canvas/-chips/-history/-prompt-row/
// -aspect-ratio/-footer) and the controllers are registered as a side effect of
// importing the editor; they are not part of the public API.
export {
  type CanvasFit,
  type ComposerPlacement,
  type DoneDetail,
  type HistoryPlacement,
  type MetadataCallback,
  type OutputFilenameResolver,
  type ToolbarPlacement,
  UcAiEditor,
} from './widgets/ai-editor';
