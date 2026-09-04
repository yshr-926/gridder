import { describe, expect, it } from 'vitest';
import type { GridPolygon } from '../model.js';
import { createPolygonClippingEngine } from './polygon-clipping-engine.js';
import { hasHole } from './split.js';
import {
  assertNormalized,
  coveredCells,
  coveredDoubleArea,
  polygonKey,
  rectangle,
  resultKey,
  square,
} from './test-helpers.js';

const engine = createPolygonClippingEngine();

describe('PolygonBooleanEngine — single cell add / remove', () => {
  it('test_union_singleCellAddedToRectangle_growsByOneCell', () => {
    const base = rectangle(0, 0, 2, 2);
    const added = square(2, 0);

    const result = engine.union([base, added]);

    assertNormalized(result);
    expect(result).toHaveLength(1);
    expect(coveredDoubleArea(result)).toBe(2 * (2 * 2) + 2 * 1);
    expect(polygonKey(result[0] as GridPolygon)).toBe(
      polygonKey({
        outerRing: [
          { x: 0, y: 0 },
          { x: 3, y: 0 },
          { x: 3, y: 1 },
          { x: 2, y: 1 },
          { x: 2, y: 2 },
          { x: 0, y: 2 },
        ],
        innerRings: [],
      }),
    );
  });

  it('test_difference_singleCellRemovedFromRectangle_leavesLShape', () => {
    const base = rectangle(0, 0, 2, 2);
    const removed = square(1, 1);

    const result = engine.difference(base, [removed]);

    assertNormalized(result);
    expect(result).toHaveLength(1);
    expect(hasHole(result[0] as GridPolygon)).toBe(false);
    expect(coveredDoubleArea(result)).toBe(2 * 3);
  });

  it('test_difference_cellRemovedFromEdge_keepsShapeConnected', () => {
    const base = rectangle(0, 0, 3, 1);
    const removed = square(0, 0);

    const result = engine.difference(base, [removed]);

    assertNormalized(result);
    expect(result).toHaveLength(1);
    expect(coveredDoubleArea(result)).toBe(2 * 2);
  });
});

describe('PolygonBooleanEngine — cells touching only at an edge or vertex', () => {
  it('test_union_cellsSharingOnlyAnEdge_mergeIntoOnePolygon', () => {
    const left = square(0, 0);
    const right = square(1, 0);

    const result = engine.union([left, right]);

    assertNormalized(result);
    expect(result).toHaveLength(1);
    expect(result[0]?.outerRing).toHaveLength(4);
    expect(coveredDoubleArea(result)).toBe(2 * 2);
  });

  it('test_union_cellsTouchingOnlyAtAVertex_staySeparatePolygons', () => {
    const lower = square(0, 0);
    const upper = square(1, 1);

    const result = engine.union([lower, upper]);

    assertNormalized(result);
    expect(result).toHaveLength(2);
    expect(coveredDoubleArea(result)).toBe(2 * 2);
  });

  it('test_difference_clipTouchingSubjectOnlyAtAnEdge_leavesSubjectUnchanged', () => {
    const base = square(0, 0);
    const clip = square(1, 0);

    const result = engine.difference(base, [clip]);

    assertNormalized(result);
    expect(resultKey(result)).toBe(resultKey([base]));
  });
});

describe('PolygonBooleanEngine — hole creation and hole removal', () => {
  it('test_difference_cellRemovedFromInterior_createsHole', () => {
    const base = rectangle(0, 0, 3, 3);
    const removed = square(1, 1);

    const result = engine.difference(base, [removed]);

    assertNormalized(result);
    expect(result).toHaveLength(1);
    const polygon = result[0] as GridPolygon;
    expect(hasHole(polygon)).toBe(true);
    expect(polygon.innerRings).toHaveLength(1);
    expect(coveredDoubleArea(result)).toBe(2 * (9 - 1));
  });

  it('test_union_cellAddedBackIntoHole_removesTheHole', () => {
    const base = rectangle(0, 0, 3, 3);
    const withHole = engine.difference(base, [square(1, 1)]);
    expect(hasHole(withHole[0] as GridPolygon)).toBe(true);

    const filled = engine.union([withHole[0] as GridPolygon, square(1, 1)]);

    assertNormalized(filled);
    expect(filled).toHaveLength(1);
    expect(hasHole(filled[0] as GridPolygon)).toBe(false);
    expect(resultKey(filled)).toBe(resultKey([rectangle(0, 0, 3, 3)]));
  });

  it('test_difference_removingRingOfCells_createsHoleThenClosingItRestoresSolid', () => {
    const base = rectangle(0, 0, 3, 3);
    const punched = engine.difference(base, [square(1, 1)]);
    const partiallyFilled = engine.union([
      punched[0] as GridPolygon,
      rectangle(1, 1, 2, 2),
    ]);

    assertNormalized(partiallyFilled);
    expect(hasHole(partiallyFilled[0] as GridPolygon)).toBe(false);
  });
});

