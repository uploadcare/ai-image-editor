import { createComponent, type EventName } from '@lit/react';
import type { ChangeDetail, DoneDetail, ErrorDetail, UcAiImageEditor } from '@uploadcare/ai-image-editor';
import React from 'react';

/** Event props of the adapter component; handlers receive the CustomEvent. */
export type AdapterEvents = {
  onUcDone: EventName<CustomEvent<DoneDetail>>;
  onUcCancel: EventName<CustomEvent<void>>;
  onUcError: EventName<CustomEvent<ErrorDetail>>;
  onUcChange: EventName<CustomEvent<ChangeDetail>>;
};

export type AdapterComponent = ReturnType<typeof createComponent<UcAiImageEditor, AdapterEvents>>;

let adapterPromise: Promise<AdapterComponent> | null = null;

/**
 * Loads `<uc-ai-image-editor>` (registering the custom element) and builds its
 * React adapter, once per page — every `<AiImageEditor>` instance shares the
 * cache. Client-only: `@uploadcare/ai-image-editor` touches DOM globals at module
 * scope, so this must never run during SSR. The dynamic import is the SSR
 * boundary — do not replace it with a static import. (`@lit/react` itself is
 * pure — no `lit` import, no side effects — so its static import is fine.)
 */
export function loadUcAiImageEditor(): Promise<AdapterComponent> {
  if (!adapterPromise) {
    adapterPromise = import('@uploadcare/ai-image-editor')
      .then(({ UcAiImageEditor }) =>
        createComponent({
          react: React,
          tagName: 'uc-ai-image-editor',
          elementClass: UcAiImageEditor,
          events: {
            onUcDone: 'uc:done' as EventName<CustomEvent<DoneDetail>>,
            onUcCancel: 'uc:cancel' as EventName<CustomEvent<void>>,
            onUcError: 'uc:error' as EventName<CustomEvent<ErrorDetail>>,
            onUcChange: 'uc:change' as EventName<CustomEvent<ChangeDetail>>,
          },
        }),
      )
      .catch((error) => {
        // allow the next mount to retry instead of caching the rejection
        adapterPromise = null;
        throw error;
      });
  }
  return adapterPromise;
}

/**
 * Warms the editor engine cache ahead of mounting `<AiImageEditor>` (e.g. on
 * hover, idle, or route prefetch), eliminating the `fallback` window.
 * Fire-and-forget; load errors surface via `onError` when `<AiImageEditor>`
 * mounts.
 */
export function preloadAiImageEditor(): void {
  if (typeof window === 'undefined') return;
  loadUcAiImageEditor().catch(() => {});
}
