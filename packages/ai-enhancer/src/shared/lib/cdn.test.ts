import { describe, expect, it, vi } from 'vitest';

import { CDN_MAX_OUTPUT_DIMENSION, cdnFullsizeUrl, cdnPreviewUrl, isUploadcareCdnUrl, withCdnOperations } from './cdn';

const UC_URL = 'https://ucarecd.net/6e44ba1c-67ad-4bcd-8e92-31eb56e7f3aa/';

describe('cdn helpers', () => {
  it('detects Uploadcare CDN urls by uuid path segment', () => {
    expect(isUploadcareCdnUrl(UC_URL)).toBe(true);
    expect(isUploadcareCdnUrl('https://example.com/image.png')).toBe(false);
  });

  it('appends operations to an Uploadcare url', () => {
    expect(withCdnOperations(UC_URL, 'format/auto', 'preview/800x800')).toBe(
      `${UC_URL}-/format/auto/-/preview/800x800/`,
    );
  });

  it('normalizes a missing trailing slash', () => {
    expect(withCdnOperations(UC_URL.slice(0, -1), 'format/auto')).toBe(`${UC_URL}-/format/auto/`);
  });

  it('leaves non-Uploadcare urls untouched', () => {
    expect(withCdnOperations('https://example.com/image.png', 'format/auto')).toBe('https://example.com/image.png');
    expect(cdnPreviewUrl('https://example.com/image.png', 800)).toBe('https://example.com/image.png');
  });

  it('builds a dpr-scaled preview url capped at the CDN limit', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    try {
      expect(cdnPreviewUrl(UC_URL, 800)).toBe(
        `${UC_URL}-/format/auto/-/progressive/yes/-/quality/lightest/-/preview/1600x1600/`,
      );
      expect(cdnPreviewUrl(UC_URL, 2000)).toContain(`preview/${CDN_MAX_OUTPUT_DIMENSION}x${CDN_MAX_OUTPUT_DIMENSION}`);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('uses normal quality on standard-density screens', () => {
    vi.stubGlobal('devicePixelRatio', 1);
    try {
      expect(cdnPreviewUrl(UC_URL, 800)).toContain('quality/normal');
      expect(cdnPreviewUrl(UC_URL, 800)).toContain('preview/800x800');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps the fullscreen rendition unscaled but delivery-optimized', () => {
    expect(cdnFullsizeUrl(UC_URL)).toBe(`${UC_URL}-/format/auto/-/progressive/yes/`);
  });
});
