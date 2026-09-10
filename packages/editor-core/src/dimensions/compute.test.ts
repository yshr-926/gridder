import { describe, expect, it } from 'vitest';
import type { GridPolygon, PhysicalScale } from '../model.js';
import { cellSizeOfPolygon, cellSizeOfVertices, formatDimension } from './compute.js';

const rect = (w: number, h: number): GridPolygon => ({
  outerRing: [
    { x: 1, y: 1 },
    { x: 1 + w, y: 1 },
    { x: 1 + w, y: 1 + h },
    { x: 1, y: 1 + h },
  ],
  innerRings: [],
});

describe('cellSizeOfVertices', () => {
  it('test_cellSizeOfVertices_emptyList_returnsZero', () => {
    expect(cellSizeOfVertices([])).toEqual({ widthCells: 0, heightCells: 0 });
  });

  it('test_cellSizeOfVertices_returnsBoundingBoxOfPoints', () => {
    const vertices = [
      { x: 2, y: 3 },
      { x: 6, y: 3 },
      { x: 6, y: 5 },
      { x: 2, y: 5 },
    ];
    expect(cellSizeOfVertices(vertices)).toEqual({ widthCells: 4, heightCells: 2 });
  });
});

describe('cellSizeOfPolygon', () => {
  it('test_cellSizeOfPolygon_rectangle_returnsBoundingBoxInCells', () => {
    expect(cellSizeOfPolygon(rect(4, 3))).toEqual({ widthCells: 4, heightCells: 3 });
  });

  it('test_cellSizeOfPolygon_lShape_usesOuterBoundingBox', () => {
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
    expect(cellSizeOfPolygon(lShape)).toEqual({ widthCells: 5, heightCells: 4 });
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

  it('test_formatDimension_mmUnit_formatsCorrectly', () => {
    const scale: PhysicalScale = { valuePerCell: 15, unit: 'mm' };
    expect(formatDimension(2, scale)).toBe('30 mm');
  });

  it('test_formatDimension_zeroCells_returnsZeroWithUnit', () => {
    const scale: PhysicalScale = { valuePerCell: 10, unit: 'cm' };
    expect(formatDimension(0, scale)).toBe('0 cm');
  });
});
