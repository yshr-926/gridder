import { describe, expect, it } from 'vitest';
import type { GridPolygon } from '@gridder/editor-core';
import {
  edgeAtPoint,
  isAxisAlignedPolygonEdge,
  vertexAtPoint,
  withEdgeMoved,
  withVertexMoved,
  type PolygonEdgeRef,
  type PolygonVertexRef,
} from './hitTest';

/**
 * Vertex/edge hit-testing and mutation helpers for issue #50 (spec §6.2:
 * "ポリゴンは...頂点・辺を直接動かして変形する"). Split from `hitTest.test.ts` so
 * parallel work on that file's other hit-testing (issue #49's cell editing)
 * doesn't collide here.
 */

/** An L-shaped concave hexagon (not axis-aligned-rect-eligible: 6 vertices). */
const lShape: GridPolygon = {
  outerRing: [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 3 },
    { x: 3, y: 3 },
    { x: 3, y: 6 },
    { x: 0, y: 6 },
  ],
  innerRings: [],
};

/** A square with a smaller square hole. */
const holedSquare: GridPolygon = {
  outerRing: [
    { x: 0, y: 0 },
    { x: 8, y: 0 },
    { x: 8, y: 8 },
    { x: 0, y: 8 },
  ],
  innerRings: [
    [
      { x: 2, y: 2 },
      { x: 5, y: 2 },
      { x: 5, y: 5 },
      { x: 2, y: 5 },
    ],
  ],
};

describe('vertexAtPoint', () => {
  it('test_vertexAtPoint_withinRadiusOfOuterVertex_returnsItsRef', () => {
    const ref = vertexAtPoint(lShape, { x: 0.1, y: 0.1 }, 0.35);
    expect(ref).toEqual({ ring: { kind: 'outer' }, vertexIndex: 0 });
  });

  it('test_vertexAtPoint_outsideRadius_returnsNull', () => {
    expect(vertexAtPoint(lShape, { x: 1, y: 1 }, 0.35)).toBeNull();
  });

  it('test_vertexAtPoint_holeVertex_returnsInnerRingRef', () => {
    const ref = vertexAtPoint(holedSquare, { x: 2.05, y: 2.05 }, 0.35);
    expect(ref).toEqual({ ring: { kind: 'inner', holeIndex: 0 }, vertexIndex: 0 });
  });

  it('test_vertexAtPoint_picksTheNearestVertex_whenTwoAreWithinRadius', () => {
    // (3, 0.1) is within a generous radius of both (0,0)-adjacent vertices
    // and (6,0), but nearest to neither corner exactly — use a case with an
    // unambiguous nearest vertex instead to keep this deterministic.
    const ref = vertexAtPoint(lShape, { x: 5.9, y: 0.05 }, 1);
    expect(ref).toEqual({ ring: { kind: 'outer' }, vertexIndex: 1 });
  });
});

describe('edgeAtPoint', () => {
  it('test_edgeAtPoint_onOuterEdge_returnsItsRef', () => {
    // Midpoint of the bottom edge (0,0)-(6,0).
    const ref = edgeAtPoint(lShape, { x: 3, y: 0.05 }, 0.35);
    expect(ref).toEqual({ ring: { kind: 'outer' }, edgeIndex: 0 });
  });

  it('test_edgeAtPoint_outsideRadius_returnsNull', () => {
    expect(edgeAtPoint(lShape, { x: 3, y: 2 }, 0.35)).toBeNull();
  });

  it('test_edgeAtPoint_holeEdge_returnsInnerRingRef', () => {
    // Midpoint of the hole's top edge (2,2)-(5,2).
    const ref = edgeAtPoint(holedSquare, { x: 3.5, y: 2.05 }, 0.35);
    expect(ref).toEqual({ ring: { kind: 'inner', holeIndex: 0 }, edgeIndex: 0 });
  });

  it('test_edgeAtPoint_nearAVertex_stillFindsTheAdjacentEdge_whenCalledDirectly', () => {
    // edgeAtPoint has no built-in vertex-priority; that ordering is the
    // interaction controller's job (checking vertexAtPoint first). Called on
    // its own it just finds the nearest edge.
    const ref = edgeAtPoint(lShape, { x: 0.2, y: 0.05 }, 0.35);
    expect(ref).toEqual({ ring: { kind: 'outer' }, edgeIndex: 0 });
  });
});

describe('isAxisAlignedPolygonEdge', () => {
  it('test_isAxisAlignedPolygonEdge_horizontalEdge_isTrue', () => {
    const ref: PolygonEdgeRef = { ring: { kind: 'outer' }, edgeIndex: 0 };
    expect(isAxisAlignedPolygonEdge(lShape, ref)).toBe(true);
  });

  it('test_isAxisAlignedPolygonEdge_diagonalEdge_isFalse', () => {
    const diagonal: GridPolygon = {
      outerRing: [
        { x: 0, y: 0 },
        { x: 4, y: 2 },
        { x: 0, y: 4 },
      ],
      innerRings: [],
    };
    const ref: PolygonEdgeRef = { ring: { kind: 'outer' }, edgeIndex: 0 };
    expect(isAxisAlignedPolygonEdge(diagonal, ref)).toBe(false);
  });

  it('test_isAxisAlignedPolygonEdge_outOfRangeRef_isFalse', () => {
    const ref: PolygonEdgeRef = { ring: { kind: 'outer' }, edgeIndex: 99 };
    expect(isAxisAlignedPolygonEdge(lShape, ref)).toBe(false);
  });
});

