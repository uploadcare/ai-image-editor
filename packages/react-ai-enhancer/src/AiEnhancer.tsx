'use client';

import type { DoneDetail, UcAiEnhancer } from '@uploadcare/ai-enhancer';
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
  onError?: (error: unknown) => void;
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
    if (state.status === 'error') onErrorRef.current?.(state.error);
  }, [state]);

  // the adapter registers schemaEvents listeners itself and calls these
  // handlers with the CustomEvent's `detail` (not the event object)
  const handlers = useMemo(
    () => ({
      'onUc:done': (detail: DoneDetail) => onDone?.(detail),
      'onUc:cancel': () => onCancel?.(),
      'onUc:error': (detail: { error: unknown }) => onError?.(detail.error),
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
      class={className}
      {...props}
      {...handlers}
    />
  );
};
