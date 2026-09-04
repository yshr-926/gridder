import { describe, expect, it } from 'vitest';
import { SHAPE_FILL_PALETTE } from '@gridder/editor-core';
import {
  createEmptyDocument,
  createRectShape,
  nextShapeFill,
  rectRingFromGridPoints,
} from './document';

describe('createEmptyDocument', () => {
  it('test_createEmptyDocument_hasNoShapes_andValidBounds', () => {
    const document = createEmptyDocument();
    expect(document.zOrder).toEqual([]);
    expect(Object.keys(document.shapes)).toEqual([]);
    expect(document.drawingBounds.min.x).toBeLessThan(document.drawingBounds.max.x);
    expect(document.drawingBounds.min.y).toBeLessThan(document.drawingBounds.max.y);
  });
});

describe('rectRingFromGridPoints', () => {
  it('test_rectRing_ordersVerticesClockwise_TL_TR_BR_BL', () => {
    const ring = rectRingFromGridPoints({ x: 2, y: 3 }, { x: 6, y: 8 });
    expect(ring).toEqual([
      { x: 2, y: 3 },
      { x: 6, y: 3 },
      { x: 6, y: 8 },
      { x: 2, y: 8 },
    ]);
  });

  it('test_rectRing_normalisesReversedDrag', () => {
    const ring = rectRingFromGridPoints({ x: 6, y: 8 }, { x: 2, y: 3 });
    expect(ring).toEqual([
      { x: 2, y: 3 },
      { x: 6, y: 3 },
      { x: 6, y: 8 },
      { x: 2, y: 8 },
    ]);
  });

  it('test_rectRing_enforcesMinimumOneCell_whenStartEqualsEnd', () => {
    const ring = rectRingFromGridPoints({ x: 4, y: 4 }, { x: 4, y: 4 });
    expect(ring).toEqual([
      { x: 4, y: 4 },
      { x: 5, y: 4 },
      { x: 5, y: 5 },
      { x: 4, y: 5 },
    ]);
  });

  it('test_rectRing_snapsFloatCoordinatesToVertices', () => {
    const ring = rectRingFromGridPoints({ x: 2.4, y: 3.6 }, { x: 5.9, y: 7.1 });
    expect(ring).toEqual([
      { x: 2, y: 4 },
      { x: 6, y: 4 },
      { x: 6, y: 7 },
      { x: 2, y: 7 },
    ]);
  });

  it('test_rectRing_returnsNull_forNonFiniteInput', () => {
    expect(
      rectRingFromGridPoints({ x: Number.NaN, y: 0 }, { x: 1, y: 1 })
    ).toBeNull();
  });
});

describe('nextShapeFill', () => {
  it('test_nextShapeFill_walksPaletteInOrder_thenWraps', () => {
    expect(nextShapeFill(0)).toBe(SHAPE_FILL_PALETTE[0]);
    expect(nextShapeFill(1)).toBe(SHAPE_FILL_PALETTE[1]);
    expect(nextShapeFill(SHAPE_FILL_PALETTE.length)).toBe(SHAPE_FILL_PALETTE[0]);
    expect(nextShapeFill(SHAPE_FILL_PALETTE.length + 2)).toBe(SHAPE_FILL_PALETTE[2]);
  });
});

describe('createRectShape', () => {
  it('test_createRectShape_buildsFourVertexPolygon_withRotatingFill', () => {
    const first = createRectShape('s1', { x: 0, y: 0 }, { x: 3, y: 2 }, 0);
    const second = createRectShape('s2', { x: 5, y: 0 }, { x: 8, y: 2 }, 1);

    expect(first?.polygon.outerRing).toHaveLength(4);
    expect(first?.polygon.innerRings).toEqual([]);
    expect(first?.style.fill).toBe(SHAPE_FILL_PALETTE[0]);
    expect(second?.style.fill).toBe(SHAPE_FILL_PALETTE[1]);
    expect(first?.id).toBe('s1');
  });
});
