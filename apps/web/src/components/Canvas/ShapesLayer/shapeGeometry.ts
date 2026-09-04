import type { GridPoint, GridPolygon, GridRing } from '@gridder/editor-core';

/**
 * A ring converted to a flat `[x0, y0, x1, y1, ...]` pixel-coordinate array,
 * ready to be pushed straight into a Konva 2D context path.
 */
export type PixelRingPath = readonly number[];

/**
 * Axis-aligned bounding box of a polygon, expressed in grid units.
 * `width` / `height` are always >= 0.
 */
export interface GridBoundingBox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Convert a single implicitly-closed ring of grid vertices into a flat array of
 * pixel coordinates. The ring is *not* explicitly closed here; callers issuing
 * a canvas path should call `closePath()` (Konva's `sceneFunc` context) so the
 * last edge back to the first vertex is drawn.
 */
export const ringToPixelPath = (ring: GridRing, gridSize: number): PixelRingPath => {
  const path: number[] = [];
  for (const point of ring) {
    path.push(point.x * gridSize, point.y * gridSize);
  }
  return path;
};

/**
 * Convert every ring of a polygon (outer first, then holes) into pixel paths.
 * The renderer draws the outer ring plus each inner ring into one path and
 * fills with the `evenodd` rule, which punches the holes out.
 */
export const polygonToPixelPaths = (
  polygon: GridPolygon,
  gridSize: number
): readonly PixelRingPath[] => {
  const paths: PixelRingPath[] = [ringToPixelPath(polygon.outerRing, gridSize)];
  for (const innerRing of polygon.innerRings) {
    paths.push(ringToPixelPath(innerRing, gridSize));
  }
  return paths;
};

const boxFromRing = (ring: GridRing): GridBoundingBox | null => {
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
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};

/**
 * Bounding box of a polygon in grid units. Holes never extend past the outer
 * ring, so only the outer ring is considered. Returns a zero-size box at the
 * origin when the outer ring is empty (an invalid shape the model rejects, but
 * the renderer stays defensive).
 */
export const polygonBoundingBox = (polygon: GridPolygon): GridBoundingBox => {
  return (
    boxFromRing(polygon.outerRing) ?? {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      height: 0,
    }
  );
};

/**
 * Centre point of a polygon's bounding box in pixel coordinates. Used to anchor
 * the always-on name annotation.
 */
export const polygonCenterPixel = (polygon: GridPolygon, gridSize: number): GridPoint => {
  const box = polygonBoundingBox(polygon);
  return {
    x: (box.minX + box.width / 2) * gridSize,
    y: (box.minY + box.height / 2) * gridSize,
  };
};
