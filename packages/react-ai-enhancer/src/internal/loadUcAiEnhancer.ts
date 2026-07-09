import { createComponent, type EventName } from '@lit/react';
import type { DoneDetail, ErrorDetail, UcAiEnhancer } from '@uploadcare/ai-enhancer';
import React from 'react';

/** Event props of the adapter component; handlers receive the CustomEvent. */
export type AdapterEvents = {
  onUcDone: EventName<CustomEvent<DoneDetail>>;
  onUcCancel: EventName<CustomEvent<void>>;
  onUcError: EventName<CustomEvent<ErrorDetail>>;
};

export type AdapterComponent = ReturnType<typeof createComponent<UcAiEnhancer, AdapterEvents>>;

let adapterPromise: Promise<AdapterComponent> | null = null;

/**
 * Loads `<uc-ai-enhancer>` (registering the custom element) and builds its
 * React adapter, once per page — every `<AiEnhancer>` instance shares the
 * cache. Client-only: `@uploadcare/ai-enhancer` touches DOM globals at module
 * scope, so this must never run during SSR. The dynamic import is the SSR
 * boundary — do not replace it with a static import. (`@lit/react` itself is
 * pure — no `lit` import, no side effects — so its static import is fine.)
 */
export function loadUcAiEnhancer(): Promise<AdapterComponent> {
  if (!adapterPromise) {
    adapterPromise = import('@uploadcare/ai-enhancer')
      .then(({ UcAiEnhancer }) =>
        createComponent({
          react: React,
          tagName: 'uc-ai-enhancer',
          elementClass: UcAiEnhancer,
          events: {
            onUcDone: 'uc:done' as EventName<CustomEvent<DoneDetail>>,
            onUcCancel: 'uc:cancel' as EventName<CustomEvent<void>>,
            onUcError: 'uc:error' as EventName<CustomEvent<ErrorDetail>>,
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
 * Warms the editor engine cache ahead of mounting `<AiEnhancer>` (e.g. on
 * hover, idle, or route prefetch), eliminating the `fallback` window.
 * Fire-and-forget; load errors surface via `onError` when `<AiEnhancer>`
 * mounts.
 */
export function preloadAiEnhancer(): void {
  if (typeof window === 'undefined') return;
  loadUcAiEnhancer().catch(() => {});
}