describe('PolygonBooleanEngine — difference that separates into multiple polygons', () => {
  it('test_difference_cellRemovedFromMiddleOfStrip_splitsIntoTwoPolygons', () => {
    const strip = rectangle(0, 0, 3, 1);
    const removed = square(1, 0);

    const result = engine.difference(strip, [removed]);

    assertNormalized(result);
    expect(result).toHaveLength(2);
    expect(coveredDoubleArea(result)).toBe(2 * 2);
    expect(resultKey(result)).toBe(
      resultKey([rectangle(0, 0, 1, 1), rectangle(2, 0, 3, 1)]),
    );
  });

  it('test_difference_crossShapedCut_splitsIntoFourCorners', () => {
    const base = rectangle(0, 0, 3, 3);
    const verticalBar = rectangle(1, 0, 2, 3);
    const horizontalBar = rectangle(0, 1, 3, 2);

    const result = engine.difference(base, [verticalBar, horizontalBar]);

    assertNormalized(result);
    expect(result).toHaveLength(4);
    expect(coveredDoubleArea(result)).toBe(2 * 4);
  });

  it('test_difference_resultOrder_isLargestOuterRingFirst', () => {
    const base = rectangle(0, 0, 5, 1);
    const removed = square(1, 0);

    const result = engine.difference(base, [removed]);

    assertNormalized(result);
    const areas = result.map((polygon) =>
      Math.abs(
        polygon.outerRing.reduce((total, point, index) => {
          const next =
            polygon.outerRing[(index + 1) % polygon.outerRing.length];
          return next === undefined
            ? total
            : total + (point.x * next.y - next.x * point.y);
        }, 0),
      ),
    );
    expect([...areas]).toEqual([...areas].sort((a, b) => b - a));
  });
});

describe('PolygonBooleanEngine — stability under repeated identical operations', () => {
  it('test_union_sameCellAddedTwice_isIdempotent', () => {
    const base = rectangle(0, 0, 2, 2);
    const cell = square(2, 0);

    const once = engine.union([base, cell]);
    const twice = engine.union([...once, cell]);

    expect(resultKey(twice)).toBe(resultKey(once));
  });

  it('test_difference_sameCellRemovedTwice_isIdempotent', () => {
    const base = rectangle(0, 0, 3, 3);
    const cell = square(1, 1);

    const once = engine.difference(base, [cell]);
    const twice = engine.difference(once[0] as GridPolygon, [cell]);

    expect(resultKey(twice)).toBe(resultKey(once));
  });

  it('test_union_repeatedApplication_producesByteIdenticalOutput', () => {
    const base = rectangle(0, 0, 4, 4);
    const cells = [square(4, 0), square(4, 1), square(-1, 3)];

    let previous = engine.union([base, ...cells]);
    for (let iteration = 0; iteration < 5; iteration += 1) {
      const next = engine.union([...previous, ...cells]);
      expect(JSON.stringify(next)).toBe(JSON.stringify(previous));
      previous = next;
    }
  });

  it('test_addThenRemoveSameCell_returnsToOriginalShape', () => {
    const base = rectangle(0, 0, 3, 2);
    const cell = square(3, 0);

    const grown = engine.union([base, cell]);
    const shrunk = engine.difference(grown[0] as GridPolygon, [cell]);

    expect(resultKey(shrunk)).toBe(resultKey([base]));
  });
});

describe('PolygonBooleanEngine — normalization of winding, duplicates and collinear vertices', () => {
  it('test_union_clockwiseInput_isReturnedCounterClockwise', () => {
    const clockwiseSquare: GridPolygon = {
      outerRing: [
        { x: 0, y: 0 },
        { x: 0, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 0 },
      ],
      innerRings: [],
    };

    const result = engine.union([clockwiseSquare]);

    assertNormalized(result);
    expect(resultKey(result)).toBe(resultKey([rectangle(0, 0, 2, 2)]));
  });

  it('test_union_counterClockwiseInput_isPreserved', () => {
    const result = engine.union([rectangle(0, 0, 2, 2)]);

    assertNormalized(result);
    expect(resultKey(result)).toBe(resultKey([rectangle(0, 0, 2, 2)]));
  });

  it('test_union_inputWithDuplicateVertices_areRemoved', () => {
    const withDuplicates: GridPolygon = {
      outerRing: [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
        { x: 2, y: 2 },
        { x: 0, y: 2 },
      ],
      innerRings: [],
    };

    const result = engine.union([withDuplicates]);

    assertNormalized(result);
    expect(result[0]?.outerRing).toHaveLength(4);
  });

  it('test_union_inputWithCollinearVertices_areRemoved', () => {
    const withCollinear: GridPolygon = {
      outerRing: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 0, y: 2 },
      ],
      innerRings: [],
    };

    const result = engine.union([withCollinear]);

    assertNormalized(result);
    expect(result[0]?.outerRing).toHaveLength(4);
  });

  it('test_difference_holeRing_isReturnedClockwise', () => {
    const result = engine.difference(rectangle(0, 0, 3, 3), [square(1, 1)]);

    assertNormalized(result);
    const hole = result[0]?.innerRings[0];
    expect(hole).toBeDefined();
  });

  it('test_union_mergedCellsProduceNoCollinearVerticesOnStraightEdges', () => {
    const cells = [square(0, 0), square(1, 0), square(2, 0), square(3, 0)];

    const result = engine.union(cells);

    assertNormalized(result);
    expect(result).toHaveLength(1);
    // A 4x1 strip is a rectangle: exactly four corners, no seam vertices.
    expect(result[0]?.outerRing).toHaveLength(4);
  });
});

describe('PolygonBooleanEngine — Adapter contract', () => {
  it('test_union_emptyOperandList_returnsEmpty', () => {
    expect(engine.union([])).toEqual([]);
  });

  it('test_difference_subjectFullyCovered_returnsEmpty', () => {
    const result = engine.difference(square(0, 0), [rectangle(-1, -1, 2, 2)]);

    expect(result).toEqual([]);
  });

  it('test_difference_rasterizedCoverage_matchesExpectedCells', () => {
    const base = rectangle(0, 0, 4, 4);
    const result = engine.difference(base, [square(1, 1), square(2, 2)]);

    const cells = coveredCells(result, {
      minX: 0,
      minY: 0,
      maxX: 4,
      maxY: 4,
    });

    expect(cells.has('1,1')).toBe(false);
    expect(cells.has('2,2')).toBe(false);
    expect(cells.size).toBe(14);
  });
});
