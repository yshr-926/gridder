import { describe, expect, it } from 'vitest';
import type { GridRing } from '../model.js';
import { isSimplePolygon } from './is-simple-polygon.js';

describe('isSimplePolygon', () => {
  it('test_isSimplePolygon_triangle_isTrue', () => {
    const ring: GridRing = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 2, y: 4 },
    ];
    expect(isSimplePolygon(ring)).toBe(true);
  });

  it('test_isSimplePolygon_convexRectangle_isTrue', () => {
    const ring: GridRing = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ];
    expect(isSimplePolygon(ring)).toBe(true);
  });

  it('test_isSimplePolygon_concaveLShape_isTrue', () => {
    // An L-shape: concave, but every edge stays simple.
    const ring: GridRing = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 4 },
      { x: 0, y: 4 },
    ];
    expect(isSimplePolygon(ring)).toBe(true);
  });

  it('test_isSimplePolygon_bowTie_selfIntersects_isFalse', () => {
    // A classic "bow tie": the two diagonals of a quad cross in the middle.
    const ring: GridRing = [
      { x: 0, y: 0 },
      { x: 4, y: 4 },
      { x: 4, y: 0 },
      { x: 0, y: 4 },
    ];
    expect(isSimplePolygon(ring)).toBe(false);
  });

  it('test_isSimplePolygon_starShape_selfIntersects_isFalse', () => {
    const ring: GridRing = [
      { x: 0, y: 0 },
      { x: 6, y: 2 },
      { x: 0, y: 4 },
      { x: 6, y: 6 },
      { x: 3, y: 3 },
    ];
    expect(isSimplePolygon(ring)).toBe(false);
  });

  it('test_isSimplePolygon_repeatedVertex_isFalse', () => {
    const ring: GridRing = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 4, y: 0 }, // repeats vertex index 1
    ];
    expect(isSimplePolygon(ring)).toBe(false);
  });

  it('test_isSimplePolygon_nonAdjacentEdgeTouchesAVertex_isFalse', () => {
    // A non-adjacent edge passes exactly through another vertex (a T-touch).
    const ring: GridRing = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 2, y: 0 }, // lies on the (0,0)-(4,0) edge
      { x: 0, y: 4 },
    ];
    expect(isSimplePolygon(ring)).toBe(false);
  });

  it('test_isSimplePolygon_fewerThanThreeVertices_isFalse', () => {
    expect(isSimplePolygon([])).toBe(false);
    expect(isSimplePolygon([{ x: 0, y: 0 }])).toBe(false);
    expect(
      isSimplePolygon([
        { x: 0, y: 0 },
        { x: 4, y: 4 },
      ])
    ).toBe(false);
  });

  it('test_isSimplePolygon_adjacentEdgesSharingOnlyTheirCommonVertex_isTrue', () => {
    // A right-angle zigzag: adjacent edges share exactly their common vertex,
    // which must not be reported as a self-intersection.
    const ring: GridRing = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 8, y: 4 },
      { x: 8, y: 8 },
      { x: 0, y: 8 },
    ];
    expect(isSimplePolygon(ring)).toBe(true);
  });

  it('test_isSimplePolygon_diagonalEdges_isTrue', () => {
    // Straight oblique edges (spec §5 "直線の斜辺"), no right angles at all.
    const ring: GridRing = [
      { x: 0, y: 0 },
      { x: 5, y: 2 },
      { x: 3, y: 6 },
    ];
    expect(isSimplePolygon(ring)).toBe(true);
  });
});
