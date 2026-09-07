import { describe, expect, it } from 'vitest';
import { isAnnotationLegible } from './annotationLegibility';

describe('isAnnotationLegible', () => {
  it('test_isAnnotationLegible_shapeAtLeastOneLineTall_isLegible', () => {
    // 1x1 cell at gridSize 20, zoom 1 = 20px >= 12px font.
    expect(isAnnotationLegible(1, 1, 20, 1, 12)).toBe(true);
  });

  it('test_isAnnotationLegible_smallerDimensionUnderFontSize_isNotLegible', () => {
    // 10x1 cells at zoom 0.5: height 10px < 12px, regardless of the width.
    expect(isAnnotationLegible(10, 1, 20, 0.5, 12)).toBe(false);
  });

  it('test_isAnnotationLegible_zoomingBackIn_restoresLegibility', () => {
    expect(isAnnotationLegible(3, 3, 10, 0.1, 12)).toBe(false);
    expect(isAnnotationLegible(3, 3, 10, 1, 12)).toBe(true);
  });
});
