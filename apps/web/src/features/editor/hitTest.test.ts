import { describe, expect, it } from 'vitest';
import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  type EditorDocument,
  type EditorShape,
  type GridRing,
} from '@gridder/editor-core';
import {
  isAxisAlignedRect,
  isPointInPolygon,
  rectContainsRect,
  rectFromPoints,
  RESIZE_HANDLE_KINDS,
  resizeCursorForHandle,
  resizeHandleAtPoint,
  resizeHandlePoint,
  resizeRectBounds,
  ringFromRect,
  shapeAtPoint,
  shapesWithinRegion,
  type ResizeHandleKind,
} from './hitTest';

const rectRing = (x: number, y: number, w: number, h: number): GridRing => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

const rectShape = (id: string, x: number, y: number, w: number, h: number): EditorShape => ({
  id,
  polygon: { outerRing: rectRing(x, y, w, h), innerRings: [] },
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
});

const documentOf = (shapes: readonly EditorShape[]): EditorDocument => ({
  formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
  shapes: Object.fromEntries(shapes.map((shape) => [shape.id, shape])),
  zOrder: shapes.map((shape) => shape.id),
  groups: {},
  drawingBounds: { mode: 'auto', min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
});

describe('isPointInPolygon', () => {
  it('test_isPointInPolygon_insidePoint_isTrue', () => {
    expect(isPointInPolygon({ x: 2, y: 2 }, rectShape('r', 0, 0, 4, 4).polygon)).toBe(true);
  });

  it('test_isPointInPolygon_outsidePoint_isFalse', () => {
    expect(isPointInPolygon({ x: 9, y: 9 }, rectShape('r', 0, 0, 4, 4).polygon)).toBe(false);
  });

  it('test_isPointInPolygon_onBorder_countsAsInside', () => {
    expect(isPointInPolygon({ x: 0, y: 2 }, rectShape('r', 0, 0, 4, 4).polygon)).toBe(true);
  });

  it('test_isPointInPolygon_insideHole_isFalse', () => {
    const shape: EditorShape = {
      id: 'holed',
      polygon: { outerRing: rectRing(0, 0, 6, 6), innerRings: [rectRing(2, 2, 2, 2)] },
      style: { fill: '#3b82f6', opacity: 1, isBorderVisible: true },
    };
    expect(isPointInPolygon({ x: 3, y: 3 }, shape.polygon)).toBe(false);
    expect(isPointInPolygon({ x: 1, y: 1 }, shape.polygon)).toBe(true);
  });
});

describe('shapeAtPoint', () => {
  it('test_shapeAtPoint_returnsTopmostShapeUnderPoint', () => {
    const back = rectShape('back', 0, 0, 6, 6);
    const front = rectShape('front', 2, 2, 6, 6);
    const document = documentOf([back, front]);

    expect(shapeAtPoint(document, { x: 3, y: 3 })?.id).toBe('front');
    expect(shapeAtPoint(document, { x: 1, y: 1 })?.id).toBe('back');
    expect(shapeAtPoint(document, { x: 20, y: 20 })).toBeNull();
  });
});

describe('shapesWithinRegion (containment semantics)', () => {
  it('test_shapesWithinRegion_selectsFullyContainedShapesOnly', () => {
    const inside = rectShape('inside', 2, 2, 3, 3);
    const straddling = rectShape('straddling', 8, 8, 6, 6);
    const document = documentOf([inside, straddling]);

    const region = rectFromPoints({ x: 0, y: 0 }, { x: 10, y: 10 });
    expect(shapesWithinRegion(document, region)).toEqual(['inside']);
  });

  it('test_shapesWithinRegion_returnsIdsInZOrder', () => {
    const a = rectShape('a', 1, 1, 2, 2);
    const b = rectShape('b', 4, 4, 2, 2);
    const document = documentOf([b, a]); // zOrder: b, a

    const region = rectFromPoints({ x: 0, y: 0 }, { x: 20, y: 20 });
    expect(shapesWithinRegion(document, region)).toEqual(['b', 'a']);
  });
});

describe('rectContainsRect', () => {
  it('test_rectContainsRect_inclusiveEdges', () => {
    expect(
      rectContainsRect(
        { minX: 0, minY: 0, maxX: 10, maxY: 10 },
        { minX: 0, minY: 0, maxX: 10, maxY: 10 }
      )
    ).toBe(true);
    expect(
      rectContainsRect(
        { minX: 0, minY: 0, maxX: 10, maxY: 10 },
        { minX: -1, minY: 0, maxX: 5, maxY: 5 }
      )
    ).toBe(false);
  });
});

describe('isAxisAlignedRect (issue #44)', () => {
  it('test_isAxisAlignedRect_fourCornerRing_isTrue', () => {
    expect(isAxisAlignedRect(rectShape('r', 0, 0, 4, 3).polygon)).toBe(true);
  });

  it('test_isAxisAlignedRect_polygonWithHole_isFalse', () => {
    const shape: EditorShape = {
      id: 'holed',
      polygon: { outerRing: rectRing(0, 0, 6, 6), innerRings: [rectRing(2, 2, 2, 2)] },
      style: { fill: '#3b82f6', opacity: 1, isBorderVisible: true },
    };
    expect(isAxisAlignedRect(shape.polygon)).toBe(false);
  });

  it('test_isAxisAlignedRect_nonRectangularQuad_isFalse', () => {
    // A parallelogram: same 4 vertex count, but not axis-aligned corners.
    const polygon = {
      outerRing: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 6, y: 4 },
        { x: 2, y: 4 },
      ],
      innerRings: [],
    };
    expect(isAxisAlignedRect(polygon)).toBe(false);
  });

  it('test_isAxisAlignedRect_triangle_isFalse', () => {
    const polygon = {
      outerRing: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 2, y: 4 },
      ],
      innerRings: [],
    };
    expect(isAxisAlignedRect(polygon)).toBe(false);
  });

  it('test_isAxisAlignedRect_degenerateZeroArea_isFalse', () => {
    const polygon = {
      outerRing: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 0 },
        { x: 0, y: 0 },
      ],
      innerRings: [],
    };
    expect(isAxisAlignedRect(polygon)).toBe(false);
  });
});

