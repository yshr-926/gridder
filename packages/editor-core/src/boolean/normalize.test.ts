import { describe, expect, it } from 'vitest';
import {
  isIntegerPolygon,
  normalizeMultiPolygon,
  type ClosedMultiPolygon,
} from './normalize.js';
import { doubleSignedArea } from './geometry.js';
import { rectangle } from './test-helpers.js';

describe('normalizeMultiPolygon', () => {
  it('test_normalizeMultiPolygon_stripsExplicitClosingVertex', () => {
    const input: ClosedMultiPolygon = [
      [
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
          [0, 0],
        ],
      ],
    ];

    const result = normalizeMultiPolygon(input);

    expect(result).toHaveLength(1);
    expect(result[0]?.outerRing).toHaveLength(4);
  });

  it('test_normalizeMultiPolygon_orientsOuterRingCounterClockwise', () => {
    const clockwiseInput: ClosedMultiPolygon = [
      [
        [
          [0, 0],
          [0, 2],
          [2, 2],
          [2, 0],
          [0, 0],
        ],
      ],
    ];

    const result = normalizeMultiPolygon(clockwiseInput);

    expect(doubleSignedArea(result[0]?.outerRing ?? [])).toBeGreaterThan(0);
  });

  it('test_normalizeMultiPolygon_orientsInnerRingClockwise', () => {
    const input: ClosedMultiPolygon = [
      [
        [
          [0, 0],
          [4, 0],
          [4, 4],
          [0, 4],
          [0, 0],
        ],
        [
          [1, 1],
          [2, 1],
          [2, 2],
          [1, 2],
          [1, 1],
        ],
      ],
    ];

    const result = normalizeMultiPolygon(input);

    expect(result[0]?.innerRings).toHaveLength(1);
    expect(doubleSignedArea(result[0]?.innerRings[0] ?? [])).toBeLessThan(0);
  });

  it('test_normalizeMultiPolygon_snapsNearIntegerCoordinates', () => {
    const input: ClosedMultiPolygon = [
      [
        [
          [0.0000001, -0.0000002],
          [2, 0],
          [2, 2],
          [0, 2],
        ],
      ],
    ];

    const result = normalizeMultiPolygon(input);

    expect(isIntegerPolygon(result[0] ?? rectangle(0, 0, 1, 1))).toBe(true);
  });

  it('test_normalizeMultiPolygon_dropsDegeneratePolygons', () => {
    const input: ClosedMultiPolygon = [
      [
        [
          [0, 0],
          [1, 0],
          [2, 0],
          [0, 0],
        ],
      ],
    ];

    expect(normalizeMultiPolygon(input)).toEqual([]);
  });

  it('test_normalizeMultiPolygon_ordersPolygonsByDescendingArea', () => {
    const input: ClosedMultiPolygon = [
      [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
      ],
      [
        [
          [10, 0],
          [14, 0],
          [14, 4],
          [10, 4],
        ],
      ],
    ];

    const result = normalizeMultiPolygon(input);

    expect(
      Math.abs(doubleSignedArea(result[0]?.outerRing ?? [])),
    ).toBeGreaterThan(Math.abs(doubleSignedArea(result[1]?.outerRing ?? [])));
  });

  it('test_normalizeMultiPolygon_isDeterministicForEquivalentInput', () => {
    const a: ClosedMultiPolygon = [
      [
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
        ],
      ],
      [
        [
          [5, 5],
          [7, 5],
          [7, 7],
          [5, 7],
        ],
      ],
    ];
    const b: ClosedMultiPolygon = [a[1] as ClosedMultiPolygon[number], a[0] as ClosedMultiPolygon[number]];

    expect(JSON.stringify(normalizeMultiPolygon(a))).toBe(
      JSON.stringify(normalizeMultiPolygon(b)),
    );
  });
});
