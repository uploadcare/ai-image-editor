import type { UcAiEnhancer } from '@uploadcare/ai-enhancer';
import { customElementToReactComponent } from '@uploadcare/react-adapter';
import React from 'react';

/**
 * The adapter turns each schemaEvents value 'x' into an `onX`-style prop
 * (`uc:done` → `onUc:done`) whose handler receives the event's `detail`.
 */
export const SCHEMA_EVENTS = {
  done: 'uc:done',
  cancel: 'uc:cancel',
  error: 'uc:error',
} as const;

export type AdapterComponent = React.ForwardRefExoticComponent<
  Record<string, unknown> & React.RefAttributes<UcAiEnhancer>
>;

let adapterPromise: Promise<AdapterComponent> | null = null;

/**
 * Loads `<uc-ai-enhancer>` (registering the custom element) and builds its
 * React adapter, once per page — every `<AiEnhancer>` instance shares the
 * cache. Client-only: `@uploadcare/ai-enhancer` touches DOM globals at module
 * scope, so this must never run during SSR. The dynamic import is the SSR
 * boundary — do not replace it with a static import.
 */
export function loadUcAiEnhancer(): Promise<AdapterComponent> {
  if (!adapterPromise) {
    adapterPromise = import('@uploadcare/ai-enhancer')
      .then(
        ({ UcAiEnhancer }) =>
          customElementToReactComponent({
            react: React,
            tag: 'uc-ai-enhancer',
            elClass: UcAiEnhancer,
            schemaEvents: SCHEMA_EVENTS,
          }) as unknown as AdapterComponent,
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