describe('resizeHandlePoint / resizeHandleAtPoint (issue #44)', () => {
  const bounds = { minX: 0, minY: 0, maxX: 4, maxY: 6 };

  it('test_resizeHandlePoint_everyKind_matchesItsCornerOrEdgeMidpoint', () => {
    expect(resizeHandlePoint(bounds, 'nw')).toEqual({ x: 0, y: 0 });
    expect(resizeHandlePoint(bounds, 'ne')).toEqual({ x: 4, y: 0 });
    expect(resizeHandlePoint(bounds, 'se')).toEqual({ x: 4, y: 6 });
    expect(resizeHandlePoint(bounds, 'sw')).toEqual({ x: 0, y: 6 });
    expect(resizeHandlePoint(bounds, 'n')).toEqual({ x: 2, y: 0 });
    expect(resizeHandlePoint(bounds, 's')).toEqual({ x: 2, y: 6 });
    expect(resizeHandlePoint(bounds, 'e')).toEqual({ x: 4, y: 3 });
    expect(resizeHandlePoint(bounds, 'w')).toEqual({ x: 0, y: 3 });
  });

  it('test_resizeHandleAtPoint_withinRadius_returnsTheHandle', () => {
    expect(resizeHandleAtPoint(bounds, { x: 0.1, y: 0.1 }, 0.35)).toBe('nw');
    expect(resizeHandleAtPoint(bounds, { x: 4, y: 3.1 }, 0.35)).toBe('e');
  });

  it('test_resizeHandleAtPoint_outsideRadius_returnsNull', () => {
    expect(resizeHandleAtPoint(bounds, { x: 2, y: 3 }, 0.35)).toBeNull();
  });

  it('test_resizeHandleAtPoint_nearCorner_prefersCornerOverAdjacentEdge', () => {
    // (0.3, 0.3) is close to both the 'nw' corner (0,0) and, loosely, the 'n'
    // edge midpoint direction — corners must win per RESIZE_HANDLE_KINDS order.
    expect(resizeHandleAtPoint(bounds, { x: 0.3, y: 0.3 }, 1)).toBe('nw');
  });

  it('test_RESIZE_HANDLE_KINDS_hasAllEightHandlesExactlyOnce', () => {
    const unique = new Set(RESIZE_HANDLE_KINDS);
    expect(unique.size).toBe(8);
  });
});

describe('resizeCursorForHandle (issue #44)', () => {
  it('test_resizeCursorForHandle_opposingEdgesAndCorners_shareAnAxis', () => {
    const axisOf = (kind: ResizeHandleKind) => resizeCursorForHandle(kind);
    expect(axisOf('e')).toBe('ew');
    expect(axisOf('w')).toBe('ew');
    expect(axisOf('n')).toBe('ns');
    expect(axisOf('s')).toBe('ns');
    expect(axisOf('nw')).toBe('nwse');
    expect(axisOf('se')).toBe('nwse');
    expect(axisOf('ne')).toBe('nesw');
    expect(axisOf('sw')).toBe('nesw');
  });
});

