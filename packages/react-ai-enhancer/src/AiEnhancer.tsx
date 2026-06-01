import {
  type AiCapability,
  type AiEditorMode,
  type AspectRatio,
  type DoneDetail,
  UcAiEditor,
} from '@uploadcare/ai-enhancer';
import { customElementToReactComponent } from '@uploadcare/react-adapter';
import React, { type FC, type Ref, useMemo } from 'react';

import '@uploadcare/ai-enhancer';

const AdapterAiEditor = customElementToReactComponent({
  react: React,
  tag: 'uc-ai-editor',
  elClass: UcAiEditor,
});

export type AiEnhancerProps = {
  mode?: AiEditorMode;
  capability?: AiCapability;
  src?: string | null;
  aspectRatios?: AspectRatio[];
  pubkey: string;
  baseUrl?: string;
  cdnCname?: string;
  cdnCnamePrefixed?: string;
  l10n?: Record<string, string>;
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
