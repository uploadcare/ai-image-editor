/**
 * Secure (signed) CDN delivery, mirroring the file-uploader's
 * `secureDeliveryProxyUrlResolver` and the planned `@uploadcare/cdn-url`
 * helper — swap to that export once it ships.
 *
 * Signing needs a secret key, so it never happens in the browser: the consumer
 * supplies a resolver callback that returns the signed/proxied delivery url
 * (typically from their backend).
 * @see https://uploadcare.com/docs/security/secure-delivery/
 */
import { parseCdnUrl, serializeOperations } from '@uploadcare/cdn-url';

/** Parts of the source CDN url handed to a {@link SecureDeliveryProxyUrlResolver}. */
export type SecureDeliveryUrlParts = { uuid: string; cdnUrlModifiers: string; fileName: string };

/** Consumer callback that turns a CDN url into a signed/proxied delivery url. */
export type SecureDeliveryProxyUrlResolver = (
  previewUrl: string,
  urlParts: SecureDeliveryUrlParts,
) => string | Promise<string>;

function urlPartsOf(url: string): SecureDeliveryUrlParts {
  try {
    const parsed = parseCdnUrl(url);
    if (parsed.kind === 'file') {
      return { uuid: parsed.uuid, cdnUrlModifiers: serializeOperations(parsed.operations), fileName: parsed.filename ?? '' };
    }
  } catch {
    // Not a CDN url — hand the resolver empty parts (it still gets the url).
  }
  return { uuid: '', cdnUrlModifiers: '', fileName: '' };
}

/**
 * Resolve a CDN url to its delivery url via the resolver, or return it
 * unchanged when no resolver is set. Returns synchronously when the resolver
 * is synchronous.
 */
export function resolveSecureDeliveryUrl(
  url: string,
  resolver: SecureDeliveryProxyUrlResolver | undefined,
): string | Promise<string> {
  return resolver ? resolver(url, urlPartsOf(url)) : url;
}
