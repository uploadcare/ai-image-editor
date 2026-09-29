import { describe, expect, it, vi } from 'vitest';
import { delay } from '../test-renderer';
import type { UcAiImageEditorType } from './harness';
import { canvasUrl, clickSend, mount, SAMPLE_UUID, STAGING, stubFetch, typePrompt } from './harness';

/** How the host sizes itself: fill vs content, the clamp, and the CDN rendition it picks. */
describe('<uc-ai-image-editor> sizing', () => {
  const stageEl = (el: UcAiImageEditorType) => el.shadowRoot!.querySelector('.stage') as HTMLElement;

  it('defaults to fill and reflects the property to the attribute', async () => {
    const el = mount(STAGING);
    await el.updateComplete;
    expect(el.sizing).toBe('fill');
    el.sizing = 'content';
    await el.updateComplete;
    expect(el.getAttribute('sizing')).toBe('content');
  });

  it('keeps an unsized fill host from collapsing (min-height fallback)', async () => {
    const el = mount(STAGING);
    await el.updateComplete;
    expect(getComputedStyle(el).minHeight).toBe('480px');

    // The mode is CSS-driven, so an unknown value behaves as fill too.
    el.sizing = 'junk' as never;
    await el.updateComplete;
    expect(getComputedStyle(el).minHeight).toBe('480px');

    // Content mode derives its own height instead of guarding a given one.
    el.sizing = 'content';
    await el.updateComplete;
    expect(getComputedStyle(el).minHeight).not.toBe('480px');

    // Plain consumer CSS always beats the :host fallback (shadow-cascade
    // rule: outer-tree declarations win over :host, specificity aside).
    el.sizing = 'fill';
    const consumerCss = document.createElement('style');
    consumerCss.textContent = 'uc-ai-image-editor { min-height: 100px; }';
    document.head.append(consumerCss);
    try {
      await el.updateComplete;
      expect(getComputedStyle(el).minHeight).toBe('100px');
    } finally {
      consumerCss.remove();
    }
  });

  it('derives its height from the selected ratio at the given width in content mode', async () => {
    const el = mount({ ...STAGING, sizing: 'content', 'aspect-ratios': '1:1', style: 'width: 640px' });
    await el.updateComplete;

    // The stage expresses the frame fit exactly: (640 - 40) / 1 + 40 = 640.
    await vi.waitFor(() => expect(stageEl(el).getBoundingClientRect().height).toBeCloseTo(640, 0));

    // The host wraps its content — stage plus composer/toolbar chrome.
    const shell = el.shadowRoot!.querySelector('.shell') as HTMLElement;
    expect(shell.getBoundingClientRect().height).toBeGreaterThan(640);
    expect(el.getBoundingClientRect().height).toBeCloseTo(shell.getBoundingClientRect().height, 0);

    // Picking a different ratio re-derives it: (640 - 40) / 2 + 40 = 340.
    el.setAttribute('aspect-ratios', '2:1');
    await el.updateComplete;
    await vi.waitFor(() => expect(stageEl(el).getBoundingClientRect().height).toBeCloseTo(340, 0));
  });

  it('clamps to the consumer max-height and letterboxes the canvas', async () => {
    const el = mount({
      ...STAGING,
      sizing: 'content',
      // Portrait wants (640 - 40) * 2 + 40 = 1240px — far above the clamp.
      'aspect-ratios': '1:2',
      style: 'width: 640px; max-height: 600px',
    });
    await el.updateComplete;

    await vi.waitFor(() => expect(el.getBoundingClientRect().height).toBeCloseTo(600, 0));
    expect(stageEl(el).getBoundingClientRect().height).toBeLessThan(600);

    // The frame letterboxes inside the clamped stage: it keeps the 1:2
    // ratio instead of stretching to the full width.
    const canvas = el.shadowRoot!.querySelector('uc-ai-canvas')!;
    const frame = canvas.shadowRoot!.querySelector('.canvas__frame') as HTMLElement;
    await vi.waitFor(() => {
      const rect = frame.getBoundingClientRect();
      expect(rect.height).toBeGreaterThan(0);
      expect(rect.width / rect.height).toBeCloseTo(0.5, 1);
      expect(rect.width).toBeLessThan(400);
    });
  });

  it('re-picks a sharper CDN preview when the host grows, keeping it when it shrinks', async () => {
    stubFetch({ uuid: SAMPLE_UUID });
    const el = mount({ ...STAGING, style: 'width: 500px; height: 480px' });
    await el.updateComplete;
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);

    const dpr = Math.max(window.devicePixelRatio, 1);
    const size = (bucket: number) => Math.min(Math.ceil(bucket * dpr), 3000);

    // A 500px-wide host lands in the 600px rendition bucket.
    await vi.waitFor(() => expect(canvasUrl(el)).toContain(`/preview/${size(600)}x${size(600)}/`));

    // Growing past the bucket steps the rendition up…
    el.style.width = '900px';
    await vi.waitFor(() => expect(canvasUrl(el)).toContain(`/preview/${size(1000)}x${size(1000)}/`));

    // …while shrinking keeps the sharper, already-cached one.
    el.style.width = '300px';
    await delay(120);
    expect(canvasUrl(el)).toContain(`/preview/${size(1000)}x${size(1000)}/`);
  });
});
