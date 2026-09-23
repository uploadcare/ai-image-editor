import { describe, expect, it } from 'vitest';
import { AUTH_ERROR_CODES, CLIENT_ERROR_CODES, KNOWN_ERROR_CODES } from '../lib/errorCodes';
import { enLocale } from './en';
import { errorLocaleKey, translate } from './translate';

describe('translate', () => {
  it('returns the en locale value when no overrides are provided', () => {
    expect(translate('ai-image-editor-cancel')).toBe(enLocale['ai-image-editor-cancel']);
  });

  it('returns the override value when provided', () => {
    expect(translate('ai-image-editor-cancel', { 'ai-image-editor-cancel': 'Zurück' })).toBe('Zurück');
  });

  it('falls back to the en locale when the override does not have the key', () => {
    expect(translate('ai-image-editor-generate-btn', { 'ai-image-editor-cancel': 'Zurück' })).toBe(
      enLocale['ai-image-editor-generate-btn'],
    );
  });

  it('handles an undefined overrides argument', () => {
    expect(translate('ai-image-editor-busy', undefined)).toBe(enLocale['ai-image-editor-busy']);
  });
});

/**
 * The editor renders `ai-image-editor-error-<code>` when one exists and the generic
 * message otherwise, so a known code without an entry here would silently degrade
 * to "Something went wrong" — which is exactly what these guard.
 */
describe('per-error-code messages', () => {
  it('gives every known error code a message', () => {
    const codes = [...KNOWN_ERROR_CODES, ...CLIENT_ERROR_CODES];
    const missing = codes.filter((code) => !(errorLocaleKey(code) in enLocale));
    expect(missing).toEqual([]);
  });

  it('collapses every auth token code onto one message', () => {
    const keys = new Set(AUTH_ERROR_CODES.map(errorLocaleKey));
    expect([...keys]).toEqual(['ai-image-editor-error-auth']);
    expect(translate('ai-image-editor-error-auth')).not.toBe(enLocale['ai-image-editor-error']);
  });

  it('resolves an invalid public key to an actionable message, not the generic one', () => {
    const message = translate('ai-image-editor-error-ProjectPublicKeyInvalidError');
    expect(message).not.toBe(enLocale['ai-image-editor-error']);
    expect(message).toMatch(/public key/i);
  });

  it('still allows a locale to override a per-code message', () => {
    expect(
      translate('ai-image-editor-error-ProjectPublicKeyInvalidError', {
        'ai-image-editor-error-ProjectPublicKeyInvalidError': 'Schlüssel ungültig.',
      }),
    ).toBe('Schlüssel ungültig.');
  });
});
