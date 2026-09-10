import type { GridPolygon } from '../model.js';
import { doubleSignedArea } from '../geometry/ring.js';

/**
 * Splits a list of grid polygons so that every entry is a single connected
 * region. A {@link GridPolygon} produced by the boolean Adapter is already one
 * connected region, so this is the identity for well-formed Adapter output; it
 * exists as a pure, renderer-free helper for callers that assemble polygons from
 * other sources (for example a difference result reconstructed from history) and
 * need the ADR-0001 guarantee that a disconnected result becomes independent
 * shapes.
 *
 * Polygons are returned largest-outer-ring first so the order is stable across
 * repeated calls.
 */
export const splitDisjointPolygons = (polygons: readonly GridPolygon[]): readonly GridPolygon[] => {
  const flattened = polygons.map((polygon) => ({
    outerRing: polygon.outerRing,
    innerRings: polygon.innerRings.map((ring) => ring),
  }));

  return flattened.sort(
    (first, second) =>
      Math.abs(doubleSignedArea(second.outerRing)) - Math.abs(doubleSignedArea(first.outerRing))
  );
};

/**
 * True when the polygon encloses at least one hole. ADR-0001 keeps a shape that
 * only gained a hole as a single polygon with inner rings, in contrast to a
 * disconnected result that is split by {@link splitDisjointPolygons}.
 */
export const hasHole = (polygon: GridPolygon): boolean => polygon.innerRings.length > 0;
