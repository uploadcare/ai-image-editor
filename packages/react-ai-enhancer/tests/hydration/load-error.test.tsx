import React from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

import { AiEnhancerError } from '@uploadcare/ai-enhancer/errors';
import { AiEnhancer } from '../../src';
import { setupContainers } from '../support/containers';

vi.mock('@uploadcare/ai-enhancer', () => {
  throw new Error('engine chunk failed to load');
});

const makeContainer = setupContainers();

it('reports engine load failures through onError and keeps the fallback', async () => {
  const container = makeContainer();
  const onError = vi.fn();

  const root = createRoot(container);
  root.render(
    <AiEnhancer pubkey="test-pubkey" onError={onError} fallback={<div data-testid="skeleton" />} />,
  );

  await vi.waitFor(() => {
    expect(onError).toHaveBeenCalledTimes(1);
  });
  const received = onError.mock.calls[0][0];
  expect(received).toBeInstanceOf(AiEnhancerError);
  expect(received.code).toBe('engine_load_failed');
  expect(received.cause).toBeInstanceOf(Error);
  expect(container.querySelector('[data-testid="skeleton"]')).not.toBeNull();
  expect(container.querySelector('uc-ai-enhancer')).toBeNull();

  root.unmount();
});
