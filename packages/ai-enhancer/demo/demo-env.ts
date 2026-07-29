/**
 * Environment + public-key wiring shared by the standalone and plugin demos.
 *
 * Both pages had their own copy of this; the plugin one had drifted (it never
 * applied an environment on first load, so the uploader started with an empty
 * `pubkey` until you changed the selector).
 *
 * The keys below are Uploadcare **public** keys for throwaway demo projects.
 * Public keys ship in client-side code by design — that is what makes the demos
 * work when opened from a link, with no query string to remember. Anything secret
 * still has no business here.
 */

export type EnvName = 'production' | 'staging';

export type DemoEnv = {
  pubkey: string;
  /** Set only where the SDK default is wrong; production needs no overrides. */
  baseUrl?: string;
  cdnCnamePrefixed?: string;
};

const ENV_STORAGE_KEY = 'uc-ai-demo-env';
const PUBKEY_STORAGE_KEY = 'uc-ai-demo-pubkey';

export const ENVIRONMENTS: Record<EnvName, DemoEnv> = {
  production: {
    pubkey: 'YOUR_PUBLIC_KEY',
  },
  staging: {
    pubkey: 'YOUR_PUBLIC_KEY',
    baseUrl: 'https://upload.example.com',
    cdnCnamePrefixed: 'https://cdn.example.com',
  },
};

const isEnvName = (value: string | null): value is EnvName => value === 'production' || value === 'staging';

/** The environment to start in: whatever was last chosen, else production. */
export function initialEnv(): EnvName {
  const saved = localStorage.getItem(ENV_STORAGE_KEY);
  return isEnvName(saved) ? saved : 'production';
}

export function rememberEnv(name: EnvName): void {
  localStorage.setItem(ENV_STORAGE_KEY, name);
}

/**
 * The key to use for `env`: an explicit override wins over the environment's
 * default, so `?pubkey=…` still works and a key typed into a demo sticks.
 *
 * The override is deliberately not per-environment — one typed key applies to
 * whichever environment you switch to, which is what you want when testing your
 * own project against staging.
 */
export function resolvePubkey(env: EnvName): string {
  const fromUrl = new URLSearchParams(location.search).get('pubkey');
  return fromUrl || localStorage.getItem(PUBKEY_STORAGE_KEY) || ENVIRONMENTS[env].pubkey;
}

/** Persist a key typed into a demo, or forget it when the field is cleared. */
export function rememberPubkey(pubkey: string): void {
  if (pubkey) {
    localStorage.setItem(PUBKEY_STORAGE_KEY, pubkey);
  } else {
    localStorage.removeItem(PUBKEY_STORAGE_KEY);
  }
}
