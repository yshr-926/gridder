import { describe, expect, it } from 'vitest';
import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  type EditorDocument,
  type EditorShape,
  type GridRing,
} from '@gridder/editor-core';
import {
  isPointInPolygon,
  rectContainsRect,
  rectFromPoints,
  shapeAtPoint,
  shapesWithinRegion,
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
