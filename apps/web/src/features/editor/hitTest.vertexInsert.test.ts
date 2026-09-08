import { describe, expect, it } from 'vitest';
import type { GridPolygon } from '@gridder/editor-core';
import {
  VERTEX_INSERT_HIT_RADIUS_MAX_PX,
  VERTEX_INSERT_MIN_CELL_PX,
  vertexInsertHitRadiusPx,
  vertexInsertionAtPoint,
  withVertexInserted,
} from './hitTest';

/**
 * Ghost-vertex hit-testing and insertion helpers for issue #64 (issue #63
 * 案 D: hover an edge near a grid point, drag to insert and move a vertex).
 */

const rect: GridPolygon = {
  outerRing: [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 4 },
    { x: 0, y: 4 },
  ],
  innerRings: [],
};

const holed: GridPolygon = {
  outerRing: rect.outerRing,
  innerRings: [
    [
      { x: 1, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 3 },
      { x: 1, y: 3 },
    ],
  ],
};

/** A triangle whose edge (0,0)-(4,2) passes through exactly one grid point, (2,1). */
const diagonal: GridPolygon = {
  outerRing: [
    { x: 0, y: 0 },
    { x: 4, y: 2 },
    { x: 0, y: 4 },
  ],
  innerRings: [],
};

const EDGE_RADIUS = 0.5;
const SNAP_RADIUS = 0.3;

describe('vertexInsertionAtPoint', () => {
  it('test_vertexInsertionAtPoint_nearInteriorGridPointOfEdge_returnsEdgeAndPoint', () => {
    const hit = vertexInsertionAtPoint(rect, { x: 2.1, y: 0.05 }, EDGE_RADIUS, SNAP_RADIUS);
    expect(hit).toEqual({ edge: { ring: { kind: 'outer' }, edgeIndex: 0 }, point: { x: 2, y: 0 } });
  });

  it('test_vertexInsertionAtPoint_betweenGridPoints_returnsNull_soEdgeDragWins', () => {
    expect(vertexInsertionAtPoint(rect, { x: 2.5, y: 0.05 }, EDGE_RADIUS, SNAP_RADIUS)).toBeNull();
  });

  it('test_vertexInsertionAtPoint_nearAnEndpoint_snapsToTheNearestInteriorPoint_notTheVertex', () => {
    // (0.2, 0) is nearest the corner (0,0), which is an existing vertex; the
    // nearest interior grid point is (1,0), 0.8 away — outside the snap radius.
    expect(vertexInsertionAtPoint(rect, { x: 0.2, y: 0 }, EDGE_RADIUS, SNAP_RADIUS)).toBeNull();
    // Right next to (1,0) it does resolve to (1,0), never to the corner.
    const hit = vertexInsertionAtPoint(rect, { x: 0.9, y: 0 }, EDGE_RADIUS, SNAP_RADIUS);
    expect(hit?.point).toEqual({ x: 1, y: 0 });
  });

  it('test_vertexInsertionAtPoint_awayFromAnyEdge_returnsNull', () => {
    expect(vertexInsertionAtPoint(rect, { x: 2, y: 2 }, EDGE_RADIUS, SNAP_RADIUS)).toBeNull();
  });

  it('test_vertexInsertionAtPoint_oneStepEdge_hasNoInteriorPoint_returnsNull', () => {
    const unit: GridPolygon = {
      outerRing: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 3 },
        { x: 0, y: 3 },
      ],
      innerRings: [],
    };
    // Bottom edge (0,0)-(1,0) is one cell long.
    expect(vertexInsertionAtPoint(unit, { x: 0.5, y: 0 }, EDGE_RADIUS, 0.6)).toBeNull();
    // The 3-cell side still offers its interior points.
    expect(vertexInsertionAtPoint(unit, { x: 1, y: 1.1 }, EDGE_RADIUS, SNAP_RADIUS)?.point).toEqual(
      { x: 1, y: 1 }
    );
  });

  it('test_vertexInsertionAtPoint_diagonalEdge_onlyOffersGridPointsTheEdgePassesThrough', () => {
    // (0,0)-(4,2) passes through (2,1) only.
    const hit = vertexInsertionAtPoint(diagonal, { x: 2.1, y: 1.05 }, EDGE_RADIUS, SNAP_RADIUS);
    expect(hit).toEqual({ edge: { ring: { kind: 'outer' }, edgeIndex: 0 }, point: { x: 2, y: 1 } });
    // (1, 0.5) lies on the edge but is not a grid point, and is 1.1 from (2,1).
    expect(vertexInsertionAtPoint(diagonal, { x: 1, y: 0.5 }, EDGE_RADIUS, SNAP_RADIUS)).toBeNull();
  });

  it('test_vertexInsertionAtPoint_holeEdge_returnsInnerRingRef', () => {
    const hit = vertexInsertionAtPoint(holed, { x: 2, y: 1.1 }, EDGE_RADIUS, SNAP_RADIUS);
    expect(hit).toEqual({
      edge: { ring: { kind: 'inner', holeIndex: 0 }, edgeIndex: 0 },
      point: { x: 2, y: 1 },
    });
  });
});

