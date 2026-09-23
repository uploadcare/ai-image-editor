import { describe, expect, it } from 'vitest';
import { CODES_WITH_OWN_MESSAGE, ERROR_MESSAGE_GROUPS } from '../lib/errorCodes';
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
 * The editor renders the message `errorLocaleKey` points at, or the generic
 * `ai-image-editor-error` when that key doesn't exist. Which codes get their
 * own line is a deliberate choice, so these pin both halves of it.
 */
describe('per-error-code messages', () => {
  it('has a message for every grouped code', () => {
    const codes = Object.values(ERROR_MESSAGE_GROUPS).flat();
    const missing = codes.filter((code) => !(errorLocaleKey(code) in enLocale));
    expect(missing).toEqual([]);
  });

  it('has a message for every code that keeps one of its own', () => {
    const missing = CODES_WITH_OWN_MESSAGE.filter((code) => !(errorLocaleKey(code) in enLocale));
    expect(missing).toEqual([]);
  });

  it('collapses a group onto one message', () => {
    const keys = new Set(ERROR_MESSAGE_GROUPS.auth.map(errorLocaleKey));
    expect([...keys]).toEqual(['ai-image-editor-error-auth']);
    expect(translate('ai-image-editor-error-auth')).not.toBe(enLocale['ai-image-editor-error']);
  });

  it('leaves a code with nothing useful to add on the generic message', () => {
    // `job_not_found` and friends have no advice beyond "try again", which is
    // what the generic message already says.
    expect(errorLocaleKey('job_not_found') in enLocale).toBe(false);
  });

  it('says nothing about projects, keys, accounts or tokens', () => {
    const jargon = /\b(project|public key|account|plan|token|session|scope|job|canvas|source)\b/i;
    const leaking = Object.entries(enLocale)
      .filter(([key]) => key.startsWith('ai-image-editor-error'))
      .filter(([, message]) => jargon.test(message));
    expect(leaking).toEqual([]);
  });

  it('resolves a setup failure to its own message, not the generic one', () => {
    const message = translate('ai-image-editor-error-setup');
    expect(message).not.toBe(enLocale['ai-image-editor-error']);
  });

  it('still allows a locale to override a shared message', () => {
    expect(
      translate('ai-image-editor-error-setup', {
        'ai-image-editor-error-setup': 'Bild-Generierung ist nicht verfügbar.',
      }),
    ).toBe('Bild-Generierung ist nicht verfügbar.');
  });
});
