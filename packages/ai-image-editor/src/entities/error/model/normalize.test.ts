import { describe, expect, it } from 'vitest';
import { AiProviderError } from '../../provider';
import { normalizeError } from './normalize';
import { AiImageEditorError } from './types';

describe('normalizeError', () => {
  it('maps AiProviderError code/source and keeps the original on cause', () => {
    const original = new AiProviderError('content_moderated', 'Blocked by moderation', 'gateway');
    const normalized = normalizeError(original);
    expect(normalized).toBeInstanceOf(AiImageEditorError);
    expect(normalized.code).toBe('content_moderated');
    expect(normalized.source).toBe('gateway');
    expect(normalized.message).toBe('Blocked by moderation');
    expect(normalized.cause).toBe(original);
  });

  it('wraps a plain Error with the unknown code', () => {
    const original = new Error('fetch failed');
    const normalized = normalizeError(original);
    expect(normalized.code).toBe('unknown');
    expect(normalized.message).toBe('fetch failed');
    expect(normalized.cause).toBe(original);
    expect(normalized.source).toBeUndefined();
  });

  it.each([
    ['a string', 'provider exploded', 'provider exploded'],
    ['an empty string', '', 'Generation failed'],
    ['undefined', undefined, 'Generation failed'],
    ['a plain object', { reason: 'nope' }, 'Generation failed'],
  ])('wraps %s thrown by a custom provider', (_name, thrown, expectedMessage) => {
    const normalized = normalizeError(thrown);
    expect(normalized).toBeInstanceOf(AiImageEditorError);
    expect(normalized.code).toBe('unknown');
    expect(normalized.message).toBe(expectedMessage);
    expect(normalized.cause).toBe(thrown);
  });

  it('is idempotent for an already-normalized error', () => {
    const error = new AiImageEditorError('boom', { code: 'invalid_request' });
    expect(normalizeError(error)).toBe(error);
  });
});
