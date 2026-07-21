import { describe, expect, it } from 'vitest';
import {
  aspectRatioEquals,
  aspectRatioKey,
  aspectRatioValueEquals,
  AUTO_RATIO,
  isConcreteRatio,
  isValidAspectRatio,
  labelKeyForRatio,
  POPULAR_ASPECT_RATIOS,
  parseAspectRatioList,
  toAspectRatioOption,
} from './aspect-ratio';

describe('isValidAspectRatio', () => {
  it.each<[readonly [number, number], boolean]>([
    [[1, 1], true],
    [[16, 9], true],
    [[9, 16], true],
    [[1, 10], true],
    [[10, 1], true],
  ])('accepts %s', (ratio, expected) => {
    expect(isValidAspectRatio(ratio)).toBe(expected);
  });

  it.each<[readonly [number, number], string]>([
    [[0, 1], 'zero width'],
    [[1, 0], 'zero height'],
    [[-1, 2], 'negative'],
    [[Number.NaN, 1], 'NaN'],
    [[1, Number.POSITIVE_INFINITY], 'Infinity'],
    [[1, 11], 'below min (1/11 < 0.1)'],
    [[11, 1], 'above max (11 > 10)'],
  ])('rejects %s (%s)', (ratio) => {
    expect(isValidAspectRatio(ratio)).toBe(false);
  });
});

describe('aspectRatioKey', () => {
  it('formats as "w:h"', () => {
    expect(aspectRatioKey([16, 9])).toBe('16:9');
    expect(aspectRatioKey([1, 1])).toBe('1:1');
  });
});

describe('labelKeyForRatio', () => {
  it('returns the matching key for known ratios', () => {
    expect(labelKeyForRatio([1, 1])).toBe('ai-enhancer-aspect-square');
    expect(labelKeyForRatio([16, 9])).toBe('ai-enhancer-aspect-widescreen');
    expect(labelKeyForRatio([9, 16])).toBe('ai-enhancer-aspect-vertical');
  });

  it('returns null for unknown ratios', () => {
    expect(labelKeyForRatio([7, 3])).toBeNull();
  });
});

describe('toAspectRatioOption', () => {
  it('packs the ratio with its label key', () => {
    expect(toAspectRatioOption([1, 1])).toEqual({ value: [1, 1], labelKey: 'ai-enhancer-aspect-square' });
    expect(toAspectRatioOption([7, 3])).toEqual({ value: [7, 3], labelKey: null });
  });
});

describe('isConcreteRatio', () => {
  it('is true for a ratio tuple, false for the Auto sentinel and null', () => {
    expect(isConcreteRatio([16, 9])).toBe(true);
    expect(isConcreteRatio(AUTO_RATIO)).toBe(false);
    expect(isConcreteRatio(null)).toBe(false);
  });
});

describe('aspectRatioValueEquals', () => {
  it('compares concrete ratios and the Auto sentinel', () => {
    expect(aspectRatioValueEquals([1, 1], [1, 1])).toBe(true);
    expect(aspectRatioValueEquals([1, 1], [16, 9])).toBe(false);
    expect(aspectRatioValueEquals(AUTO_RATIO, AUTO_RATIO)).toBe(true);
    expect(aspectRatioValueEquals(AUTO_RATIO, [1, 1])).toBe(false);
    expect(aspectRatioValueEquals([1, 1], AUTO_RATIO)).toBe(false);
  });
});

describe('parseAspectRatioList', () => {
  it('parses a comma-separated list', () => {
    expect(parseAspectRatioList('16:9, 5:4, 1:1')).toEqual([
      [16, 9],
      [5, 4],
      [1, 1],
    ]);
  });

  it('parses a space-separated list', () => {
    expect(parseAspectRatioList('16:9 1:1')).toEqual([
      [16, 9],
      [1, 1],
    ]);
  });

  it('drops invalid entries', () => {
    expect(parseAspectRatioList('16:9, free, 0:1, 11:1, 5:4')).toEqual([
      [16, 9],
      [5, 4],
    ]);
  });

  it('returns an empty list for an empty input', () => {
    expect(parseAspectRatioList('')).toEqual([]);
    expect(parseAspectRatioList('   ')).toEqual([]);
  });
});

describe('aspectRatioEquals', () => {
  it('is true when both components match', () => {
    expect(aspectRatioEquals([16, 9], [16, 9])).toBe(true);
  });

  it('is false otherwise', () => {
    expect(aspectRatioEquals([16, 9], [9, 16])).toBe(false);
  });
});

describe('POPULAR_ASPECT_RATIOS', () => {
  it('contains only valid ratios', () => {
    for (const ratio of POPULAR_ASPECT_RATIOS) {
      expect(isValidAspectRatio(ratio)).toBe(true);
    }
  });

  it('contains 1:1', () => {
    expect(POPULAR_ASPECT_RATIOS.some(([w, h]) => w === 1 && h === 1)).toBe(true);
  });
});
