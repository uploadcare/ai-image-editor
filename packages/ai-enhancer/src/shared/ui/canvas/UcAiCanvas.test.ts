import { describe, expect, it, vi } from 'vitest';
import './UcAiCanvas';
import type { UcAiCanvas } from './UcAiCanvas';

async function mount(url: string | null, errorLabel = 'Failed to load'): Promise<UcAiCanvas> {
  const el = document.createElement('uc-ai-canvas') as UcAiCanvas;
  el.errorLabel = errorLabel;
  el.url = url;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const preloadImg = (el: UcAiCanvas) => el.shadowRoot!.querySelector('img.preload');
const shownImg = (el: UcAiCanvas) => el.shadowRoot!.querySelector('img.shown');
const errorState = (el: UcAiCanvas) => el.shadowRoot!.querySelector('.error-state');
const loader = (el: UcAiCanvas) => el.shadowRoot!.querySelector('.busy-overlay');

describe('UcAiCanvas', () => {
  it('shows a loader and preloads the new url before displaying it', async () => {
    const el = await mount('https://example.com/a.png');
    // Before load: loader visible, nothing shown yet, preloader present.
    expect(loader(el)).toBeTruthy();
    expect(shownImg(el)).toBeNull();
    expect(preloadImg(el)).toBeTruthy();

    preloadImg(el)!.dispatchEvent(new Event('load'));
    await el.updateComplete;

    // After load: the image is shown, loader and preloader are gone.
    expect(shownImg(el)?.getAttribute('src')).toBe('https://example.com/a.png');
    expect(loader(el)).toBeNull();
    expect(preloadImg(el)).toBeNull();
  });

  it('keeps the previous image while a new one preloads (smooth swap)', async () => {
    const el = await mount('https://example.com/a.png');
    preloadImg(el)!.dispatchEvent(new Event('load'));
    await el.updateComplete;
    expect(shownImg(el)?.getAttribute('src')).toBe('https://example.com/a.png');

    // Request a second image: the first stays shown, loader is up, second preloads.
    el.url = 'https://example.com/b.png';
    await el.updateComplete;
    expect(shownImg(el)?.getAttribute('src')).toBe('https://example.com/a.png');
    expect(loader(el)).toBeTruthy();
    expect(preloadImg(el)?.getAttribute('src')).toBe('https://example.com/b.png');

    preloadImg(el)!.dispatchEvent(new Event('load'));
    await el.updateComplete;
    expect(shownImg(el)?.getAttribute('src')).toBe('https://example.com/b.png');
  });

  it('shows an error state and emits uc:image-error when the image fails to load', async () => {
    const el = await mount('https://example.com/broken.png');
    const onError = vi.fn();
    el.addEventListener('uc:image-error', onError);

    preloadImg(el)!.dispatchEvent(new Event('error'));
    await el.updateComplete;

    expect(onError).toHaveBeenCalledOnce();
    expect((onError.mock.calls[0]![0] as CustomEvent).detail.url).toBe('https://example.com/broken.png');
    expect(errorState(el)?.textContent).toContain('Failed to load');
    expect(loader(el)).toBeNull();
  });

  it('clears the error and retries when the url changes', async () => {
    const el = await mount('https://example.com/broken.png');
    preloadImg(el)!.dispatchEvent(new Event('error'));
    await el.updateComplete;
    expect(errorState(el)).toBeTruthy();

    el.url = 'https://example.com/fresh.png';
    await el.updateComplete;

    expect(errorState(el)).toBeNull();
    expect(preloadImg(el)?.getAttribute('src')).toBe('https://example.com/fresh.png');
  });

  it('shows the loader while busy even without a url', async () => {
    const el = await mount(null);
    el.busy = true;
    await el.updateComplete;
    expect(loader(el)).toBeTruthy();
  });
});
