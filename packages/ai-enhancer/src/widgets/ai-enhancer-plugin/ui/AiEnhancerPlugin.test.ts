import { describe, expect, it, vi } from 'vitest';
import { aspectRatiosFromCropPreset } from './AiEnhancerPlugin';

describe('aspectRatiosFromCropPreset', () => {
  it('returns null when cropPreset is empty', () => {
    expect(aspectRatiosFromCropPreset('')).toBeNull();
  });

  it('parses a list of "w:h" ratios', () => {
    expect(aspectRatiosFromCropPreset('16:9,1:1,9:16')).toEqual([
      [16, 9],
      [1, 1],
      [9, 16],
    ]);
  });

  it('drops invalid ratios, warning on each', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(aspectRatiosFromCropPreset('16:9, 0:1, 1:1')).toEqual([
      [16, 9],
      [1, 1],
    ]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('falls back to the popular set when only "free" is configured', () => {
    const result = aspectRatiosFromCropPreset('free');
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(0);
    expect(result).toEqual(expect.arrayContaining([[1, 1]]));
  });

  it('respects specific ratios when both "free" and ratios are present', () => {
    expect(aspectRatiosFromCropPreset('free, 16:9, 1:1')).toEqual([
      [16, 9],
      [1, 1],
    ]);
  });
});
