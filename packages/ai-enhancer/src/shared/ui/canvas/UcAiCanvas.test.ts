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
const shownImg = (el: UcAiCanvas) => el.shadowRoot!.querySelector('img.canvas__image');
const errorState = (el: UcAiCanvas) => el.shadowRoot!.querySelector('.error-state');
const canvasEl = (el: UcAiCanvas) => el.shadowRoot!.querySelector('.canvas')!;
const isEmpty = (el: UcAiCanvas) => canvasEl(el).classList.contains('is-empty');
const isLoading = (el: UcAiCanvas) => canvasEl(el).classList.contains('is-loading');

describe('UcAiCanvas', () => {
  it('preloads the new url before displaying it', async () => {
    const el = await mount('https://example.com/a.png');
    // Before load: empty state (dot grid shown), nothing displayed, preloader present.
    expect(isEmpty(el)).toBe(true);
    expect(shownImg(el)).toBeNull();
    expect(preloadImg(el)).toBeTruthy();

    preloadImg(el)!.dispatchEvent(new Event('load'));
    await el.updateComplete;

    // After load: the image is displayed, empty state cleared, preloader gone.
    expect(shownImg(el)?.getAttribute('src')).toBe('https://example.com/a.png');
    expect(isEmpty(el)).toBe(false);
    expect(preloadImg(el)).toBeNull();
  });

  it('keeps the current image while a new one preloads (smooth swap)', async () => {
    const el = await mount('https://example.com/a.png');
    preloadImg(el)!.dispatchEvent(new Event('load'));
    await el.updateComplete;
    expect(shownImg(el)?.getAttribute('src')).toBe('https://example.com/a.png');

    // Request a second image: the first stays shown while the second preloads.
    el.url = 'https://example.com/b.png';
    await el.updateComplete;
    expect(shownImg(el)?.getAttribute('src')).toBe('https://example.com/a.png');
    expect(preloadImg(el)?.getAttribute('src')).toBe('https://example.com/b.png');

    preloadImg(el)!.dispatchEvent(new Event('load'));
    await el.updateComplete;
    expect(shownImg(el)?.getAttribute('src')).toBe('https://example.com/b.png');
  });

  it('sizes the frame to the given aspect ratio', async () => {
    const el = await mount('https://example.com/a.png');
    el.ratio = 16 / 9;
    await el.updateComplete;
    // The frame element exists and is the box the image is cropped into.
    expect(el.shadowRoot!.querySelector('.canvas__frame')).toBeTruthy();
  });

  describe('frame sizing', () => {
    /** happy-dom reports 0 for clientWidth/Height — stub a square viewport. */
    function stubViewport(el: UcAiCanvas, w = 1000, h = 1000): void {
      const vp = el.shadowRoot!.querySelector('.canvas__viewport')!;
      Object.defineProperty(vp, 'clientWidth', { value: w, configurable: true });
      Object.defineProperty(vp, 'clientHeight', { value: h, configurable: true });
    }
    const frameEl = (el: UcAiCanvas) => el.shadowRoot!.querySelector('.canvas__frame') as HTMLElement;

    it('sizes the frame to naturalRatio before the image decodes', async () => {
      const el = await mount('https://example.com/portrait.png');
      stubViewport(el);
      // Portrait hint (2:3) into a square viewport → height fills, width = h * 2/3.
      el.naturalRatio = 2 / 3;
      await el.updateComplete;
      expect(frameEl(el).style.height).toBe('1000px');
      expect(frameEl(el).style.width).toBe('667px');
    });

    it('prefers a pinned ratio over naturalRatio', async () => {
      const el = await mount('https://example.com/a.png');
      stubViewport(el);
      el.naturalRatio = 2 / 3;
      el.ratio = 1; // square pin wins
      await el.updateComplete;
      expect(frameEl(el).style.width).toBe('1000px');
      expect(frameEl(el).style.height).toBe('1000px');
    });

    it('re-sizes to the decoded image dimensions on load when no ratio is known', async () => {
      const el = await mount('https://example.com/portrait.png');
      stubViewport(el);

      // Displaying the image (no ratio, no hint, img not yet decoded) frames to
      // the landscape default (3/2).
      preloadImg(el)!.dispatchEvent(new Event('load'));
      await el.updateComplete;
      expect(frameEl(el).style.width).toBe('1000px');
      expect(frameEl(el).style.height).toBe('667px');

      // Image decodes as portrait; the displayed <img>'s load must re-frame it.
      const shown = shownImg(el)!;
      Object.defineProperty(shown, 'naturalWidth', { value: 800, configurable: true });
      Object.defineProperty(shown, 'naturalHeight', { value: 1200, configurable: true });
      shown.dispatchEvent(new Event('load'));
      await el.updateComplete;
      expect(frameEl(el).style.height).toBe('1000px');
      expect(frameEl(el).style.width).toBe('667px');
    });
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

  it('marks the canvas as loading while busy', async () => {
    const el = await mount(null);
    expect(isLoading(el)).toBe(false);
    el.busy = true;
    await el.updateComplete;
    expect(isLoading(el)).toBe(true);
    expect(isEmpty(el)).toBe(true);
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
