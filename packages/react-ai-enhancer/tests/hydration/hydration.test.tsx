import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

import { AiEnhancer } from '../../src';
import { useContainers } from '../support/containers';

// Deterministic stand-in for the real Lit element: accessors live on the
// prototype (like Lit's @property) so the adapter's prop-splitting treats them
// as element properties. The import is gated so the first test can observe the
// pre-resolution fallback state.
let releaseImport: () => void;
const importGate = new Promise<void>((resolve) => {
  releaseImport = resolve;
});

vi.mock('@uploadcare/ai-enhancer', async () => {
  await importGate;
  class UcAiEnhancer extends HTMLElement {
    #pubkey = '';
    get pubkey() {
      return this.#pubkey;
    }
    set pubkey(value: string) {
      this.#pubkey = value;
    }
  }
  customElements.define('uc-ai-enhancer', UcAiEnhancer);
  return { UcAiEnhancer };
});

const makeContainer = useContainers();

it('shows the fallback until the engine loads, then swaps in the element with wired props and events', async () => {
  const container = makeContainer();
  const onDone = vi.fn();
  const apiRef = React.createRef<HTMLElement>();

  const root = createRoot(container);
  root.render(
    <AiEnhancer
      pubkey="test-pubkey"
      className="my-class"
      apiRef={apiRef}
      onDone={onDone}
      fallback={<div data-testid="skeleton" />}
    />,
  );

  // engine import is still gated: fallback must be visible
  await vi.waitFor(() => {
    expect(container.querySelector('[data-testid="skeleton"]')).not.toBeNull();
  });
  expect(container.querySelector('uc-ai-enhancer')).toBeNull();

  releaseImport();

  await vi.waitFor(() => {
    expect(container.querySelector('uc-ai-enhancer')).not.toBeNull();
  });
  const el = container.querySelector('uc-ai-enhancer') as HTMLElement & { pubkey: string };
  expect(container.querySelector('[data-testid="skeleton"]')).toBeNull();
  expect(el.pubkey).toBe('test-pubkey');
  expect(el.getAttribute('class')).toBe('my-class');
  expect(apiRef.current).toBe(el);

  el.dispatchEvent(new CustomEvent('uc:done', { detail: { some: 'detail' } }));
  expect(onDone).toHaveBeenCalledWith({ some: 'detail' });

  root.unmount();
  expect(container.querySelector('uc-ai-enhancer')).toBeNull();
});

it('hydrates server HTML without hydration mismatches', async () => {
  releaseImport(); // in case the first test didn't run (order independence)
  const ui = (
    <AiEnhancer pubkey="test-pubkey" fallback={<div data-testid="skeleton">loading</div>} />
  );
  const serverHtml = renderToString(ui);
  expect(serverHtml).toContain('skeleton');

  const container = makeContainer();
  container.innerHTML = serverHtml;

  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const root = hydrateRoot(container, ui);

  await vi.waitFor(() => {
    expect(container.querySelector('uc-ai-enhancer')).not.toBeNull();
  });

  const messages = consoleError.mock.calls.map((args) => args.map(String).join(' '));
  expect(messages.filter((m) => /hydrat|did not match|mismatch/i.test(m))).toEqual([]);
  consoleError.mockRestore();
  root.unmount();
});

it('uc:cancel and uc:error events reach their callbacks', async () => {
  releaseImport(); // in case the first test didn't run (order independence)
  const container = makeContainer();
  const onCancel = vi.fn();
  const onError = vi.fn();

  const root = createRoot(container);
  root.render(<AiEnhancer pubkey="test-pubkey" onCancel={onCancel} onError={onError} />);

  await vi.waitFor(() => {
    expect(container.querySelector('uc-ai-enhancer')).not.toBeNull();
  });
  const el = container.querySelector('uc-ai-enhancer') as HTMLElement;

  el.dispatchEvent(new CustomEvent('uc:cancel', { detail: undefined }));
  expect(onCancel).toHaveBeenCalledTimes(1);

  const error = new Error('generation failed');
  el.dispatchEvent(new CustomEvent('uc:error', { detail: { error } }));
  expect(onError).toHaveBeenCalledWith(error);

  root.unmount();
});
