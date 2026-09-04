// `polygon-clipping` 0.15.7 ships only a default export (its ESM build has no
// named exports), so a bundler like Rollup rejects `import { union } from …`.
// Take the default and destructure the operations we use.
import polygonClipping from 'polygon-clipping';

const { difference, union } = polygonClipping;
import type { GridPolygon, GridRing } from '../model.js';
import type { PolygonBooleanEngine } from './engine.js';
import {
  normalizeMultiPolygon,
  type ClosedMultiPolygon,
  type ClosedPolygon,
  type ClosedRing,
} from './normalize.js';

/**
 * The only module in `@gridder/editor-core` that imports `polygon-clipping`.
 * Everything outside this file works with {@link GridPolygon} and the plain
 * `Closed*` data structures in `./normalize`, so the library can be swapped by
 * replacing this file alone (ADR-0001, `editor-stack-research.md`).
 */

/** The subset of `polygon-clipping`'s input type this Adapter passes. */
type LibGeom = Parameters<typeof union>[0];
type LibMultiPolygon = ReturnType<typeof union>;

/** Converts an implicit-closure {@link GridRing} to an explicit-closure ring. */
const toClosedRing = (ring: GridRing): ClosedRing => {
  const closed: [number, number][] = ring.map((point) => [point.x, point.y]);
  const first = closed[0];
  const last = closed[closed.length - 1];
  if (
    first !== undefined &&
    (last === undefined || first[0] !== last[0] || first[1] !== last[1])
  ) {
    closed.push([first[0], first[1]]);
  }
  return closed;
};

const toClosedPolygon = (polygon: GridPolygon): ClosedPolygon => [
  toClosedRing(polygon.outerRing),
  ...polygon.innerRings.map(toClosedRing),
];

/**
 * `polygon-clipping` accepts a Polygon or a MultiPolygon; passing each Gridder
 * shape as its own single-polygon MultiPolygon keeps the call uniform.
 */
const toClosedMultiPolygon = (polygon: GridPolygon): ClosedMultiPolygon => [
  toClosedPolygon(polygon),
];

const asLibGeom = (multiPolygon: ClosedMultiPolygon): LibGeom =>
  multiPolygon as unknown as LibGeom;

const asClosedMultiPolygon = (
  multiPolygon: LibMultiPolygon,
): ClosedMultiPolygon => multiPolygon as unknown as ClosedMultiPolygon;

/**
 * {@link PolygonBooleanEngine} backed by `polygon-clipping`. Construct it with
 * {@link createPolygonClippingEngine}.
 */
class PolygonClippingEngine implements PolygonBooleanEngine {
  union(operands: readonly GridPolygon[]): readonly GridPolygon[] {
    if (operands.length === 0) {
      return [];
    }
    const [first, ...rest] = operands;
    const result = union(
      asLibGeom(toClosedMultiPolygon(first as GridPolygon)),
      ...rest.map((operand) => asLibGeom(toClosedMultiPolygon(operand))),
    );
    return normalizeMultiPolygon(asClosedMultiPolygon(result));
  }

  difference(
    subject: GridPolygon,
    clips: readonly GridPolygon[],
  ): readonly GridPolygon[] {
    const result = difference(
      asLibGeom(toClosedMultiPolygon(subject)),
      ...clips.map((clip) => asLibGeom(toClosedMultiPolygon(clip))),
    );
    return normalizeMultiPolygon(asClosedMultiPolygon(result));
  }
}

/** Returns a {@link PolygonBooleanEngine} implemented with `polygon-clipping`. */
export const createPolygonClippingEngine = (): PolygonBooleanEngine =>
  new PolygonClippingEngine();
