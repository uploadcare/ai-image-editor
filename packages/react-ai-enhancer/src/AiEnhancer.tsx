import { type DoneDetail, UcAiEnhancer } from '@uploadcare/ai-enhancer';
import { customElementToReactComponent } from '@uploadcare/react-adapter';
import React, { type FC, type Ref, useMemo } from 'react';

import '@uploadcare/ai-enhancer';

const AdapterAiEditor = customElementToReactComponent({
  react: React,
  tag: 'uc-ai-enhancer',
  elClass: UcAiEnhancer,
});

/**
 * Props mirror the public `<uc-ai-enhancer>` API via indexed-access types, so they
 * track the element automatically. Keep this in sync when the element's public
 * properties change — see AGENTS.md.
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
  composerAutoHide?: UcAiEnhancer['composerAutoHide'];
  toolbarPlacement?: UcAiEnhancer['toolbarPlacement'];
  secureDeliveryProxyUrlResolver?: UcAiEnhancer['secureDeliveryProxyUrlResolver'];
  className?: string;
  apiRef?: Ref<UcAiEnhancer>;
  onDone?: (detail: DoneDetail) => void;
  onCancel?: () => void;
  onError?: (error: unknown) => void;
};

export const AiEnhancer: FC<AiEnhancerProps> = ({ apiRef, className, onDone, onCancel, onError, ...props }) => {
  const handlers = useMemo(
    () => ({
      'uc:done': (e: CustomEvent<DoneDetail>) => onDone?.(e.detail),
      'uc:cancel': () => onCancel?.(),
      'uc:error': (e: CustomEvent<{ error: unknown }>) => onError?.(e.detail.error),
    }),
    [onDone, onCancel, onError],
  );

  return (
    <AdapterAiEditor
      ref={apiRef as Ref<UcAiEnhancer>}
      // @ts-expect-error className passes through to the custom element
      class={className}
      {...props}
      {...handlers}
    />
  );
};
