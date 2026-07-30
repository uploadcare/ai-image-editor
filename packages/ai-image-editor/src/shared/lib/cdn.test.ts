import { describe, expect, it, vi } from 'vitest';

import { CDN_MAX_OUTPUT_DIMENSION, cdnPreviewUrl, cdnSquareThumbUrl } from './cdn';

const UC_URL = 'https://ucarecd.net/6e44ba1c-67ad-4bcd-8e92-31eb56e7f3aa/';

describe('cdn helpers', () => {
  it('leaves non-Uploadcare urls untouched', () => {
    // Not a parseable CDN url (no uuid path segment) → returned as-is.
    expect(cdnPreviewUrl('https://example.com/image.png', 800)).toBe('https://example.com/image.png');
    expect(cdnSquareThumbUrl('https://example.com/image.png', 48)).toBe('https://example.com/image.png');
  });

  it('builds a dpr-scaled preview url capped at the CDN limit (resize directive only)', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    try {
      // Only the resize directive — the CDN applies format/auto + quality itself.
      expect(cdnPreviewUrl(UC_URL, 800)).toBe(`${UC_URL}-/preview/1600x1600/`);
      expect(cdnPreviewUrl(UC_URL, 2000)).toContain(`preview/${CDN_MAX_OUTPUT_DIMENSION}x${CDN_MAX_OUTPUT_DIMENSION}`);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('scales the preview by devicePixelRatio', () => {
    vi.stubGlobal('devicePixelRatio', 1);
    try {
      expect(cdnPreviewUrl(UC_URL, 800)).toBe(`${UC_URL}-/preview/800x800/`);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('builds a dpr-scaled centered square crop-to-fill thumbnail', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    try {
      // scale_crop (not preview) so a non-square source fills the square tile sharply.
      expect(cdnSquareThumbUrl(UC_URL, 48)).toBe(`${UC_URL}-/scale_crop/96x96/center/`);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
