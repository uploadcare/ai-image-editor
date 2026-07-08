/**
 * Internal export surface — implementation details that are NOT part of the
 * public `@uploadcare/ai-enhancer` API.
 *
 * These are consumed inside this repo (e.g. the docs demo's fake provider) and
 * are intentionally kept out of the public barrel (`./index`) and the generated
 * docs. Nothing here carries stability guarantees; import at your own risk.
 */

// Provider — the editor's AI backend (default: Uploadcare's derivative API).
export {
  type AiProvider,
  AiProviderError,
  type AiProviderRequest,
  type AiProviderResult,
  type EditRequestParams,
  type GenerateRequestParams,
  UploadcareApiClient,
  type UploadcareApiClientOptions,
  UploadcareDerivativeApi,
  type UploadcareDerivativeApiOptions,
  type UploadcareJobErrorStatus,
  type UploadcareJobProcessingStatus,
  type UploadcareJobResponse,
  type UploadcareJobStatus,
  type UploadcareJobSuccessStatus,
  type UploadcareJobUploadingStatus,
} from './entities/provider';

// Aspect-ratio internals — helpers, the picker sentinel, and option/value types.
export {
  aspectRatioEquals,
  aspectRatioKey,
  type AspectRatioLabelKey,
  type AspectRatioOption,
  aspectRatioSvg,
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

// Mode metadata.
export { MODES, type ModeMeta } from './entities/mode';

// i18n internals — locale loaders and the key type used for lookups.
export { type AiEnhancerLocaleKey, LOCALE_LOADERS, type LocaleLoader, SUPPORTED_LOCALES } from './shared/i18n';

// Secure-delivery resolver consumed by the editor.
export { resolveSecureDeliveryUrl } from './shared/lib/secureDelivery';
