import { describe, expect, it } from 'vitest';

import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  DEFAULT_ANNOTATION_FONT_SIZE,
  type EditorDocument,
  type EditorShape,
} from '../model.js';
import { isDocumentValid } from '../validation.js';
import { DocumentHistory } from '../history/index.js';
import { RotateShapesCommand } from './index.js';

const rectangle = (id: string, offsetX: number, width = 4, height = 3): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x: offsetX, y: 0 },
      { x: offsetX + width, y: 0 },
      { x: offsetX + width, y: height },
      { x: offsetX, y: height },
    ],
    innerRings: [],
  },
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
  name: id,
});

/** L-shaped concave hexagon with an odd bounding box (5 x 5) at `offset`. */
const concaveShape = (id: string, offset: { x: number; y: number }): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x: offset.x, y: offset.y },
      { x: offset.x + 5, y: offset.y },
      { x: offset.x + 5, y: offset.y + 2 },
      { x: offset.x + 2, y: offset.y + 2 },
      { x: offset.x + 2, y: offset.y + 5 },
      { x: offset.x, y: offset.y + 5 },
    ],
    innerRings: [],
  },
  style: { fill: '#ef4444', opacity: 1, isBorderVisible: true },
});

/** 5 x 5 square with a 2 x 1 rectangular hole, an odd bounding box on both axes. */
const shapeWithHole = (id: string, offset: { x: number; y: number }): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x: offset.x, y: offset.y },
      { x: offset.x + 5, y: offset.y },
      { x: offset.x + 5, y: offset.y + 5 },
      { x: offset.x, y: offset.y + 5 },
    ],
    innerRings: [
      [
        { x: offset.x + 1, y: offset.y + 1 },
        { x: offset.x + 3, y: offset.y + 1 },
        { x: offset.x + 3, y: offset.y + 2 },
        { x: offset.x + 1, y: offset.y + 2 },
      ],
    ],
  },
  style: { fill: '#22c55e', opacity: 1, isBorderVisible: true },
});

const documentOf = (shapes: readonly EditorShape[]): EditorDocument => ({
  formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
  annotationFontSize: DEFAULT_ANNOTATION_FONT_SIZE,
  shapes: Object.fromEntries(shapes.map((shape) => [shape.id, shape])),
  zOrder: shapes.map((shape) => shape.id),
  groups: {},
  drawingBounds: { mode: 'auto', min: { x: -10, y: -10 }, max: { x: 20, y: 20 } },
});

const allVertices = (document: EditorDocument, shapeId: string) => {
  const polygon = document.shapes[shapeId]?.polygon;
  if (polygon === undefined) {
    throw new Error(`Shape "${shapeId}" missing.`);
  }
  return [polygon.outerRing, ...polygon.innerRings].flat();
};

const expectAllVerticesIntegers = (document: EditorDocument, shapeIds: readonly string[]) => {
  for (const shapeId of shapeIds) {
    for (const point of allVertices(document, shapeId)) {
      expect(Number.isInteger(point.x)).toBe(true);
      expect(Number.isInteger(point.y)).toBe(true);
    }
  }
};

