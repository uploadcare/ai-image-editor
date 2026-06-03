/**
 * Minimal Uploadcare CDN URL helpers, mirroring the file-uploader's cdn-utils.
 * @see https://uploadcare.com/docs/transformations/image/resize-crop/
 */

/** The CDN refuses output dimensions above this (per side). */
export const CDN_MAX_OUTPUT_DIMENSION = 3000;

/** Matches an Uploadcare CDN file URL: `https://<cdn>/<uuid>/...`. */
const UC_CDN_URL_RE = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/|$)/i;

export function isUploadcareCdnUrl(url: string): boolean {
  return UC_CDN_URL_RE.test(url);
}

/**
 * Appends transformation operations (e.g. `format/auto`, `preview/800x800`)
 * to an Uploadcare CDN URL. Non-Uploadcare URLs are returned untouched.
 */
export function withCdnOperations(url: string, ...operations: string[]): string {
  if (!isUploadcareCdnUrl(url)) return url;
  const ops = operations.filter(Boolean);
  if (ops.length === 0) return url;
  const base = url.endsWith('/') ? url : `${url}/`;
  return `${base}${ops.map((op) => `-/${op}/`).join('')}`;
}

/**
 * Optimized delivery for an on-screen preview: modern format, progressive
 * loading, DPR-aware quality, and a proportional downscale to the given CSS
 * size (scaled by devicePixelRatio, capped by the CDN limit).
 */
export function cdnPreviewUrl(url: string, cssSize: number): string {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  const size = Math.min(Math.ceil(cssSize * Math.max(dpr, 1)), CDN_MAX_OUTPUT_DIMENSION);
  // High-DPI screens hide compression artifacts; trade quality for weight.
  const quality = dpr >= 2 ? 'lightest' : 'normal';
  return withCdnOperations(url, 'format/auto', 'progressive/yes', `quality/${quality}`, `preview/${size}x${size}`);
}

/** Full-quality rendition for the fullscreen view (still delivery-optimized). */
export function cdnFullsizeUrl(url: string): string {
  return withCdnOperations(url, 'format/auto', 'progressive/yes');
}
