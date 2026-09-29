import { describe, expect, it } from 'vitest';
import type { AuthErrorCode } from '@uploadcare/upload-client';
import { CLIENT_ERROR_CODES, type KnownErrorCode, KNOWN_ERROR_CODES } from '../lib/errorCodes';
import { enLocale } from './en';
import { translate } from './translate';

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
 * The editor renders `ai-image-editor-error-<code>` when one exists and the
 * generic message otherwise, so a known code with no entry would silently
 * degrade to "Something went wrong" — which is what these guard.
 */
describe('per-error-code messages', () => {
  it('gives every known error code its own message', () => {
    const codes = [...KNOWN_ERROR_CODES, ...CLIENT_ERROR_CODES];
    const missing = codes.filter((code) => !(`ai-image-editor-error-${code}` in enLocale));
    expect(missing).toEqual([]);
  });

  it('knows every auth code upload-client can raise', () => {
    // Type-level: a sixth auth code upstream leaves this unassignable, and the
    // build fails here rather than the code reaching a visitor as the generic
    // "something went wrong" with no mention of reloading.
    type UnlistedAuthCode = Exclude<AuthErrorCode, KnownErrorCode>;
    const everyAuthCodeIsListed: [UnlistedAuthCode] extends [never] ? true : UnlistedAuthCode = true;
    expect(everyAuthCodeIsListed).toBe(true);
  });

  it('says the same thing for every auth token failure', () => {
    // They differ only in what the integrator has to fix; the visitor gets one
    // line, and reloading is the whole of the advice.
    const messages = new Set(
      [
        'AccessTokenInvalidError',
        'AccessTokenExpiredError',
        'ScopeForbiddenError',
        'OperationsLimitExceededError',
        'SignatureRequiredError',
        'auth_token_failed',
      ].map((code) => translate(`ai-image-editor-error-${code}` as keyof typeof enLocale)),
    );
    expect([...messages]).toEqual(['Something went wrong. Please reload the page and try again.']);
  });

  it('says nothing about projects, keys, accounts or tokens', () => {
    const jargon = /\b(project|public key|account|plan|token|session|scope|job|canvas|source)\b/i;
    const leaking = Object.entries(enLocale)
      .filter(([key]) => key.startsWith('ai-image-editor-error'))
      .filter(([, message]) => jargon.test(message));
    expect(leaking).toEqual([]);
  });

  it('resolves a setup failure to its own message, not the generic one', () => {
    const message = translate('ai-image-editor-error-derivative_disabled');
    expect(message).not.toBe(enLocale['ai-image-editor-error']);
  });

  it('still allows a locale to override a per-code message', () => {
    expect(
      translate('ai-image-editor-error-derivative_disabled', {
        'ai-image-editor-error-derivative_disabled': 'Bild-Generierung ist nicht verfügbar.',
      }),
    ).toBe('Bild-Generierung ist nicht verfügbar.');
  });
});
