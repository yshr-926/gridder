import type {
  EditorDocument,
  EditorShape,
  GridPoint,
  GridPolygon,
  GridRing,
} from '@gridder/editor-core';

/**
 * Geometric hit-testing for the direct-manipulation controller (issue #42).
 *
 * The controller resolves a pointer to a shape itself rather than leaning on
 * Konva event targets, so the selection rules stay pure and unit-testable and
 * do not depend on the renderer's hit graph.
 */

/** An axis-aligned box in grid units. */
export interface GridRect {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** The box spanned by two grid vertices, normalised so min <= max. */
export const rectFromPoints = (a: GridPoint, b: GridPoint): GridRect => ({
  minX: Math.min(a.x, b.x),
  minY: Math.min(a.y, b.y),
  maxX: Math.max(a.x, b.x),
  maxY: Math.max(a.y, b.y),
});

/** Bounding box of a ring; `null` for an empty ring. */
const ringBounds = (ring: GridRing): GridRect | null => {
  if (ring.length === 0) {
    return null;
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of ring) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
};

/** Bounding box of a polygon's outer ring in grid units. */
export const polygonBounds = (polygon: GridPolygon): GridRect =>
  ringBounds(polygon.outerRing) ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };

/**
 * Even-odd ray cast: is the point strictly inside the implicitly-closed ring?
 * Points exactly on an edge count as inside so a click on a shape's border
 * still selects it.
 */
const isPointInRing = (point: GridPoint, ring: GridRing): boolean => {
  if (ring.length < 3) {
    return false;
  }
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];

    // On-segment check (treats the boundary as inside).
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    const withinX =
      point.x >= Math.min(a.x, b.x) - 1e-9 && point.x <= Math.max(a.x, b.x) + 1e-9;
    const withinY =
      point.y >= Math.min(a.y, b.y) - 1e-9 && point.y <= Math.max(a.y, b.y) + 1e-9;
    if (Math.abs(cross) < 1e-9 && withinX && withinY) {
      return true;
    }

    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
};

/** Is the grid point inside the polygon (outer ring minus any holes)? */
export const isPointInPolygon = (point: GridPoint, polygon: GridPolygon): boolean => {
  if (!isPointInRing(point, polygon.outerRing)) {
    return false;
  }
  for (const hole of polygon.innerRings) {
    if (isPointInRing(point, hole)) {
      return false;
    }
  }
  return true;
};

/**
 * The topmost shape whose polygon contains `point`, or `null`. "Topmost" means
 * last in `zOrder` (drawn frontmost), matching what the user sees.
 */
export const shapeAtPoint = (
  document: EditorDocument,
  point: GridPoint
): EditorShape | null => {
  for (let i = document.zOrder.length - 1; i >= 0; i -= 1) {
    const shape = document.shapes[document.zOrder[i]];
    if (shape !== undefined && isPointInPolygon(point, shape.polygon)) {
      return shape;
    }
  }
  return null;
};

/** True when `inner` lies entirely within `outer` (inclusive edges). */
export const rectContainsRect = (outer: GridRect, inner: GridRect): boolean =>
  inner.minX >= outer.minX &&
  inner.minY >= outer.minY &&
  inner.maxX <= outer.maxX &&
  inner.maxY <= outer.maxY;

/**
 * IDs of every shape whose bounding box is fully contained by `region`
 * (marquee semantics: containment, not intersection — issue #42). Returned in
 * `zOrder` so callers get a stable back-to-front ordering.
 */
export const shapesWithinRegion = (
  document: EditorDocument,
  region: GridRect
): readonly string[] => {
  const ids: string[] = [];
  for (const shapeId of document.zOrder) {
    const shape = document.shapes[shapeId];
    if (shape === undefined) {
      continue;
    }
    if (rectContainsRect(region, polygonBounds(shape.polygon))) {
      ids.push(shapeId);
    }
  }
  return ids;
};
