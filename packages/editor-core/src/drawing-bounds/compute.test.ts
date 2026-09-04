import { describe, expect, it } from 'vitest';
import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  type EditorDocument,
  type EditorShape,
} from '../model.js';
import { boundingBoxOfShapes, resolveDrawingBounds } from './compute.js';

const rectangle = (id: string, minX: number, minY: number, maxX: number, maxY: number): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ],
    innerRings: [],
  },
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
});

const baseDocument = (overrides: Partial<EditorDocument> = {}): EditorDocument => ({
  formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
  shapes: {},
  zOrder: [],
  groups: {},
  drawingBounds: { mode: 'auto', min: { x: 0, y: 0 }, max: { x: 1, y: 1 } },
  ...overrides,
});

describe('boundingBoxOfShapes', () => {
  it('test_boundingBoxOfShapes_noShapes_returnsNull', () => {
    expect(boundingBoxOfShapes([])).toBeNull();
  });

  it('test_boundingBoxOfShapes_oneShape_returnsItsBounds', () => {
    const shape = rectangle('a', 2, 3, 6, 5);
    expect(boundingBoxOfShapes([shape])).toEqual({ min: { x: 2, y: 3 }, max: { x: 6, y: 5 } });
  });

  it('test_boundingBoxOfShapes_multipleShapes_returnsUnionBounds', () => {
    const a = rectangle('a', 0, 0, 4, 3);
    const b = rectangle('b', 6, -2, 10, 1);
    expect(boundingBoxOfShapes([a, b])).toEqual({ min: { x: 0, y: -2 }, max: { x: 10, y: 3 } });
  });

  it('test_boundingBoxOfShapes_overlappingShapes_returnsUnionBounds', () => {
    const a = rectangle('a', 0, 0, 5, 5);
    const b = rectangle('b', 2, 2, 8, 8);
    expect(boundingBoxOfShapes([a, b])).toEqual({ min: { x: 0, y: 0 }, max: { x: 8, y: 8 } });
  });

  it('test_boundingBoxOfShapes_shapeEntirelyInsideAnother_isAbsorbed', () => {
    const outer = rectangle('outer', 0, 0, 10, 10);
    const inner = rectangle('inner', 2, 2, 4, 4);
    expect(boundingBoxOfShapes([outer, inner])).toEqual({ min: { x: 0, y: 0 }, max: { x: 10, y: 10 } });
  });
});

describe('resolveDrawingBounds', () => {
  it('test_resolveDrawingBounds_manualMode_returnsStoredRectangle_ignoringShapes', () => {
    const document = baseDocument({
      shapes: { a: rectangle('a', 0, 0, 3, 3) },
      zOrder: ['a'],
      drawingBounds: { mode: 'manual', min: { x: -5, y: -5 }, max: { x: 20, y: 20 } },
    });
    expect(resolveDrawingBounds(document)).toEqual({ min: { x: -5, y: -5 }, max: { x: 20, y: 20 } });
  });

  it('test_resolveDrawingBounds_autoMode_noShapes_returnsNull', () => {
    const document = baseDocument({ drawingBounds: { mode: 'auto', min: { x: 0, y: 0 }, max: { x: 1, y: 1 } } });
    expect(resolveDrawingBounds(document)).toBeNull();
  });

  it('test_resolveDrawingBounds_autoMode_withShapes_returnsLiveBoundingBox_ignoringStoredRectangle', () => {
    const document = baseDocument({
      shapes: { a: rectangle('a', 1, 1, 5, 4) },
      zOrder: ['a'],
      // Stale value from a previous manual edit; auto mode must not read it.
      drawingBounds: { mode: 'auto', min: { x: 100, y: 100 }, max: { x: 200, y: 200 } },
    });
    expect(resolveDrawingBounds(document)).toEqual({ min: { x: 1, y: 1 }, max: { x: 5, y: 4 } });
  });

  it('test_resolveDrawingBounds_autoMode_tracksLatestShapeEdits', () => {
    const grown = baseDocument({
      shapes: {
        a: rectangle('a', 0, 0, 2, 2),
        b: rectangle('b', 5, 5, 9, 9),
      },
      zOrder: ['a', 'b'],
      drawingBounds: { mode: 'auto', min: { x: 0, y: 0 }, max: { x: 2, y: 2 } },
    });
    expect(resolveDrawingBounds(grown)).toEqual({ min: { x: 0, y: 0 }, max: { x: 9, y: 9 } });
  });
});
