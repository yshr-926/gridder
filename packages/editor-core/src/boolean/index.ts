/**
 * Polygon boolean Adapter for `@gridder/editor-core`.
 *
 * ADR-0001: adding or removing a cell is a union or difference of the shape's
 * polygon with a unit square. The geometry itself comes from a permissive OSS
 * library (`polygon-clipping`, MIT) reached only through
 * {@link createPolygonClippingEngine}; no other module imports that library, so
 * it can be replaced by swapping `./polygon-clipping-engine`.
 *
 * Winding convention for every polygon this module returns: the outer ring has a
 * positive shoelace area over the stored `(x, y)` grid coordinates
 * (counter-clockwise), and every inner ring has a negative area (clockwise).
 * Closure is implicit, matching {@link GridRing} in the document model.
 */
export type {
  PolygonBooleanEngine,
  NormalizedGridPolygon,
} from './engine.js';
export { createPolygonClippingEngine } from './polygon-clipping-engine.js';
export { splitDisjointPolygons, hasHole } from './split.js';
export {
  normalizeMultiPolygon,
  isIntegerPolygon,
  type ClosedRing,
  type ClosedPolygon,
  type ClosedMultiPolygon,
} from './normalize.js';
export {
  doubleSignedArea,
  areCollinear,
  cleanRing,
  reverseRing,
  orientRing,
  hasIntegerCoordinates,
} from './geometry.js';
