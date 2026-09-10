import type { GridPolygon } from '../model.js';
import { cleanRing } from './ring.js';

/**
 * Normalises a polygon the way the boolean Adapter normalises its results
 * (issue #64): every ring — the outer boundary and every hole — has its
 * duplicate vertices merged and its collinear (straight-through) vertices
 * removed via {@link cleanRing}. Winding and ring order are preserved.
 *
 * This is what lets a vertex edit "return" a shape to a rectangle: an L-shape
 * dragged back into a rectangular outline collapses to exactly 4 vertices, so
 * `isAxisAlignedRect`-style geometric checks recognise it again, and a vertex
 * dropped on top of its neighbour becomes one vertex instead of two.
 *
 * Returns `null` when any ring collapses to fewer than 3 distinct,
 * non-collinear vertices (i.e. it would have zero area) — a hole that
 * disappears is treated the same as an outer ring that disappears, so the
 * caller can reject the edit rather than silently dropping part of the shape.
 */
export const cleanPolygon = (polygon: GridPolygon): GridPolygon | null => {
  const outerRing = cleanRing(polygon.outerRing);
  if (outerRing.length === 0) {
    return null;
  }
  const innerRings = polygon.innerRings.map(cleanRing);
  if (innerRings.some((ring) => ring.length === 0)) {
    return null;
  }
  return { outerRing, innerRings };
};
