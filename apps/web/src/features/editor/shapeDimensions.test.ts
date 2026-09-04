import { describe, expect, it } from 'vitest';
import type { GridPolygon, PhysicalScale } from '@gridder/editor-core';
import { formatDimension, shapeCellSize } from './shapeDimensions';

const rect = (w: number, h: number): GridPolygon => ({
  outerRing: [
    { x: 1, y: 1 },
    { x: 1 + w, y: 1 },
    { x: 1 + w, y: 1 + h },
    { x: 1, y: 1 + h },
  ],
  innerRings: [],
});

describe('shapeCellSize', () => {
  it('test_shapeCellSize_rectangle_returnsBoundingBoxInCells', () => {
    expect(shapeCellSize(rect(4, 3))).toEqual({ widthCells: 4, heightCells: 3 });
  });

  it('test_shapeCellSize_lShape_usesOuterBoundingBox', () => {
    const lShape: GridPolygon = {
      outerRing: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 4 },
        { x: 0, y: 4 },
      ],
      innerRings: [],
    };
    expect(shapeCellSize(lShape)).toEqual({ widthCells: 5, heightCells: 4 });
  });
});

describe('formatDimension', () => {
  it('test_formatDimension_noScale_showsCellCount', () => {
    expect(formatDimension(3, undefined)).toBe('3 セル');
  });

  it('test_formatDimension_withScale_multipliesAndAppendsUnit', () => {
    const scale: PhysicalScale = { valuePerCell: 10, unit: 'cm' };
    expect(formatDimension(3, scale)).toBe('30 cm');
  });

  it('test_formatDimension_withFractionalScale_trimsTrailingZeros', () => {
    const scale: PhysicalScale = { valuePerCell: 2.5, unit: 'm' };
    expect(formatDimension(3, scale)).toBe('7.5 m');
  });
});
