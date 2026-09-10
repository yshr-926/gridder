import { describe, expect, it } from 'vitest';
import { estimateLabelWidth } from './labelWidth';

describe('estimateLabelWidth', () => {
  it('test_estimateLabelWidth_latin_isSixTenthsEmPerCharacter', () => {
    expect(estimateLabelWidth('Kitchen', 10)).toBeCloseTo(7 * 6);
  });

  it('test_estimateLabelWidth_kana_isOneEmPerCharacter', () => {
    expect(estimateLabelWidth('リビング', 10)).toBeCloseTo(40);
  });

  it('test_estimateLabelWidth_mixedDimensionLabel_countsWideCharactersFully_issue67', () => {
    // "6 セル × 9 セル": 4 wide + 7 narrow characters (the "×" is Latin-1).
    expect(estimateLabelWidth('6 セル × 9 セル', 10)).toBeCloseTo(4 * 10 + 7 * 6);
  });

  it('test_estimateLabelWidth_empty_isZero', () => {
    expect(estimateLabelWidth('', 12)).toBe(0);
  });
});