describe('withVertexInserted', () => {
  it('test_withVertexInserted_outerEdge_insertsAfterTheEdgeStartVertex', () => {
    const next = withVertexInserted(
      rect,
      { ring: { kind: 'outer' }, edgeIndex: 0 },
      { x: 2, y: 0 }
    );
    expect(next.outerRing).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 4 },
      { x: 0, y: 4 },
    ]);
    expect(rect.outerRing).toHaveLength(4);
  });

  it('test_withVertexInserted_closingEdge_appendsAtTheEnd', () => {
    const next = withVertexInserted(
      rect,
      { ring: { kind: 'outer' }, edgeIndex: 3 },
      { x: 0, y: 2 }
    );
    expect(next.outerRing[4]).toEqual({ x: 0, y: 2 });
  });

  it('test_withVertexInserted_holeEdge_insertsOnlyInThatHole', () => {
    const next = withVertexInserted(
      holed,
      { ring: { kind: 'inner', holeIndex: 0 }, edgeIndex: 1 },
      { x: 4, y: 2 }
    );
    expect(next.innerRings[0]).toEqual([
      { x: 1, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
      { x: 4, y: 3 },
      { x: 1, y: 3 },
    ]);
    expect(next.outerRing).toBe(holed.outerRing);
  });

  it('test_withVertexInserted_outOfRange_returnsSameReference', () => {
    expect(
      withVertexInserted(rect, { ring: { kind: 'outer' }, edgeIndex: 9 }, { x: 0, y: 0 })
    ).toBe(rect);
    expect(
      withVertexInserted(
        rect,
        { ring: { kind: 'inner', holeIndex: 0 }, edgeIndex: 0 },
        { x: 0, y: 0 }
      )
    ).toBe(rect);
  });
});

describe('vertexInsertHitRadiusPx', () => {
  it('test_vertexInsertHitRadiusPx_belowMinimumCell_returnsNull', () => {
    expect(vertexInsertHitRadiusPx(VERTEX_INSERT_MIN_CELL_PX - 1)).toBeNull();
    expect(vertexInsertHitRadiusPx(10)).toBeNull();
  });

  it('test_vertexInsertHitRadiusPx_defaultZoom20pxCell_leavesRoomForEdgeDrag', () => {
    // 20 * 0.3 = 6px radius, so two neighbouring snap zones leave an 8px gap.
    expect(vertexInsertHitRadiusPx(20)).toBe(6);
  });

  it('test_vertexInsertHitRadiusPx_largeCell_isCappedAtTheMaximum', () => {
    expect(vertexInsertHitRadiusPx(32)).toBe(VERTEX_INSERT_HIT_RADIUS_MAX_PX);
    expect(vertexInsertHitRadiusPx(200)).toBe(VERTEX_INSERT_HIT_RADIUS_MAX_PX);
  });

  it('test_vertexInsertHitRadiusPx_atMinimumCell_isProportional', () => {
    expect(vertexInsertHitRadiusPx(VERTEX_INSERT_MIN_CELL_PX)).toBeCloseTo(
      VERTEX_INSERT_MIN_CELL_PX * 0.3
    );
  });
});
