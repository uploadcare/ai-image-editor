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
const loaderActive = (el: UcAiCanvas) =>
  el.shadowRoot!.querySelector('.busy-overlay')!.classList.contains('busy-overlay--active');

describe('UcAiCanvas', () => {
  it('shows a loader and preloads the new url before displaying it', async () => {
    const el = await mount('https://example.com/a.png');
    // Before load: loader visible, nothing shown yet, preloader present.
    expect(loaderActive(el)).toBe(true);
    expect(shownImg(el)).toBeNull();
    expect(preloadImg(el)).toBeTruthy();

    preloadImg(el)!.dispatchEvent(new Event('load'));
    await el.updateComplete;

    // After load: the image is shown, loader and preloader are gone.
    expect(shownImg(el)?.getAttribute('src')).toBe('https://example.com/a.png');
    expect(loaderActive(el)).toBe(false);
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
    expect(loaderActive(el)).toBe(true);
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
    expect(loaderActive(el)).toBe(false);
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
    expect(loaderActive(el)).toBe(true);
  });

  describe('fullscreen button', () => {
    const fullscreenBtn = (el: UcAiCanvas) => el.shadowRoot!.querySelector('[data-testid="fullscreen-btn"]');

    /** happy-dom has no Fullscreen API — stub just enough of it. */
    function stubFullscreenSupport() {
      Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
      const requestFullscreen = vi.fn().mockResolvedValue(undefined);
      HTMLElement.prototype.requestFullscreen = requestFullscreen;
      return requestFullscreen;
    }

    async function mountWithImage(): Promise<UcAiCanvas> {
      const el = await mount('https://example.com/a.png');
      el.fullscreenLabel = 'View fullscreen';
      el.exitFullscreenLabel = 'Exit fullscreen';
      preloadImg(el)!.dispatchEvent(new Event('load'));
      await el.updateComplete;
      return el;
    }

    it('is hidden when the Fullscreen API is unsupported', async () => {
      const el = await mountWithImage();
      expect(fullscreenBtn(el)).toBeNull();
    });

    it('is hidden while no image is displayed and shown once one is', async () => {
      stubFullscreenSupport();
      const el = await mount('https://example.com/a.png');
      expect(fullscreenBtn(el)).toBeNull();

      preloadImg(el)!.dispatchEvent(new Event('load'));
      await el.updateComplete;
      expect(fullscreenBtn(el)).toBeTruthy();
    });

    it('requests fullscreen on the canvas when clicked', async () => {
      const requestFullscreen = stubFullscreenSupport();
      const el = await mountWithImage();

      (fullscreenBtn(el) as HTMLButtonElement).click();

      expect(requestFullscreen).toHaveBeenCalledOnce();
      expect(fullscreenBtn(el)!.getAttribute('aria-label')).toBe('View fullscreen');
    });

    it('preloads the fullsize rendition when the button is hovered', async () => {
      stubFullscreenSupport();
      const created: string[] = [];
      vi.stubGlobal(
        'Image',
        class {
          set src(value: string) {
            created.push(value);
          }
        },
      );
      try {
        const el = await mountWithImage();
        el.fullsizeUrl = 'https://example.com/full.png';
        await el.updateComplete;

        fullscreenBtn(el)!.dispatchEvent(new Event('mouseenter'));
        expect(created).toEqual(['https://example.com/full.png']);

        // Hovering again must not refetch the same url.
        fullscreenBtn(el)!.dispatchEvent(new Event('mouseenter'));
        expect(created).toHaveLength(1);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('overlays the fullsize rendition only while fullscreen', async () => {
      stubFullscreenSupport();
      const el = await mountWithImage();
      el.fullsizeUrl = 'https://example.com/full.png';
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('img.layer.full')).toBeNull();

      const canvas = el.shadowRoot!.querySelector('.canvas')!;
      Object.defineProperty(document, 'fullscreenElement', { value: canvas, configurable: true });
      canvas.dispatchEvent(new Event('fullscreenchange', { bubbles: true }));
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('img.layer.full')?.getAttribute('src')).toBe('https://example.com/full.png');

      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
      canvas.dispatchEvent(new Event('fullscreenchange', { bubbles: true }));
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('img.layer.full')).toBeNull();
    });

    it('switches to the exit state while fullscreen is active', async () => {
      stubFullscreenSupport();
      const el = await mountWithImage();
      const canvas = el.shadowRoot!.querySelector('.canvas')!;

      Object.defineProperty(document, 'fullscreenElement', { value: canvas, configurable: true });
      canvas.dispatchEvent(new Event('fullscreenchange', { bubbles: true }));
      await el.updateComplete;
      expect(fullscreenBtn(el)!.getAttribute('aria-label')).toBe('Exit fullscreen');

      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
      canvas.dispatchEvent(new Event('fullscreenchange', { bubbles: true }));
      await el.updateComplete;
      expect(fullscreenBtn(el)!.getAttribute('aria-label')).toBe('View fullscreen');
    });
  });
});
