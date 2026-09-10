import { describe, expect, it } from 'vitest';
import type { GridPolygon, GridRing } from '../model.js';
import { cleanPolygon } from './clean-polygon.js';

const square = (x: number, y: number, size: number): GridRing => [
  { x, y },
  { x: x + size, y },
  { x: x + size, y: y + size },
  { x, y: y + size },
];

describe('cleanPolygon', () => {
  it('test_cleanPolygon_alreadyClean_returnsEqualPolygon', () => {
    const polygon: GridPolygon = { outerRing: square(0, 0, 4), innerRings: [square(1, 1, 2)] };
    expect(cleanPolygon(polygon)).toEqual(polygon);
  });

  it('test_cleanPolygon_lShapeDraggedBackToRectangle_collapsesToFourVertices', () => {
    // An L-shape whose notch vertex was dragged back onto the corner: the
    // two former notch vertices now sit on the rectangle's edges.
    const polygon: GridPolygon = {
      outerRing: [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 6 },
        { x: 0, y: 6 },
        { x: 0, y: 3 },
      ],
      innerRings: [],
    };
    expect(cleanPolygon(polygon)).toEqual({ outerRing: square(0, 0, 6), innerRings: [] });
  });

  it('test_cleanPolygon_vertexDroppedOnNeighbour_mergesTheDuplicate', () => {
    const polygon: GridPolygon = {
      outerRing: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 3 },
        { x: 6, y: 3 },
        { x: 3, y: 3 },
        { x: 3, y: 6 },
        { x: 0, y: 6 },
      ],
      innerRings: [],
    };
    expect(cleanPolygon(polygon)?.outerRing).toEqual([
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 3 },
      { x: 3, y: 3 },
      { x: 3, y: 6 },
      { x: 0, y: 6 },
    ]);
  });

  it('test_cleanPolygon_outerRingCollapsesBelowThreeVertices_returnsNull', () => {
    const polygon: GridPolygon = {
      outerRing: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 0 },
        { x: 0, y: 0 },
      ],
      innerRings: [],
    };
    expect(cleanPolygon(polygon)).toBeNull();
  });

  it('test_cleanPolygon_outerRingWithZeroArea_returnsNull', () => {
    // Three distinct but collinear vertices: no area, every vertex removed.
    const polygon: GridPolygon = {
      outerRing: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 4, y: 0 },
      ],
      innerRings: [],
    };
    expect(cleanPolygon(polygon)).toBeNull();
  });

  it('test_cleanPolygon_holeVertexDroppedOnNeighbour_mergesInsideTheHole', () => {
    const polygon: GridPolygon = {
      outerRing: square(0, 0, 8),
      innerRings: [
        [
          { x: 2, y: 2 },
          { x: 5, y: 2 },
          { x: 5, y: 5 },
          { x: 5, y: 5 },
          { x: 2, y: 5 },
        ],
      ],
    };
    expect(cleanPolygon(polygon)).toEqual({
      outerRing: square(0, 0, 8),
      innerRings: [square(2, 2, 3)],
    });
  });

  it('test_cleanPolygon_holeCollapsesToZeroArea_returnsNull', () => {
    const polygon: GridPolygon = {
      outerRing: square(0, 0, 8),
      innerRings: [
        [
          { x: 2, y: 2 },
          { x: 5, y: 2 },
          { x: 5, y: 2 },
          { x: 2, y: 2 },
        ],
      ],
    };
    expect(cleanPolygon(polygon)).toBeNull();
  });

  it('test_cleanPolygon_preservesWindingAndRingOrder', () => {
    const clockwise: GridRing = [
      { x: 0, y: 0 },
      { x: 0, y: 4 },
      { x: 4, y: 4 },
      { x: 4, y: 0 },
    ];
    const polygon: GridPolygon = {
      outerRing: clockwise,
      innerRings: [square(1, 1, 1), square(2, 2, 1)],
    };
    expect(cleanPolygon(polygon)).toEqual(polygon);
  });
});
