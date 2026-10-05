import { AuthTokenCache } from '@uploadcare/signed-uploads/client';
import { isAuthTokenResolver, normalizeAuthToken } from '@uploadcare/upload-client';
import type { AuthToken, AuthTokenProvider } from '@uploadcare/upload-client';

/** What the controller reads back from the element, each time it is asked. */
type AuthTokenSource = {
  readonly authToken?: AuthToken;
  readonly cacheAuthToken: boolean;
};

/**
 * Turns the element's `authToken` option into the one value the provider is
 * given, and owns the cache behind it.
 *
 * The provider is built once and reads the option when it is called, so a
 * token that changes, including the new closure a React parent produces on
 * every render, needs nothing pushed anywhere, and the API client is not
 * rebuilt for a new token value.
 */
export class AuthTokenController {
  private _cache?: AuthTokenCache;

  /**
   * Handed to the API client as `authToken`. The object form, so whoever
   * holds it can drop a token the Upload API refuses rather than only read
   * one.
   *
   * Nothing here acts on a refusal by itself: the editor's own requests are
   * one-shot fetches that raise the error and stop, so recovering a spent
   * token takes an `invalidateAuthToken()` call from the host or the
   * integrator. upload-client's retry applies to uploads, which this client
   * does not make.
   */
  public readonly provider: AuthTokenProvider = {
    getToken: () => this._resolve(),
    invalidate: () => this.invalidate(),
  };

  public constructor(private readonly _source: AuthTokenSource) {}

  /**
   * Drop the cached token, so the next request asks for a new one.
   *
   * Assigning a different function to `authToken` does not do this on its
   * own: a new function identity is taken to be the same function, which is
   * what lets a parent component pass an inline one without refetching on
   * every render.
   */
  public invalidate(): void {
    this._cache?.invalidate();

    // A provider passed in keeps its own token, so it is the only thing that
    // can drop that one. Inside the File Uploader this reaches the uploader's
    // cache.
    const { authToken } = this._source;
    if (isAuthTokenResolver(authToken)) {
      normalizeAuthToken(authToken).invalidate?.();
    }
  }

  private _resolve(): string | Promise<string> {
    // Resolves even a plain token, so the provider holds one thing while a
    // token is set.
    const { authToken, cacheAuthToken } = this._source;

    // Only a job that started with a token and is still running when the
    // token is unset gets here; the API client is rebuilt without one.
    if (!authToken) {
      return Promise.reject(new Error('`authToken` was unset while a request still needed it'));
    }
    if (typeof authToken === 'string') return authToken;
    // Someone else's provider, the File Uploader plugin's among them: it owns
    // the caching and the invalidation, so this one does neither.
    if (typeof authToken === 'object') return authToken.getToken();
    if (!cacheAuthToken) return authToken();

    // Swapping `fetchToken` keeps the token a new closure would discard.
    if (this._cache) {
      this._cache.fetchToken = authToken;
    } else {
      this._cache = new AuthTokenCache({ fetchToken: authToken });
    }
    return this._cache.getToken();
  }
}
