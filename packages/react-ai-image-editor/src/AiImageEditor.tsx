'use client';

import type { ChangeDetail, DoneDetail, ErrorDetail, UcAiImageEditor } from '@uploadcare/ai-image-editor';
// value import from the side-effect-free subpath: the main entry registers
// custom elements at module scope and must never load during SSR
import { AiImageEditorError } from '@uploadcare/ai-image-editor/errors';
import React, { type FC, type ReactNode, type Ref, useEffect, useMemo, useRef } from 'react';

import { useLazyAiImageEditor } from './internal/useLazyAiImageEditor';

/**
 * Props mirror the public `<uc-ai-image-editor>` API via indexed-access types, so they
 * track the element automatically. Keep this in sync when the element's public
 * properties change.
 */
export type AiImageEditorProps = {
  pubkey: string;
  /** Edit an existing image by uuid (use this OR `sourceFileInfo`). */
  sourceUuid?: UcAiImageEditor['sourceUuid'];
  /** Edit an existing image from its UploadcareFile (use this OR `sourceUuid`). */
  sourceFileInfo?: UcAiImageEditor['sourceFileInfo'];
  aspectRatios?: UcAiImageEditor['aspectRatios'];
  presets?: UcAiImageEditor['presets'];
  presetsOnly?: UcAiImageEditor['presetsOnly'];
  metadata?: UcAiImageEditor['metadata'];
  outputFilename?: UcAiImageEditor['outputFilename'];
  baseUrl?: UcAiImageEditor['baseUrl'];
  cdnCname?: UcAiImageEditor['cdnCname'];
  cdnCnamePrefixed?: UcAiImageEditor['cdnCnamePrefixed'];
  localeName?: UcAiImageEditor['localeName'];
  localeDefinitionOverride?: UcAiImageEditor['localeDefinitionOverride'];
  composerPlacement?: UcAiImageEditor['composerPlacement'];
  canvasFit?: UcAiImageEditor['canvasFit'];
  historyPlacement?: UcAiImageEditor['historyPlacement'];
  /** @internal Not part of the public API yet (typed locally: the element strips `@internal` members from its published types). */
  composerAutoHide?: boolean;
  toolbarPlacement?: UcAiImageEditor['toolbarPlacement'];
  secureDeliveryProxyUrlResolver?: UcAiImageEditor['secureDeliveryProxyUrlResolver'];
  className?: string;
  apiRef?: Ref<UcAiImageEditor>;
  /**
   * Rendered during SSR and on the client until the editor engine loads.
   * Defaults to `null`. Size it to the editor's final dimensions to avoid
   * layout shift; call `preloadAiImageEditor()` to shrink the loading window.
   */
  fallback?: ReactNode;
  onDone?: (detail: DoneDetail) => void;
  /**
   * The current generation result changed (finished generation, history
   * selection, or reset — then `null`). The way to drive your own chrome with
   * `toolbarPlacement="none"`.
   */
  onChange?: (result: DoneDetail | null) => void;
  onCancel?: () => void;
  onError?: (error: AiImageEditorError) => void;
};

export const AiImageEditor: FC<AiImageEditorProps> = ({
  apiRef,
  className,
  fallback = null,
  onChange,
  onDone,
  onCancel,
  onError,
  ...props
}) => {
  const state = useLazyAiImageEditor();

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
      onUcChange: (e: CustomEvent<ChangeDetail>) => onChange?.(e.detail.result),
    }),
    [onDone, onCancel, onError, onChange],
  );

  if (state.status !== 'ready') {
    return <>{fallback}</>;
  }

  const AdapterAiEditor = state.Adapter;
  return (
    <AdapterAiEditor
      ref={apiRef as Ref<UcAiImageEditor>}
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
function normalizeLoadError(err: unknown): AiImageEditorError {
  if (err instanceof AiImageEditorError) return err;
  const message = err instanceof Error ? err.message : 'Failed to load the AI Image Editor engine';
  return new AiImageEditorError(message, { code: 'engine_load_failed', cause: err });
}
