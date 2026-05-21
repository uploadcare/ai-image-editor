import {
  type AiCapability,
  type AiEditorMode,
  type AiProvider,
  type ApplyDetail,
  type AspectRatio,
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
  provider?: AiProvider;
  l10n?: Record<string, string>;
  className?: string;
  apiRef?: Ref<UcAiEditor>;
  onApply?: (detail: ApplyDetail) => void;
  onCancel?: () => void;
  onError?: (error: unknown) => void;
};

export const AiEnhancer: FC<AiEnhancerProps> = ({
  apiRef,
  className,
  onApply,
  onCancel,
  onError,
  ...props
}) => {
  const handlers = useMemo(
    () => ({
      'uc:apply': (e: CustomEvent<ApplyDetail>) => onApply?.(e.detail),
      'uc:cancel': () => onCancel?.(),
      'uc:error': (e: CustomEvent<{ error: unknown }>) => onError?.(e.detail.error),
    }),
    [onApply, onCancel, onError],
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
