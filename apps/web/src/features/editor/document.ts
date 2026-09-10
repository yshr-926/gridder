import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  DEFAULT_ANNOTATION_FONT_SIZE,
  SHAPE_FILL_PALETTE,
  type EditorDocument,
  type EditorShape,
  type GridPoint,
  type GridRing,
  type ShapeFillColor,
  type ShapeStyle,
} from '@gridder/editor-core';

/**
 * App-layer helpers for building the pieces of an {@link EditorDocument} that
 * the direct-manipulation controller needs (issue #42). Geometry that ends up
 * in the document still travels through an editor-core Command; these helpers
 * only assemble the shape value handed to `CreateShapeCommand`.
 */

/** An empty sketch: no shapes, an arbitrary but valid auto drawing-bounds box. */
export const createEmptyDocument = (): EditorDocument => ({
  formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
  annotationFontSize: DEFAULT_ANNOTATION_FONT_SIZE,
  shapes: {},
  zOrder: [],
  groups: {},
  drawingBounds: {
    mode: 'auto',
    min: { x: 0, y: 0 },
    max: { x: 1, y: 1 },
  },
});

/** Default style for a freshly created shape; only the fill rotates. */
const DEFAULT_SHAPE_OPACITY = 0.8;

/**
 * Fill colour for the next shape: walk {@link SHAPE_FILL_PALETTE} in order,
 * wrapping around, indexed by how many shapes already exist.
 */
export const nextShapeFill = (existingShapeCount: number): ShapeFillColor => {
  const index =
    ((existingShapeCount % SHAPE_FILL_PALETTE.length) + SHAPE_FILL_PALETTE.length) %
    SHAPE_FILL_PALETTE.length;
  return SHAPE_FILL_PALETTE[index];
};

export const defaultShapeStyle = (existingShapeCount: number): ShapeStyle => ({
  fill: nextShapeFill(existingShapeCount),
  opacity: DEFAULT_SHAPE_OPACITY,
  isBorderVisible: true,
});

/**
 * The axis-aligned rectangle spanned by two grid vertices, as a 4-vertex ring
 * with implicit closure (clockwise in raw `(x, y)` space: TL, TR, BR, BL).
 *
 * The rectangle is snapped to whole grid vertices and forced to a minimum of
 * one cell in each axis, so a click without a drag still produces a valid
 * shape. Returns `null` only when either coordinate is not finite.
 */
export const rectRingFromGridPoints = (start: GridPoint, end: GridPoint): GridRing | null => {
  if (
    !Number.isFinite(start.x) ||
    !Number.isFinite(start.y) ||
    !Number.isFinite(end.x) ||
    !Number.isFinite(end.y)
  ) {
    return null;
  }

  const x0 = Math.round(Math.min(start.x, end.x));
  const y0 = Math.round(Math.min(start.y, end.y));
  let x1 = Math.round(Math.max(start.x, end.x));
  let y1 = Math.round(Math.max(start.y, end.y));

  if (x1 - x0 < 1) {
    x1 = x0 + 1;
  }
  if (y1 - y0 < 1) {
    y1 = y0 + 1;
  }

  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
};

/**
 * Build the {@link EditorShape} for a new rectangle from a drag between two
 * grid vertices. `id` is supplied by the caller so tests stay deterministic.
 * Returns `null` when the rectangle geometry is degenerate.
 */
export const createRectShape = (
  id: string,
  start: GridPoint,
  end: GridPoint,
  existingShapeCount: number
): EditorShape | null => {
  const outerRing = rectRingFromGridPoints(start, end);
  if (outerRing === null) {
    return null;
  }
  return {
    id,
    polygon: { outerRing, innerRings: [] },
    style: defaultShapeStyle(existingShapeCount),
  };
};
