/**
 * Public key + upload API wiring shared by the standalone and plugin demos.
 *
 * No project key is committed here: this repo is public, and a baked-in key is
 * someone's quota. Both fields are editable in the demo toolbar, persist to
 * localStorage, and accept a `?pubkey=…` / `?baseUrl=…` override so a link can
 * carry them.
 */

/** Uploadcare's production upload API — the SDK default, surfaced so it's editable. */
export const DEFAULT_BASE_URL = 'https://upload.uploadcare.com';

/** Placeholder, not a key: the demos need one entered before they can generate. */
export const DEFAULT_PUBKEY = 'YOUR_PUBLIC_KEY';

const PUBKEY_STORAGE_KEY = 'uc-ai-demo-pubkey';
const BASE_URL_STORAGE_KEY = 'uc-ai-demo-base-url';

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

/** Persist a value typed into a demo field, or forget it when the field is cleared. */
export const rememberPubkey = (pubkey: string): void => remember(PUBKEY_STORAGE_KEY, pubkey);
export const rememberBaseUrl = (baseUrl: string): void => remember(BASE_URL_STORAGE_KEY, baseUrl);
