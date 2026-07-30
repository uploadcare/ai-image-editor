import type { DoneDetail, UcAiImageEditor } from '@uploadcare/ai-image-editor';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';

import { AiImageEditorError } from '@uploadcare/ai-image-editor/errors';
import { AiImageEditor, preloadAiImageEditor } from '../../src';
import { setupContainers } from '../support/containers';

// The real element talks to Uploadcare APIs once connected; stub the network
// so tests are hermetic (same approach as packages/ai-image-editor e2e tests).
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

it('mounts the real <uc-ai-image-editor> element in a browser', async () => {
  const container = render(
    <AiImageEditor pubkey="test-pubkey" fallback={<div data-testid="skeleton" />} />,
  );

  await vi.waitFor(
    () => {
      expect(container.querySelector('uc-ai-image-editor')).not.toBeNull();
    },
    { timeout: 10_000 },
  );

  const el = container.querySelector('uc-ai-image-editor') as UcAiImageEditor;
  const Ctor = customElements.get('uc-ai-image-editor');
  expect(Ctor).toBeDefined();
  expect(el).toBeInstanceOf(Ctor as CustomElementConstructor);
  expect(el.shadowRoot).not.toBeNull();
  expect(container.querySelector('[data-testid="skeleton"]')).toBeNull();
});

it('passes props to the element and exposes it via apiRef', async () => {
  const apiRef = React.createRef<UcAiImageEditor>();
  const container = render(
    <AiImageEditor pubkey="test-pubkey" className="my-class" canvasFit="available" apiRef={apiRef} />,
  );

  await vi.waitFor(
    () => {
      expect(container.querySelector('uc-ai-image-editor')).not.toBeNull();
    },
    { timeout: 10_000 },
  );

  const el = container.querySelector('uc-ai-image-editor') as UcAiImageEditor;
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
    <AiImageEditor pubkey="test-pubkey" onDone={onDone} onCancel={onCancel} onError={onError} />,
  );

  await vi.waitFor(
    () => {
      expect(container.querySelector('uc-ai-image-editor')).not.toBeNull();
    },
    { timeout: 10_000 },
  );

  const el = container.querySelector('uc-ai-image-editor') as UcAiImageEditor;

  const detail = { cdnUrl: 'https://ucarecdn.com/x/', uuid: 'u' };
  el.dispatchEvent(new CustomEvent('uc:done', { detail }));
  expect(onDone).toHaveBeenCalledWith(detail);

  el.dispatchEvent(new CustomEvent('uc:cancel'));
  expect(onCancel).toHaveBeenCalledTimes(1);

  const error = new AiImageEditorError('boom', { code: 'invalid_request' });
  el.dispatchEvent(new CustomEvent('uc:error', { detail: { error } }));
  expect(onError).toHaveBeenCalledWith(error);
});

it('delivers uc:change results to onChange', async () => {
  const onChange = vi.fn();
  const container = render(<AiImageEditor pubkey="test-pubkey" onChange={onChange} />);

  await vi.waitFor(
    () => {
      expect(container.querySelector('uc-ai-image-editor')).not.toBeNull();
    },
    { timeout: 10_000 },
  );

  const el = container.querySelector('uc-ai-image-editor') as UcAiImageEditor;
  // full DoneDetail shape so wiring regressions that drop fields would surface
  const result: DoneDetail = {
    url: 'https://ucarecdn.com/x/',
    uuid: 'x',
    prompt: 'a tiger',
    mode: 'generate',
    aspectRatio: [1, 1],
    file: { uuid: 'x', cdnUrl: 'https://ucarecdn.com/x/' } as DoneDetail['file'],
  };
  el.dispatchEvent(new CustomEvent('uc:change', { detail: { result } }));
  expect(onChange).toHaveBeenCalledWith(result);

  el.dispatchEvent(new CustomEvent('uc:change', { detail: { result: null } }));
  expect(onChange).toHaveBeenLastCalledWith(null);
});

it('updated callback props receive events (no stale handlers)', async () => {
  const first = vi.fn();
  const second = vi.fn();
  const container = render(<AiImageEditor pubkey="test-pubkey" onCancel={first} />);

  await vi.waitFor(
    () => {
      expect(container.querySelector('uc-ai-image-editor')).not.toBeNull();
    },
    { timeout: 10_000 },
  );

  const root = roots[roots.length - 1];
  root.render(<AiImageEditor pubkey="test-pubkey" onCancel={second} />);
  await new Promise((r) => setTimeout(r, 50));

  const el = container.querySelector('uc-ai-image-editor') as UcAiImageEditor;
  el.dispatchEvent(new CustomEvent('uc:cancel'));
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
});

it('preloadAiImageEditor warms the engine cache', async () => {
  preloadAiImageEditor();
  const container = render(<AiImageEditor pubkey="test-pubkey" />);
  await vi.waitFor(
    () => {
      expect(container.querySelector('uc-ai-image-editor')).not.toBeNull();
    },
    { timeout: 10_000 },
  );
});

it('shares one AiImageEditorError class identity across package entries', async () => {
  // both imports resolve to built dist files here, so this guards the
  // bundling contract: instanceof must work across the main and /errors entries
  const main = await import('@uploadcare/ai-image-editor');
  expect(main.AiImageEditorError).toBe(AiImageEditorError);
});

it('unmount removes the element cleanly', async () => {
  const container = render(<AiImageEditor pubkey="test-pubkey" />);
  await vi.waitFor(
    () => {
      expect(container.querySelector('uc-ai-image-editor')).not.toBeNull();
    },
    { timeout: 10_000 },
  );
  const root = roots[roots.length - 1];
  root.unmount();
  expect(container.querySelector('uc-ai-image-editor')).toBeNull();
});
