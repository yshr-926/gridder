import { describe, expect, it } from 'vitest';
import type { GridPolygon } from '../model.js';
import { hasHole, splitDisjointPolygons } from './split.js';
import { rectangle } from './test-helpers.js';

describe('splitDisjointPolygons', () => {
  it('test_splitDisjointPolygons_alreadyConnectedPolygons_areReturnedAsIs', () => {
    const input: GridPolygon[] = [rectangle(0, 0, 1, 1)];

    const result = splitDisjointPolygons(input);

    expect(result).toHaveLength(1);
    expect(result[0]?.outerRing).toEqual(input[0]?.outerRing);
  });

  it('test_splitDisjointPolygons_multipleRegions_orderedLargestFirst', () => {
    const small = rectangle(0, 0, 1, 1);
    const large = rectangle(5, 0, 9, 3);

    const result = splitDisjointPolygons([small, large]);

    expect(result[0]?.outerRing).toEqual(large.outerRing);
    expect(result[1]?.outerRing).toEqual(small.outerRing);
  });

  it('test_splitDisjointPolygons_preservesInnerRings', () => {
    const withHole: GridPolygon = {
      outerRing: rectangle(0, 0, 3, 3).outerRing,
      innerRings: [
        [
          { x: 1, y: 1 },
          { x: 1, y: 2 },
          { x: 2, y: 2 },
          { x: 2, y: 1 },
        ],
      ],
    };

    const result = splitDisjointPolygons([withHole]);

    expect(result[0]?.innerRings).toHaveLength(1);
  });

  it('test_splitDisjointPolygons_doesNotMutateInput', () => {
    const input: GridPolygon[] = [rectangle(0, 0, 1, 1), rectangle(9, 9, 12, 12)];
    const snapshot = JSON.stringify(input);

    splitDisjointPolygons(input);

    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe('hasHole', () => {
  it('test_hasHole_polygonWithInnerRing_returnsTrue', () => {
    const withHole: GridPolygon = {
      outerRing: rectangle(0, 0, 3, 3).outerRing,
      innerRings: [
        [
          { x: 1, y: 1 },
          { x: 1, y: 2 },
          { x: 2, y: 2 },
          { x: 2, y: 1 },
        ],
      ],
    };

    expect(hasHole(withHole)).toBe(true);
  });

  it('test_hasHole_solidPolygon_returnsFalse', () => {
    expect(hasHole(rectangle(0, 0, 2, 2))).toBe(false);
  });
});
