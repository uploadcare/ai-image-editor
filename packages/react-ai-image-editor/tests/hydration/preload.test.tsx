import { expect, it, vi } from 'vitest';

import { preloadAiImageEditor } from '../../src';

// A file of its own: a module resolves once per file, so an earlier render here would have loaded the engine already.
vi.mock('@uploadcare/ai-image-editor', async () => (await import('../support/fake-editor')).defineFakeEditor());

it('preloadAiImageEditor loads the engine before anything renders', async () => {
  expect(customElements.get('uc-ai-image-editor')).toBeUndefined();

  preloadAiImageEditor();

  // Loading the engine registers the element; nothing has been rendered.
  await vi.waitFor(() => expect(customElements.get('uc-ai-image-editor')).toBeDefined());
});
