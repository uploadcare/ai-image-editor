/**
 * Public key + upload API wiring shared by the standalone and plugin demos.
 *
 * No project key is committed here: this repo is public, and a baked-in key is
 * someone's quota. These fields are editable in the demo toolbar, persist to
 * localStorage, and accept a `?pubkey=…` / `?baseUrl=…` / `?cdnCname=…` /
 * `?cdnCnamePrefixed=…` override so a link can carry them.
 */

/** Uploadcare's production upload API — the SDK default, surfaced so it's editable. */
export const DEFAULT_BASE_URL = 'https://upload.uploadcare.com';

/**
 * Uploadcare's production CDN — the SDK default. Left at this value the editor
 * derives the real base from the public key, same as the file uploader's
 * `cdnCname`, so point it elsewhere only for a custom cname or a test CDN.
 */
export const DEFAULT_CDN_CNAME = 'https://ucarecdn.com';

/**
 * The base the public-key-prefixed CDN hostname is built on
 * (`<pubkey>.ucarecd.net`) — the SDK default, and what results actually load
 * from while `cdnCname` is left alone.
 */
export const DEFAULT_CDN_CNAME_PREFIXED = 'https://ucarecd.net';

/** Placeholder, not a key: the demos need one entered before they can generate. */
export const DEFAULT_PUBKEY = 'YOUR_PUBLIC_KEY';

const PUBKEY_STORAGE_KEY = 'uc-ai-demo-pubkey';
const BASE_URL_STORAGE_KEY = 'uc-ai-demo-base-url';
const CDN_CNAME_STORAGE_KEY = 'uc-ai-demo-cdn-cname';
const CDN_CNAME_PREFIXED_STORAGE_KEY = 'uc-ai-demo-cdn-cname-prefixed';
const AUTH_TOKEN_STORAGE_KEY = 'uc-ai-demo-auth-token';

/** URL param wins over a remembered value, which wins over the default. */
function resolve(param: string, storageKey: string, fallback: string): string {
  const fromUrl = new URLSearchParams(location.search).get(param);
  return fromUrl || localStorage.getItem(storageKey) || fallback;
}

function remember(storageKey: string, value: string): void {
  if (value) {
    localStorage.setItem(storageKey, value);
  } else {
    localStorage.removeItem(storageKey);
  }
}

export const resolvePubkey = (): string => resolve('pubkey', PUBKEY_STORAGE_KEY, DEFAULT_PUBKEY);
export const resolveBaseUrl = (): string => resolve('baseUrl', BASE_URL_STORAGE_KEY, DEFAULT_BASE_URL);
export const resolveCdnCname = (): string => resolve('cdnCname', CDN_CNAME_STORAGE_KEY, DEFAULT_CDN_CNAME);
export const resolveCdnCnamePrefixed = (): string =>
  resolve('cdnCnamePrefixed', CDN_CNAME_PREFIXED_STORAGE_KEY, DEFAULT_CDN_CNAME_PREFIXED);

/**
 * A token for a project with signed uploads enabled. Empty means send none,
 * which is what a project without the feature wants.
 *
 * Deliberately not readable from the URL, unlike the two above: a token is a
 * bearer credential, and a link carrying one would leak it through history,
 * bookmarks and referrers. Mint a short-lived one for the demo.
 */
export const resolveAuthToken = (): string => localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || '';

/** Persist a value typed into a demo field, or forget it when the field is cleared. */
export const rememberPubkey = (pubkey: string): void => remember(PUBKEY_STORAGE_KEY, pubkey);
export const rememberBaseUrl = (baseUrl: string): void => remember(BASE_URL_STORAGE_KEY, baseUrl);
export const rememberCdnCname = (cdnCname: string): void => remember(CDN_CNAME_STORAGE_KEY, cdnCname);
export const rememberCdnCnamePrefixed = (cdnCnamePrefixed: string): void =>
  remember(CDN_CNAME_PREFIXED_STORAGE_KEY, cdnCnamePrefixed);
export const rememberAuthToken = (authToken: string): void => remember(AUTH_TOKEN_STORAGE_KEY, authToken);
