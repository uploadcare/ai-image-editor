import type { UcAiEnhancer } from '@uploadcare/ai-enhancer';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';

import { AiEnhancerError } from '@uploadcare/ai-enhancer/errors';
import { AiEnhancer, preloadAiEnhancer } from '../../src';
import { setupContainers } from '../support/containers';

// The real element talks to Uploadcare APIs once connected; stub the network
// so tests are hermetic (same approach as packages/ai-enhancer e2e tests).
const realFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;
  return () => {
    globalThis.fetch = realFetch;
  };
});

const makeContainer = setupContainers();

const roots: Root[] = [];
function render(ui: React.ReactElement): HTMLElement {
  const container = makeContainer();
  const root = createRoot(container);
  root.render(ui);
  roots.push(root);
  return container;
}

afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  localStorage.clear();
});

it('mounts the real <uc-ai-enhancer> element in a browser', async () => {
  const container = render(
    <AiEnhancer pubkey="test-pubkey" fallback={<div data-testid="skeleton" />} />,
  );

  await vi.waitFor(
    () => {
      expect(container.querySelector('uc-ai-enhancer')).not.toBeNull();
    },
    { timeout: 10_000 },
  );

  const el = container.querySelector('uc-ai-enhancer') as UcAiEnhancer;
  const Ctor = customElements.get('uc-ai-enhancer');
  expect(Ctor).toBeDefined();
  expect(el).toBeInstanceOf(Ctor as CustomElementConstructor);
  expect(el.shadowRoot).not.toBeNull();
  expect(container.querySelector('[data-testid="skeleton"]')).toBeNull();
});

it('passes props to the element and exposes it via apiRef', async () => {
  const apiRef = React.createRef<UcAiEnhancer>();
  const container = render(
    <AiEnhancer pubkey="test-pubkey" className="my-class" canvasFit="available" apiRef={apiRef} />,
  );

  await vi.waitFor(
    () => {
      expect(container.querySelector('uc-ai-enhancer')).not.toBeNull();
    },
    { timeout: 10_000 },
  );

  const el = container.querySelector('uc-ai-enhancer') as UcAiEnhancer;
  expect(el.pubkey).toBe('test-pubkey');
  expect(el.canvasFit).toBe('available');
  expect(el.getAttribute('class')).toBe('my-class');
  expect(apiRef.current).toBe(el);
});

it('delivers uc:done, uc:cancel and uc:error events to callbacks', async () => {
  const onDone = vi.fn();
  const onCancel = vi.fn();
  const onError = vi.fn();
  const container = render(
    <AiEnhancer pubkey="test-pubkey" onDone={onDone} onCancel={onCancel} onError={onError} />,
  );

  await vi.waitFor(
    () => {
      expect(container.querySelector('uc-ai-enhancer')).not.toBeNull();
    },
    { timeout: 10_000 },
  );

  const el = container.querySelector('uc-ai-enhancer') as UcAiEnhancer;

  const detail = { cdnUrl: 'https://ucarecdn.com/x/', uuid: 'u' };
  el.dispatchEvent(new CustomEvent('uc:done', { detail }));
  expect(onDone).toHaveBeenCalledWith(detail);

  el.dispatchEvent(new CustomEvent('uc:cancel'));
  expect(onCancel).toHaveBeenCalledTimes(1);

  const error = new AiEnhancerError('boom', { code: 'invalid_request' });
  el.dispatchEvent(new CustomEvent('uc:error', { detail: { error } }));
  expect(onError).toHaveBeenCalledWith(error);
});

it('updated callback props receive events (no stale handlers)', async () => {
  const first = vi.fn();
  const second = vi.fn();
  const container = render(<AiEnhancer pubkey="test-pubkey" onCancel={first} />);

  await vi.waitFor(
    () => {
      expect(container.querySelector('uc-ai-enhancer')).not.toBeNull();
    },
    { timeout: 10_000 },
  );

  const root = roots[roots.length - 1];
  root.render(<AiEnhancer pubkey="test-pubkey" onCancel={second} />);
  await new Promise((r) => setTimeout(r, 50));

  const el = container.querySelector('uc-ai-enhancer') as UcAiEnhancer;
  el.dispatchEvent(new CustomEvent('uc:cancel'));
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
});

it('preloadAiEnhancer warms the engine cache', async () => {
  preloadAiEnhancer();
  const container = render(<AiEnhancer pubkey="test-pubkey" />);
  await vi.waitFor(
    () => {
      expect(container.querySelector('uc-ai-enhancer')).not.toBeNull();
    },
    { timeout: 10_000 },
  );
});

it('shares one AiEnhancerError class identity across package entries', async () => {
  // both imports resolve to built dist files here, so this guards the
  // bundling contract: instanceof must work across the main and /errors entries
  const main = await import('@uploadcare/ai-enhancer');
  expect(main.AiEnhancerError).toBe(AiEnhancerError);
});

it('unmount removes the element cleanly', async () => {
  const container = render(<AiEnhancer pubkey="test-pubkey" />);
  await vi.waitFor(
    () => {
      expect(container.querySelector('uc-ai-enhancer')).not.toBeNull();
    },
    { timeout: 10_000 },
  );
  const root = roots[roots.length - 1];
  root.unmount();
  expect(container.querySelector('uc-ai-enhancer')).toBeNull();
});