describe('RotateShapesCommand', () => {
  it('test_apply_singleRectangleClockwise_swapsWidthAndHeight', () => {
    const document = documentOf([rectangle('shape-a', 0, 4, 3)]);
    const command = new RotateShapesCommand(['shape-a'], 'cw');

    const rotated = command.apply(document);

    expect(rotated.shapes['shape-a']?.polygon.outerRing).toEqual([
      { x: 3, y: 0 },
      { x: 3, y: 4 },
      { x: 0, y: 4 },
      { x: 0, y: 0 },
    ]);
    expect(isDocumentValid(rotated)).toBe(true);
  });

  it('test_apply_fourTimesClockwise_returnsToOriginal_forRectangle', () => {
    const start = documentOf([rectangle('shape-a', 2, 4, 3)]);
    let current = start;
    for (let i = 0; i < 4; i += 1) {
      current = new RotateShapesCommand(['shape-a'], 'cw').apply(current);
    }
    expect(current).toEqual(start);
  });

  it('test_apply_fourTimesCounterClockwise_returnsToOriginal_forRectangle', () => {
    const start = documentOf([rectangle('shape-a', 2, 4, 3)]);
    let current = start;
    for (let i = 0; i < 4; i += 1) {
      current = new RotateShapesCommand(['shape-a'], 'ccw').apply(current);
    }
    expect(current).toEqual(start);
  });

  it('test_apply_fourTimes_returnsToOriginal_forMultiSelection', () => {
    const start = documentOf([rectangle('shape-a', 0, 4, 3), rectangle('shape-b', 6, 2, 5)]);
    const ids = ['shape-a', 'shape-b'];
    let current = start;
    for (let i = 0; i < 4; i += 1) {
      current = new RotateShapesCommand(ids, 'cw').apply(current);
    }
    expect(current).toEqual(start);
  });

  it('test_apply_concaveShape_keepsIntegerVertices_throughFourRotations', () => {
    const start = documentOf([concaveShape('shape-a', { x: 1, y: 1 })]);
    let current = start;
    for (let i = 0; i < 4; i += 1) {
      current = new RotateShapesCommand(['shape-a'], 'cw').apply(current);
      expectAllVerticesIntegers(current, ['shape-a']);
      expect(isDocumentValid(current)).toBe(true);
    }
    expect(current).toEqual(start);
  });

  it('test_apply_shapeWithHole_rotatesInnerRing_andKeepsIntegerVertices', () => {
    const start = documentOf([shapeWithHole('shape-a', { x: 0, y: 0 })]);
    const rotated = new RotateShapesCommand(['shape-a'], 'cw').apply(start);

    expectAllVerticesIntegers(rotated, ['shape-a']);
    expect(rotated.shapes['shape-a']?.polygon.innerRings).toHaveLength(1);
    expect(isDocumentValid(rotated)).toBe(true);

    let current = start;
    for (let i = 0; i < 4; i += 1) {
      current = new RotateShapesCommand(['shape-a'], 'cw').apply(current);
    }
    expect(current).toEqual(start);
  });

  it('test_apply_oddBoundingBoxMultiSelection_keepsIntegerVertices_throughFourRotations', () => {
    // A 3-wide and a 5-wide shape share a bounding box with an odd width, so
    // the naive center-of-bbox pivot would be a half-integer here.
    const start = documentOf([
      rectangle('shape-a', 0, 3, 4),
      concaveShape('shape-b', { x: 4, y: 0 }),
    ]);
    const ids = ['shape-a', 'shape-b'];
    let current = start;
    for (let i = 0; i < 4; i += 1) {
      current = new RotateShapesCommand(ids, 'ccw').apply(current);
      expectAllVerticesIntegers(current, ids);
    }
    expect(current).toEqual(start);
  });

  it('test_apply_missingShape_throws', () => {
    const document = documentOf([rectangle('shape-a', 0)]);
    expect(() => new RotateShapesCommand(['missing'], 'cw').apply(document)).toThrow();
  });

  it('test_invert_clockwise_returnsCounterClockwiseCommand', () => {
    const document = documentOf([rectangle('shape-a', 0, 4, 3)]);
    const command = new RotateShapesCommand(['shape-a'], 'cw');
    const rotated = command.apply(document);

    const inverse = command.invert();
    expect(inverse.apply(rotated)).toEqual(document);
  });

  it('test_dispatch_undo_redo_documentMatchesEachStep', () => {
    const start = documentOf([rectangle('shape-a', 0, 4, 3), rectangle('shape-b', 8, 2, 6)]);
    const history = new DocumentHistory(start);

    const afterRotate = history.dispatch(new RotateShapesCommand(['shape-a', 'shape-b'], 'cw'));
    expect(history.getDocument()).toBe(afterRotate);
    expect(afterRotate).not.toEqual(start);

    expect(history.undo()).toEqual(start);
    expect(history.canRedo).toBe(true);

    expect(history.redo()).toEqual(afterRotate);
  });
});
