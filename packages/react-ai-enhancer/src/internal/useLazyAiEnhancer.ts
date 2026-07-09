import { useEffect, useState } from 'react';
import { type AdapterComponent, loadUcAiEnhancer } from './loadUcAiEnhancer';

export type LazyAiEnhancerState =
  | { status: 'loading' }
  | { status: 'ready'; Adapter: AdapterComponent }
  | { status: 'error'; error: unknown };

/**
 * Resolves the lazily-loaded editor adapter after mount. During SSR (and the
 * first client render, so hydration output matches the server byte-for-byte)
 * the state is always 'loading'.
 */
export function useLazyAiEnhancer(): LazyAiEnhancerState {
  const [state, setState] = useState<LazyAiEnhancerState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadUcAiEnhancer().then(
      (Adapter) => {
        if (!cancelled) setState({ status: 'ready', Adapter });
      },
      (error) => {
        if (!cancelled) setState({ status: 'error', error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
