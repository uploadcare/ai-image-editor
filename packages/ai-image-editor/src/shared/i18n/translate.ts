import { isAuthErrorCode } from '../lib/errorCodes';
import { enLocale } from './en';

export function translate(key: keyof typeof enLocale, overrides?: Partial<typeof enLocale>): string {
  return overrides?.[key] ?? enLocale[key];
}

/**
 * The locale key holding the message for an error code. Every auth token code
 * collapses onto the single `ai-image-editor-error-auth` key; the rest get
 * their own. The returned key may not exist (unknown or untranslated codes) —
 * the caller falls back to the generic `ai-image-editor-error`.
 */
export function errorLocaleKey(code: string): string {
  return isAuthErrorCode(code) ? 'ai-image-editor-error-auth' : `ai-image-editor-error-${code}`;
}
