import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  DEFAULT_ANNOTATION_FONT_SIZE,
  SHAPE_FILL_PALETTE,
  type EditorDocument,
  type EditorShape,
  type GridRing,
  type ShapeId,
} from '@gridder/editor-core';

/**
 * Options for {@link createDummyDocument}.
 */
export interface DummyDocumentOptions {
  /** Number of shapes to generate. */
  readonly shapeCount: number;
  /** Grid cells covered by each shape's outer ring (before the hole). */
  readonly cellsPerShape: number;
  /** When true, every shape gets a rectangular hole punched out of it. */
  readonly withHole?: boolean;
  /** When true, every shape gets a name annotation. */
  readonly withName?: boolean;
}

/** Rectangular ring from `(x, y)` spanning `w` x `h` grid cells, closure implicit. */
const rectRing = (x: number, y: number, w: number, h: number): GridRing => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

/**
 * Build a dummy {@link EditorDocument} for performance and rendering tests.
 *
 * Shapes are laid out on a coarse grid of rows/columns so they do not overlap.
 * With `shapeCount: 500` and `cellsPerShape: 100` the document represents about
 * 50,000 grid cells while holding only 500 shapes — the scale ADR-0003 targets.
 */
export const createDummyDocument = (options: DummyDocumentOptions): EditorDocument => {
  const { shapeCount, cellsPerShape, withHole = true, withName = true } = options;

  const side = Math.max(1, Math.round(Math.sqrt(cellsPerShape)));
  const columns = Math.max(1, Math.ceil(Math.sqrt(shapeCount)));
  const gap = 2;
  const stride = side + gap;

  const shapes: Record<ShapeId, EditorShape> = {};
  const zOrder: ShapeId[] = [];

  for (let index = 0; index < shapeCount; index += 1) {
    const id: ShapeId = `shape-${index}`;
    const col = index % columns;
    const row = Math.floor(index / columns);
    const originX = col * stride;
    const originY = row * stride;

    const innerRings: GridRing[] =
      withHole && side >= 3 ? [rectRing(originX + 1, originY + 1, side - 2, side - 2)] : [];

    shapes[id] = {
      id,
      polygon: {
        outerRing: rectRing(originX, originY, side, side),
        innerRings,
      },
      style: {
        fill: SHAPE_FILL_PALETTE[index % SHAPE_FILL_PALETTE.length],
        opacity: 1,
        isBorderVisible: true,
      },
      ...(withName ? { name: `Shape ${index}` } : {}),
    };
    zOrder.push(id);
  }

  const maxRow = Math.ceil(shapeCount / columns);

  return {
    formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
    annotationFontSize: DEFAULT_ANNOTATION_FONT_SIZE,
    shapes,
    zOrder,
    groups: {},
    drawingBounds: {
      mode: 'auto',
      min: { x: 0, y: 0 },
      max: { x: columns * stride, y: maxRow * stride },
    },
  };
};

/**
 * A small hand-built document exercising a concave outer ring and a hole,
 * used by the polygon rendering tests.
 */
export const createConcaveHoleDocument = (): EditorDocument => {
  const outerRing: GridRing = [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 6 },
    { x: 4, y: 6 },
    { x: 4, y: 3 },
    { x: 2, y: 3 },
    { x: 2, y: 6 },
    { x: 0, y: 6 },
  ];
  const innerRing: GridRing = [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 2, y: 2 },
    { x: 1, y: 2 },
  ];

  const shape: EditorShape = {
    id: 'concave-hole',
    polygon: { outerRing, innerRings: [innerRing] },
    style: { fill: SHAPE_FILL_PALETTE[0], opacity: 0.9, isBorderVisible: true },
    name: 'U with hole',
  };

  return {
    formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
    annotationFontSize: DEFAULT_ANNOTATION_FONT_SIZE,
    shapes: { [shape.id]: shape },
    zOrder: [shape.id],
    groups: {},
    drawingBounds: {
      mode: 'auto',
      min: { x: 0, y: 0 },
      max: { x: 6, y: 6 },
    },
  };
};
