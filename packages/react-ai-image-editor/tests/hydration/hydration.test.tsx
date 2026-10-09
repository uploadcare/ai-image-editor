import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

import { AiImageEditor } from '../../src';
import { setupContainers } from '../support/containers';

vi.mock('@uploadcare/ai-image-editor', async () => (await import('../support/fake-editor')).defineFakeEditor());

const makeContainer = setupContainers();

it('hydrates server HTML without hydration mismatches', async () => {
  const ui = <AiImageEditor pubkey="test-pubkey" fallback={<div data-testid="skeleton">loading</div>} />;
  const serverHtml = renderToString(ui);
  expect(serverHtml).toContain('skeleton');

  const container = makeContainer();
  container.innerHTML = serverHtml;

  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const root = hydrateRoot(container, ui);

  await vi.waitFor(() => {
    expect(container.querySelector('uc-ai-image-editor')).not.toBeNull();
  });

  const messages = consoleError.mock.calls.map((args) => args.map(String).join(' '));
  expect(messages.filter((m) => /hydrat|did not match|mismatch/i.test(m))).toEqual([]);
  consoleError.mockRestore();
  root.unmount();
});

it('uc:cancel and uc:error events reach their callbacks', async () => {
  const container = makeContainer();
  const onCancel = vi.fn();
  const onError = vi.fn();

  const root = createRoot(container);
  root.render(<AiImageEditor pubkey="test-pubkey" onCancel={onCancel} onError={onError} />);

  await vi.waitFor(() => {
    expect(container.querySelector('uc-ai-image-editor')).not.toBeNull();
  });
  const el = container.querySelector('uc-ai-image-editor') as HTMLElement;

  el.dispatchEvent(new CustomEvent('uc:cancel', { detail: undefined }));
  expect(onCancel).toHaveBeenCalledTimes(1);

  const error = new Error('generation failed');
  el.dispatchEvent(new CustomEvent('uc:error', { detail: { error } }));
  expect(onError).toHaveBeenCalledWith(error);

  root.unmount();
});
