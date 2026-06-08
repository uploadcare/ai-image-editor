/**
 * Uploadcare CDN transformation URLs, built with `@uploadcare/cdn-url`.
 *
 * We emit only the resize directive (`preview` / `scale_crop`); the CDN applies
 * `format/auto` and adaptive quality automatically.
 * @see https://uploadcare.com/docs/transformations/image/resize-crop/
 */
import type { CdnOperation } from '@uploadcare/cdn-url';
import { CdnUrl } from '@uploadcare/cdn-url/builder';
import { preview, scaleCrop } from '@uploadcare/cdn-url/ops';

/** The CDN refuses output dimensions above this (per side). */
export const CDN_MAX_OUTPUT_DIMENSION = 3000;

/** DPR-aware target size in CDN pixels, capped by the CDN limit. */
function scaledSize(cssSize: number): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  return Math.min(Math.ceil(cssSize * Math.max(dpr, 1)), CDN_MAX_OUTPUT_DIMENSION);
}

/** Append CDN operations to a URL, leaving non-CDN URLs untouched. */
function withOps(url: string, operations: CdnOperation[]): string {
  if (operations.length === 0) return url;
  try {
    return CdnUrl.parse(url).with(...operations).href;
  } catch {
    // Not a parseable Uploadcare CDN URL — return it as-is.
    return url;
  }
}

/**
 * Optimized on-screen preview: a proportional downscale to the given CSS size
 * (scaled by devicePixelRatio, capped by the CDN limit).
 */
export function cdnPreviewUrl(url: string, cssSize: number): string {
  const size = scaledSize(cssSize);
  return withOps(url, [preview(size, size)]);
}

/**
 * Square thumbnail that fills a fixed `object-fit: cover` box: crops to a
 * centered square so non-square sources stay sharp instead of being upscaled.
 */
export function cdnSquareThumbUrl(url: string, cssSize: number): string {
  const size = scaledSize(cssSize);
  return withOps(url, [scaleCrop(size, size, { align: 'center' })]);
}
