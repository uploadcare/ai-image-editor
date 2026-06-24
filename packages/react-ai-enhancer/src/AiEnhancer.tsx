import { type DoneDetail, UcAiEditor } from '@uploadcare/ai-enhancer';
import { customElementToReactComponent } from '@uploadcare/react-adapter';
import React, { type FC, type Ref, useMemo } from 'react';

import '@uploadcare/ai-enhancer';

const AdapterAiEditor = customElementToReactComponent({
  react: React,
  tag: 'uc-ai-enhancer',
  elClass: UcAiEditor,
});

/**
 * Props mirror the public `<uc-ai-enhancer>` API via indexed-access types, so they
 * track the element automatically. Keep this in sync when the element's public
 * properties change — see AGENTS.md.
 */
export type AiEnhancerProps = {
  pubkey: string;
  /** Edit an existing image by uuid (use this OR `sourceFileInfo`). */
  sourceUuid?: UcAiEditor['sourceUuid'];
  /** Edit an existing image from its UploadcareFile (use this OR `sourceUuid`). */
  sourceFileInfo?: UcAiEditor['sourceFileInfo'];
  aspectRatios?: UcAiEditor['aspectRatios'];
  presets?: UcAiEditor['presets'];
  presetsOnly?: UcAiEditor['presetsOnly'];
  metadata?: UcAiEditor['metadata'];
  outputFilename?: UcAiEditor['outputFilename'];
  baseUrl?: UcAiEditor['baseUrl'];
  cdnCname?: UcAiEditor['cdnCname'];
  cdnCnamePrefixed?: UcAiEditor['cdnCnamePrefixed'];
  localeName?: UcAiEditor['localeName'];
  localeDefinitionOverride?: UcAiEditor['localeDefinitionOverride'];
  composerPlacement?: UcAiEditor['composerPlacement'];
  canvasFit?: UcAiEditor['canvasFit'];
  historyPlacement?: UcAiEditor['historyPlacement'];
  composerAutoHide?: UcAiEditor['composerAutoHide'];
  toolbarPlacement?: UcAiEditor['toolbarPlacement'];
  secureDeliveryProxyUrlResolver?: UcAiEditor['secureDeliveryProxyUrlResolver'];
  className?: string;
  apiRef?: Ref<UcAiEditor>;
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
      ref={apiRef as Ref<UcAiEditor>}
      // @ts-expect-error className passes through to the custom element
      class={className}
      {...props}
      {...handlers}
    />
  );
};
