import { describe, expect, it } from 'vitest';
import type { GridRing } from '../model.js';
import {
  areCollinear,
  cleanRing,
  doubleSignedArea,
  hasIntegerCoordinates,
  orientRing,
  reverseRing,
} from './geometry.js';

describe('doubleSignedArea', () => {
  it('test_doubleSignedArea_counterClockwiseSquare_isPositive', () => {
    const ring: GridRing = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ];

    expect(doubleSignedArea(ring)).toBe(8);
  });

  it('test_doubleSignedArea_clockwiseSquare_isNegative', () => {
    const ring: GridRing = [
      { x: 0, y: 0 },
      { x: 0, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 0 },
    ];

    expect(doubleSignedArea(ring)).toBe(-8);
  });
});

describe('areCollinear', () => {
  it('test_areCollinear_pointsOnSameLine_returnsTrue', () => {
    expect(
      areCollinear({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 0 }),
    ).toBe(true);
  });

  it('test_areCollinear_pointsFormingCorner_returnsFalse', () => {
    expect(
      areCollinear({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }),
    ).toBe(false);
  });
});

describe('cleanRing', () => {
  it('test_cleanRing_consecutiveDuplicateVertices_areRemoved', () => {
    const ring: GridRing = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ];

    expect(cleanRing(ring)).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ]);
  });

  it('test_cleanRing_explicitClosingVertex_isDropped', () => {
    const ring: GridRing = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 0 },
    ];

    expect(cleanRing(ring)).toHaveLength(4);
  });

  it('test_cleanRing_collinearVertices_areRemoved', () => {
    const ring: GridRing = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 1 },
    ];

    expect(cleanRing(ring)).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ]);
  });

  it('test_cleanRing_collinearAcrossWrapAround_isRemoved', () => {
    const ring: GridRing = [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
    ];

    // The first vertex (1,0) is collinear with (0.5,0) before it and (2,0)
    // after it through the wrap-around edge and must be dropped.
    expect(cleanRing(ring)).toEqual([
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 0 },
    ]);
  });

  it('test_cleanRing_degenerateRing_returnsEmpty', () => {
    const ring: GridRing = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];

    expect(cleanRing(ring)).toEqual([]);
  });

  it('test_cleanRing_preservesWindingDirection', () => {
    const clockwise: GridRing = [
      { x: 0, y: 0 },
      { x: 0, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 0 },
    ];

    expect(doubleSignedArea(cleanRing(clockwise))).toBeLessThan(0);
  });
});

describe('reverseRing', () => {
  it('test_reverseRing_flipsWindingDirection', () => {
    const ring: GridRing = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
    ];

    expect(doubleSignedArea(reverseRing(ring))).toBe(-doubleSignedArea(ring));
  });
});

describe('orientRing', () => {
  const clockwiseSquare: GridRing = [
    { x: 0, y: 0 },
    { x: 0, y: 2 },
    { x: 2, y: 2 },
    { x: 2, y: 0 },
  ];

  it('test_orientRing_wantCounterClockwise_reversesClockwiseRing', () => {
    expect(doubleSignedArea(orientRing(clockwiseSquare, true))).toBeGreaterThan(
      0,
    );
  });

  it('test_orientRing_wantClockwise_keepsClockwiseRing', () => {
    expect(orientRing(clockwiseSquare, false)).toEqual(clockwiseSquare);
  });
});

describe('hasIntegerCoordinates', () => {
  it('test_hasIntegerCoordinates_allIntegers_returnsTrue', () => {
    expect(
      hasIntegerCoordinates([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ]),
    ).toBe(true);
  });

  it('test_hasIntegerCoordinates_fractionalCoordinate_returnsFalse', () => {
    expect(
      hasIntegerCoordinates([
        { x: 0, y: 0 },
        { x: 1.5, y: 4 },
      ]),
    ).toBe(false);
  });
});
