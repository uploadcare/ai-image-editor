'use client';

import type { DoneDetail, ErrorDetail, UcAiEnhancer } from '@uploadcare/ai-enhancer';
// value import from the side-effect-free subpath: the main entry registers
// custom elements at module scope and must never load during SSR
import { AiEnhancerError } from '@uploadcare/ai-enhancer/errors';
import React, { type FC, type ReactNode, type Ref, useEffect, useMemo, useRef } from 'react';

import { useLazyAiEnhancer } from './internal/useLazyAiEnhancer';

/**
 * Props mirror the public `<uc-ai-enhancer>` API via indexed-access types, so they
 * track the element automatically. Keep this in sync when the element's public
 * properties change.
 */
export type AiEnhancerProps = {
  pubkey: string;
  /** Edit an existing image by uuid (use this OR `sourceFileInfo`). */
  sourceUuid?: UcAiEnhancer['sourceUuid'];
  /** Edit an existing image from its UploadcareFile (use this OR `sourceUuid`). */
  sourceFileInfo?: UcAiEnhancer['sourceFileInfo'];
  aspectRatios?: UcAiEnhancer['aspectRatios'];
  presets?: UcAiEnhancer['presets'];
  presetsOnly?: UcAiEnhancer['presetsOnly'];
  metadata?: UcAiEnhancer['metadata'];
  outputFilename?: UcAiEnhancer['outputFilename'];
  baseUrl?: UcAiEnhancer['baseUrl'];
  cdnCname?: UcAiEnhancer['cdnCname'];
  cdnCnamePrefixed?: UcAiEnhancer['cdnCnamePrefixed'];
  localeName?: UcAiEnhancer['localeName'];
  localeDefinitionOverride?: UcAiEnhancer['localeDefinitionOverride'];
  composerPlacement?: UcAiEnhancer['composerPlacement'];
  canvasFit?: UcAiEnhancer['canvasFit'];
  historyPlacement?: UcAiEnhancer['historyPlacement'];
  /** @internal Not part of the public API yet (typed locally: the element strips `@internal` members from its published types). */
  composerAutoHide?: boolean;
  toolbarPlacement?: UcAiEnhancer['toolbarPlacement'];
  secureDeliveryProxyUrlResolver?: UcAiEnhancer['secureDeliveryProxyUrlResolver'];
  className?: string;
  apiRef?: Ref<UcAiEnhancer>;
  /**
   * Rendered during SSR and on the client until the editor engine loads.
   * Defaults to `null`. Size it to the editor's final dimensions to avoid
   * layout shift; call `preloadAiEnhancer()` to shrink the loading window.
   */
  fallback?: ReactNode;
  onDone?: (detail: DoneDetail) => void;
  onCancel?: () => void;
  onError?: (error: AiEnhancerError) => void;
};

export const AiEnhancer: FC<AiEnhancerProps> = ({
  apiRef,
  className,
  fallback = null,
  onDone,
  onCancel,
  onError,
  ...props
}) => {
  const state = useLazyAiEnhancer();

  // ref keeps callback identity out of the deps: report each load failure
  // once, not on every parent re-render
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  useEffect(() => {
    if (state.status === 'error') onErrorRef.current?.(normalizeLoadError(state.error));
  }, [state]);

  // @lit/react registers the event listeners; handlers receive the CustomEvent
  const handlers = useMemo(
    () => ({
      onUcDone: (e: CustomEvent<DoneDetail>) => onDone?.(e.detail),
      onUcCancel: () => onCancel?.(),
      onUcError: (e: CustomEvent<ErrorDetail>) => onError?.(e.detail.error),
    }),
    [onDone, onCancel, onError],
  );

  if (state.status !== 'ready') {
    return <>{fallback}</>;
  }

  const AdapterAiEditor = state.Adapter;
  return (
    <AdapterAiEditor
      ref={apiRef as Ref<UcAiEnhancer>}
      className={className}
      {...props}
      {...handlers}
    />
  );
};

/**
 * Wraps an engine lazy-load rejection into the same public error class the
 * element uses for `uc:error`, under a frontend-only code (deliberately not in
 * the shared platform code list).
 */
function normalizeLoadError(err: unknown): AiEnhancerError {
  if (err instanceof AiEnhancerError) return err;
  const message = err instanceof Error ? err.message : 'Failed to load the AI enhancer engine';
  return new AiEnhancerError(message, { code: 'engine_load_failed', cause: err });
}