describe('resizeRectBounds (issue #44)', () => {
  const bounds = { minX: 0, minY: 0, maxX: 5, maxY: 5 };

  it('test_resizeRectBounds_eastHandle_movesOnlyTheEastEdge', () => {
    expect(resizeRectBounds(bounds, 'e', { x: 8, y: 0 })).toEqual({
      minX: 0,
      minY: 0,
      maxX: 8,
      maxY: 5,
    });
  });

  it('test_resizeRectBounds_westHandle_movesOnlyTheWestEdge', () => {
    expect(resizeRectBounds(bounds, 'w', { x: -3, y: 0 })).toEqual({
      minX: -3,
      minY: 0,
      maxX: 5,
      maxY: 5,
    });
  });

  it('test_resizeRectBounds_northHandle_movesOnlyTheNorthEdge', () => {
    expect(resizeRectBounds(bounds, 'n', { x: 0, y: -2 })).toEqual({
      minX: 0,
      minY: -2,
      maxX: 5,
      maxY: 5,
    });
  });

  it('test_resizeRectBounds_southHandle_movesOnlyTheSouthEdge', () => {
    expect(resizeRectBounds(bounds, 's', { x: 0, y: 9 })).toEqual({
      minX: 0,
      minY: 0,
      maxX: 5,
      maxY: 9,
    });
  });

  it('test_resizeRectBounds_cornerHandle_movesBothEdgesOnThatCorner', () => {
    expect(resizeRectBounds(bounds, 'se', { x: 8, y: 9 })).toEqual({
      minX: 0,
      minY: 0,
      maxX: 8,
      maxY: 9,
    });
    expect(resizeRectBounds(bounds, 'nw', { x: -2, y: -3 })).toEqual({
      minX: -2,
      minY: -3,
      maxX: 5,
      maxY: 5,
    });
  });

  it('test_resizeRectBounds_eastPastWest_flipsAndNormalizes', () => {
    // Dragging the east handle to x=-3 crosses the fixed west edge (0): the
    // rectangle flips instead of clamping or inverting.
    expect(resizeRectBounds(bounds, 'e', { x: -3, y: 0 })).toEqual({
      minX: -3,
      minY: 0,
      maxX: 0,
      maxY: 5,
    });
  });

  it('test_resizeRectBounds_westPastEast_flipsAndNormalizes', () => {
    expect(resizeRectBounds(bounds, 'w', { x: 8, y: 0 })).toEqual({
      minX: 5,
      minY: 0,
      maxX: 8,
      maxY: 5,
    });
  });

  it('test_resizeRectBounds_northPastSouth_flipsAndNormalizes', () => {
    // Dragging the north handle to y=9 crosses the fixed south edge (5).
    expect(resizeRectBounds(bounds, 'n', { x: 0, y: 9 })).toEqual({
      minX: 0,
      minY: 5,
      maxX: 5,
      maxY: 9,
    });
  });

  it('test_resizeRectBounds_southPastNorth_flipsAndNormalizes', () => {
    expect(resizeRectBounds(bounds, 's', { x: 0, y: -3 })).toEqual({
      minX: 0,
      minY: -3,
      maxX: 5,
      maxY: 0,
    });
  });

  it('test_resizeRectBounds_cornerHandle_flipsBothAxesIndependently', () => {
    // 'se' dragged up-and-left past both fixed edges (0,0): both axes flip.
    expect(resizeRectBounds(bounds, 'se', { x: -3, y: -2 })).toEqual({
      minX: -3,
      minY: -2,
      maxX: 0,
      maxY: 0,
    });
  });

  it('test_resizeRectBounds_neverShrinksBelowOneCell_evenAtTheFixedEdge', () => {
    expect(resizeRectBounds(bounds, 'e', { x: 0, y: 0 })).toEqual({
      minX: 0,
      minY: 0,
      maxX: 1,
      maxY: 5,
    });
    // Dragging 'w' to the fixed east edge (5) still enforces min 1 cell —
    // the west edge is pushed to 6, one past the fixed edge.
    expect(resizeRectBounds(bounds, 'w', { x: 5, y: 0 })).toEqual({
      minX: 5,
      minY: 0,
      maxX: 6,
      maxY: 5,
    });
  });

  it('test_resizeRectBounds_edgeHandle_leavesTheOtherAxisUntouched', () => {
    const result = resizeRectBounds(bounds, 'e', { x: 8, y: 99 });
    expect(result.minY).toBe(0);
    expect(result.maxY).toBe(5);
  });
});

describe('ringFromRect (issue #44)', () => {
  it('test_ringFromRect_producesFourVerticesInTLTRBRBLOrder', () => {
    expect(ringFromRect({ minX: 1, minY: 2, maxX: 5, maxY: 8 })).toEqual([
      { x: 1, y: 2 },
      { x: 5, y: 2 },
      { x: 5, y: 8 },
      { x: 1, y: 8 },
    ]);
  });
});
