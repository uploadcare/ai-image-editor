import { describe, expect, it } from 'vitest';
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
