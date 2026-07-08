import { describe, expect, it } from 'vitest';
import { enLocale } from './en';
import { translate } from './translate';

describe('translate', () => {
  it('returns the en locale value when no overrides are provided', () => {
    expect(translate('ai-enhancer-cancel')).toBe(enLocale['ai-enhancer-cancel']);
  });

  it('returns the override value when provided', () => {
    expect(translate('ai-enhancer-cancel', { 'ai-enhancer-cancel': 'Zurück' })).toBe('Zurück');
  });

  it('falls back to the en locale when the override does not have the key', () => {
    expect(translate('ai-enhancer-generate-btn', { 'ai-enhancer-cancel': 'Zurück' })).toBe(
      enLocale['ai-enhancer-generate-btn'],
    );
  });

  it('handles an undefined overrides argument', () => {
    expect(translate('ai-enhancer-busy', undefined)).toBe(enLocale['ai-enhancer-busy']);
  });
});
