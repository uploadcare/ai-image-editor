import { errorMessageGroup } from '../lib/errorCodes';
import { enLocale } from './en';

export function translate(key: keyof typeof enLocale, overrides?: Partial<typeof enLocale>): string {
  return overrides?.[key] ?? enLocale[key];
}

/**
 * The locale key holding the message for an error code: the shared key of its
 * group when it has one, its own otherwise. The returned key often does not
 * exist — codes with nothing useful to say, and codes the frontend has never
 * heard of, both land on a missing key and the caller falls back to the
 * generic `ai-image-editor-error`.
 */
export function errorLocaleKey(code: string): string {
  const group = errorMessageGroup(code);
  return group ? `ai-image-editor-error-${group}` : `ai-image-editor-error-${code}`;
}
