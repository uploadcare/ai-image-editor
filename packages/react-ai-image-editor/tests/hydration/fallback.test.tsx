import React from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

import { AiImageEditor } from '../../src';
import { setupContainers } from '../support/containers';

// The engine import is gated so the test can observe the fallback before it resolves. A module resolves once per
// file, so this test has a file to itself: sharing one, it would pass only when it happened to run first.
let releaseImport: () => void;
const importGate = new Promise<void>((resolve) => {
  releaseImport = resolve;
});

vi.mock('@uploadcare/ai-image-editor', async () => {
  await importGate;
  return (await import('../support/fake-editor')).defineFakeEditor();
});

const makeContainer = setupContainers();

it('shows the fallback until the engine loads, then swaps in the element with wired props and events', async () => {
  const container = makeContainer();
  const onDone = vi.fn();
  const apiRef = React.createRef<HTMLElement>();

  const root = createRoot(container);
  root.render(
    <AiImageEditor
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
  expect(container.querySelector('uc-ai-image-editor')).toBeNull();

  releaseImport();

  await vi.waitFor(() => {
    expect(container.querySelector('uc-ai-image-editor')).not.toBeNull();
  });
  const el = container.querySelector('uc-ai-image-editor') as HTMLElement & { pubkey: string };
  expect(container.querySelector('[data-testid="skeleton"]')).toBeNull();
  expect(el.pubkey).toBe('test-pubkey');
  expect(el.getAttribute('class')).toBe('my-class');
  expect(apiRef.current).toBe(el);

  el.dispatchEvent(new CustomEvent('uc:done', { detail: { some: 'detail' } }));
  expect(onDone).toHaveBeenCalledWith({ some: 'detail' });

  root.unmount();
  expect(container.querySelector('uc-ai-image-editor')).toBeNull();
});
