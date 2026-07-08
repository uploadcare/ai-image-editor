import type { ReactiveController, ReactiveControllerHost } from 'lit';

import { resolveSecureDeliveryUrl, type SecureDeliveryProxyUrlResolver } from './secureDelivery';

/**
 * Resolves CDN urls to their secure-delivery urls for a host element, caching
 * results. {@link resolve} returns synchronously when no resolver is set,
 * already cached, or the resolver is synchronous; for an async resolver it
 * returns `null` while pending, then caches and requests an update.
 */
export class SecureUrlController implements ReactiveController {
  private _resolver?: SecureDeliveryProxyUrlResolver;
  private readonly _host: ReactiveControllerHost;
  private readonly _cache = new Map<string, string>();
  /** Urls with an async resolution in flight, so we don't dispatch duplicates. */
  private readonly _pending = new Set<string>();

  public constructor(host: ReactiveControllerHost) {
    this._host = host;
    host.addController(this);
  }

  public hostDisconnected(): void {
    this._cache.clear();
    this._pending.clear();
  }

  /** Point at a new resolver; clears the cache since the signing changed. */
  public setResolver(resolver: SecureDeliveryProxyUrlResolver | undefined): void {
    this._resolver = resolver;
    this._cache.clear();
    this._pending.clear();
    this._host.requestUpdate();
  }

  /** The delivery url for `url`, or `null` while an async resolver is pending. */
  public resolve(url: string | null): string | null {
    if (!url || !this._resolver) return url;
    const cached = this._cache.get(url);
    if (cached !== undefined) return cached;
    // Already resolving (a concurrent re-render) — don't dispatch a duplicate.
    if (this._pending.has(url)) return null;

    const result = resolveSecureDeliveryUrl(url, this._resolver);
    if (typeof result === 'string') {
      this._cache.set(url, result);
      return result;
    }
    this._pending.add(url);
    void result
      .then((secured) => this._cache.set(url, secured))
      // On failure fall back to the raw url so the image can still attempt to load.
      .catch(() => this._cache.set(url, url))
      .finally(() => {
        this._pending.delete(url);
        this._host.requestUpdate();
      });
    return null;
  }
}