describe('withVertexMoved', () => {
  it('test_withVertexMoved_movesOnlyTheTargetVertex', () => {
    const ref: PolygonVertexRef = { ring: { kind: 'outer' }, vertexIndex: 0 };
    const moved = withVertexMoved(lShape, ref, { x: -2, y: -2 });
    expect(moved.outerRing[0]).toEqual({ x: -2, y: -2 });
    expect(moved.outerRing.slice(1)).toEqual(lShape.outerRing.slice(1));
  });

  it('test_withVertexMoved_holeVertex_movesOnlyThatHolesVertex', () => {
    const ref: PolygonVertexRef = { ring: { kind: 'inner', holeIndex: 0 }, vertexIndex: 2 };
    const moved = withVertexMoved(holedSquare, ref, { x: 6, y: 6 });
    expect(moved.innerRings[0]?.[2]).toEqual({ x: 6, y: 6 });
    expect(moved.outerRing).toEqual(holedSquare.outerRing);
  });

  it('test_withVertexMoved_samePosition_returnsTheExactSamePolygonReference', () => {
    const ref: PolygonVertexRef = { ring: { kind: 'outer' }, vertexIndex: 0 };
    expect(withVertexMoved(lShape, ref, { x: 0, y: 0 })).toBe(lShape);
  });

  it('test_withVertexMoved_outOfRangeIndex_returnsTheExactSamePolygonReference', () => {
    const ref: PolygonVertexRef = { ring: { kind: 'outer' }, vertexIndex: 99 };
    expect(withVertexMoved(lShape, ref, { x: 1, y: 1 })).toBe(lShape);
  });

  it('test_withVertexMoved_outOfRangeHoleIndex_returnsTheExactSamePolygonReference', () => {
    const ref: PolygonVertexRef = { ring: { kind: 'inner', holeIndex: 5 }, vertexIndex: 0 };
    expect(withVertexMoved(holedSquare, ref, { x: 1, y: 1 })).toBe(holedSquare);
  });
});

describe('withEdgeMoved', () => {
  it('test_withEdgeMoved_axisAlignedEdge_translatesBothEndpoints', () => {
    // Bottom edge (0,0)-(6,0), an axis-aligned edge.
    const ref: PolygonEdgeRef = { ring: { kind: 'outer' }, edgeIndex: 0 };
    const moved = withEdgeMoved(lShape, ref, { x: 0, y: -2 });
    expect(moved.outerRing[0]).toEqual({ x: 0, y: -2 });
    expect(moved.outerRing[1]).toEqual({ x: 6, y: -2 });
    // Every other vertex is untouched.
    expect(moved.outerRing.slice(2)).toEqual(lShape.outerRing.slice(2));
  });

  it('test_withEdgeMoved_diagonalEdge_translatesBothEndpointsByTheSameDelta', () => {
    const diagonal: GridPolygon = {
      outerRing: [
        { x: 0, y: 0 },
        { x: 4, y: 2 },
        { x: 0, y: 4 },
      ],
      innerRings: [],
    };
    const ref: PolygonEdgeRef = { ring: { kind: 'outer' }, edgeIndex: 0 };
    const moved = withEdgeMoved(diagonal, ref, { x: 3, y: 1 });
    expect(moved.outerRing[0]).toEqual({ x: 3, y: 1 });
    expect(moved.outerRing[1]).toEqual({ x: 7, y: 3 });
    expect(moved.outerRing[2]).toEqual({ x: 0, y: 4 });
  });

  it('test_withEdgeMoved_wrappingEdge_translatesLastAndFirstVertex', () => {
    // The last edge of a ring wraps from the last vertex back to vertex 0.
    const ref: PolygonEdgeRef = { ring: { kind: 'outer' }, edgeIndex: lShape.outerRing.length - 1 };
    const moved = withEdgeMoved(lShape, ref, { x: 1, y: 0 });
    expect(moved.outerRing[lShape.outerRing.length - 1]).toEqual({
      x: lShape.outerRing[lShape.outerRing.length - 1].x + 1,
      y: lShape.outerRing[lShape.outerRing.length - 1].y,
    });
    expect(moved.outerRing[0]).toEqual({ x: lShape.outerRing[0].x + 1, y: lShape.outerRing[0].y });
  });

  it('test_withEdgeMoved_holeEdge_movesOnlyThatHolesEdge', () => {
    const ref: PolygonEdgeRef = { ring: { kind: 'inner', holeIndex: 0 }, edgeIndex: 0 };
    const moved = withEdgeMoved(holedSquare, ref, { x: 0, y: -1 });
    expect(moved.innerRings[0]?.[0]).toEqual({ x: 2, y: 1 });
    expect(moved.innerRings[0]?.[1]).toEqual({ x: 5, y: 1 });
    expect(moved.outerRing).toEqual(holedSquare.outerRing);
  });

  it('test_withEdgeMoved_zeroDelta_returnsTheExactSamePolygonReference', () => {
    const ref: PolygonEdgeRef = { ring: { kind: 'outer' }, edgeIndex: 0 };
    expect(withEdgeMoved(lShape, ref, { x: 0, y: 0 })).toBe(lShape);
  });

  it('test_withEdgeMoved_outOfRangeIndex_returnsTheExactSamePolygonReference', () => {
    const ref: PolygonEdgeRef = { ring: { kind: 'outer' }, edgeIndex: 99 };
    expect(withEdgeMoved(lShape, ref, { x: 1, y: 1 })).toBe(lShape);
  });
});
