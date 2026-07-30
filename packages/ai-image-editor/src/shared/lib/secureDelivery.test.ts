import { describe, expect, it, vi } from 'vitest';

import { resolveSecureDeliveryUrl } from './secureDelivery';

const UC_URL = 'https://ucarecd.net/6e44ba1c-67ad-4bcd-8e92-31eb56e7f3aa/-/preview/800x800/';

describe('resolveSecureDeliveryUrl', () => {
  it('returns the url unchanged with no resolver', () => {
    expect(resolveSecureDeliveryUrl(UC_URL, undefined)).toBe(UC_URL);
  });

  it('calls the resolver with the url + parsed parts', () => {
    const resolver = vi.fn(() => 'https://signed.example/x');
    expect(resolveSecureDeliveryUrl(UC_URL, resolver)).toBe('https://signed.example/x');
    expect(resolver).toHaveBeenCalledWith(UC_URL, {
      uuid: '6e44ba1c-67ad-4bcd-8e92-31eb56e7f3aa',
      cdnUrlModifiers: '-/preview/800x800/',
      fileName: '',
    });
  });

  it('hands the resolver empty parts for a non-CDN url', () => {
    const resolver = vi.fn((u: string) => u);
    void resolveSecureDeliveryUrl('https://example.com/image.png', resolver);
    expect(resolver).toHaveBeenCalledWith('https://example.com/image.png', {
      uuid: '',
      cdnUrlModifiers: '',
      fileName: '',
    });
  });

  it('returns a promise for an async resolver', async () => {
    const out = resolveSecureDeliveryUrl(UC_URL, async () => 'https://async/x');
    expect(out).toBeInstanceOf(Promise);
    expect(await out).toBe('https://async/x');
  });
});
